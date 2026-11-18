import { RpcException } from '@nestjs/microservices';

export type Actor = { accountId: number; employeeId: number; role: 'HR_ADMIN' | 'EMPLOYEE' };
export function fail(message: string, status = 400): never { throw new RpcException({ status, message }); }
export function actorCheck(actor: Actor, hr = false) {
  if (!actor || !Number.isSafeInteger(actor.accountId) || actor.accountId < 1 || !Number.isSafeInteger(actor.employeeId) || actor.employeeId < 1 || !['HR_ADMIN', 'EMPLOYEE'].includes(actor.role)) fail('Sesi tidak valid.', 401);
  if (hr && actor.role !== 'HR_ADMIN') fail('Akses khusus HR.', 403);
}
export function workDate(now = new Date()) { return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10); }
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1000-01-01' && value <= '9999-12-31' && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const dateValue = (date: string) => new Date(`${date}T00:00:00Z`);
export function validateTimes(checkIn: Date | null, checkOut: Date | null, now: Date) {
  if (!checkIn || checkIn > now || (checkOut && (checkOut <= checkIn || checkOut > now))) fail('Check-in wajib tersedia; check-out harus setelah check-in dan waktu tidak boleh di masa depan.');
}
export function validateProgress(value: unknown) {
  let count = 0;
  const children: Record<string, string[]> = { doc: ['paragraph', 'bulletList', 'orderedList'], paragraph: ['text', 'hardBreak'], bulletList: ['listItem'], orderedList: ['listItem'], listItem: ['paragraph', 'bulletList', 'orderedList'], text: [], hardBreak: [] };
  function walk(node: unknown, depth: number, allowed: string[]): string {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 12 || ++count > 12000) fail('Format progress tidak valid.');
    const n = node as Record<string, unknown>;
    if (typeof n.type !== 'string' || !allowed.includes(n.type) || Object.keys(n).some(k => !['type', 'content', 'text', 'marks', 'attrs'].includes(k))) fail('Format progress tidak didukung.');
    if (n.attrs !== undefined && (n.type !== 'orderedList' || !n.attrs || typeof n.attrs !== 'object' || Object.keys(n.attrs).some(k => k !== 'start' && k !== 'type') || !Number.isSafeInteger((n.attrs as { start: number }).start) || (n.attrs as { start: number }).start < 1 || ![undefined, null, '1'].includes((n.attrs as { type?: string }).type))) fail('Atribut progress tidak valid.');
    if (n.marks !== undefined && (n.type !== 'text' || !Array.isArray(n.marks) || n.marks.length > 2 || n.marks.some(m => !m || typeof m !== 'object' || Object.keys(m).length !== 1 || !['bold', 'italic'].includes(m.type)))) fail('Format teks progress tidak valid.');
    if (n.type === 'text') { if (typeof n.text !== 'string' || !n.text || n.content !== undefined) fail('Teks progress tidak valid.'); return n.text; }
    if (n.text !== undefined || (n.content !== undefined && !Array.isArray(n.content)) || (n.type === 'hardBreak' && n.content !== undefined)) fail('Isi progress tidak valid.');
    const content = (n.content ?? []) as unknown[];
    if (['bulletList', 'orderedList', 'listItem'].includes(n.type) && !content.length) fail('Daftar progress tidak valid.');
    return content.map(child => walk(child, depth + 1, children[n.type as string])).join(' ');
  }
  const text = walk(value, 0, ['doc']);
  if (!text.trim() || text.length > 10000 || JSON.stringify(value).length > 150000) fail('Isi progress hari ini, maksimal 10.000 karakter.');
}

export type Position = { latitude: number; longitude: number; accuracy: number; timestamp: number };
export type Location = { name: string; latitude: number; longitude: number; radius: number };
export function validatePosition(p: Position, location: Location, now: Date) {
  if (!p || ![p.latitude, p.longitude, p.accuracy, p.timestamp].every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180 || p.accuracy < 0 || p.timestamp > now.getTime() + 5000 || now.getTime() - p.timestamp > 30000) fail('GPS kedaluwarsa atau tidak valid. Ambil lokasi kembali.');
  if (p.accuracy > location.radius) fail('GPS belum cukup akurat. Coba di area terbuka.');
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(p.latitude - location.latitude) / 2) ** 2 + Math.cos(rad(p.latitude)) * Math.cos(rad(location.latitude)) * Math.sin(rad(p.longitude - location.longitude) / 2) ** 2;
  const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  if (distance > location.radius) fail('Kamu berada di luar radius lokasi kerja.');
  return distance;
}
