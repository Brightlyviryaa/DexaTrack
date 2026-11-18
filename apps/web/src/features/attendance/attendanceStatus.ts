export function attendanceStatus(time: string | null, start = '08:00') {
  return !time ? 'Belum hadir' : time > start ? 'Terlambat' : 'Tepat waktu';
}
