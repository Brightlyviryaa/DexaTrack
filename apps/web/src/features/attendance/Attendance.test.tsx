// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../../app/providers/AppProviders';
import { Attendance } from './Attendance';
import { attendanceStatus } from './attendanceStatus';
import { useWorkforce, workDate, WorkforceStatus } from '../workforce';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Harness() { const data = useWorkforce(); return data.isPending || data.error ? <WorkforceStatus data={data} /> : <Attendance data={data} employees={data.employees} />; }
const employees = [1,2,3].map(id => ({ id, fullName: `Employee ${id}`, department: 'Engineering', isActive: true }));
const snapshot = { records: [{ employeeId: 1, date: workDate(), checkIn: `${workDate()}T08:30:00+07:00`, checkOut: null, workStartTime: '09:00', corrections: [], version: 1 }], requests: [{ employeeId: 2, status: 'Disetujui', type: 'Sakit', start: workDate(), end: workDate() }], employees, location: null, workStartTime: '08:00' };
describe('attendance backend view', () => {
  it('uses configured inclusive start time', () => {
    expect(attendanceStatus('08:00')).toBe('Tepat waktu');
    expect(attendanceStatus('08:01')).toBe('Terlambat');
    expect(attendanceStatus('08:30', '09:00')).toBe('Tepat waktu');
    expect(attendanceStatus(null)).toBe('Belum hadir');
  });
  it('uses stored policy, approved requests and honest missing evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(snapshot))));
    const user = userEvent.setup(); render(<AppProviders><MemoryRouter><Harness /></MemoryRouter></AppProviders>);
    await user.click(await screen.findByRole('button', { name: 'Lihat detail Employee 1' }));
    expect(within(screen.getByRole('dialog')).getAllByText('Foto dan GPS belum tersedia untuk catatan ini.')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Tutup' }));
    await user.selectOptions(screen.getByLabelText('Status'), 'Sakit');
    expect(screen.queryByText('Employee 1')).toBeNull(); expect(screen.getByText('Employee 2')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Status'), 'Terlambat');
    expect(screen.getByText('Tidak ada kehadiran yang cocok dengan filter.')).toBeTruthy();
  });
  it('does not turn a failed query into zero attendance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: 'Attendance unavailable' }), { status: 503 })));
    render(<AppProviders><MemoryRouter><Harness /></MemoryRouter></AppProviders>);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Attendance unavailable'));
    expect(screen.queryByLabelText('Ringkasan kehadiran')).toBeNull();
  });
});
