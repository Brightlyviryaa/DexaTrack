import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { send } from '../../shared/api/http';
import { useLogout } from './api';
const titles = { register: 'Daftar sebagai karyawan', 'forgot-password': 'Lupa password', 'reset-password': 'Reset password', activate: 'Aktifkan akun', account: 'Keamanan akun' };
export function AuthPage({ kind }: { kind: keyof typeof titles }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [rawToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const requestId = useRef(crypto.randomUUID());
  const navigate = useNavigate(), logout = useLogout();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) { setError('Konfirmasi password belum sama.'); setBusy(false); return; }
    try {
      const result = await send<{ message: string }>(`/auth/${kind === 'account' ? 'change-password' : kind}`, { ...data, token: rawToken }, 'POST', requestId.current);
      if (kind === 'account') { await logout(); navigate('/login', { replace: true }); }
      else { setMessage(result.message); window.history.replaceState(null, '', window.location.pathname); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main className="auth-standalone"><section className="auth-panel"><div className="brand"><span>Dexa</span>Track</div><h1>{titles[kind]}</h1>
    {kind === 'register' && <p>Pendaftaran membutuhkan persetujuan HR sebelum kamu bisa masuk.</p>}
    {message ? <p role="status">{message}</p> : <form className="employee-form" onSubmit={submit}>
      {kind === 'register' && <label>Nama lengkap<input name="fullName" required maxLength={150} autoComplete="name" /></label>}
      {(kind === 'register' || kind === 'forgot-password') && <label>Email<input name="email" type="email" required maxLength={191} autoComplete="email" /></label>}
      {kind === 'account' && <label>Password lama<input name="currentPassword" type="password" required autoComplete="current-password" maxLength={128} /></label>}
      {kind !== 'forgot-password' && <><label>Password baru<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><label>Konfirmasi password<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><small>Gunakan 12–128 karakter.</small></>}
      {(kind === 'activate' || kind === 'reset-password') && !rawToken && <p role="alert">Tautan tidak lengkap. Minta tautan baru dari HR atau halaman lupa password.</p>}
      {error && <p className="employee-error" role="alert">{error}</p>}
      <button className="employee-primary" disabled={busy || ((kind === 'activate' || kind === 'reset-password') && !rawToken)}>{busy ? 'Memproses…' : kind === 'register' ? 'Daftar' : kind === 'forgot-password' ? 'Kirim tautan' : 'Simpan password'}</button>
    </form>}
    <Link to={kind === 'account' ? '/' : '/login'}>{kind === 'account' ? 'Kembali' : 'Kembali ke login'}</Link>
  </section></main>;
}
