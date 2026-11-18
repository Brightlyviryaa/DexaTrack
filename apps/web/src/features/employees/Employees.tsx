import { useRef, useState, type FormEvent } from 'react';
import type { User } from '../auth';
import { useUsers, useUserMutation } from './api';
import { EmployeeModal } from './EmployeeModal';
type Form = { fullName: string; email: string; department: string; role: 'EMPLOYEE' | 'HR_ADMIN' };
const empty: Form = { fullName: '', email: '', department: '', role: 'EMPLOYEE' };
export function Employees() {
  const users = useUsers(), mutation = useUserMutation();
  const [search, setSearch] = useState(''), [status, setStatus] = useState('ALL'), [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | 'new' | null>(null), [form, setForm] = useState<Form>(empty);
  const [confirmation, setConfirmation] = useState<{ user: User; action: 'archive' | 'reset-password' | 'reject' | 'approve' | 'status' } | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const operationId = useRef(crypto.randomUUID());
  const busy = mutation.isPending;
  const rows = (users.data ?? []).filter(u => (status === 'ALL' || u.approval === status) && [u.email, u.profile?.fullName, u.profile?.employeeNo, u.profile?.department].some(v => v?.toLowerCase().includes(search.trim().toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(rows.length / 5)), currentPage = Math.min(page, pageCount);
  function start() { setError(''); setNotice(''); operationId.current = crypto.randomUUID(); }
  async function perform(path: string, data: unknown, method: string, close: () => void) {
    setError('');
    try { const result = await mutation.mutateAsync({ path, data, method, requestId: operationId.current }); setNotice(result.message); close(); }
    catch (e) { setError((e as Error).message); }
  }
  function open(user?: User) {
    start(); setEditing(user ?? 'new'); setForm(user ? { fullName: user.profile?.fullName ?? '', email: user.email, department: user.profile?.department ?? '', role: user.role } : empty);
  }
  function save(e: FormEvent, close: () => void) {
    e.preventDefault();
    void perform(editing === 'new' ? '/users' : `/users/${(editing as User).id}`, form, editing === 'new' ? 'POST' : 'PATCH', close);
  }
  const labels = { archive: 'Arsipkan karyawan', 'reset-password': 'Kirim tautan password', reject: 'Tolak pendaftaran', approve: 'Setujui pendaftaran', status: confirmation?.user.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun' };
  return <div className="employees-content">
    {notice && <p className="employee-notice" role="status">{notice}</p>}
    {!editing && !confirmation && error && <p role="alert" className="employee-error">{error}</p>}
    <section className="employee-list" aria-label="Daftar karyawan">
      <div className="employee-toolbar"><label className="employee-search"><span className="sr-only">Cari karyawan</span><input type="search" placeholder="Cari nama, email, ID, atau departemen" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><button className="employee-primary" onClick={() => open()}>+ Tambah karyawan</button></div>
      <label className="employee-filters">Persetujuan<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="ALL">Semua akun</option><option value="PENDING">Menunggu persetujuan</option><option value="APPROVED">Disetujui</option><option value="REJECTED">Ditolak</option></select></label>
      {users.isPending ? <p role="status">Memuat karyawan…</p> : users.isError ? <div role="alert"><p>{users.error.message}</p><button className="employee-secondary" onClick={() => void users.refetch()}>Coba lagi</button></div> : <>
        <div className="employee-table-wrap"><table><thead><tr><th>Karyawan</th><th>ID karyawan</th><th>Departemen</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.slice((currentPage - 1) * 5, currentPage * 5).map(u => <tr key={u.id}>
          <td><div className="employee"><span className="employee-avatar">{(u.profile?.fullName ?? u.email).slice(0, 2).toUpperCase()}</span><span><strong>{u.profile?.fullName ?? 'Profil sedang disiapkan'}</strong><small>{u.email}</small></span></div></td>
          <td data-label="ID karyawan"><span className="employee-id">{u.profile?.employeeNo ?? '—'}</span></td><td data-label="Departemen">{u.profile?.department ?? '—'}</td><td data-label="Role">{u.role === 'HR_ADMIN' ? 'HR' : 'Employee'}</td>
          <td data-label="Status">{u.syncing ? 'Sinkronisasi tertunda' : u.approval === 'PENDING' ? 'Menunggu HR' : u.approval === 'REJECTED' ? 'Ditolak' : u.needsActivation ? 'Menunggu aktivasi' : u.isActive ? 'Aktif' : 'Nonaktif'}</td>
          <td><div className="employee-row-actions"><button onClick={() => open(u)} disabled={busy || u.syncing}>Ubah</button>{(u.approval === 'PENDING' || u.approval === 'REJECTED') && <button onClick={() => { start(); setForm({ ...empty, department: u.profile?.department ?? '' }); setConfirmation({ user: u, action: 'approve' }); }} disabled={busy || u.syncing}>Setujui</button>}
            {u.approval === 'PENDING' && <button onClick={() => { start(); setConfirmation({ user: u, action: 'reject' }); }} disabled={busy || u.syncing}>Tolak</button>}
            {u.approval === 'APPROVED' && <><button onClick={() => { start(); setConfirmation({ user: u, action: 'status' }); }} disabled={busy || u.syncing}>{u.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button><button onClick={() => { start(); setConfirmation({ user: u, action: 'reset-password' }); }} disabled={busy || u.syncing || !u.isActive}>{u.needsActivation ? 'Kirim ulang aktivasi' : 'Reset password'}</button></>}
            <button className="delete-action" onClick={() => { start(); setConfirmation({ user: u, action: 'archive' }); }} disabled={busy || u.syncing}>Arsipkan</button></div></td>
        </tr>)}</tbody></table></div>
        {!rows.length && <p className="employee-empty">Tidak ada karyawan yang cocok dengan filter.</p>}
        <nav className="employee-pagination" aria-label="Halaman karyawan"><span>{rows.length} karyawan</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Halaman sebelumnya">‹</button><span>{currentPage} / {pageCount}</span><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Halaman berikutnya">›</button></div></nav>
      </>}
    </section>
    {editing && <EmployeeModal title={editing === 'new' ? 'Tambah karyawan' : 'Ubah karyawan'} description={editing === 'new' ? 'Tautan aktivasi akan dikirim melalui email.' : 'Perubahan disimpan ke akun dan profil karyawan.'} onClose={() => { if (!busy) setEditing(null); }}>{close => <form className="employee-form" onSubmit={e => save(e, close)}>
      <div><label htmlFor="employee-name">Nama lengkap</label><input id="employee-name" required maxLength={150} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
      <div><label htmlFor="employee-email">Email akun</label><input id="employee-email" type="email" required maxLength={191} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <div><label htmlFor="employee-department">Departemen</label><input id="employee-department" required maxLength={100} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
      <div><label htmlFor="employee-role">Role akun</label><select id="employee-role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Form['role'] })}><option value="EMPLOYEE">Employee</option><option value="HR_ADMIN">HR</option></select></div>
      {error && <p role="alert" className="employee-error">{error}</p>}<div className="employee-form-actions"><button type="button" className="employee-secondary" disabled={busy} onClick={close}>Batal</button><button className="employee-primary" disabled={busy}>{busy ? 'Menyimpan…' : editing === 'new' ? 'Tambah karyawan' : 'Simpan perubahan'}</button></div>
    </form>}</EmployeeModal>}
    {confirmation && <EmployeeModal title={labels[confirmation.action]} description={<>{confirmation.user.profile?.fullName ?? confirmation.user.email}{confirmation.action === 'archive' && ' akan diarsipkan; riwayat tetap tersimpan.'}</>} onClose={() => { if (!busy) setConfirmation(null); }} destructive={confirmation.action === 'archive'}>{close => <form className="employee-form" onSubmit={e => { e.preventDefault(); const { user, action } = confirmation; void perform(`/users/${user.id}${action === 'status' || action === 'archive' ? '' : `/${action}`}`, action === 'status' ? { isActive: !user.isActive } : action === 'approve' ? { department: form.department } : {}, action === 'archive' ? 'DELETE' : action === 'status' ? 'PATCH' : 'POST', close); }}>
      {confirmation.action === 'approve' && <label>Departemen<input required maxLength={100} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></label>}
      {error && <p role="alert" className="employee-error">{error}</p>}<div className="employee-form-actions"><button type="button" className="employee-secondary" disabled={busy} onClick={close}>Batal</button><button className="employee-primary" disabled={busy}>{busy ? 'Memproses…' : labels[confirmation.action]}</button></div>
    </form>}</EmployeeModal>}
  </div>;
}
