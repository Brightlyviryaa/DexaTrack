import { useState, type FormEvent } from 'react';
import type { Employee } from '../employees';
import { requestTypes, workDate, type RequestType, type Workforce } from '../workforce';
import { Dialog } from '../../shared/ui/Dialog';

export function RequestForm({ employee, data, onClose, onSuccess }: { employee: Employee; data: Workforce; onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<RequestType>('Cuti');
  const [start, setStart] = useState(workDate());
  const [end, setEnd] = useState(workDate());
  const [reason, setReason] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [error, setError] = useState('');
  const override = type === 'Koreksi absensi';
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await data.addRequest({ employeeId: employee.id, name: employee.fullName, department: employee.department, type, start, end: override ? start : end, reason, ...(override ? { checkIn, checkOut } : {}) }); onSuccess(); }
    catch (e) { setError((e as Error).message); }
  }
  return <Dialog title="Buat pengajuan" onClose={onClose}>
    <p className="portal-muted">Pengajuanmu akan ditinjau oleh tim HR.</p>
    <form className="portal-form" onSubmit={submit}>
      <label>Jenis pengajuan<select value={type} onChange={e => { setType(e.target.value as RequestType); setError(''); }}>{requestTypes.map(t => <option key={t} value={t}>{t === 'Koreksi absensi' ? 'Override / Koreksi absensi' : t}</option>)}</select></label>
      <div className="portal-form-grid"><label>{override ? 'Tanggal absensi' : 'Tanggal mulai'}<input type="date" required max={override ? workDate() : undefined} value={start} onChange={e => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} /></label>{!override && <label>Tanggal selesai<input type="date" required min={start} value={end} onChange={e => setEnd(e.target.value)} /></label>}</div>
      {override && <><div className="portal-form-grid"><label>Usulan check-in<input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} /></label><label>Usulan check-out<input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} /></label></div><p className="portal-footnote">Isi waktu yang ingin dikoreksi. Kolom kosong mempertahankan waktu sebelumnya. Waktu mengikuti WIB.</p></>}
      <label>Alasan<textarea required rows={4} maxLength={2000} placeholder={override ? 'Jelaskan absensi yang perlu dikoreksi…' : 'Ceritakan alasan pengajuanmu…'} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <p className="portal-error" role="alert">{error}</p>}
      <button className="portal-primary" type="submit" disabled={data.isSaving}>Kirim pengajuan <span aria-hidden="true">↗</span></button>
    </form>
  </Dialog>;
}
