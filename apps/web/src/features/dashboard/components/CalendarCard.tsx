import { Icon } from './Icon';

export function CalendarCard() {
  return (
    <section className="dash-card calendar-card"><div className="card-heading"><span className="calendar-mark"><Icon name="calendar" /></span><h2>Kalender November</h2></div><div className="calendar-grid">{['M','S','S','R','K','J','S'].map((day, i) => <span className="weekday" key={`${day}${i}`}>{day}</span>)}{Array.from({ length: 35 }, (_, i) => <span className={`calendar-day ${i === 15 ? 'today' : ''} ${i > 29 ? 'muted' : ''}`} key={i}>{i < 30 ? i + 1 : i - 29}</span>)}</div><div className="calendar-caption"><span /> 16 November <span className="calendar-caption-right">Contoh tanggal</span></div></section>
  );
}
