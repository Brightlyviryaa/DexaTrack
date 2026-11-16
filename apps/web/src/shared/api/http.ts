export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

// All service requests use the gateway; credentials are only configured when auth exists.
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    throw new HttpError(response.status, `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
