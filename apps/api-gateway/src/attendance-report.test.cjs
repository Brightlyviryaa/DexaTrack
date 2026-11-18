const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildAttendanceReport } = require('../dist/attendance-report');
const { GatewayController } = require('../dist/gateway.controller');
const { of, throwError } = require('rxjs');

const counts = [3, 1, 2].map(employeeId => ({ employeeId, present: 1, late: 2, leave: 0, sick: 1 }));
const profiles = [2, 1].map(id => ({ id, fullName: 'Ayu', department: 'Engineering', isActive: id !== 2 }));
const period = '2026-11';

test('filters totals and preserves separate rows for coworkers with the same name', () => {
  const found = buildAttendanceReport(period, '  ENGINEERING ', counts, profiles);
  assert.deepEqual(found.rows.map(row => row.employeeId), [1, 2]);
  assert.deepEqual(found.totals, { present: 2, late: 4, leave: 0, sick: 2, absent: null });
  assert.equal(found.totalDays, 8);
  assert.equal(found.rows[0].absent, null);
  assert.equal(buildAttendanceReport(period, '#3', counts, profiles).rows[0].fullName, 'Karyawan #3');
  assert.equal(buildAttendanceReport(period, 'none', counts, profiles).totalDays, 0);
});

test('report enforces the HR session and propagates service failures', async () => {
  const req = { headers: {} };
  const unavailable = () => throwError(() => new Error('Unavailable'));
  const hr = { send: () => of({ id: 7, employeeId: 8, role: 'HR_ADMIN' }) };
  const denied = new GatewayController({ send: () => of({ role: 'EMPLOYEE' }) }, {}, {});
  await assert.rejects(denied.attendanceReport(req, period), error => error.getStatus() === 403);
  const noSession = new GatewayController({ send: () => throwError(() => ({ status: 401 })) }, {}, {});
  await assert.rejects(noSession.attendanceReport(req, period), error => error.getStatus() === 401);
  const failedAttendance = new GatewayController(hr, {}, { send: unavailable });
  await assert.rejects(failedAttendance.attendanceReport(req, period), error => error.getStatus() === 503);
  const failedEmployees = new GatewayController(hr, { send: unavailable }, { send: () => of(counts) });
  await assert.rejects(failedEmployees.attendanceReport(req, period), error => error.getStatus() === 503);
  await assert.rejects(failedEmployees.attendanceReport(req, period, ['Ayu', 'Ayu']), error => error.getStatus() === 400);
});
