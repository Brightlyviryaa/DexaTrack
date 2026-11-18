import { lazy, Suspense } from 'react';
import type { JSONContent } from '@tiptap/react';

const RichTextEditor = lazy(() => import('./RichTextEditor'));
export function ProgressEditor(props: { value?: JSONContent; onChange?: (value: JSONContent) => void; readOnly?: boolean }) {
  return <Suspense fallback={<p className="portal-muted" role="status">Menyiapkan editor…</p>}><RichTextEditor {...props} /></Suspense>;
}
