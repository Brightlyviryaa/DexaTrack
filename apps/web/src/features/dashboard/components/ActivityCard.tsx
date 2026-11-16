import { Icon } from './Icon';

export function ActivityCard() {
  return (
    <section className="dash-card chart-card"><div className="card-heading"><span className="card-icon"><Icon name="activity" /></span><h2>Aktivitas minggu ini</h2></div><div className="chart-stats"><div><strong>108</strong><span>Rata-rata hadir</span></div><div><strong>112/128</strong><span>Hadir hari ini</span></div><div><strong>87,5%</strong><span>Tingkat kehadiran</span></div></div><div className="chart" role="img" aria-label="Kehadiran contoh: Senin 105, Selasa 112, Rabu 98, Kamis 115, Jumat 110 orang"><div className="chart-grid"><span>120</span><span>90</span><span>60</span><span>30</span><span>0</span></div><div className="bars">{[105,112,98,115,110].map((value, index) => <div className="bar-column" key={index}><div className={`bar ${index === 3 ? 'bar-highlight' : ''}`} style={{ height: `${value / 120 * 85}%` }} /><span>{['Sen', 'Sel', 'Rab', 'Kam', 'Jum'][index]}</span></div>)}</div></div><div className="chart-scale" /><div className="chart-legend"><span>Lebih sedikit</span><span>Lebih banyak</span></div></section>
  );
}
