import { lazy, Suspense, useState, type FormEvent } from 'react';
import { getPosition } from './browser';
import type { Workforce } from './useWorkforce';
import type { WorkPoint } from './WorkLocationMap';
import './work-settings.css';

const WorkLocationMap = lazy(() => import('./WorkLocationMap'));

export function WorkSettings({ data }: { data: Workforce }) {
  const saved = {
    name: data.location?.name ?? 'Kantor DexaTrack',
    point: data.location ? { latitude: data.location.latitude, longitude: data.location.longitude } : null,
    radius: data.location?.radius.toString() ?? '100',
    workStartTime: data.workStartTime,
  };
  const [draft, setDraft] = useState<typeof saved | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsPoint, setGpsPoint] = useState<WorkPoint | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const values = draft ?? saved;
  const radius = Number(values.radius);

  function update(fields: Partial<typeof saved>) {
    setDraft(current => ({ ...(current ?? saved), ...fields }));
    setSavedSuccessfully(false);
    setSaveError('');
  }

  async function locate() {
    setLocating(true);
    setGpsError('');
    try {
      const { latitude, longitude } = await getPosition();
      const point = { latitude, longitude };
      update({ point });
      setGpsPoint(point);
    } catch (error) {
      setGpsError((error as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locating || data.isSaving) return;
    setSaveError('');
    setSavedSuccessfully(false);
    const name = values.name.trim();
    if (!name || !values.point) {
      setSaveError(!name ? 'Isi nama lokasi kerja.' : 'Pilih titik lokasi kerja di peta atau gunakan lokasi saat ini.');
      return;
    }
    try {
      await data.setLocation({
        name,
        ...values.point,
        radius,
      }, values.workStartTime);
      setDraft(null);
      setGpsError('');
      setSavedSuccessfully(true);
    } catch (error) {
      setSaveError((error as Error).message);
    }
  }

  if (!data.hasSnapshot) {
    return data.error ? (
      <div className="work-settings-load-error">
        <p role="alert">Gagal memuat pengaturan. {data.error.message}</p>
        <button className="employee-secondary" onClick={() => void data.refetch()}>Coba lagi</button>
      </div>
    ) : <p className="auth-loading" role="status">Memuat pengaturan…</p>;
  }

  return (
    <form className="work-settings" onSubmit={save}>
      {data.error && (
        <div className="work-settings-load-error">
          <p role="alert">Gagal memuat ulang pengaturan. Isian Anda tetap tersedia.</p>
          <button type="button" className="employee-secondary" onClick={() => void data.refetch()}>Coba lagi</button>
        </div>
      )}
      <fieldset className="work-settings-grid" disabled={data.isSaving}>
        <legend className="sr-only">Pengaturan absensi</legend>
        <section className="work-settings-card" aria-labelledby="work-location-title">
          <header className="work-settings-card-heading">
            <h2 id="work-location-title">Lokasi kerja</h2>
            <p>Tentukan titik dan radius yang berlaku untuk check-in dan check-out.</p>
          </header>
          <label>Nama lokasi
            <input value={values.name} required maxLength={150} onChange={e => update({ name: e.target.value })} />
          </label>
          <div className="work-map-picker">
            <div className="work-map-toolbar">
              <p className={values.point ? 'work-map-picked' : undefined} role="status">
                {values.point ? 'Titik lokasi dipilih' : 'Pilih titik lokasi'}
              </p>
              <button type="button" className="employee-secondary work-settings-gps" disabled={locating} onClick={() => void locate()}>
                {locating ? 'Mencari lokasi…' : 'Gunakan lokasi saat ini'}
              </button>
            </div>
            <Suspense fallback={<p className="work-map-loading work-map-canvas" role="status">Memuat peta…</p>}>
              <WorkLocationMap
                point={values.point}
                gpsPoint={gpsPoint}
                radius={radius >= .01 && radius <= 99999999.99 ? radius : 0}
                disabled={locating || data.isSaving}
                onSelect={point => { setGpsError(''); update({ point }); }}
              />
            </Suspense>
            <p className="work-map-hint">Ketuk peta atau geser pin. Lingkaran menunjukkan area absensi.</p>
            {gpsError && <p className="work-settings-error" role="alert">{gpsError} Anda juga bisa memilih titik di peta.</p>}
          </div>
          <label>Radius (meter)
            <input type="number" min="0.01" max="99999999.99" step="0.01" required value={values.radius} onChange={e => update({ radius: e.target.value })} />
          </label>
        </section>
        <section className="work-settings-card" aria-labelledby="work-hours-title">
          <header className="work-settings-card-heading">
            <h2 id="work-hours-title">Jam masuk</h2>
            <p>Check-in setelah jam ini ditandai terlambat.</p>
          </header>
          <label>Jam masuk (WIB)
            <input type="time" required value={values.workStartTime} onChange={e => update({ workStartTime: e.target.value })} />
          </label>
          <p className="work-settings-notice">Perubahan berlaku untuk absensi berikutnya. Lokasi dan jam masuk yang tercatat pada absensi terdahulu tetap tersimpan.</p>
        </section>
      </fieldset>
      <div className="work-settings-actions">
        {saveError && <p className="work-settings-error" role="alert">{saveError}</p>}
        <p className="work-settings-status" role="status">
          {data.isSaving ? 'Menyimpan pengaturan…' : savedSuccessfully ? 'Pengaturan berhasil disimpan.' : ''}
        </p>
        <button type="submit" className="employee-primary" disabled={locating || data.isSaving}>
          {data.isSaving ? 'Menyimpan…' : 'Simpan pengaturan'}
        </button>
      </div>
    </form>
  );
}
