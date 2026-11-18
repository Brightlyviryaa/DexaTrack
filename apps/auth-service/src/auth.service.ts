import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { Prisma, Account } from '../generated/client';
import { PrismaService } from './prisma.service';
import { MailService } from './mail.service';
import { digest, email, fail, hashPassword, password, text, token, verifyPassword } from './security';

type Profile = { id: number; employeeNo: string; fullName: string; department: string | null; email: string; isActive: boolean };
type Draft = { fullName: string; department: string };
type Input = Record<string, unknown>;
const publicAccount = (a: Account, profile: Profile | null) => ({ id: a.id, employeeId: a.employeeId, email: a.email, role: a.role, isActive: a.isActive, approval: a.approval, archivedAt: a.archivedAt, syncing: a.syncing, needsActivation: !a.passwordHash, profile });
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService, private readonly mail: MailService, @Inject('EMPLOYEES') private readonly employees: ClientProxy) {}
  private async locked<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM identity_lock WHERE id = 1 FOR UPDATE`;
      return work(tx);
    }, { maxWait: 15000, timeout: 15000 });
  }
  private async rpc<T>(cmd: string, data: unknown): Promise<T> {
    try { return await firstValueFrom(this.employees.send<T>({ cmd }, data).pipe(timeout(5000))); }
    catch (e) {
      const error = e as { status?: number; message?: string };
      return fail(error.status === 409 ? 409 : 503, error.status === 409 ? error.message! : 'Employees service belum tersedia. Operasi dapat dicoba ulang.');
    }
  }
  private enabled(a: Account) { return a.approval === 'APPROVED' && a.isActive && !a.archivedAt && !a.syncing && a.employeeId !== null; }
  private async actor(raw: string | undefined, tx: Prisma.TransactionClient = this.prisma) {
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return fail(401, 'Silakan masuk kembali.');
    const s = await tx.session.findUnique({ where: { tokenHash: digest(raw) }, include: { account: true } });
    if (!s || s.expiresAt <= new Date() || !this.enabled(s.account) || !s.account.passwordHash) return fail(401, 'Silakan masuk kembali.');
    return s.account;
  }
  private async admin(raw: string | undefined, tx: Prisma.TransactionClient = this.prisma) {
    const a = await this.actor(raw, tx);
    if (a.role !== 'HR_ADMIN') return fail(403, 'Akses khusus HR.');
    return a;
  }
  private requestId(value: unknown) {
    const id = text(value, 'ID operasi', 36);
    if (!/^[a-f0-9-]{36}$/i.test(id)) return fail(400, 'ID operasi tidak valid.');
    return id;
  }
  private draft(data: Input, optionalDepartment = false): Draft {
    return { fullName: text(data.fullName, 'Nama lengkap', 150), department: optionalDepartment && !data.department ? '' : text(data.department, 'Departemen', 100) };
  }
  private async profile(a: Account): Promise<Profile | null> {
    if (!a.employeeId) return null;
    return (await this.rpc<Profile[]>('employees.profiles', { ids: [a.employeeId] }))[0] ?? null;
  }
  // The intent is committed before TCP. Retrying after a crash replays the same profile upsert.
  async reconcile(accountId?: number) {
    const operations = await this.prisma.userOperation.findMany({ where: { completedAt: null, ...(accountId ? { accountId } : {}) } });
    for (const operation of operations) {
      await this.locked(async tx => {
        const op = await tx.userOperation.findUnique({ where: { accountId: operation.accountId }, include: { account: true } });
        if (!op || op.completedAt) return;
        const draft = op.profile as Draft;
        const a = op.account;
        const p = await this.rpc<Profile>('employees.sync', { accountId: a.id, employeeId: a.employeeId, ...draft, email: a.email, isActive: a.isActive && a.approval === 'APPROVED' && !a.archivedAt });
        await tx.account.update({ where: { id: a.id }, data: { employeeId: p.id, syncing: false } });
        await tx.userOperation.update({ where: { accountId: a.id }, data: { completedAt: new Date() } });
      });
    }
  }
  private async create(data: Input, approved: boolean, raw?: string, bootstrap = false) {
    const address = email(data.email), draft = this.draft(data, !approved), requestId = this.requestId(data.requestId);
    const hash = approved && !bootstrap ? null : await hashPassword(password(data.password));
    const a = await this.locked(async tx => {
      if (bootstrap) {
        if (await tx.account.count({ where: { role: 'HR_ADMIN', approval: 'APPROVED', isActive: true, archivedAt: null } })) return fail(409, 'Admin sudah tersedia.');
      } else if (approved) await this.admin(raw, tx);
      const previous = await tx.userOperation.findUnique({ where: { requestId }, include: { account: true } });
      if (previous) {
        if (previous.account.email !== address) return fail(409, 'ID operasi sudah digunakan.');
        return previous.account;
      }
      const role = bootstrap ? 'HR_ADMIN' : approved ? this.role(data.role ?? 'EMPLOYEE') : 'EMPLOYEE';
      return tx.account.create({ data: { email: address, passwordHash: hash, role, approval: approved ? 'APPROVED' : 'PENDING', syncing: true,
        operation: { create: { requestId, profile: draft } } } });
    });
    await this.reconcile(a.id);
    if (approved && !bootstrap) await this.issueEmail(a.id, true);
    return { message: approved ? 'Akun dibuat. Tautan aktivasi telah dikirim.' : 'Pendaftaran diterima. Tunggu persetujuan HR.' };
  }
  private role(value: unknown): 'EMPLOYEE' | 'HR_ADMIN' {
    if (value !== 'EMPLOYEE' && value !== 'HR_ADMIN') return fail(400, 'Role tidak valid.');
    return value;
  }
  private async issueEmail(accountId: number, activation: boolean) {
    const raw = token();
    const a = await this.locked(async tx => {
      const a = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
      if (!this.enabled(a)) return fail(409, 'Akun belum aktif atau belum disetujui.');
      await tx.emailToken.deleteMany({ where: { accountId } });
      await tx.emailToken.create({ data: { tokenHash: digest(raw), accountId, purpose: activation ? 'ACTIVATE' : 'RESET', expiresAt: new Date(Date.now() + 30 * 60_000) } });
      return a;
    });
    try { await this.mail.send(a.email, raw, activation); }
    catch { this.logger.error(`SMTP delivery failed for account ${accountId}`); fail(503, 'Email belum terkirim. Gunakan kirim ulang aktivasi/reset password.'); }
  }
  private async mutate(data: Input, raw: string | undefined, action: string) {
    const id = Number(data.id);
    if (!Number.isSafeInteger(id) || id < 1) return fail(400, 'ID akun tidak valid.');
    const requestId = this.requestId(data.requestId);
    // Load the profile before taking the identity lock; stale writes are rejected by updatedAt.
    const before = await this.prisma.account.findUnique({ where: { id } });
    if (!before) return fail(404, 'Akun tidak ditemukan.');
    const profile = await this.profile(before);
    await this.locked(async tx => {
      const actor = await this.admin(raw, tx);
      const a = await tx.account.findUniqueOrThrow({ where: { id } });
      const previous = await tx.userOperation.findUnique({ where: { requestId } });
      if (previous) { if (previous.accountId !== id) return fail(409, 'ID operasi sudah digunakan.'); return; }
      if (a.syncing) return fail(409, 'Sinkronisasi sebelumnya belum selesai. Jalankan rekonsiliasi dahulu.');
      if (a.updatedAt.getTime() !== before.updatedAt.getTime()) return fail(409, 'Data berubah. Muat ulang dan coba lagi.');
      if (a.archivedAt) return fail(409, 'Akun telah diarsipkan.');
      const draft = { fullName: profile?.fullName ?? '', department: profile?.department ?? '' };
      const values: Prisma.AccountUpdateInput = {};
      if (action === 'users.update') {
        if (data.fullName !== undefined) draft.fullName = text(data.fullName, 'Nama lengkap', 150);
        if (data.department !== undefined) draft.department = text(data.department, 'Departemen', 100);
        if (data.email !== undefined) values.email = email(data.email);
        if (data.role !== undefined) values.role = this.role(data.role);
        if (data.isActive !== undefined) { if (typeof data.isActive !== 'boolean') return fail(400, 'Status tidak valid.'); values.isActive = data.isActive; }
      } else if (action === 'users.approve') {
        draft.department = text(data.department, 'Departemen', 100);
        values.approval = 'APPROVED'; values.isActive = true;
      } else if (action === 'users.reject') { values.approval = 'REJECTED'; values.isActive = false; }
      else if (action === 'users.archive') { values.archivedAt = new Date(); values.isActive = false; }
      if (actor.id === id && (values.isActive === false || values.role === 'EMPLOYEE' || values.approval === 'REJECTED')) return fail(409, 'Tidak dapat mencabut akses HR sendiri.');
      if (a.role === 'HR_ADMIN' && a.approval === 'APPROVED' && a.isActive && (values.role === 'EMPLOYEE' || values.isActive === false || values.approval === 'REJECTED')) {
        const admins = await tx.account.count({ where: { role: 'HR_ADMIN', approval: 'APPROVED', isActive: true, archivedAt: null } });
        if (admins <= 1) return fail(409, 'Admin aktif terakhir harus dipertahankan.');
      }
      await tx.account.update({ where: { id }, data: { ...values, syncing: true } });
      await tx.session.deleteMany({ where: { accountId: id } });
      await tx.emailToken.deleteMany({ where: { accountId: id } });
      await tx.userOperation.upsert({ where: { accountId: id }, create: { accountId: id, requestId, profile: draft }, update: { requestId, profile: draft, completedAt: null } });
    });
    await this.reconcile(id);
    return { message: 'Perubahan disimpan.' };
  }
  async bootstrap(data: Input) { return this.create(data, true, undefined, true); }
  async execute(action: string, data: Input, raw?: string): Promise<unknown> {
    try { return await this.dispatch(action, data, raw); }
    catch (error) {
      if (error instanceof RpcException) throw error;
      const code = (error as { code?: string }).code;
      if (code === 'P2002') return fail(409, 'Email atau ID operasi sudah digunakan.');
      if (code === 'P2025') return fail(404, 'Akun tidak ditemukan.');
      this.logger.error(`Auth operation ${action} failed (${code ?? 'internal'})`);
      return fail(503, 'Layanan belum tersedia. Coba lagi.');
    }
  }
  private async dispatch(action: string, data: Input, raw?: string): Promise<unknown> {
    if (action === 'register') return this.create(data, false);
    if (action === 'login') {
      const address = email(data.email);
      const a = await this.prisma.account.findUnique({ where: { email: address } });
      if (!await verifyPassword(data.password, a?.passwordHash ?? null) || !a) return fail(401, 'Email atau password salah.');
      return this.locked(async tx => {
        const fresh = await tx.account.findUniqueOrThrow({ where: { id: a.id } });
        if (fresh.passwordHash !== a.passwordHash) return fail(401, 'Email atau password salah.');
        if (fresh.approval === 'PENDING') return fail(403, 'Akun menunggu persetujuan HR.');
        if (!this.enabled(fresh)) return fail(403, 'Akun belum tersedia. Hubungi HR.');
        const sessionToken = token(), expiresAt = new Date(Date.now() + 7 * 86400_000);
        await tx.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
        await tx.session.create({ data: { tokenHash: digest(sessionToken), accountId: a.id, expiresAt } });
        return { sessionToken, expiresAt };
      });
    }
    if (action === 'logout') {
      if (raw) await this.prisma.session.deleteMany({ where: { tokenHash: digest(raw) } });
      return { message: 'Berhasil keluar.' };
    }
    if (action === 'forgot-password') {
      const a = await this.prisma.account.findUnique({ where: { email: email(data.email) } });
      if (a && this.enabled(a)) { try { await this.issueEmail(a.id, !a.passwordHash); } catch { /* Public response never reveals existence or delivery status. */ } }
      return { message: 'Jika akun memenuhi syarat, tautan akan dikirim ke email kamu.' };
    }
    if (action === 'reset-password' || action === 'activate') {
      const rawToken = text(data.token, 'Token', 64);
      const hash = await hashPassword(password(data.password));
      return this.locked(async tx => {
        const t = await tx.emailToken.findUnique({ where: { tokenHash: digest(rawToken) }, include: { account: true } });
        if (!t || t.expiresAt <= new Date() || t.purpose !== (action === 'activate' ? 'ACTIVATE' : 'RESET') || !this.enabled(t.account)) return fail(400, 'Tautan tidak valid atau sudah kedaluwarsa.');
        await tx.account.update({ where: { id: t.accountId }, data: { passwordHash: hash } });
        await tx.emailToken.deleteMany({ where: { accountId: t.accountId } });
        await tx.session.deleteMany({ where: { accountId: t.accountId } });
        return { message: 'Password tersimpan. Silakan masuk.' };
      });
    }
    const actor = await this.actor(raw);
    if (action === 'me') {
      const p = await this.profile(actor);
      if (!p?.isActive) return fail(403, 'Profil karyawan belum aktif. Hubungi HR.');
      return publicAccount(actor, p);
    }
    if (action === 'change-password') {
      if (!await verifyPassword(data.currentPassword, actor.passwordHash)) return fail(400, 'Password lama salah.');
      const hash = await hashPassword(password(data.password));
      return this.locked(async tx => {
        const fresh = await this.actor(raw, tx);
        if (fresh.passwordHash !== actor.passwordHash) return fail(409, 'Password telah berubah. Masuk kembali.');
        await tx.account.update({ where: { id: actor.id }, data: { passwordHash: hash } });
        await tx.session.deleteMany({ where: { accountId: actor.id } });
        await tx.emailToken.deleteMany({ where: { accountId: actor.id } });
        return { message: 'Password diubah. Silakan masuk kembali.' };
      });
    }
    await this.admin(raw);
    if (action === 'users.list' || action === 'users.get') {
      const id = action === 'users.get' ? Number(data.id) : undefined;
      if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) return fail(400, 'ID tidak valid.');
      const accounts = await this.prisma.account.findMany({ where: { archivedAt: null, ...(id ? { id } : {}) }, orderBy: { id: 'desc' } });
      const profiles = await this.rpc<Profile[]>('employees.profiles', { ids: accounts.flatMap(a => a.employeeId ? [a.employeeId] : []) });
      const rows = accounts.map(a => publicAccount(a, profiles.find(p => p.id === a.employeeId) ?? null));
      if (id && !rows.length) return fail(404, 'Akun tidak ditemukan.');
      return id ? rows[0] : rows;
    }
    if (action === 'users.create') return this.create(data, true, raw);
    if (['users.update', 'users.approve', 'users.reject', 'users.archive'].includes(action)) return this.mutate(data, raw, action);
    if (action === 'users.reset-password') {
      const id = Number(data.id);
      if (!Number.isSafeInteger(id) || id < 1) return fail(400, 'ID tidak valid.');
      const a = await this.prisma.account.findUnique({ where: { id } });
      if (!a) return fail(404, 'Akun tidak ditemukan.');
      await this.issueEmail(a.id, !a.passwordHash);
      return { message: 'Tautan telah dikirim.' };
    }
    return fail(404, 'Operasi tidak ditemukan.');
  }
}
