import { Icon } from './Icon';
export function CalendarCard({ date }: { date: string }) {
  const [year, month, today] = date.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T12:00:00+07:00`));
  return <section className="dash-card calendar-card"><div className="card-heading"><span className="calendar-mark"><Icon name="calendar" /></span><h2>Kalender {monthName}</h2></div><div className="calendar-grid">{['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((day, i) => <span className="weekday" key={i}>{day}</span>)}{Array.from({ length: Math.ceil((firstDay + days) / 7) * 7 }, (_, i) => { const day = i - firstDay + 1; return <span className={`calendar-day ${day === today ? 'today' : ''} ${day < 1 || day > days ? 'muted' : ''}`} aria-current={day === today ? 'date' : undefined} key={i}>{day >= 1 && day <= days ? day : ''}</span>; })}</div><div className="calendar-caption"><span />{today} {monthName}<span className="calendar-caption-right">WIB</span></div></section>;
}
