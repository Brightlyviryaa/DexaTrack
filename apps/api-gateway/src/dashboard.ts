export type Profile = { id: number; fullName: string; department: string | null };
export type SummaryRecord = { employeeId: number; date: string; checkIn: string | null; checkOut: string | null; workStartTime?: string };
export type SummaryRequest = { id: number; employeeId: number; type: string; start: string; end: string; status: string };
export type Snapshot = { today: string; workStartTime: string; records: SummaryRecord[]; requests: SummaryRequest[] };
export function dailyStatus(record: SummaryRecord | undefined, requests: SummaryRequest[], date: string, start: string) {
  if (record?.checkIn) return new Date(record.checkIn) > new Date(`${date}T${record.workStartTime ?? start}:00+07:00`) ? 'Terlambat' : 'Tepat waktu';
  const approved = requests.filter(r => r.status === 'Disetujui' && r.start <= date && r.end >= date);
  if (approved.some(r => r.type === 'Sakit')) return 'Sakit';
  return approved.some(r => r.type === 'Cuti' || r.type === 'Izin') ? 'Izin / cuti' : 'Belum hadir';
}
export function buildDashboard(profiles: Profile[], data: Snapshot) {
  const date = data.today, active = new Set(profiles.map(p => p.id));
  const rows = profiles.map(p => {
    const record = data.records.find(r => r.employeeId === p.id && r.date === date);
    return { ...p, checkIn: record?.checkIn ?? null, checkOut: record?.checkOut ?? null, status: dailyStatus(record, data.requests.filter(r => r.employeeId === p.id), date, data.workStartTime) };
  });
  const current = new Date(`${date}T00:00:00Z`), weekday = (current.getUTCDay() + 6) % 7;
  const monday = new Date(current.getTime() - weekday * 86400000);
  const weekly = Array.from({ length: 5 }, (_, i) => {
    const day = new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { date: day, present: data.records.filter(r => active.has(r.employeeId) && r.date === day && r.checkIn).length, elapsed: day <= date };
  });
  const weekEnd = new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const elapsed = weekly.filter(d => d.elapsed), present = rows.filter(r => r.checkIn).length;
  const metrics = { employees: profiles.length, present, late: rows.filter(r => r.status === 'Terlambat').length, leave: rows.filter(r => r.status === 'Izin / cuti').length, sick: rows.filter(r => r.status === 'Sakit').length, absent: rows.filter(r => r.status === 'Belum hadir').length, checkedOut: rows.filter(r => r.checkOut).length };
  return { date, workStartTime: data.workStartTime, metrics, rows, weekly, average: elapsed.length ? Math.round(elapsed.reduce((sum, d) => sum + d.present, 0) / elapsed.length * 10) / 10 : 0, rate: profiles.length ? Math.round(present / profiles.length * 1000) / 10 : 0, tasks: { pending: data.requests.filter(r => r.status === 'Menunggu').length, missingCheckout: data.records.filter(r => r.date < date && r.checkIn && !r.checkOut).length, upcomingLeave: data.requests.filter(r => active.has(r.employeeId) && r.type === 'Cuti' && r.status === 'Disetujui' && r.start > date && r.start <= weekEnd).length } };
}
