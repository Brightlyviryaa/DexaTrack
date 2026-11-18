import { useSearchParams } from 'react-router';
import { useState } from 'react';
import type { Employee } from '../employees';
import { AttendanceDetail } from '../employee-portal';
import { timeLabel, workDate, type AttendanceRecord, type Workforce } from '../workforce';
import { attendanceStatus } from './attendanceStatus';

export function Attendance({ data, employees }: { data: Workforce; employees: Employee[] }) {
  const [params, setParams] = useSearchParams();
  const followup = params.get('followup') === 'checkout';
  const [date, setDate] = useState(workDate());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Semua status');
  const [selected, setSelected] = useState<{ record: AttendanceRecord; name: string } | null>(null);
  const source = followup ? data.records.filter(r => r.date < workDate() && r.checkIn && !r.checkOut).map(record => ({ employee: employees.find(e => e.id === record.employeeId) ?? { id: record.employeeId, fullName: `Karyawan #${record.employeeId}`, department: '' }, record })) : employees.filter(e => e.isActive).map(employee => ({ employee, record: data.records.find(r => r.employeeId === employee.id && r.date === date) }));
  const rows = source.map(({ employee, record }) => {
    const day = record?.date ?? date;
    let status = attendanceStatus(record?.checkIn ? new Date(new Date(record.checkIn).getTime() + 7 * 3600000).toISOString().slice(11, 23) : null, `${record?.workStartTime ?? data.workStartTime}:00.000`);
    if (!record?.checkIn) {
      const approved = data.requests.filter(r => r.employeeId === employee.id && r.status === 'Disetujui' && r.start <= day && r.end >= day);
      if (approved.some(r => r.type === 'Sakit')) status = 'Sakit';
      else if (approved.some(r => r.type === 'Cuti' || r.type === 'Izin')) status = 'Izin / cuti';
    }
    return { employee, record, status };
  });
  const filtered = rows.filter(r => `${r.employee.fullName} ${r.employee.department}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'Semua status' || r.status === filter));
  return <div className="attendance-page">
    {followup && <p className="employee-notice">Absensi hari sebelumnya tanpa check-out. <button onClick={() => setParams({})}>Tampilkan hari ini</button></p>}
    <section className="attendance-summary" aria-label="Ringkasan kehadiran">{[{ label: 'Total karyawan', value: rows.length }, { label: 'Sudah check-in', value: rows.filter(r => r.record?.checkIn).length }, { label: 'Terlambat', value: rows.filter(r => r.status === 'Terlambat').length }, { label: 'Sudah check-out', value: rows.filter(r => r.record?.checkOut).length }].map(s => <div key={s.label}><span>{s.label}</span><strong>{s.value}<small> orang</small></strong></div>)}<div className="attendance-hours"><span>Jam masuk saat ini</span><strong>{data.workStartTime} WIB</strong><small>Kebijakan saat check-in tersimpan</small></div></section>
    <section className="employee-list attendance-list" aria-label="Daftar kehadiran"><div className="attendance-filters"><label className="attendance-search"><span>Cari karyawan</span><input type="search" placeholder="Cari nama atau departemen" value={search} onChange={e => setSearch(e.target.value)} /></label><label><span>Tanggal</span><input type="date" disabled={followup} required value={date} onChange={e => setDate(e.target.value)} /></label><label><span>Status</span><select value={filter} onChange={e => setFilter(e.target.value)}>{['Semua status', 'Tepat waktu', 'Terlambat', 'Belum hadir', 'Izin / cuti', 'Sakit'].map(s => <option key={s}>{s}</option>)}</select></label></div>
    <div className="attendance-table-wrap"><table><thead><tr><th>Karyawan</th><th>Check-in</th><th>Check-out</th><th>Status</th><th><span className="sr-only">Detail</span></th></tr></thead><tbody>{filtered.map(({ employee, record, status }) => <tr key={`${employee.id}-${record?.date ?? date}`}><td><div className="employee"><span className="employee-avatar">{employee.fullName.split(' ').map(n => n[0]).join('')}</span><span><strong>{employee.fullName}</strong><small>{employee.department}{followup && ` · ${record?.date}`}</small></span></div></td><td data-label="Check-in">{timeLabel(record?.checkIn)}</td><td data-label="Check-out">{timeLabel(record?.checkOut)}</td><td data-label="Status"><span className={`status ${status === 'Terlambat' ? 'late' : status === 'Belum hadir' ? 'inactive' : ''}`}>{status}</span>{!!record?.corrections.length && <small className="attendance-corrected">Dikoreksi HR</small>}</td><td><button type="button" className="attendance-detail-button" disabled={!date} onClick={() => setSelected({ name: employee.fullName, record: record ?? { employeeId: employee.id, date, checkIn: null, checkOut: null, corrections: [], version: 0 } })} aria-label={`Lihat detail ${employee.fullName}`}>Lihat detail ↗</button></td></tr>)}</tbody></table></div>
    {!filtered.length && <p className="employee-empty">Tidak ada kehadiran yang cocok dengan filter.</p>}<div className="attendance-list-footer">Menampilkan {filtered.length} karyawan · Waktu dalam WIB</div></section>
    {selected && <AttendanceDetail record={selected.record} name={selected.name} onClose={() => setSelected(null)} />}
  </div>;
}
