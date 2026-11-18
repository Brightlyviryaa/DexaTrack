import type { JSONContent } from '@tiptap/react';

export type WorkLocation = { name: string; latitude: number; longitude: number; radius: number };
export type PositionFix = { latitude: number; longitude: number; accuracy: number; timestamp: number };
export type Evidence = { photo: string; capturedAt: string; submittedAt: string; position: PositionFix; distance: number; location: WorkLocation };
export type Correction = { requestId: number; before: { checkIn: string | null; checkOut: string | null }; after: { checkIn: string | null; checkOut: string | null }; reason: string; decidedAt: string; reviewer: string };
export type AttendanceRecord = { employeeId: number; date: string; checkIn: string | null; checkOut: string | null; inEvidence?: Evidence; outEvidence?: Evidence; progress?: JSONContent; corrections: Correction[]; version: number; workStartTime?: string; sample?: boolean };
export const requestTypes = ['Cuti', 'Sakit', 'Izin', 'Koreksi absensi'] as const;
export type RequestType = typeof requestTypes[number];
export type RequestStatus = 'Menunggu' | 'Disetujui' | 'Ditolak';
export type RequestItem = { id: number; employeeId: number; name: string; department: string; type: RequestType; date: string; start: string; end: string; reason: string; status: RequestStatus; checkIn?: string; checkOut?: string; baseVersion?: number; decidedAt?: string; reviewer?: string };
export type RequestInput = Pick<RequestItem, 'employeeId' | 'name' | 'department' | 'type' | 'start' | 'end' | 'reason' | 'checkIn' | 'checkOut'>;
export type WorkforceState = { records: AttendanceRecord[]; requests: RequestItem[]; location: WorkLocation | null };

export function workDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function timeLabel(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '—';
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00+07:00`));
}
export function distanceMeters(a: Pick<PositionFix, 'latitude' | 'longitude'>, b: WorkLocation) {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function validateLocation(location: WorkLocation) {
  if (!location.name.trim() || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180 || !Number.isFinite(location.radius) || location.radius <= 0) throw new Error('Isi nama, koordinat yang valid, dan radius lebih dari 0 meter.');
}
export function validateFix(fix: PositionFix, location: WorkLocation, now = Date.now()) {
  validateLocation(location);
  if (![fix.latitude, fix.longitude, fix.accuracy, fix.timestamp].every(Number.isFinite) || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180 || fix.accuracy < 0 || fix.timestamp > now + 5000 || now - fix.timestamp > 30000) throw new Error('Lokasi sudah kedaluwarsa atau tidak valid. Coba ambil GPS lagi.');
  if (fix.accuracy > location.radius) throw new Error(`GPS belum cukup akurat (±${Math.round(fix.accuracy)} m). Coba lagi di area terbuka.`);
  const distance = distanceMeters(fix, location);
  if (distance > location.radius) throw new Error(`Kamu berada ${Math.round(distance)} m dari lokasi kerja, di luar radius ${location.radius} m.`);
  return distance;
}
export function progressText(document?: JSONContent): string {
  return document?.text ?? document?.content?.map(progressText).join(' ') ?? '';
}