type Counts = { present: number; late: number; leave: number; sick: number };
export type AttendanceReportCount = Counts & { employeeId: number };
export type AttendanceReportProfile = { id: number; fullName: string; department: string | null };

export function buildAttendanceReport(
  period: string,
  search: string,
  counts: AttendanceReportCount[],
  profiles: AttendanceReportProfile[],
) {
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]));
  const term = search.trim().toLowerCase();
  const rows = counts.map(count => {
    const profile = profilesById.get(count.employeeId);
    return {
      ...count,
      fullName: profile?.fullName ?? `Karyawan #${count.employeeId}`,
      department: profile?.department ?? null,
      absent: null,
    };
  }).filter(row => `${row.fullName} ${row.department ?? ''}`.toLowerCase().includes(term))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id') || a.employeeId - b.employeeId);

  const totals = { present: 0, late: 0, leave: 0, sick: 0, absent: null };
  for (const row of rows) {
    totals.present += row.present;
    totals.late += row.late;
    totals.leave += row.leave;
    totals.sick += row.sick;
  }
  return { period, totals, totalDays: totals.present + totals.late + totals.leave + totals.sick, rows };
}
