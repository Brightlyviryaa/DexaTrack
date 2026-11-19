import { Outlet } from 'react-router';
import { MobileNavigation } from '../../shared/ui/MobileNavigation';
import { PortalIcon } from './PortalIcon';

const tabs = [
  { to: '/employee', label: 'Beranda', icon: <PortalIcon name="home" /> },
  { to: '/employee/histori', label: 'Histori', icon: <PortalIcon name="history" /> },
  { to: '/employee/pengajuan', label: 'Pengajuan', icon: <PortalIcon name="request" /> },
  { to: '/employee/profil', label: 'Profil', icon: <PortalIcon name="profile" /> },
];

export function EmployeePortalLayout() {
  return (
    <div className="employee-portal">
      <Outlet />
      <MobileNavigation tabs={tabs} label="Navigasi karyawan" variant="employee" />
    </div>
  );
}
