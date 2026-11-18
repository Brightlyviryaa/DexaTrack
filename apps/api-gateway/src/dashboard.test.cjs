const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDashboard, dailyStatus } = require('../dist/dashboard');
const { GatewayController } = require('../dist/gateway.controller');
const { of, throwError } = require('rxjs');
const date = '2026-11-17'; // Tuesday
const profiles = [1,2,3,4,5].map(id => ({ id, fullName: `Employee ${id}`, department: 'Team' }));
const request = (employeeId, type, start = date, end = date, status = 'Disetujui') => ({ id: employeeId, employeeId, type, start, end, status });
const attendance = (employeeId, day, hour = '08:00:00') => ({ employeeId, date: day, checkIn: `${day}T${hour}+07:00`, checkOut: null, workStartTime: '08:00' });
test('daily status prioritizes check-in, then sick, then leave/permission, and compares exact time', () => {
  assert.equal(dailyStatus(attendance(1, date), [request(1,'Sakit')], date,'08:00'), 'Tepat waktu');
  assert.equal(dailyStatus(attendance(1, date, '08:00:01'), [], date,'08:00'), 'Terlambat');
  assert.equal(dailyStatus(undefined,[request(1,'Cuti'),request(1,'Sakit')],date,'08:00'),'Sakit');
  assert.equal(dailyStatus(undefined,[request(1,'Izin')],date,'08:00'),'Izin / cuti');
  assert.equal(dailyStatus(undefined,[request(1,'Cuti',date,date,'Menunggu')],date,'08:00'),'Belum hadir');
});
test('real summary uses active roster, elapsed weekdays, structured check-in, and exact followups', () => {
  const records = [attendance(1,date),attendance(2,date,'08:00:01'),attendance(1,'2026-11-16'), attendance(999,date), { employeeId: 5, date, checkIn: null, checkOut: null }];
  const requests = [request(1,'Cuti'),request(3,'Izin'),request(4,'Sakit'),request(5,'Cuti','2026-11-18'),request(3,'Cuti','2026-11-23'),request(2,'Izin',date,date,'Menunggu')];
  const result = buildDashboard(profiles, { today:date, records, requests, workStartTime:'08:00' });
  assert.deepEqual(result.metrics, { employees:5,present:2,late:1,leave:1,sick:1,absent:1,checkedOut:0 });
  assert.equal(result.average,1.5); assert.equal(result.rate,40);
  assert.deepEqual(result.weekly.map(d=>d.elapsed),[true,true,false,false,false]);
  assert.deepEqual(result.tasks, { pending:1,missingCheckout:1,upcomingLeave:1 });
  assert.equal(buildDashboard(profiles,{ today:'2026-11-22',records,requests,workStartTime:'08:00' }).average,.6);
});
test('empty data remains zero without NaN or fictional employees', () => {
  const result = buildDashboard([], { today:date,records:[],requests:[],workStartTime:'08:00' });
  assert.equal(result.average,0); assert.equal(result.rate,0); assert.deepEqual(result.rows,[]);
});
test('summary rejects employees and surfaces owner-service failures', async () => {
  const denied = new GatewayController({send:()=>of({role:'EMPLOYEE'})}, {}, {});
  await assert.rejects(denied.dashboard({headers:{}}),e=>e.getStatus()===403);
  const user = {id:1,employeeId:1,role:'HR_ADMIN'};
  const failed = new GatewayController({send:()=>of(user)}, {send:()=>throwError(()=>new Error('Employees unavailable'))}, {send:()=>of({})});
  await assert.rejects(failed.dashboard({headers:{}}),e=>e.getStatus()===503);
  const failedAttendance = new GatewayController({send:()=>of(user)}, {send:()=>of([])}, {send:()=>throwError(()=>new Error('Attendance unavailable'))});
  await assert.rejects(failedAttendance.dashboard({headers:{}}),e=>e.getStatus()===503);
});
