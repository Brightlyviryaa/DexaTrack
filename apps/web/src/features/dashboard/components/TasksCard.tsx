import { Icon } from './Icon';
import { tasks } from '../data/demo';

export function TasksCard() {
  return (
    <section className="dash-card tasks-card"><div className="card-heading"><span className="card-icon"><Icon name="briefcase" /></span><h2>Tindak lanjut HR</h2><span className="count-pill">3</span></div><div className="task-list">{tasks.map(task => <div className="task" key={task.title}><span className="task-icon"><Icon name={task.icon} /></span><div><strong>{task.title}</strong><small>{task.detail}</small></div><span className="task-count">{task.count}</span></div>)}</div><div className="task-note">Data contoh untuk gambaran aktivitas HR.</div></section>
  );
}
