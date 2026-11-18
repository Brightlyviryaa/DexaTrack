import { NavLink } from 'react-router';
import { Icon } from './Icon';

export function DashboardSidebar({ onLogout }: { onLogout: () => void }) {
  return (
      <aside className="dashboard-sidebar">
        <div className="sidebar-top"><div className="brand"><span>Dexa</span>Track</div></div>
        <nav aria-label="Navigasi utama" className="sidebar-nav">
          <p>Operasional</p>
          <NavLink className={({ isActive }) => isActive ? "nav-active" : undefined} to="/dashboard"><Icon name="grid" /> Dashboard</NavLink>
          <NavLink className={({ isActive }) => isActive ? "nav-active" : undefined} to="/karyawan"><Icon name="users" /> Daftar karyawan</NavLink>
          <NavLink className={({ isActive }) => isActive ? "nav-active" : undefined} to="/kehadiran"><Icon name="calendar" /> Kehadiran</NavLink>
          <NavLink className={({ isActive }) => isActive ? "nav-active" : undefined} to="/pengajuan"><Icon name="briefcase" /> Pengajuan</NavLink>
          <p>Manajemen</p>
          <NavLink className={({ isActive }) => isActive ? "nav-active" : undefined} to="/laporan"><Icon name="file" /> Laporan</NavLink>
          <NavLink className={({ isActive }) => isActive ? "nav-active" : undefined} to="/settings"><Icon name="settings" /> Settings</NavLink>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-demo"><span className="demo-dot" /> Waktu Indonesia Barat</div><button className="logout-button" onClick={onLogout}><Icon name="logout" /> Keluar</button></div>
      </aside>
  );
}
