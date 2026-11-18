// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import type { User } from '../features/auth';
import type { WorkLocation } from '../features/workforce';
import type { WorkPoint } from '../features/workforce/WorkLocationMap';
vi.mock('../features/workforce/WorkLocationMap', () => ({
  default: ({ onSelect, disabled }: { onSelect: (point: WorkPoint) => void; disabled: boolean }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect({ latitude: -6.2, longitude: 106.8 })}>Pilih di peta</button>
  ),
}));
const hr: User = { id: 1, employeeId: 101, email: 'hr@example.com', role: 'HR_ADMIN', isActive: true, approval: 'APPROVED', archivedAt: null, syncing: false, needsActivation: false, profile: { id: 101, employeeNo: 'public-id-101', fullName: 'Admin Test', department: 'HR', email: 'hr@example.com', isActive: true } };
const worker: User = { ...hr, id: 2, employeeId: 202, role: 'EMPLOYEE', email: 'worker@example.com', profile: { ...hr.profile!, id: 202, fullName: 'Worker Test', email: 'worker@example.com' } };
let session: User | null = null;
let accounts: User[] = [];
let unavailable = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function mockAPI({ failFirstSettingsSave = false }: { failFirstSettingsSave?: boolean } = {}) {
  session = null; accounts = [hr, worker]; unavailable = false;
  let settings: (WorkLocation & { workStartTime: string }) | null = null;
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/me') return unavailable ? json({ message: 'Service unavailable' }, 503) : session ? json(session) : json({ message: 'Silakan masuk kembali.' }, 401);
    if (path === '/api/auth/login') { const data = JSON.parse(init?.body as string); if (data.password === 'bad') return json({ message: 'Email atau password salah.' }, 401); session = data.email === 'worker@example.com' ? worker : hr; return json({ message: 'Masuk' }); }
    if (path === '/api/auth/logout') { session = null; return json({ message: 'Keluar' }); }
    if (path === '/api/workforce') {
      const { workStartTime, ...location } = settings ?? { workStartTime: '08:00' };
      return json({ records: [], requests: [], location: settings ? location : null, workStartTime, today: '2026-11-17', employees: accounts.filter(u => u.profile).map(u => u.profile) });
    }
    if (path === '/api/attendance/settings' && init?.method === 'PUT') {
      if (failFirstSettingsSave) {
        failFirstSettingsSave = false;
        return json({ message: 'Penyimpanan sementara gagal.' }, 503);
      }
      settings = JSON.parse(init.body as string);
      return json(settings);
    }
    if (path === '/api/dashboard/summary') return json({ date: '2026-11-17', workStartTime: '08:00', metrics: { employees: 2, present: 0, late: 0, leave: 0, sick: 0, absent: 2, checkedOut: 0 }, rows: [], weekly: [], average: 0, rate: 0, tasks: { pending: 0, missingCheckout: 0, upcomingLeave: 0 } });
    if (path === '/api/users' && (!init?.method || init.method === 'GET')) return json(accounts);
    if (path === '/api/users' && init?.method === 'POST') { const data = JSON.parse(init.body as string); accounts = [...accounts, { ...worker, id: 3, email: data.email, needsActivation: true, profile: { ...worker.profile!, id: 303, fullName: data.fullName, department: data.department } }]; return json({ message: 'Tautan aktivasi telah dikirim.' }, 201); }
    if (path === '/api/auth/register') return json({ message: 'Pendaftaran diterima. Tunggu persetujuan HR.' }, 201);
    if (path === '/api/auth/forgot-password') return json({ message: 'Jika akun memenuhi syarat, tautan akan dikirim ke email kamu.' });
    throw new Error(`Unhandled API: ${init?.method} ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock); return fetchMock;
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function app(path = '/login') { return render(<AppProviders><MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter></AppProviders>); }
describe('authenticated application', () => {
  it('logs in through gateway, removes demo identity controls, and revokes session on logout', async () => {
    const api = mockAPI(), user = userEvent.setup(); app();
    await user.type(await screen.findByLabelText('Email'), 'hr@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct password');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));
    await screen.findByRole('heading', { name: 'Kehadiran hari ini' });
    expect(screen.getByTestId('location').textContent).toBe('/dashboard');
    expect(screen.queryByLabelText('Mode demo')).toBeNull();
    expect(screen.getByText('Admin Test')).toBeTruthy();
    await user.click(within(screen.getByRole('navigation', { name: 'Navigasi utama' })).getByRole('link', { name: 'Daftar karyawan' }));
    await screen.findByText('Worker Test');
    await user.click(screen.getByRole('button', { name: '+ Tambah karyawan' }));
    await user.type(screen.getByLabelText('Nama lengkap'), 'New Worker');
    await user.type(screen.getByLabelText('Email akun'), 'new@example.com');
    await user.type(screen.getByLabelText('Departemen'), 'Engineering');
    await user.click(screen.getByRole('button', { name: /^Tambah karyawan$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('New Worker')).toBeTruthy();
    expect(screen.getByText('Menunggu aktivasi')).toBeTruthy();
    expect(api.mock.calls.some(([path, init]) => path === '/api/users' && init?.method === 'POST' && new Headers(init.headers).has('Idempotency-Key'))).toBe(true);
    await user.click(screen.getAllByRole('button', { name: 'Keluar' })[0]);
    await screen.findByRole('button', { name: 'Masuk' });
    expect(session).toBeNull();
  });
  it.each(['/karyawan', '/settings'])('restores a session on refresh and blocks Employee access to %s', async (path) => {
    const api = mockAPI(); session = worker; app(path);
    await screen.findByRole('button', { name: 'Check-in sekarang' });
    expect(screen.getByTestId('location').textContent).toBe('/employee');
    expect(screen.getByText('Selamat', { exact: false })).toBeTruthy();
    expect(api.mock.calls.some(([path]) => path === '/api/users')).toBe(false);
    expect(screen.queryByText('Data contoh')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
  });
  it('opens Settings from Kehadiran, retries a failed save, and shows saved values after reload', async () => {
    const api = mockAPI({ failFirstSettingsSave: true });
    session = hr;
    const user = userEvent.setup();
    const view = app('/kehadiran');
    await screen.findByText('08:00 WIB');
    expect(screen.queryByRole('button', { name: 'Atur lokasi kerja' })).toBeNull();
    const nav = within(screen.getByRole('navigation', { name: 'Navigasi utama' }));
    await user.click(nav.getByRole('link', { name: 'Settings' }));
    expect(screen.getByTestId('location').textContent).toBe('/settings');
    expect(nav.getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Pilih titik lokasi')).toBeTruthy();
    const name = screen.getByLabelText('Nama lokasi') as HTMLInputElement;
    const hours = screen.getByLabelText('Jam masuk (WIB)') as HTMLInputElement;
    const save = screen.getByRole('button', { name: 'Simpan pengaturan' });
    await user.click(save);
    expect((await screen.findByRole('alert')).textContent).toContain('Pilih titik lokasi kerja di peta');
    expect(api.mock.calls.some(([path]) => path === '/api/attendance/settings')).toBe(false);
    await user.clear(name);
    await user.type(name, 'Kantor Jakarta');
    await user.click(await screen.findByRole('button', { name: 'Pilih di peta' }));
    fireEvent.change(hours, { target: { value: '09:15' } });
    await user.click(save);
    expect((await screen.findByRole('alert')).textContent).toBe('Penyimpanan sementara gagal.');
    expect([name.value, hours.value]).toEqual(['Kantor Jakarta', '09:15']);
    expect(screen.getByText('Titik lokasi dipilih')).toBeTruthy();
    await user.click(save);
    await screen.findByText('Pengaturan berhasil disimpan.');
    const saves = api.mock.calls.filter(([path, init]) => path === '/api/attendance/settings' && init?.method === 'PUT');
    expect(saves.map(([, init]) => JSON.parse(init!.body as string))).toEqual(Array(2).fill({ name: 'Kantor Jakarta', latitude: -6.2, longitude: 106.8, radius: 100, workStartTime: '09:15' }));
    expect(screen.getByText('Titik lokasi dipilih')).toBeTruthy();
    await user.click(nav.getByRole('link', { name: 'Kehadiran' }));
    await screen.findByText('09:15 WIB');
    view.unmount();
    app('/settings');
    const savedName = await screen.findByLabelText('Nama lokasi');
    expect(savedName).toHaveProperty('value', 'Kantor Jakarta');
    expect(screen.getByLabelText('Jam masuk (WIB)')).toHaveProperty('value', '09:15');
  });
  it('allows map selection after GPS denial and uses the new GPS point on retry', async () => {
    const api = mockAPI();
    session = hr;
    const user = userEvent.setup();
    const getCurrentPosition = vi.fn()
      .mockImplementationOnce((_success, error) => error({ code: 1 }))
      .mockImplementationOnce(success => success({ coords: { latitude: 0, longitude: 106.81, accuracy: 8 }, timestamp: Date.now() }));
    vi.stubGlobal('navigator', Object.create(navigator, { geolocation: { value: { getCurrentPosition } } }));
    app('/settings');
    const gps = await screen.findByRole('button', { name: 'Gunakan lokasi saat ini' });
    await user.click(gps);
    expect((await screen.findByRole('alert')).textContent).toContain('Izin lokasi ditolak.');
    await user.click(await screen.findByRole('button', { name: 'Pilih di peta' }));
    expect(screen.getByText('Titik lokasi dipilih')).toBeTruthy();
    await user.click(gps);
    expect(screen.getByLabelText('Nama lokasi')).toHaveProperty('value', 'Kantor DexaTrack');
    expect(screen.queryByLabelText(/Latitude|Longitude/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Simpan pengaturan' }));
    await screen.findByText('Pengaturan berhasil disimpan.');
    const [, init] = api.mock.calls.find(([path]) => path === '/api/attendance/settings')!;
    expect(JSON.parse(init!.body as string)).toMatchObject({ latitude: 0, longitude: 106.81 });
  });
  it('shows login errors without admitting a user', async () => {
    mockAPI(); const user = userEvent.setup(); app();
    await user.type(await screen.findByLabelText('Email'), 'hr@example.com'); await user.type(screen.getByLabelText('Password'), 'bad'); await user.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Email atau password salah.');
    expect(screen.getByTestId('location').textContent).toBe('/login');
  });
  it('keeps transient service failure distinct from an invalid session and supports retry', async () => {
    mockAPI(); session = worker; unavailable = true; const user = userEvent.setup(); app('/employee');
    await screen.findByText('Service unavailable'); expect(screen.queryByLabelText('Password')).toBeNull();
    unavailable = false; await user.click(screen.getByRole('button', { name: 'Coba lagi' })); await screen.findByRole('button', { name: 'Check-in sekarang' });
  });
  it('registers without allowing role selection and displays pending approval', async () => {
    const api = mockAPI(), user = userEvent.setup(); app('/register');
    await user.type(await screen.findByLabelText('Nama lengkap'), 'New Person'); await user.type(screen.getByLabelText('Email'), 'person@example.com');
    await user.type(screen.getByLabelText('Password baru'), 'long password 123'); await user.type(screen.getByLabelText('Konfirmasi password'), 'long password 123');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));
    expect(await screen.findByText('Pendaftaran diterima. Tunggu persetujuan HR.')).toBeTruthy();
    const payload = JSON.parse(api.mock.calls.find(([path]) => path === '/api/auth/register')![1]!.body as string);
    expect(payload.role).toBeUndefined();
  });
});
