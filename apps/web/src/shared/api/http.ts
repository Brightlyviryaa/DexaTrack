export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'HttpError'; }
}
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('X-DexaTrack-Request', '1');
  if (options?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: unknown } | null;
    if (response.status === 401 && path !== '/auth/login' && !options?.signal?.aborted) window.dispatchEvent(new Event('dexatrack:unauthorized'));
    throw new HttpError(response.status, typeof body?.message === 'string' ? body.message : `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
export function send<T>(path: string, data: unknown, method = 'POST', requestId?: string) {
  return request<T>(path, { method, body: JSON.stringify(data), ...(requestId ? { headers: { 'Idempotency-Key': requestId } } : {}) });
}
