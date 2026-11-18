import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Prisma, RequestType } from '../generated/client';
import { PrismaService } from './prisma.service';
import { PhotoStore } from './photo-store';
import { countAttendanceDays, reportRange } from './attendance-report';
import { Actor, actorCheck, dateValue, fail, validDate, validTime, validatePosition, validateProgress, validateTimes, workDate, Location, Position } from './domain';

type Submission = { date: string; kind: 'in' | 'out'; evidence: { photo: string; capturedAt: string; position: Position; location: Location }; progress?: Prisma.InputJsonValue };
const related = { evidence: true, corrections: { orderBy: { decidedAt: 'asc' as const } } };
export const requestTypes = { Cuti: 'LEAVE', Sakit: 'SICK', Izin: 'PERMISSION', 'Koreksi absensi': 'ATTENDANCE_CORRECTION' } as const;
const statuses = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };
const iso = (value: Date | null) => value?.toISOString() ?? null;
const time = (value: Date | null) => value ? new Date(value.getTime() + 7 * 3600000).toISOString().slice(11, 16) : undefined;
type RecordWithEvidence = Prisma.AttendanceGetPayload<{ include: typeof related }>;
function recordView(r: RecordWithEvidence) {
  const proof = (kind: 'CHECK_IN' | 'CHECK_OUT') => {
    const e = r.evidence.find(e => e.eventType === kind);
    return e ? { photo: `/api/attendance/photos/${e.id}`, capturedAt: iso(e.capturedAt), submittedAt: iso(e.submittedAt), position: { latitude: Number(e.latitude), longitude: Number(e.longitude), accuracy: Number(e.accuracyMeters), timestamp: e.positionAt.getTime() }, distance: Number(e.distanceMeters), location: { name: e.locationName, latitude: Number(e.locationLatitude), longitude: Number(e.locationLongitude), radius: Number(e.locationRadiusMeters) } } : undefined;
  };
  return { employeeId: r.employeeId, date: r.workDate.toISOString().slice(0, 10), checkIn: iso(r.checkInAt), checkOut: iso(r.checkOutAt), workStartTime: r.workStartTime, version: r.version, progress: r.progress ?? undefined, inEvidence: proof('CHECK_IN'), outEvidence: proof('CHECK_OUT'), corrections: r.corrections.map(c => ({ requestId: c.requestId, before: { checkIn: iso(c.beforeCheckInAt), checkOut: iso(c.beforeCheckOutAt) }, after: { checkIn: iso(c.afterCheckInAt), checkOut: iso(c.afterCheckOutAt) }, reason: c.reason, decidedAt: iso(c.decidedAt), reviewer: `HR #${c.reviewerAccountId}` })) };
}

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService, private readonly photos: PhotoStore) {}
  async transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }); }
      catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'P2034' && attempt < 3) continue;
        if (code === 'P2002' || code === 'P2034') fail('Data berubah atau transaksi sudah tercatat. Muat ulang dan coba kembali.', 409);
        if (error instanceof Error && !(error instanceof RpcException)) fail('Database absensi belum tersedia. Coba kembali.', 503);
        throw error;
      }
    }
  }
  async attendanceReport(actor: Actor, period: unknown) {
    actorCheck(actor, true);
    const range = reportRange(period);
    const { startDate, endDate } = range;
    if (endDate < startDate) return [];

    return this.transaction(async tx => {
      const checkIns = await tx.attendance.findMany({
        where: { workDate: { gte: startDate, lte: endDate }, checkInAt: { not: null } },
        select: { employeeId: true, workDate: true, checkInAt: true, workStartTime: true },
      });
      const requests = await tx.request.findMany({
        where: {
          status: 'APPROVED',
          type: { in: ['LEAVE', 'SICK', 'PERMISSION'] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { employeeId: true, startDate: true, endDate: true, type: true },
      });
      return countAttendanceDays(checkIns, requests, range);
    });
  }
  async snapshot(actor: Actor) {
    actorCheck(actor);
    return this.transaction(async tx => {
      const where = actor.role === 'HR_ADMIN' ? {} : { employeeId: actor.employeeId };
      const records = await tx.attendance.findMany({ where, include: related, orderBy: { workDate: 'desc' } });
      const requests = await tx.request.findMany({ where, orderBy: { createdAt: 'desc' } });
      const settings = await tx.attendanceSettings.findUnique({ where: { id: 1 }, include: { workLocation: true } });
      const location = settings?.workLocation;
      return { records: records.map(recordView), requests: requests.map(r => ({ id: r.id, employeeId: r.employeeId, type: Object.keys(requestTypes).find(k => requestTypes[k as keyof typeof requestTypes] === r.type), start: r.startDate.toISOString().slice(0, 10), end: r.endDate.toISOString().slice(0, 10), date: `${r.startDate.toISOString().slice(0, 10)} – ${r.endDate.toISOString().slice(0, 10)}`, reason: r.reason, status: statuses[r.status], checkIn: time(r.proposedCheckInAt), checkOut: time(r.proposedCheckOutAt), baseVersion: r.baseVersion ?? undefined, decidedAt: iso(r.decidedAt) ?? undefined, reviewer: r.reviewerAccountId ? `HR #${r.reviewerAccountId}` : undefined })), location: location ? { name: location.name, latitude: Number(location.latitude), longitude: Number(location.longitude), radius: Number(location.radiusMeters) } : null, workStartTime: settings?.workStartTime ?? '08:00', today: workDate() };
    });
  }
  async submit(actor: Actor, data: Submission) {
    actorCheck(actor);
    const now = new Date();
    if (!data || !['in', 'out'].includes(data.kind) || data.date !== workDate(now)) fail('Tanggal sudah berganti atau tidak valid. Mulai absensi kembali.');
    const e = data.evidence;
    if (!e || typeof e.capturedAt !== 'string' || !Number.isFinite(Date.parse(e.capturedAt))) fail('Ambil selfie terlebih dahulu.');
    const captured = new Date(e.capturedAt);
    if (workDate(captured) !== data.date || captured.getTime() > now.getTime() + 5000 || now.getTime() - captured.getTime() > 15 * 60000) fail('Selfie kedaluwarsa. Ambil selfie kembali.');
    if (data.kind === 'out') validateProgress(data.progress);
    const photo = await this.photos.validate(e.photo);
    const key = await this.photos.save(photo);
    try {
      return await this.transaction(async tx => {
        const now = new Date();
        if (data.date !== workDate(now)) fail('Tanggal sudah berganti. Mulai absensi kembali.');
        const settings = await tx.attendanceSettings.findUnique({ where: { id: 1 }, include: { workLocation: true } });
        if (!settings) fail('HR belum menetapkan lokasi kerja.');
        const l = settings.workLocation;
        const location = { name: l.name, latitude: Number(l.latitude), longitude: Number(l.longitude), radius: Number(l.radiusMeters) };
        if (!e.location || Object.keys(location).some(k => location[k as keyof Location] !== e.location[k as keyof Location])) fail('Lokasi kerja berubah. Muat ulang sebelum absensi.', 409);
        const distance = validatePosition(e.position, location, now);
        const where = { employeeId_workDate: { employeeId: actor.employeeId, workDate: dateValue(data.date) } };
        let record = await tx.attendance.findUnique({ where });
        if (data.kind === 'in' && record?.checkInAt) fail('Kamu sudah check-in hari ini.', 409);
        if (data.kind === 'out' && (!record?.checkInAt || record.checkOutAt)) fail('Check-out memerlukan check-in dan hanya dapat dilakukan sekali.', 409);
        if (data.kind === 'out' && record?.checkInAt && now <= record.checkInAt) fail('Check-out harus setelah check-in.');
        const change = data.kind === 'in' ? { checkInAt: now, workStartTime: settings.workStartTime } : { checkOutAt: now, progress: data.progress };
        if (record) {
          const changed = await tx.attendance.updateMany({ where: { id: record.id, version: record.version }, data: { ...change, version: { increment: 1 } } });
          if (changed.count !== 1) fail('Absensi berubah. Muat ulang.', 409);
        } else record = await tx.attendance.create({ data: { employeeId: actor.employeeId, workDate: dateValue(data.date), ...change } });
        await tx.attendanceEvidence.create({ data: { attendanceId: record.id, eventType: data.kind === 'in' ? 'CHECK_IN' : 'CHECK_OUT', photoKey: key, capturedAt: captured, submittedAt: now, positionAt: new Date(e.position.timestamp), latitude: e.position.latitude, longitude: e.position.longitude, accuracyMeters: e.position.accuracy, distanceMeters: distance, locationName: l.name, locationLatitude: l.latitude, locationLongitude: l.longitude, locationRadiusMeters: l.radiusMeters } });
        return { message: 'Absensi tersimpan.' };
      });
    } catch (error) {
      // A failed commit acknowledgement can be ambiguous; keep the file if the database cannot confirm rollback.
      const saved = await this.prisma.attendanceEvidence.findFirst({ where: { photoKey: key } }).catch(() => undefined);
      if (saved === null) await this.photos.remove(key);
      throw error;
    }
  }
  async createRequest(actor: Actor, data: { type: string; start: string; end: string; reason: string; checkIn?: string; checkOut?: string; baseVersion?: number }) {
    actorCheck(actor);
    if (!data || !Object.hasOwn(requestTypes, data.type) || !validDate(data.start) || !validDate(data.end) || data.end < data.start || typeof data.reason !== 'string' || !data.reason.trim() || data.reason.length > 2000) fail('Lengkapi jenis, tanggal, dan alasan (maksimal 2.000 karakter).');
    const type: RequestType = requestTypes[data.type as keyof typeof requestTypes], now = new Date();
    return this.transaction(async tx => {
      let correction = {};
      if (type === 'ATTENDANCE_CORRECTION') {
        if (data.start !== data.end || data.start > workDate(now) || (!data.checkIn && !data.checkOut) || [data.checkIn, data.checkOut].some(t => t !== undefined && t !== '' && !validTime(t)) || !Number.isSafeInteger(data.baseVersion) || data.baseVersion! < 0) fail('Tanggal, waktu, atau versi koreksi tidak valid.');
        const record = await tx.attendance.findUnique({ where: { employeeId_workDate: { employeeId: actor.employeeId, workDate: dateValue(data.start) } } });
        if ((record?.version ?? 0) !== data.baseVersion) fail('Absensi berubah. Muat ulang sebelum mengajukan koreksi.', 409);
        const checkIn = data.checkIn ? new Date(`${data.start}T${data.checkIn}:00+07:00`) : record?.checkInAt ?? null;
        const checkOut = data.checkOut ? new Date(`${data.start}T${data.checkOut}:00+07:00`) : record?.checkOutAt ?? null;
        validateTimes(checkIn, checkOut, now);
        correction = { proposedCheckInAt: checkIn, proposedCheckOutAt: checkOut, baseVersion: data.baseVersion };
      } else if (data.checkIn || data.checkOut || data.baseVersion !== undefined) fail('Waktu koreksi hanya untuk koreksi absensi.');
      await tx.request.create({ data: { employeeId: actor.employeeId, type, startDate: dateValue(data.start), endDate: dateValue(data.end), reason: data.reason.trim(), ...correction } });
      return { message: 'Pengajuan tersimpan.' };
    });
  }
  async decide(actor: Actor, data: { id: number; status: string }) {
    actorCheck(actor, true);
    if (!data || !Number.isSafeInteger(data.id) || data.id < 1 || !['Disetujui', 'Ditolak'].includes(data.status)) fail('Keputusan tidak valid.');
    return this.transaction(async tx => {
      const request = await tx.request.findUnique({ where: { id: data.id } });
      if (!request) fail('Pengajuan tidak ditemukan.', 404);
      if (request.status !== 'PENDING') fail('Pengajuan sudah diproses.', 409);
      const now = new Date();
      if (data.status === 'Disetujui' && request.type === 'ATTENDANCE_CORRECTION') {
        const where = { employeeId_workDate: { employeeId: request.employeeId, workDate: request.startDate } };
        let record = await tx.attendance.findUnique({ where });
        if ((record?.version ?? 0) !== request.baseVersion) fail('Absensi berubah sejak pengajuan. Tolak dan minta karyawan mengajukan ulang.', 409);
        const checkIn = request.proposedCheckInAt, checkOut = request.proposedCheckOutAt;
        validateTimes(checkIn, checkOut, now);
        const before = { beforeCheckInAt: record?.checkInAt ?? null, beforeCheckOutAt: record?.checkOutAt ?? null };
        if (record) {
          const changed = await tx.attendance.updateMany({ where: { id: record.id, version: request.baseVersion! }, data: { checkInAt: checkIn, checkOutAt: checkOut, version: { increment: 1 } } });
          if (changed.count !== 1) fail('Absensi berubah.', 409);
        } else {
          const settings = await tx.attendanceSettings.findUnique({ where: { id: 1 } });
          record = await tx.attendance.create({ data: { employeeId: request.employeeId, workDate: request.startDate, checkInAt: checkIn, checkOutAt: checkOut, workStartTime: settings?.workStartTime ?? '08:00' } });
        }
        await tx.attendanceCorrection.create({ data: { attendanceId: record.id, requestId: request.id, ...before, afterCheckInAt: checkIn!, afterCheckOutAt: checkOut, reason: request.reason, reviewerAccountId: actor.accountId, decidedAt: now } });
      }
      const changed = await tx.request.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: data.status === 'Disetujui' ? 'APPROVED' : 'REJECTED', decidedAt: now, reviewerAccountId: actor.accountId } });
      if (changed.count !== 1) fail('Pengajuan sudah diproses.', 409);
      return { message: 'Keputusan tersimpan.' };
    });
  }
  async photo(actor: Actor, id: number) {
    actorCheck(actor);
    if (!Number.isSafeInteger(id) || id < 1) fail('Foto tidak ditemukan.', 404);
    const evidence = await this.prisma.attendanceEvidence.findUnique({ where: { id }, include: { attendance: { select: { employeeId: true } } } });
    if (!evidence || (actor.role !== 'HR_ADMIN' && evidence.attendance.employeeId !== actor.employeeId)) fail('Foto tidak ditemukan.', 404);
    return this.photos.read(evidence.photoKey);
  }
}
