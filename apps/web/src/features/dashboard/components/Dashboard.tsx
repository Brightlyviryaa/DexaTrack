import { useState } from 'react';
import { Icon } from './Icon';
import { metrics } from '../data/demo';
import { AttendanceCard } from './AttendanceCard';
import { ActivityCard } from './ActivityCard';
import { CalendarCard } from './CalendarCard';
import { OverviewCard } from './OverviewCard';
import { TasksCard } from './TasksCard';

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const date = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top"><div className="brand"><span>Dexa</span>Track</div><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">×</button></div>
        <nav aria-label="Navigasi utama" className="sidebar-nav">
          <p>Operasional</p>
          <a className="nav-active" href="#dashboard" onClick={() => setMenuOpen(false)} aria-current="page"><Icon name="grid" /> Dashboard</a>
          <div className="nav-disabled"><Icon name="users" /> Karyawan <small>Segera</small></div>
          <div className="nav-disabled"><Icon name="calendar" /> Kehadiran <small>Segera</small></div>
          <div className="nav-disabled"><Icon name="briefcase" /> Pengajuan <small>Segera</small></div>
          <p>Manajemen</p>
          <div className="nav-disabled"><Icon name="file" /> Laporan <small>Segera</small></div>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-demo"><span className="demo-dot" /> Data demo</div><button className="logout-button" onClick={onLogout}><Icon name="logout" /> Keluar</button></div>
      </aside>
      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Tutup menu" />}
      <main id="dashboard" className="dashboard-main">
        <header className="dashboard-header"><div className="header-heading"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Buka menu" aria-expanded={menuOpen}><Icon name="menu" /></button><h1>{date}</h1></div><div className="header-right"><span className="demo-badge"><span /> Data demo</span><div className="profile-avatar">AH</div><div className="profile-copy"><strong>Admin HR</strong><small>Administrator</small></div></div></header>
        <div className="dashboard-content">
          <section className="metrics" aria-label="Ringkasan kehadiran">{metrics.map((item) => <article className="metric" key={item.label}><div className="metric-icon"><Icon name={item.icon} /></div><div className="metric-body"><p>{item.label}</p><div className="metric-value">{item.value}<span> orang</span></div></div><span className="metric-tag">{item.tag}</span></article>)}</section>
          <div className="dashboard-grid">
            <AttendanceCard />
            <ActivityCard />
            <CalendarCard />
            <OverviewCard />
            <TasksCard />
          </div>
        </div>
      </main>
    </div>
  );
}
