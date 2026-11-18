const { test } = require('node:test');
const assert = require('node:assert/strict');
const { countAttendanceDays, reportRange } = require('../dist/attendance-report');
const date = value => new Date(`${value}T00:00:00Z`);

test('validates the month and clips its end at the WIB date', () => {
  const now = new Date('2026-10-31T17:00:00Z');
  for (const invalid of [undefined, ['2026-11'], '2026-1', '2026-13', '0999-12', '2026-11-01']) {
    assert.throws(() => reportRange(invalid, now), error => error.getError().status === 400);
  }
  assert.deepEqual(reportRange('2026-11', now), { startDate: date('2026-11-01'), endDate: date('2026-11-01') });
  assert.deepEqual(reportRange('2024-02', now), { startDate: date('2024-02-01'), endDate: date('2024-02-29') });
});

test('counts at most one status per employee and clips approved days to the report range', () => {
  const checkIn = (day, time, workStartTime = '08:00') => ({
    employeeId: 1, workDate: date(day), checkInAt: time ? new Date(`${day}T${time}+07:00`) : null, workStartTime,
  });
  const request = (employeeId, type, start, end) => ({ employeeId, type, startDate: date(start), endDate: date(end) });
  const range = reportRange('2026-11', new Date('2026-11-04T17:00:00Z'));
  const rows = countAttendanceDays([
    checkIn('2026-11-02', '09:00:00', '09:00'),
    checkIn('2026-11-03', '08:00:01'),
    { ...checkIn('2026-11-05', null), employeeId: 3 },
  ], [
    request(1, 'SICK', '2026-11-02', '2026-11-04'),
    request(1, 'LEAVE', '2026-10-31', '2026-11-07'),
    request(1, 'PERMISSION', '2026-11-04', '2026-11-05'),
    request(2, 'SICK', '2026-11-06', '2026-11-06'),
  ], range);
  assert.deepEqual(rows, [{ employeeId: 1, present: 1, late: 1, leave: 2, sick: 1 }]);
});
