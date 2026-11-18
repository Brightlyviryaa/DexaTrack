import { createHash, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { RpcException } from '@nestjs/microservices';
const scrypt = promisify(derive);
export const fail = (status: number, message: string): never => { throw new RpcException({ status, message }); };
export function text(value: unknown, name: string, max: number, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) return fail(400, `${name} tidak valid.`);
  return value.trim();
}
export function email(value: unknown): string {
  const normalized = text(value, 'Email', 191).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return fail(400, 'Email tidak valid.');
  return normalized;
}
export function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) return fail(400, 'Password harus 12–128 karakter.');
  return value;
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(value, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(value: unknown, encoded: string | null) {
  const parts = encoded?.split(':');
  // A fixed dummy derivation keeps nonexistent users on the expensive path too.
  const valid = parts?.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  const candidate = await scrypt(typeof value === 'string' && value.length <= 128 ? value : '', valid ? parts[1] : '0'.repeat(32), 64) as Buffer;
  return !!valid && typeof value === 'string' && value.length <= 128 && timingSafeEqual(candidate, Buffer.from(parts[2], 'hex'));
}
