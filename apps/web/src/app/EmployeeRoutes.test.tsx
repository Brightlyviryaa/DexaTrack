// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(['/dashboard', '/karyawan', '/employee', '/employee/profil'])('requires a real session for %s', async path => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })));
  render(<AppProviders><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></AppProviders>);
  expect(await screen.findByRole('button', { name: 'Masuk' })).toBeTruthy();
  expect(screen.queryByLabelText('Mode demo')).toBeNull();
});
it('shows the generic password recovery result', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => path.endsWith('/me') ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ message: 'Jika akun memenuhi syarat, tautan akan dikirim ke email kamu.' }))));
  render(<AppProviders><MemoryRouter initialEntries={['/forgot-password']}><App /></MemoryRouter></AppProviders>);
  const user = userEvent.setup(); await user.type(await screen.findByLabelText('Email'), 'someone@example.com'); await user.click(screen.getByRole('button', { name: 'Kirim tautan' }));
  expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Jika akun memenuhi syarat, tautan akan dikirim ke email kamu.');
});
