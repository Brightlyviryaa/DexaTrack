import { useState } from 'react';
import { workDate } from '../workforce';
import { useAttendanceReport } from './api';

const statuses = [
  ['present', 'Hadir'],
  ['late', 'Terlambat'],
  ['leave', 'Izin'],
  ['sick', 'Sakit'],
  ['absent', 'Tidak hadir'],
] as const;

export function Reports() {
  const [period, setPeriod] = useState(() => workDate().slice(0, 7));
  const [search, setSearch] = useState('');
  const query = useAttendanceReport(period, search);
  const data = query.data;

  return <div className="attendance-page">
    <div className="section-intro">
      <div><span className="attendance-kicker">REKAP KEHADIRAN</span><h2>Pantau kehadiran tim</h2><p>Ringkasan hari kehadiran berdasarkan periode dan karyawan.</p></div>
      {data && <div className="intro-counter"><strong>{data.totalDays}</strong><span>hari tercatat</span></div>}
    </div>
    <section className="employee-list attendance-list" aria-label="Laporan kehadiran">
      <div className="attendance-filters">
        <label className="attendance-search"><span>Cari karyawan</span><input type="search" placeholder="Cari nama atau departemen" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label><span>Periode</span><input type="month" min="1000-01" max="9999-12" required value={period} onChange={event => setPeriod(event.target.value)} /></label>
      </div>
      {!period && <p className="employee-empty">Pilih bulan untuk melihat laporan.</p>}
      {period && query.isPending && <p className="employee-empty" role="status">Memuat laporan kehadiran…</p>}
      {query.isError && <div className="employee-error" role="alert"><p>{query.error.message}</p><button type="button" onClick={() => void query.refetch()}>Coba lagi</button></div>}
      {data && <>
        <div className="report-summary" aria-label="Ringkasan laporan">
          {statuses.map(([key, label]) => <div key={key}><span>{label}</span><strong>{data.totals[key] ?? '—'}</strong>{data.totals[key] !== null && <small>hari</small>}</div>)}
        </div>
        <div className="report-caption"><strong>Rincian per karyawan</strong><span>Hitungan tidak hadir menunggu kalender kerja.</span></div>
        <div className="attendance-table-wrap">
          <table>
            <thead><tr><th scope="col">Karyawan</th>{statuses.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead>
            <tbody>{data.rows.map(row => <tr key={row.employeeId}>
              <td><div className="employee"><span className="employee-avatar" aria-hidden="true">{row.fullName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><span><strong>{row.fullName}</strong><small>{row.department}</small></span></div></td>
              {statuses.map(([key, label]) => <td data-label={label} key={key}>{row[key] ?? '—'}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        {data.rows.length === 0 && <p className="employee-empty">{search.trim() ? 'Tidak ada hasil untuk pencarian ini.' : 'Tidak ada catatan kehadiran pada periode ini.'}</p>}
        <div className="attendance-list-footer">Menampilkan {data.rows.length} karyawan</div>
      </>}
    </section>
  </div>;
}
