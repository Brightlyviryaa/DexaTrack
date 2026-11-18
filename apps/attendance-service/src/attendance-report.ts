import { dateValue, fail, validDate, workDate } from './domain';

type CountedStatus = 'present' | 'late' | 'leave' | 'sick';
type CheckIn = { employeeId: number; workDate: Date; checkInAt: Date | null; workStartTime: string };
type ApprovedRequest = { employeeId: number; startDate: Date; endDate: Date; type: string };

export function reportRange(period: unknown, now = new Date()) {
  const start = typeof period === 'string' ? `${period}-01` : '';
  if (!validDate(start)) fail('Periode laporan harus berupa bulan yang valid (YYYY-MM).');

  const startDate = dateValue(start);
  const endOfMonth = new Date(startDate);
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);

  const today = dateValue(workDate(now));
  return { startDate, endDate: endOfMonth < today ? endOfMonth : today };
}

export function countAttendanceDays(
  checkIns: CheckIn[],
  requests: ApprovedRequest[],
  { startDate, endDate }: ReturnType<typeof reportRange>,
) {
  const days = new Map<number, Map<number, CountedStatus>>();
  function employeeDays(employeeId: number) {
    let statuses = days.get(employeeId);
    if (!statuses) {
      statuses = new Map();
      days.set(employeeId, statuses);
    }
    return statuses;
  }

  for (const request of requests) {
    const status = request.type === 'SICK' ? 'sick' : 'leave';
    const first = Math.max(request.startDate.getTime(), startDate.getTime());
    const last = Math.min(request.endDate.getTime(), endDate.getTime());
    for (let day = first; day <= last; day += 86_400_000) {
      const statuses = employeeDays(request.employeeId);
      if (status === 'sick' || !statuses.has(day)) statuses.set(day, status);
    }
  }
  for (const { employeeId, workDate, checkInAt, workStartTime } of checkIns) {
    if (!checkInAt) continue;
    const date = workDate.toISOString().slice(0, 10);
    const cutoff = new Date(`${date}T${workStartTime}:00+07:00`);
    employeeDays(employeeId).set(workDate.getTime(), checkInAt > cutoff ? 'late' : 'present');
  }

  return Array.from(days, ([employeeId, statuses]) => {
    const counts = { present: 0, late: 0, leave: 0, sick: 0 };
    for (const status of statuses.values()) counts[status]++;
    return { employeeId, ...counts };
  });
}
