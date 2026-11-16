import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">DexaTrack</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">WFH Attendance</h1>
        <p className="mt-3 leading-7 text-slate-600">Starter aplikasi absensi karyawan dan monitoring HR. Frontend React + TypeScript + Tailwind siap dikembangkan.</p>
        <div className="mt-8 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">API: <code>http://localhost:3000/api</code></div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
