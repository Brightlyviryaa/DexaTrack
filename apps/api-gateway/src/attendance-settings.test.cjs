const { test } = require('node:test');
const assert = require('node:assert/strict');
const { of } = require('rxjs');
const { GatewayController } = require('../dist/gateway.controller');

function controller(role) {
  const calls = [];
  const auth = { send: () => of({ role }) };
  const attendance = { send: (pattern, data) => { calls.push({ pattern, data }); return of({}); } };
  return { gateway: new GatewayController(auth, {}, attendance), calls };
}

test('only HR can update attendance settings', async () => {
  const { gateway, calls } = controller('EMPLOYEE');
  await assert.rejects(gateway.updateAttendanceSettings({ headers: {}, body: {} }), error => error.getStatus() === 403);
  assert.equal(calls.length, 0);
});

test('HR update forwards the settings to attendance service', async () => {
  const { gateway, calls } = controller('HR_ADMIN');
  const body = { name: 'Kantor', latitude: -6.2, longitude: 106.8, radius: 100, workStartTime: '08:00' };
  await gateway.updateAttendanceSettings({ headers: {}, body });
  assert.deepEqual(calls[0], { pattern: { cmd: 'attendance.settings.set' }, data: body });
});
