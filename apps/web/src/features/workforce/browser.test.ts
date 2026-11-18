// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPosition } from './browser';
afterEach(() => vi.unstubAllGlobals());
describe('GPS permission handling', () => {
  it.each([[1, 'Izin lokasi ditolak'], [2, 'Lokasi tidak tersedia'], [3, 'GPS belum merespons']])('handles error %s with actionable feedback', async (code, message) => {
    const mock = vi.fn((_success, error) => error({ code }));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: mock } });
    await expect(getPosition()).rejects.toThrow(String(message));
    expect(mock).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
  it('reports unsupported browsers and maps only required location evidence', async () => {
    vi.stubGlobal('navigator', {});
    await expect(getPosition()).rejects.toThrow('GPS tidak tersedia');
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (success: (p: unknown) => void) => success({ coords: { latitude: -6.2, longitude: 106.8, accuracy: 20 }, timestamp: 123 }) } });
    await expect(getPosition()).resolves.toEqual({ latitude: -6.2, longitude: 106.8, accuracy: 20, timestamp: 123 });
  });
});
