import { useState } from 'react';
import { Navigate, Route, Routes, useMatch } from 'react-router';
import { Dashboard } from '../../features/dashboard';
import { asEmployee } from '../../features/employees';
import { useWorkforce, WorkforceStatus } from '../../features/workforce';
import { EmployeePortal, EmployeePortalLayout } from '../../features/employee-portal';
import { useSession, useLogout, AuthPage, type User } from '../../features/auth';
import { LoginPage } from '../../pages/LoginPage';

export function AppRouter() {
  const session = useSession();
  if (session.isPending) return <p className="auth-loading" role="status">Memeriksa sesi…</p>;
  if (session.isError) return <div className="auth-loading" role="alert"><p>{session.error.message}</p><button onClick={() => void session.refetch()}>Coba lagi</button></div>;
  if (session.data) return <SignedIn key={session.data.id} user={session.data} />;
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<AuthPage kind="register" />} />
    <Route path="/forgot-password" element={<AuthPage kind="forgot-password" />} />
    <Route path="/reset-password" element={<AuthPage kind="reset-password" />} />
    <Route path="/activate" element={<AuthPage kind="activate" />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}
function SignedIn({ user }: { user: User }) {
  const hr = user.role === 'HR_ADMIN', home = hr ? '/dashboard' : '/employee';
  const historyRoute = useMatch('/employee/histori');
  const data = useWorkforce(hr || !historyRoute, user.id), logout = useLogout();
  const [error, setError] = useState('');
  const leave = () => { void logout().catch(e => setError((e as Error).message)); };
  const employees = data.employees;
  const hrRoutes = [['/dashboard', 'dashboard'], ['/kehadiran', 'attendance'], ['/karyawan', 'employees'], ['/pengajuan', 'requests'], ['/laporan', 'reports'], ['/settings', 'settings']] as const;
  const employeeRoutes = [{ page: 'home' }, { path: 'histori', page: 'history' }, { path: 'pengajuan', page: 'requests' }, { path: 'profil', page: 'profile' }] as const;
  const employee = !hr && user.profile ? asEmployee(user) : null;
  return <>{error && <p role="alert" className="employee-error">{error}</p>}<Routes>
    <Route path="/account" element={<AuthPage kind="account" />} />
    <Route path="/activate" element={<AuthPage kind="activate" />} />
    <Route path="/reset-password" element={<AuthPage kind="reset-password" />} />
    {hrRoutes.map(([path, page]) => <Route key={path} path={path} element={hr ? <Dashboard page={page} employees={employees} requests={data} onLogout={leave} user={user} /> : <Navigate to={home} replace />} />)}
    {employee && (
      <Route path="/employee" element={<EmployeePortalLayout />}>
        {employeeRoutes.map(route => {
          const { page } = route;
          const content = page === 'history' || data.hasSnapshot
            ? <EmployeePortal key={page} employee={employee} page={page} data={data} onLogout={leave} />
            : <WorkforceStatus data={data} />;
          return 'path' in route
            ? <Route key={page} path={route.path} element={content} />
            : <Route key={page} index element={content} />;
        })}
      </Route>
    )}
    <Route path="*" element={<Navigate to={home} replace />} />
  </Routes></>;
}
