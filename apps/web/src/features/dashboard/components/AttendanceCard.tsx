import { Icon } from './Icon';
import { employees } from '../data/demo';

export function AttendanceCard() {
  return (
    <section className="dash-card attendance-card"><div className="card-heading"><span className="card-icon"><Icon name="users" /></span><h2>Kehadiran hari ini</h2><span className="count-pill">112</span><p>Ringkasan aktivitas tim</p></div><div className="table-scroll"><table><thead><tr><th>Karyawan</th><th>Divisi</th><th>Jam masuk</th><th>Status</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.name}><td><div className="employee"><span className={`employee-avatar ${employee.color}`}>{employee.initials}</span><span>{employee.name}</span></div></td><td>{employee.team}</td><td>{employee.time}</td><td><span className={`status ${employee.status === 'Terlambat' ? 'late' : ''}`}>{employee.status}</span></td></tr>)}</tbody></table></div><div className="card-footer">Menampilkan 5 dari 112 kehadiran <span>Data contoh</span></div></section>
  );
}
