import { useEffect, useRef, useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { HttpError } from '../../shared/api/http';
import { Dialog } from '../../shared/ui/Dialog';
import { ProgressEditor } from '../../shared/ui/ProgressEditor';
import { getPosition, progressText, validateFix, workDate, type Workforce } from '../workforce';
import { PortalIcon } from './PortalIcon';

export function AttendanceFlow({ kind, employeeId, data, onClose, onSuccess, needsStatusCheck, onStatusCheckChange }: { kind: 'in' | 'out'; employeeId: number; data: Workforce; onClose: () => void; onSuccess: () => void; needsStatusCheck: boolean; onStatusCheckChange: (needed: boolean) => void }) {
  const [date] = useState(() => workDate());
  const [photo, setPhoto] = useState('');
  const [capturedAt, setCapturedAt] = useState('');
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<JSONContent>();
  const [step, setStep] = useState<'camera' | 'progress'>('camera');
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef(true);
  const generation = useRef(0);
  const submitting = useRef(false);
  function stopCamera() { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; if (video.current) video.current.srcObject = null; }
  useEffect(() => { active.current = true; return () => { active.current = false; stopCamera(); }; }, []);

  async function startCamera() {
    const attempt = ++generation.current;
    setError(''); setStarting(true); setReady(false); setPhoto('');
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia. Buka aplikasi melalui HTTPS atau localhost.');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false });
      if (!active.current || attempt !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    } catch (e) {
      if (active.current && attempt === generation.current) {
        stopCamera();
        setError(e instanceof DOMException ? e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera di browser lalu coba lagi.' : 'Kamera tidak dapat dibuka. Pastikan kamera tersedia dan tidak digunakan aplikasi lain.' : (e as Error).message);
      }
    } finally { if (active.current && attempt === generation.current) setStarting(false); }
  }
  function capture() {
    if (!video.current?.videoWidth || !ready) return;
    try {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 960 / video.current.videoWidth);
      canvas.width = Math.round(video.current.videoWidth * ratio); canvas.height = Math.round(video.current.videoHeight * ratio);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Foto belum dapat diambil. Coba lagi.');
      context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', 0.85);
      if (!image.startsWith('data:image/jpeg;base64,')) throw new Error('Foto belum siap. Coba lagi.');
      setPhoto(image); setCapturedAt(new Date().toISOString()); setError(''); stopCamera(); setReady(false);
    } catch (e) { setError((e as Error).message); }
  }
  async function checkStatus() {
    setChecking(true);
    const result = await data.refetch({ cancelRefetch: false });
    if (!active.current) return;
    setChecking(false);
    if (result.isError) {
      setError('Status absensi belum bisa diperiksa. Coba lagi sebelum mengirim ulang.');
      return;
    }
    const record = result.data?.records.find(record => record.employeeId === employeeId && record.date === date);
    onStatusCheckChange(false);
    if ((kind === 'out' ? record?.checkOut : record?.checkIn)) onSuccess();
    else setError('');
  }
  async function submit() {
    if (submitting.current || needsStatusCheck || data.error || workDate() !== date) return;
    submitting.current = true; setBusy(true); setError('');
    let sent = false;
    try {
      if (!data.location) throw new Error('HR belum menetapkan lokasi kerja.');
      const position = await getPosition();
      if (!active.current) return;
      if (workDate() !== date) throw new Error('Tanggal WIB sudah berganti. Tutup dialog dan mulai absensi kembali.');
      if (!navigator.onLine) throw new Error('Koneksi internet terputus. Sambungkan kembali sebelum mengirim absensi.');
      const distance = validateFix(position, data.location);
      sent = true;
      await data.submitAttendance(employeeId, date, kind, { photo, capturedAt, submittedAt: new Date().toISOString(), position, distance, location: data.location }, progress);
      if (active.current) onSuccess();
    } catch (e) {
      if (active.current) {
        const uncertain = sent && (!(e instanceof HttpError) || e.status === 409 || e.status >= 500);
        if (uncertain) onStatusCheckChange(true);
        setError(uncertain ? 'Periksa status absensi di server sebelum mengirim ulang.' : (e as Error).message);
      }
    }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  const checkout = kind === 'out';
  const dateChanged = workDate() !== date;
  return <Dialog title={checkout ? 'Check-out' : 'Check-in'} onClose={onClose} full closeDisabled={busy}>
    <div className="capture-steps"><span className={step === 'camera' ? 'active' : ''}>01 <b>Selfie</b></span><i /><span className={step === 'progress' ? 'active' : ''}>02 <b>{checkout ? 'Progress & lokasi' : 'Konfirmasi lokasi'}</b></span></div>
    {step === 'camera' ? <>
      <div className="capture-intro"><h3>{photo ? 'Selfie sudah siap.' : 'Senyum, mulai dari sini.'}</h3><p>{photo ? 'Pastikan wajah terlihat jelas sebelum melanjutkan.' : 'Posisikan wajah di tengah oval, dengan pencahayaan yang cukup.'}</p></div>
      <div className={`camera-stage${photo ? ' has-photo' : ''}`}>
        <video ref={video} hidden={!!photo} autoPlay playsInline muted onLoadedData={() => { if (stream.current) setReady(true); }} />
        {photo ? <img src={photo} alt="Preview selfie absensi" /> : <><div className="camera-oval" />{!ready && <div className="camera-placeholder"><PortalIcon name="camera" /><span>{starting ? 'Membuka kamera…' : 'Kamera depan kamu'}</span></div>}<span className="camera-caption">Panduan posisi wajah</span></>}
      </div>
      {!photo && <button type="button" className="portal-primary capture-button" disabled={starting} onClick={ready ? capture : startCamera}><PortalIcon name="camera" />{ready ? 'Ambil selfie' : starting ? 'Membuka kamera…' : 'Aktifkan kamera'}</button>}
      {photo && <div className="portal-action-row"><button className="portal-secondary" disabled={busy} onClick={startCamera}>Ambil ulang</button><button className="portal-primary" disabled={busy} onClick={() => { setStep('progress'); setError(''); }}>Lanjutkan <PortalIcon name="arrow" /></button></div>}
    </> : <>
      <div className="capture-proof"><img src={photo} alt="Selfie siap digunakan" /><div><strong>Selfie siap digunakan</strong><span>Foto disimpan bersama absensimu.</span></div><button className="portal-link" disabled={busy} onClick={() => setStep('camera')}>Ubah</button></div>
      {checkout && <section className="progress-section"><h3>Bagaimana progress hari ini?</h3><p>Tulis pekerjaan yang selesai, perkembangan, atau kendala yang kamu temui.</p><ProgressEditor value={progress} onChange={setProgress} /><small>{progressText(progress).length.toLocaleString('id-ID')} / 10.000 karakter</small></section>}
      <div className="portal-location"><PortalIcon name="pin" /><div><strong>{data.location?.name ?? 'Lokasi belum diatur'}</strong><span>Radius {data.location?.radius ?? '—'} m · GPS diperiksa saat konfirmasi</span></div></div>
      <button className="portal-primary" disabled={busy || checking || needsStatusCheck || !!data.error || !data.location || dateChanged || (checkout && (!progressText(progress).trim() || progressText(progress).length > 10000))} onClick={submit}>{busy ? 'Memproses absensi…' : `Konfirmasi check-${checkout ? 'out' : 'in'}`} {!busy && <PortalIcon name="check" />}</button>
      <p className="portal-footnote">Izinkan akses lokasi untuk memastikan kamu berada di lokasi kerja.</p>
    </>}
    {(error || dateChanged || data.error) && <p className="portal-error" role="alert">{dateChanged ? 'Tanggal WIB sudah berganti. Tutup dialog dan mulai absensi kembali.' : error || 'Data absensi belum mutakhir. Periksa status sebelum melanjutkan.'}</p>}
    {(needsStatusCheck || data.error) && !dateChanged && <button className="portal-secondary" disabled={busy || checking} onClick={() => void checkStatus()}>{checking ? 'Memeriksa status…' : 'Periksa status absensi'}</button>}
    {busy && <p className="portal-footnote" role="status">Memeriksa posisi terbaru dan menyimpan absensi…</p>}
  </Dialog>;
}
