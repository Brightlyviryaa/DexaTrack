import type { PositionFix } from './model';

export function getPosition(): Promise<PositionFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('GPS tidak tersedia. Gunakan browser dengan izin lokasi melalui HTTPS atau localhost.')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp }),
      e => reject(new Error(e.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser, lalu coba lagi.' : e.code === 3 ? 'GPS belum merespons. Coba lagi di area terbuka.' : 'Lokasi tidak tersedia. Periksa layanan lokasi perangkat dan coba lagi.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
}
