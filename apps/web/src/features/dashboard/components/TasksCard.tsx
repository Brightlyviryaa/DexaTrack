import { Icon } from './Icon';
import { Link } from 'react-router';
import type { DashboardSummary } from '../api';
export function TasksCard({ data }: { data: DashboardSummary }) {
  const tasks = [
    { title: 'Pengajuan menunggu', detail: 'Tinjau keputusan yang diperlukan', count: data.tasks.pending, icon: 'briefcase' as const, path: '/pengajuan?status=Menunggu' },
    { title: 'Belum check-out', detail: 'Absensi dari hari sebelumnya', count: data.tasks.missingCheckout, icon: 'clock' as const, path: '/kehadiran?followup=checkout' },
    { title: 'Cuti mendatang', detail: 'Disetujui, mulai minggu ini', count: data.tasks.upcomingLeave, icon: 'calendar' as const, path: '/pengajuan?upcoming=1' },
  ];
  return <section className="dash-card tasks-card"><div className="card-heading"><span className="card-icon"><Icon name="briefcase" /></span><h2>Tindak lanjut HR</h2><span className="count-pill">{tasks.reduce((sum, t) => sum + t.count, 0)}</span></div><div className="task-list">{tasks.map(t => <Link className="task" to={t.path} key={t.title}><span className="task-icon"><Icon name={t.icon} /></span><div><strong>{t.title}</strong><small>{t.detail}</small></div><span className="task-count">{t.count}</span><span className="mobile-task-arrow"><Icon name="arrow" /></span></Link>)}</div><div className="task-note">Pengajuan dan absensi tersimpan di server.</div></section>;
}
