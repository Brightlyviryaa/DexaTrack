import { DashboardSidebar } from './DashboardSidebar';
import { DashboardContent } from './DashboardContent';
import { MobileNavigation } from './MobileNavigation';
import { Link, NavLink } from 'react-router';
import type { User } from '../../auth';
import { Employees, type Employee } from '../../employees';
import { Icon } from './Icon';
import { Attendance } from '../../attendance';
import { Requests } from '../../requests';
import { WorkSettings, WorkforceStatus, type Workforce } from '../../workforce';
import { Reports } from '../../reports';

export function Dashboard({ onLogout, employees, requests, page, user }: { onLogout: () => void; employees: Employee[]; requests: Workforce; user: User; page: 'dashboard' | 'employees' | 'attendance' | 'requests' | 'reports' | 'settings' }) {
  const date = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const title = page === 'dashboard' ? date : page === 'employees' ? 'Daftar karyawan' : page === 'attendance' ? 'Kehadiran' : page === 'requests' ? 'Pengajuan' : page === 'reports' ? 'Laporan' : 'Settings';
  const workforceUnavailable = requests.isPending || requests.error;
  return (
    <div className="dashboard-shell">
      <DashboardSidebar onLogout={onLogout} />
      <main key={page} className="dashboard-main" id="dashboard">
        <header className="dashboard-header">
          <div className="header-heading"><h1 className={page === 'dashboard' ? 'home-title' : undefined}>{page === 'dashboard' ? <><span className="desktop-date">{date}</span><span className="mobile-wordmark">Dexa<span>Track</span></span></> : title}</h1></div>
          <div className="header-right">
            <Link className="profile-avatar" to="/account" aria-label="Keamanan akun">{user.profile?.fullName.slice(0, 2).toUpperCase()}</Link><div className="profile-copy"><strong>{user.profile?.fullName}</strong><small>Administrator</small></div>
            <NavLink className="mobile-settings" to="/settings" aria-label="Settings" title="Settings"><Icon name="settings" /></NavLink>
            <button className="mobile-logout" onClick={onLogout} aria-label="Keluar" title="Keluar"><Icon name="logout" /></button>
          </div>
        </header>
        <div className="dashboard-page">
          {page === 'dashboard' && <DashboardContent date={date} />}
          {page === 'employees' && <Employees />}
          {page === 'attendance' && (workforceUnavailable ? <WorkforceStatus data={requests} /> : <Attendance data={requests} employees={employees} />)}
          {page === 'requests' && (workforceUnavailable ? <WorkforceStatus data={requests} /> : <Requests data={requests} />)}
          {page === 'reports' && <Reports />}
          {page === 'settings' && <WorkSettings data={requests} />}
        </div>
      </main>
      <MobileNavigation />
    </div>
  );
}
