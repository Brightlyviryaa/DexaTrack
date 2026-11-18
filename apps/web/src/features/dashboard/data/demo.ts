import type { IconName } from '../components/Icon';

export const employees = [
  { initials: 'AN', name: 'Aditya Nugraha', team: 'Product Design', time: '08:00', status: 'Tepat waktu', color: 'mint' },
  { initials: 'SP', name: 'Salsabila Putri', team: 'Engineering', time: '07:52', status: 'Tepat waktu', color: 'peach' },
  { initials: 'RP', name: 'Rizky Pratama', team: 'Marketing', time: '08:47', status: 'Terlambat', color: 'lavender' },
  { initials: 'NA', name: 'Nadia Amelia', team: 'People & Culture', time: '08:05', status: 'Terlambat', color: 'blue' },
  { initials: 'DF', name: 'Dimas Firmansyah', team: 'Engineering', time: '—', status: 'Belum check-in', color: 'sand' },
];
export const metrics: { icon: IconName; label: string; value: string; detail: string; tag: string }[] = [
  { icon: 'users', label: 'Total karyawan', value: '128', detail: 'Karyawan aktif', tag: 'Tim DexaTrack' },
  { icon: 'check', label: 'Hadir hari ini', value: '112', detail: '87,5% dari total', tag: '+4,2%' },
  { icon: 'clock', label: 'Terlambat', value: '8', detail: 'Karyawan hari ini', tag: 'Hari ini' },
  { icon: 'calendar', label: 'Tidak hadir', value: '8', detail: 'Izin, cuti & sakit', tag: 'Hari ini' },
];
export const tasks = [
  { icon: 'file' as const, title: 'Pengajuan izin menunggu', detail: '3 pengajuan perlu ditinjau', count: '03' },
  { icon: 'clock' as const, title: 'Kehadiran perlu diperiksa', detail: '2 data belum lengkap', count: '02' },
  { icon: 'calendar' as const, title: 'Jadwal cuti mendatang', detail: '4 karyawan minggu ini', count: '04' },
];
