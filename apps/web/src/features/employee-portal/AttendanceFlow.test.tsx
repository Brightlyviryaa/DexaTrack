// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttendanceFlow } from './AttendanceFlow';
import { AppProviders } from '../../app/providers/AppProviders';
import { useWorkforce } from '../workforce';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Harness() { const data = useWorkforce(); return <AttendanceFlow kind="in" employeeId={1} data={data} onClose={() => {}} onSuccess={() => {}} />; }
function fakeCamera() {
  const stop = vi.fn();
  const media = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(media) } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  return { stop, media };
}
describe('selfie capture', () => {
  it('shows denial and permits retry', async () => {
    const user = userEvent.setup(); fakeCamera();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    render(<AppProviders><Harness /></AppProviders>);
    await user.click(screen.getByRole('button', { name: 'Aktifkan kamera' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Izin kamera ditolak'));
    expect((screen.getByRole('button', { name: 'Aktifkan kamera' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('waits for video readiness, captures and stops tracks, then supports retake', async () => {
    const user = userEvent.setup(); const { stop } = fakeCamera();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,dGVzdA==');
    const { container, unmount } = render(<AppProviders><Harness /></AppProviders>);
    expect(screen.queryByRole('button', { name: 'Ambil selfie' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Aktifkan kamera' }));
    const video = container.querySelector('video')!;
    Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 } });
    fireEvent.loadedData(video);
    await user.click(screen.getByRole('button', { name: 'Ambil selfie' }));
    expect(screen.getByAltText('Preview selfie absensi')).toBeTruthy();
    expect(stop).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Ambil ulang' }));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    unmount(); expect(stop).toHaveBeenCalledTimes(2);
  });
  it('stops a late camera grant after the flow was closed', async () => {
    const user = userEvent.setup(); const { media, stop } = fakeCamera();
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(r => { resolve = r; }));
    const { unmount } = render(<AppProviders><Harness /></AppProviders>);
    await user.click(screen.getByRole('button', { name: 'Aktifkan kamera' }));
    unmount();
    await act(async () => resolve(media));
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
  });
});
