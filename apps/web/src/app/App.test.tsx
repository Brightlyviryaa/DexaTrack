// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

afterEach(cleanup);

describe('demo session', () => {
  it('shows the dashboard after login and returns to login after logout', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Email'), 'demo@example.com');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(screen.getByRole('heading', { name: 'Kehadiran hari ini' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keluar' }));
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeTruthy();
  });
});
