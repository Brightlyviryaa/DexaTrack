import { Icon } from './Icon';
import { AttendanceCard } from './AttendanceCard';
import { ActivityCard } from './ActivityCard';
import { CalendarCard } from './CalendarCard';
import { OverviewCard } from './OverviewCard';
import { TasksCard } from './TasksCard';
import { useDashboard } from '../api';

export function DashboardContent({ date }: { date: string }) {
  const query = useDashboard();
  if (query.error) return <div className="employee-error" role="alert"><p>{query.error.message}</p><button onClick={() => void query.refetch()}>Coba lagi</button></div>;
  if (query.isPending) return <p className="auth-loading" role="status">Memuat ringkasan HR…</p>;
  const data = query.data;
  const metrics = [
    { label: 'Total karyawan', value: data.metrics.employees, icon: 'users' as const, detail: 'Karyawan aktif' },
    { label: 'Hadir hari ini', value: data.metrics.present, icon: 'check' as const, detail: 'Memiliki check-in' },
    { label: 'Terlambat', value: data.metrics.late, icon: 'clock' as const, detail: `Jam masuk ${data.workStartTime} WIB` },
    { label: 'Belum hadir', value: data.metrics.absent, icon: 'calendar' as const, detail: 'Tanpa check-in atau izin disetujui' },
  ];
  return <div className="dashboard-content">
    <section className="mobile-welcome" aria-label="Selamat datang"><p>{date}</p><h2>Halo, Admin HR<span>Bagaimana kabar tim hari ini?</span></h2></section>
    <section className="metrics" aria-label="Ringkasan kehadiran">{metrics.map(item => <article className="metric" key={item.label}><div className="metric-icon"><Icon name={item.icon} /></div><div className="metric-body"><p>{item.label}</p><div className="metric-value">{item.value}<span> orang</span></div><small className="metric-detail">{item.detail}</small></div></article>)}</section>
    <div className="dashboard-grid"><TasksCard data={data} /><AttendanceCard data={data} /><ActivityCard data={data} /><CalendarCard date={data.date} /><OverviewCard data={data} /></div>
  </div>;
}
