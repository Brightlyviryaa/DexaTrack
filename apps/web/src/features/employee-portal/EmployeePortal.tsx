import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import type { Employee } from '../employees';
import { dateLabel, timeLabel, workDate, type AttendanceRecord, type Workforce } from '../workforce';
import { AttendanceFlow } from './AttendanceFlow';
import { AttendanceDetail } from './AttendanceDetail';
import { RequestForm } from './RequestForm';
import { PortalIcon } from './PortalIcon';

const tabs = [{ path: '/employee', label: 'Beranda', icon: 'home' }, { path: '/employee/histori', label: 'Histori', icon: 'history' }, { path: '/employee/pengajuan', label: 'Pengajuan', icon: 'request' }, { path: '/employee/profil', label: 'Profil', icon: 'profile' }] as const;
export function EmployeePortal({ employee, page, data, onLogout }: { employee: Employee; page: 'home' | 'history' | 'requests' | 'profile'; data: Workforce; onLogout: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(workDate().slice(0, 7));
  const [flow, setFlow] = useState<'in' | 'out' | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [detail, setDetail] = useState<AttendanceRecord | null>(null);
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('Semua status');
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }, []);
  const today = workDate(now);
  const records = data.records.filter(r => r.employeeId === employee.id).sort((a, b) => b.date.localeCompare(a.date));
  const attendance = records.find(r => r.date === today);
  const requests = data.requests.filter(r => r.employeeId === employee.id);
  const waiting = requests.filter(r => r.status === 'Menunggu').length;
  const completed = !!attendance?.checkOut;
  const started = !!attendance?.checkIn;
  const initials = employee.fullName.split(' ').slice(0, 2).map(n => n[0]).join('');
  const visibleRecords = page === 'home' ? records.slice(0, 3) : records.filter(r => r.date.startsWith(month));
  const clock = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  function history() {
    return <section className="portal-history"><div className="portal-section-heading"><h2>{page === 'home' ? 'Absensi terakhir' : 'Riwayat absensi'}</h2>{page === 'home' && <Link to="/employee/histori">Lihat semua <span aria-hidden="true">↗</span></Link>}</div>
      {page === 'history' && <label className="portal-month">Periode<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}
      <div className="portal-history-list">{visibleRecords.length ? visibleRecords.map(r => <button className="portal-history-row" key={r.date} onClick={() => setDetail(r)}><span className="portal-date-tile"><b>{Number(r.date.slice(8))}</b><small>{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${r.date}T12:00:00+07:00`))}</small></span><span className="portal-history-description"><strong>{r.date === today ? 'Hari ini' : new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${r.date}T12:00:00+07:00`))}</strong><span>{timeLabel(r.checkIn)} <i>—</i> {timeLabel(r.checkOut)} <small>WIB</small></span><small>{r.corrections.length ? 'Dikoreksi HR' : r.inEvidence ? 'Selfie & GPS tercatat' : 'Bukti selfie & GPS belum tersedia'}</small></span><span className={`portal-status ${r.checkOut ? 'done' : 'working'}`}>{r.checkOut ? 'Selesai' : r.checkIn ? 'Berlangsung' : 'Belum check-in'}</span><span className="portal-chevron" aria-hidden="true">›</span></button>) : <div className="portal-empty"><PortalIcon name="history" /><h3>Belum ada absensi</h3><p>{page === 'home' ? 'Absensi pertama kamu akan tampil di sini.' : 'Tidak ada catatan pada periode ini.'}</p></div>}</div>
    </section>;
  }
  return <div className="employee-portal"><div className="portal-container">
    <header className="portal-header"><Link to="/employee" className="portal-brand">Dexa<span>Track</span><small>EMPLOYEE</small></Link><Link to="/employee/profil" className="portal-avatar" aria-label="Buka profil">{initials}</Link></header>
    <main key={page} className="portal-main">
      {notice && <div className="portal-notice" role="status"><PortalIcon name="check" /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup pemberitahuan">×</button></div>}
      {page === 'home' && <>
        <div className="portal-greeting"><p>Selamat {Number(clock.slice(0, 2)) < 11 ? 'pagi' : Number(clock.slice(0, 2)) < 15 ? 'siang' : Number(clock.slice(0, 2)) < 18 ? 'sore' : 'malam'}, {employee.fullName.split(' ')[0]}.</p><h1>{completed ? 'Terima kasih untuk hari ini.' : started ? 'Semangat menjalani harimu.' : 'Hari baik dimulai di sini.'}</h1></div>
        <section className="portal-attendance-card" aria-label="Absensi hari ini"><div className="portal-card-top"><span><i />{completed ? 'SELESAI HARI INI' : started ? 'SEDANG BEKERJA' : 'SIAP MEMULAI HARI'}</span><PortalIcon name="clock" /></div><p className="portal-today">{dateLabel(today)}</p><div className="portal-clock">{clock.slice(0, 5)}<span>{clock.slice(5)} <small>WIB</small></span></div>
          <div className="portal-time-pair"><div><span><i className="in-dot" />Check-in</span><strong>{timeLabel(attendance?.checkIn)}</strong></div><div><span><i className="out-dot" />Check-out</span><strong>{timeLabel(attendance?.checkOut)}</strong></div></div>
          <button className="portal-primary" disabled={completed || !data.location} onClick={() => setFlow(started ? 'out' : 'in')}><PortalIcon name={completed ? 'check' : 'camera'} />{completed ? 'Absensi hari ini selesai' : started ? 'Check-out sekarang' : 'Check-in sekarang'}{!completed && <PortalIcon name="arrow" />}</button>
          <p className="portal-card-note">{!data.location ? 'Hubungi HR untuk menetapkan lokasi kerja.' : completed ? 'Sampai bertemu di hari kerja berikutnya.' : 'Siapkan selfie dan aktifkan lokasi perangkat.'}</p>
        </section>
        <div className="portal-location"><span className="portal-location-icon"><PortalIcon name="pin" /></span><div><strong>{data.location?.name ?? 'Lokasi kerja belum diatur'}</strong><span>{data.location ? `Area absensi · radius ${data.location.radius} meter` : 'Hubungi HR untuk pengaturan lokasi'}</span></div>{data.location && <span className="portal-location-tag">LOKASI KERJA</span>}</div>
        <Link className="portal-request-shortcut" to="/employee/pengajuan"><span className="portal-shortcut-icon"><PortalIcon name="request" /></span><div><strong>Butuh izin atau koreksi absensi?</strong><span>{waiting ? `${waiting} pengajuan menunggu ditinjau HR` : 'Ajukan cuti, sakit, izin, atau override.'}</span></div><span aria-hidden="true">↗</span></Link>
        {history()}
      </>}
      {page === 'history' && <><div className="portal-page-title"><span className="portal-eyebrow">CATATAN KEHADIRAN</span><h1>Setiap hari, tercatat.</h1><p>Lihat waktu, lokasi, dan progress kerjamu.</p></div>{history()}</>}
      {page === 'requests' && <><div className="portal-page-title"><span className="portal-eyebrow">PENGAJUAN PRIBADI</span><h1>Rencanakan harimu.</h1><p>Cuti, sakit, izin, dan koreksi absensi dalam satu tempat.</p></div><button className="portal-primary" onClick={() => setRequestOpen(true)}>Buat pengajuan <span aria-hidden="true">＋</span></button><div className="portal-section-heading"><h2>Pengajuanmu</h2><span>{waiting} menunggu</span></div><label className="portal-filter">Status pengajuan<select value={status} onChange={e => setStatus(e.target.value)}>{['Semua status', 'Menunggu', 'Disetujui', 'Ditolak'].map(s => <option key={s}>{s}</option>)}</select></label><div className="portal-request-list">{requests.filter(r => status === 'Semua status' || r.status === status).map(r => <article key={r.id} className="portal-request-card"><div><h3>{r.type === 'Koreksi absensi' ? 'Override / Koreksi absensi' : r.type}</h3><span className={`request-status status-${r.status.toLowerCase()}`}>{r.status}</span></div><p className="portal-request-date">{dateLabel(r.start)}{r.end !== r.start && ` – ${dateLabel(r.end)}`}</p><p>{r.reason}</p>{r.type === 'Koreksi absensi' && <p className="portal-request-times">Usulan masuk: {r.checkIn || 'Tetap'} · keluar: {r.checkOut || 'Tetap'} WIB</p>}{r.decidedAt && <small>Ditinjau {r.reviewer} · {timeLabel(r.decidedAt)} WIB</small>}</article>)}{!requests.some(r => status === 'Semua status' || r.status === status) && <div className="portal-empty"><PortalIcon name="request" /><h3>Belum ada pengajuan</h3><p>Pengajuan sesuai filter akan muncul di sini.</p></div>}</div></>}
      {page === 'profile' && <><div className="portal-page-title"><span className="portal-eyebrow">PROFIL KARYAWAN</span><h1>Ruang personalmu.</h1><p>Informasi profil mengikuti data dari HR.</p></div><section className="portal-profile-card"><div className="portal-profile-identity"><span className="portal-avatar">{initials}</span><h2>{employee.fullName}</h2><p>{employee.department}</p><span className="portal-status done">Employee aktif</span></div><dl>{[['Email', employee.email], ['ID karyawan', employee.employeeNo], ['Lokasi kerja', data.location?.name ?? 'Belum ditetapkan'], ['Radius absensi', data.location ? `${data.location.radius} meter` : '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><Link className="portal-logout" to="/account">Ubah password</Link><button className="portal-logout" onClick={onLogout}>Keluar <span aria-hidden="true">↗</span></button></>}
      <p className="portal-demo-note"><span /> Absensi & pengajuan tersimpan · Waktu mengikuti WIB</p>
    </main>
  </div><nav className="portal-bottom-nav" aria-label="Navigasi employee">{tabs.map(tab => <NavLink key={tab.path} to={tab.path} end><span><PortalIcon name={tab.icon} /></span>{tab.label}</NavLink>)}</nav>
    {flow && <AttendanceFlow kind={flow} employeeId={employee.id} data={data} onClose={() => setFlow(null)} onSuccess={() => { setNotice(`Check-${flow === 'in' ? 'in' : 'out'} berhasil. Absensimu sudah tercatat.`); setFlow(null); }} />}
    {requestOpen && <RequestForm employee={employee} data={data} onClose={() => setRequestOpen(false)} onSuccess={() => { setRequestOpen(false); setNotice('Pengajuan terkirim. Menunggu tinjauan HR.'); }} />}
    {detail && <AttendanceDetail record={detail} onClose={() => setDetail(null)} />}
  </div>;
}
