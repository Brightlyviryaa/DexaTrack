import { Link } from 'react-router';
import type { Employee } from '../employees';
import type { Workforce } from '../workforce';
import { PortalIcon } from './PortalIcon';

export function EmployeeProfile({ employee, initials, data, onLogout }: {
  employee: Employee;
  initials: string;
  data: Workforce;
  onLogout: () => void;
}) {
  const details = [
    { label: 'Email', value: employee.email },
    { label: 'ID karyawan', value: employee.employeeNo },
    { label: 'Lokasi kerja', value: data.location?.name ?? 'Belum ditetapkan' },
    { label: 'Radius absensi', value: data.location ? `${data.location.radius} meter` : '—' },
  ];

  return (
    <div className="portal-profile">
      <h1>Profil karyawan</h1>
      <section className="portal-profile-identity" aria-labelledby="employee-name">
        <span className="portal-profile-avatar" aria-hidden="true">{initials}</span>
        <div className="portal-profile-name">
          <h2 id="employee-name">{employee.fullName}</h2>
          <p>{employee.department.trim() || 'Departemen belum ditetapkan'}</p>
          <span className="portal-profile-status" data-active={employee.isActive}>
            {employee.isActive ? 'Akun aktif' : 'Akun tidak aktif'}
          </span>
        </div>
      </section>
      <section className="portal-profile-section" aria-labelledby="profile-details">
        <h2 id="profile-details">Detail profil</h2>
        <p className="portal-profile-hint">Data profil dikelola oleh HR.</p>
        {data.error && (
          <div className="portal-error" role="alert">
            <p>Data lokasi kerja belum mutakhir.</p>
            <button type="button" className="portal-link" onClick={() => void data.refetch()}>Coba lagi</button>
          </div>
        )}
        <dl className="portal-profile-details">
          {details.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="portal-profile-section" aria-labelledby="profile-security">
        <h2 id="profile-security">Keamanan akun</h2>
        <div className="portal-profile-actions">
          <Link to="/account" className="portal-profile-action">
            <span className="portal-profile-action-icon"><PortalIcon name="lock" /></span>
            Ubah password
            <span className="portal-profile-action-arrow"><PortalIcon name="chevron" /></span>
          </Link>
          <button type="button" className="portal-profile-action portal-profile-action-danger" onClick={onLogout}>
            <span className="portal-profile-action-icon"><PortalIcon name="logout" /></span>
            Keluar
          </button>
        </div>
      </section>
    </div>
  );
}
