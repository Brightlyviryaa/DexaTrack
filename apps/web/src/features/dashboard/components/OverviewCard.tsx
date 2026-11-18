import { Icon } from './Icon';
import type { DashboardSummary } from '../api';
export function OverviewCard({ data }: { data: DashboardSummary }) {
  const m = data.metrics;
  return <section className="dash-card overview-card"><div className="card-heading"><span className="card-icon"><Icon name="check" /></span><h2>Status kehadiran</h2></div><div className="bubble-chart" aria-label={`Hadir ${m.present}, izin atau cuti ${m.leave}, sakit ${m.sick}, belum hadir ${m.absent}`}><div className="bubble bubble-main"><strong>{data.rate.toLocaleString('id-ID')}%</strong><span>Hadir</span></div><div className="bubble bubble-leave">{m.leave}</div><div className="bubble bubble-absent">{m.absent}</div><div className="bubble bubble-sick">{m.sick}</div></div><div className="status-list">{[['Hadir', m.present, 'present'], ['Izin / cuti', m.leave, 'permission'], ['Sakit', m.sick, 'sick'], ['Belum hadir', m.absent, 'absent']].map(([label, value, color]) => <div key={label}><span><i className={`dot ${color}`} />{label}</span><strong>{value}</strong></div>)}</div></section>;
}
