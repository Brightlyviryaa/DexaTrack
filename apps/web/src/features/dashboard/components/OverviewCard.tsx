import { Icon } from './Icon';

export function OverviewCard() {
  return (
    <section className="dash-card overview-card"><div className="card-heading"><span className="card-icon"><Icon name="check" /></span><h2>Status kehadiran</h2></div><div className="bubble-chart" aria-label="Hadir 112, izin atau cuti 5, sakit 3, belum hadir 8"><div className="bubble bubble-main"><strong>87,5%</strong><span>Hadir</span></div><div className="bubble bubble-leave">5</div><div className="bubble bubble-absent">8</div><div className="bubble bubble-sick">3</div></div><div className="status-list"><div><span><i className="dot present" />Hadir</span><strong>112</strong></div><div><span><i className="dot permission" />Izin / cuti</span><strong>5</strong></div><div><span><i className="dot sick" />Sakit</span><strong>3</strong></div><div><span><i className="dot absent" />Belum hadir</span><strong>8</strong></div></div></section>
  );
}
