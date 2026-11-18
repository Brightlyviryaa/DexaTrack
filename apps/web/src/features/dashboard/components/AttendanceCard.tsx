import { Icon } from './Icon';
import { Link } from 'react-router';
import type { DashboardSummary } from '../api';
import { timeLabel } from '../../workforce';
export function AttendanceCard({ data }: { data: DashboardSummary }) {
  return <section className="dash-card attendance-card">
    <div className="card-heading"><span className="card-icon"><Icon name="users" /></span><h2>Kehadiran hari ini</h2><span className="count-pill">{data.metrics.present}</span><p>Ringkasan aktivitas tim</p></div>
    <div className="table-scroll"><table><thead><tr><th>Karyawan</th><th>Divisi</th><th>Jam masuk</th><th>Status</th></tr></thead><tbody>{data.rows.slice(0, 5).map(e => <tr key={e.id}>
      <td className="attendance-person"><div className="employee"><span className="employee-avatar">{e.fullName.split(' ').slice(0, 2).map(n => n[0]).join('')}</span><span>{e.fullName}<small className="mobile-employee-team">{e.department}</small></span></div></td>
      <td className="attendance-team">{e.department ?? '—'}</td><td className="attendance-time"><span className="mobile-time-label">Masuk </span>{timeLabel(e.checkIn)}</td>
      <td className="attendance-status"><span className={`status ${e.status === 'Terlambat' ? 'late' : e.status === 'Belum hadir' ? 'inactive' : ''}`}>{e.status}</span></td>
    </tr>)}</tbody></table></div>
    {!data.rows.length && <p className="employee-empty">Belum ada karyawan aktif.</p>}
    <div className="card-footer">Menampilkan {Math.min(5, data.rows.length)} dari {data.rows.length} karyawan <span>WIB</span></div>
    <Link className="mobile-card-link" to="/kehadiran">Lihat semua kehadiran <Icon name="arrow" /></Link>
  </section>;
}
