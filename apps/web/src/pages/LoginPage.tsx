import { useState } from 'react';
import { Link } from 'react-router';
import { useLogin } from '../features/auth';
import type { FormEvent } from 'react';

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path d="M4 4l16 16" />}
    </svg>
  );
}

function Wordmark({ light = false }: { light?: boolean }) {
  return <div className={`brand${light ? ' brand-light' : ''}`}><span>Dexa</span>Track</div>;
}

export function LoginPage() {
  const login = useLogin();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try { await login(data); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Masuk ke DexaTrack">
        <aside className="story-panel">
          <div className="story-shade" />
          <div className="story-content">
            <Wordmark light />
            <div className="story-copy">
              <span className="story-eyebrow"><span className="status-dot" /> WORK FROM HOME, MADE SIMPLE</span>
              <h2>Hadir dari mana saja.<br /><em>Tetap terhubung.</em></h2>
              <p>Awali hari kerja dengan lebih mudah, di mana pun kamu bekerja.</p>
              <div className="story-caption"><span className="caption-line" /> Ruang kerja yang lebih fleksibel</div>
            </div>
          </div>
        </aside>

        <div className="form-panel">
          <div className="mobile-brand"><Wordmark /></div>
          <div className="form-content">
            <h1>Senang melihatmu <span>kembali.</span></h1>
            <p className="intro">Masuk untuk memulai hari kerjamu bersama DexaTrack.</p>

            <form onSubmit={handleSubmit}>

              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="username" placeholder="nama@perusahaan.com" required maxLength={191} />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="password-wrap">
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Masukkan password" required />
                  <button className="visibility-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={showPassword}><EyeIcon visible={showPassword} /></button>
                </div>
              </div>
              <button className="submit-button" type="submit" disabled={busy}><span>{busy ? 'Memproses…' : 'Masuk'}</span><span className="button-arrow" aria-hidden="true">→</span></button>
              {error && <p className="employee-error" role="alert">{error}</p>}
            </form>
            <div className="auth-links"><Link to="/forgot-password">Lupa password?</Link><Link to="/register">Daftar akun</Link></div>
            <div className="help-copy">Mengalami kendala saat masuk? <span>Hubungi admin HR kamu.</span></div>
          </div>
          <div className="form-footer"><span>© {new Date().getFullYear()} DexaTrack</span><span>Track presence. Verify work.</span></div>
        </div>
      </section>
    </main>
  );
}
