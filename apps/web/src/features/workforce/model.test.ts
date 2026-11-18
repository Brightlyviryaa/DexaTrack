import { describe, expect, it } from 'vitest';
import { distanceMeters, validateFix, validateLocation, workDate } from './model';

const now = new Date('2026-11-16T10:00:00Z');
const location = { name: 'Kantor', latitude: -6.2, longitude: 106.8, radius: 100 };
const fix = { latitude: -6.2, longitude: 106.8, accuracy: 10, timestamp: now.getTime() };

describe('location and WIB boundaries', () => {
  it('uses the Jakarta date across UTC midnight boundaries', () => {
    expect(workDate(new Date('2026-11-16T17:00:00Z'))).toBe('2026-11-17');
    expect(workDate(new Date('2026-11-16T16:59:59Z'))).toBe('2026-11-16');
  });
  it('accepts inside and exact radius, rejects outside, stale and inaccurate fixes', () => {
    expect(validateFix(fix, location, now.getTime())).toBe(0);
    const edge = { ...fix, latitude: fix.latitude + .0005 };
    const radius = distanceMeters(edge, location);
    expect(validateFix(edge, { ...location, radius }, now.getTime())).toBe(radius);
    expect(() => validateFix(edge, { ...location, radius: radius - 1 }, now.getTime())).toThrow('di luar radius');
    expect(() => validateFix({ ...fix, accuracy: 101 }, location, now.getTime())).toThrow('akurat');
    expect(() => validateFix({ ...fix, timestamp: now.getTime() - 31000 }, location, now.getTime())).toThrow('kedaluwarsa');
    expect(() => validateFix({ ...fix, latitude: NaN }, location, now.getTime())).toThrow();
    expect(() => validateLocation({ ...location, latitude: 91 })).toThrow();
    expect(() => validateLocation({ ...location, radius: 0 })).toThrow();
  });
});