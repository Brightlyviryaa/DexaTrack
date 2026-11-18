import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const extensions = [StarterKit.configure({ heading: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false, link: false, strike: false, underline: false })];

export default function RichTextEditor({ value, onChange, readOnly = false }: { value?: JSONContent; onChange?: (value: JSONContent) => void; readOnly?: boolean }) {
  const editor = useEditor({
    extensions, content: value, editable: !readOnly,
    editorProps: { attributes: { 'aria-label': readOnly ? 'Laporan progress' : 'Progress hari ini', role: 'textbox', 'aria-multiline': 'true', ...(readOnly ? { 'aria-readonly': 'true' } : {}) } },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    shouldRerenderOnTransaction: true,
  });
  return <div className={`progress-editor${readOnly ? ' progress-readonly' : ''}`}>
    {!readOnly && <div className="progress-toolbar" role="toolbar" aria-label="Format progress">
      <button type="button" aria-label="Tebal" aria-pressed={editor?.isActive('bold') ?? false} onClick={() => editor?.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button type="button" aria-label="Miring" aria-pressed={editor?.isActive('italic') ?? false} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
      <span />
      <button type="button" aria-label="Daftar bullet" aria-pressed={editor?.isActive('bulletList') ?? false} onClick={() => editor?.chain().focus().toggleBulletList().run()}>• ≡</button>
      <button type="button" aria-label="Daftar bernomor" aria-pressed={editor?.isActive('orderedList') ?? false} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. ≡</button>
      <span />
      <button type="button" aria-label="Urungkan" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>↶</button>
      <button type="button" aria-label="Ulangi" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>↷</button>
    </div>}
    <EditorContent editor={editor} />
  </div>;
}
