// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../../../app/providers/AppProviders';
import { DashboardContent } from './DashboardContent';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const empty = { date: '2026-12-01', workStartTime: '09:00', metrics: { employees: 0, present: 0, late: 0, leave: 0, sick: 0, absent: 0, checkedOut: 0 }, rows: [], weekly: [{ date: '2026-11-30', present: 0, elapsed: true }], average: 0, rate: 0, tasks: { pending: 0, missingCheckout: 0, upcomingLeave: 0 } };
function view() { return render(<AppProviders><MemoryRouter><DashboardContent date="Selasa, 1 Desember 2026" /></MemoryRouter></AppProviders>); }
it('shows loading, real zero data and current calendar', async () => {
  let resolve!: (r: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
  view(); expect(screen.getByRole('status').textContent).toBe('Memuat ringkasan HR…');
  resolve(new Response(JSON.stringify(empty)));
  expect(await screen.findByText('Belum ada karyawan aktif.')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Kalender Desember 2026' })).toBeTruthy();
  expect(document.querySelector('[aria-current="date"]')?.textContent).toBe('1');
  expect(screen.queryByText('Data contoh')).toBeNull();
});
it('hides figures on service failure and allows retry', async () => {
  let failed = true;
  vi.stubGlobal('fetch', vi.fn(async () => failed ? new Response(JSON.stringify({ message: 'Service unavailable' }), { status: 503 }) : new Response(JSON.stringify(empty))));
  view(); expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Service unavailable'));
  expect(screen.queryByLabelText('Ringkasan kehadiran')).toBeNull();
  failed = false; await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByLabelText('Ringkasan kehadiran')).toBeTruthy();
});
