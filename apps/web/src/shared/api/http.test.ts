import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, request } from './http';

afterEach(() => vi.unstubAllGlobals());

describe('gateway HTTP client', () => {
  it('requests the gateway and returns JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', undefined);
  });

  it('exposes unsuccessful HTTP status as HttpError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(request('/health')).rejects.toMatchObject({ name: 'HttpError', status: 503 });
    expect(new HttpError(503, 'error')).toBeInstanceOf(Error);
  });
});
