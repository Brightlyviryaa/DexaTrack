import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({ title, onClose, children, full = false, closeDisabled = false }: { title: string; onClose: () => void; children: ReactNode; full?: boolean; closeDisabled?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`portal-dialog${full ? ' portal-dialog-full' : ''}`} aria-label={title} onCancel={e => { e.preventDefault(); if (!closeDisabled) onClose(); }}>
    <header className="portal-dialog-heading"><div><span className="portal-eyebrow">DEXATRACK</span><h2>{title}</h2></div><button type="button" className="portal-close" onClick={onClose} aria-label="Tutup" disabled={closeDisabled}>×</button></header>
    {children}
  </dialog>;
}
