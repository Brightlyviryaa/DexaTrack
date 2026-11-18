// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Reports } from './Reports';

const totals = { present: 1, late: 2, leave: 0, sick: 1, absent: null };
const row = { employeeId: 12, fullName: 'Ayu Sari', department: 'Engineering', ...totals };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('keeps filters available through errors and loads the matching rekap', async () => {
  let failed = false;
  const fetchReport = vi.fn(async (path: string) => {
    const params = new URL(path, 'https://dexatrack.test').searchParams;
    const period = params.get('period');
    const search = params.get('q');
    if (period === '2025-02' && !failed) {
      failed = true;
      return json({ message: 'Laporan sementara gagal.' }, 503);
    }
    if (period === '2025-02' && search !== 'Engineering') {
      return json({ period, totals: { ...totals, present: 0, late: 0, sick: 0 }, totalDays: 0, rows: [] });
    }
    return json({ period, totals, totalDays: 4, rows: [row] });
  });
  vi.stubGlobal('fetch', fetchReport);
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><Reports /></QueryClientProvider>);

  expect(screen.getByRole('status').textContent).toContain('Memuat laporan');
  const ayu = await screen.findByRole('row', { name: /Ayu Sari/ });
  expect(within(ayu).getByText('—')).toBeTruthy();
  expect(screen.getByText('Hitungan tidak hadir menunggu kalender kerja.')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Periode'), { target: { value: '2025-02' } });
  expect((await screen.findByRole('alert')).textContent).toContain('Laporan sementara gagal.');
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(await screen.findByText('Tidak ada catatan kehadiran pada periode ini.')).toBeTruthy();

  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Mitra' } });
  expect(await screen.findByText('Tidak ada hasil untuk pencarian ini.')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Engineering' } });
  expect(await screen.findByRole('row', { name: /Ayu Sari/ })).toBeTruthy();
  expect(fetchReport).toHaveBeenLastCalledWith('/api/reports/attendance?period=2025-02&q=Engineering', expect.anything());
});
