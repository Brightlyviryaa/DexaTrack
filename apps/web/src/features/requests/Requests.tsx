import { useSearchParams } from 'react-router';
import { workDate } from '../workforce';
import { useEffect, useRef, useState } from 'react';

import { requestTypes, type RequestItem, type RequestStatus, type Workforce } from '../workforce';

const statusOptions = ['Semua status', 'Menunggu', 'Disetujui', 'Ditolak'];

function Detail({ item, onClose, onDecision, error, busy }: { item: RequestItem; onClose: () => void; onDecision: (status: Exclude<RequestStatus, 'Menunggu'>) => void; error: string; busy: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="employee-modal attendance-modal" aria-labelledby="request-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="attendance-detail-heading"><div><span className="attendance-kicker">DETAIL PENGAJUAN</span><h2 id="request-title">{item.type}</h2><p>{item.name} · {item.department}</p></div><button type="button" className="employee-close" onClick={onClose} aria-label="Tutup detail" disabled={busy}>×</button></div>
    <div className="request-detail-grid"><div><span>Tanggal</span><strong>{item.date}</strong></div><div><span>Status</span><strong className={`request-status status-${item.status.toLowerCase()}`}>{item.status}</strong></div></div>
    <section className="attendance-report"><h3>Alasan pengajuan</h3><p>{item.reason}</p></section>
    {item.type === 'Koreksi absensi' && <p className="request-note">Usulan check-in: {item.checkIn || 'Tetap'} · check-out: {item.checkOut || 'Tetap'} WIB. Persetujuan mengoreksi absensi dan menyimpan waktu aslinya.</p>}
    {error && <p className="portal-error" role="alert">{error}</p>}
    {item.status === 'Menunggu' && <div className="request-actions"><button type="button" className="request-reject" disabled={busy} onClick={() => onDecision('Ditolak')}>Tolak</button><button type="button" className="request-approve" disabled={busy} onClick={() => onDecision('Disetujui')}>Setujui</button></div>}
  </dialog>;
}
export function Requests({ data }: { data: Workforce }) {
  const [params, setParams] = useSearchParams();
  const upcoming = params.get('upcoming') === '1';
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [type, setType] = useState('Semua jenis');
  const status = statusOptions.find(option => option === params.get('status')) ?? 'Semua status';
  const [selected, setSelected] = useState<number | null>(null);
  const deciding = useRef(false);
  const item = data.requests.find((request) => request.id === selected);
  function setStatus(value: string) {
    setParams(current => {
      const next = new URLSearchParams(current);
      if (value === 'Semua status') next.delete('status');
      else next.set('status', value);
      return next;
    });
  }
  async function decide(decision: Exclude<RequestStatus, 'Menunggu'>) {
    if (!item || deciding.current || data.isSaving) return;
    deciding.current = true;
    setError('');
    try {
      await data.decideRequest(item.id, decision);
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      deciding.current = false;
    }
  }
  const today = workDate(), weekEnd = new Date(`${today}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6 - (weekEnd.getUTCDay() + 6) % 7);
  const filtered = data.requests.filter((request) => (!upcoming || (request.type === 'Cuti' && request.status === 'Disetujui' && request.start > today && request.start <= weekEnd.toISOString().slice(0, 10) && data.employees.some(e => e.id === request.employeeId && e.isActive))) && `${request.name} ${request.department}`.toLowerCase().includes(search.trim().toLowerCase()) && (type === 'Semua jenis' || request.type === type) && (status === 'Semua status' || request.status === status));
  return <div className="attendance-page">{upcoming && <p className="employee-notice">Cuti disetujui yang mulai minggu ini. <button onClick={() => setParams({})}>Semua pengajuan</button></p>}<div className="section-intro"><div><span className="attendance-kicker">TINJAU PENGAJUAN</span><h2>Kelola permintaan tim</h2><p>Tinjau izin, sakit, cuti, dan koreksi absensi karyawan.</p></div><div className="intro-counter"><strong>{data.requests.filter((request) => request.status === 'Menunggu').length}</strong><span>perlu ditinjau</span></div></div>
    <section className="employee-list attendance-list" aria-label="Daftar pengajuan"><div className="attendance-filters"><label className="attendance-search"><span>Cari karyawan</span><input type="search" placeholder="Cari nama atau departemen" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span>Jenis pengajuan</span><select value={type} onChange={(event) => setType(event.target.value)}>{['Semua jenis', ...requestTypes].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <div className="attendance-table-wrap"><table><thead><tr><th>Karyawan</th><th>Jenis</th><th>Tanggal</th><th>Status</th><th><span className="sr-only">Detail</span></th></tr></thead><tbody>{filtered.map((request) => <tr key={request.id}><td><div className="employee"><span className="employee-avatar">{request.name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{request.name}</strong><small>{request.department}</small></span></div></td><td data-label="Jenis">{request.type}</td><td data-label="Tanggal">{request.date}</td><td data-label="Status"><span className={`request-status status-${request.status.toLowerCase()}`}>{request.status}</span></td><td><button type="button" className="attendance-detail-button" onClick={() => { setError(''); setSelected(request.id); }} aria-label={`Lihat pengajuan ${request.name}`}>Lihat detail <span aria-hidden="true">↗</span></button></td></tr>)}</tbody></table></div>
    {filtered.length === 0 && <p className="employee-empty">Tidak ada pengajuan yang cocok dengan filter.</p>}<div className="attendance-list-footer">Menampilkan {filtered.length} dari {data.requests.length} pengajuan</div></section>
    {item && <Detail busy={data.isSaving} item={item} onClose={() => { if (!deciding.current) setSelected(null); }} error={error} onDecision={decide} />}</div>;
}
