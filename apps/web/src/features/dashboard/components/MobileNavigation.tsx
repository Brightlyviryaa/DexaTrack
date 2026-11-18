import { NavLink } from 'react-router';
import { Icon } from './Icon';

const tabs = [
  { to: '/dashboard', label: 'Beranda', icon: 'grid' },
  { to: '/karyawan', label: 'Tim', icon: 'users' },
  { to: '/kehadiran', label: 'Absensi', icon: 'calendar' },
  { to: '/pengajuan', label: 'Pengajuan', icon: 'briefcase' },
  { to: '/laporan', label: 'Laporan', icon: 'file' },
] as const;

export function MobileNavigation() {
  return (
    <nav className="mobile-navigation" aria-label="Navigasi mobile">
      <div className="mobile-navigation-tabs">
        <span className="mobile-navigation-indicator" aria-hidden="true" />
        {tabs.map(tab => <NavLink key={tab.to} to={tab.to} end><span className="mobile-tab-icon"><Icon name={tab.icon} /></span><span>{tab.label}</span></NavLink>)}
      </div>
    </nav>
  );
}
