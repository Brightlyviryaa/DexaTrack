import { useEffect, useRef, useState, type ReactNode } from 'react';

export function EmployeeModal({ title, description, onClose, children, destructive = false }: { title: string; description: ReactNode; onClose: () => void; children: (close: () => void) => ReactNode; destructive?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  function close() { setClosing(true); }

  return <dialog ref={dialog} className={`employee-modal ${closing ? 'employee-modal-closing' : ''}`} aria-labelledby="employee-modal-title" aria-describedby="employee-modal-description" onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="employee-modal-header">
      <div className={`employee-modal-icon ${destructive ? 'employee-modal-icon-danger' : ''}`} aria-hidden="true">{destructive ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="8" r="3" /><path d="M4 20v-1a6 6 0 0 1 12 0v1M18 8v6m-3-3h6" /></svg>}</div>
      <button className="employee-close" type="button" onClick={close} aria-label="Tutup dialog">×</button>
    </div>
    <div className="employee-modal-copy"><h2 id="employee-modal-title">{title}</h2><p id="employee-modal-description">{description}</p></div>
    {children(close)}
  </dialog>;
}
