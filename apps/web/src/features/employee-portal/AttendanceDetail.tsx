import { Dialog } from '../../shared/ui/Dialog';
import { ProgressEditor } from '../../shared/ui/ProgressEditor';
import { dateLabel, timeLabel, workDate, type AttendanceRecord, type Evidence } from '../workforce';

function Proof({ title, evidence }: { title: string; evidence?: Evidence }) {
  return <section className="attendance-proof"><h3>{title}</h3>{evidence ? <>
    <img src={evidence.photo} alt={`Selfie ${title}`} />
    <dl><div><dt>Foto diambil</dt><dd>{timeLabel(evidence.capturedAt)} WIB</dd></div><div><dt>Dicatat pada</dt><dd>{timeLabel(evidence.submittedAt)} WIB</dd></div><div><dt>Lokasi kerja</dt><dd>{evidence.location.name}</dd></div><div><dt>Koordinat GPS</dt><dd>{evidence.position.latitude.toFixed(6)}, {evidence.position.longitude.toFixed(6)}</dd></div><div><dt>Akurasi / jarak</dt><dd>±{Math.round(evidence.position.accuracy)} m / {Math.round(evidence.distance)} m</dd></div><div><dt>Radius saat absen</dt><dd>{evidence.location.radius} m</dd></div></dl>
  </> : <p className="portal-muted">Foto dan GPS belum tersedia untuk catatan ini.</p>}</section>;
}
export function AttendanceDetail({ record, name, onClose }: { record: AttendanceRecord; name?: string; onClose: () => void }) {
  return <Dialog title="Detail absensi" onClose={onClose}>
    <p className="portal-muted">{name && `${name} · `}{dateLabel(record.date)}{record.sample && ' · Data contoh'}</p>
    <div className="portal-time-pair"><div><span>Check-in</span><strong>{timeLabel(record.checkIn)}</strong></div><div><span>Check-out</span><strong>{timeLabel(record.checkOut)}</strong></div></div>
    <div className="attendance-proofs"><Proof title="Check-in" evidence={record.inEvidence} /><Proof title="Check-out" evidence={record.outEvidence} /></div>
    <section className="progress-section"><h3>Progress hari ini</h3>{record.progress ? <ProgressEditor readOnly value={record.progress} /> : <p className="portal-muted">Belum ada laporan checkout.</p>}</section>
    {record.corrections.length > 0 && <section className="correction-history"><h3>Riwayat koreksi HR</h3>{record.corrections.map(c => <article key={c.requestId}><strong>{c.reviewer} · {dateLabel(workDate(new Date(c.decidedAt)))} · {timeLabel(c.decidedAt)} WIB</strong><p>{c.reason}</p><p>Check-in: {timeLabel(c.before.checkIn)} → {timeLabel(c.after.checkIn)}<br />Check-out: {timeLabel(c.before.checkOut)} → {timeLabel(c.after.checkOut)}</p><small>Bukti foto dan GPS asli tetap disimpan.</small></article>)}</section>}
  </Dialog>;
}
