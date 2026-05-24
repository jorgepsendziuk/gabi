import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@gabi/ui';

interface ReportEditorProps {
  content: string;
  onChange: (html: string) => void;
  columns: Array<{ field: string; header: string }>;
  disabled?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`gabi-btn gabi-btn--sm ${active ? 'gabi-btn--accent' : 'gabi-btn--outline'}`}
    >
      {children}
    </button>
  );
}

export function ReportEditor({ content, onChange, columns, disabled }: ReportEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return <p className="text-sm text-gabi-muted">Carregando editor…</p>;
  }

  const insertField = (field: string) => {
    editor.chain().focus().insertContent(`{{${field}}}`).run();
  };

  return (
    <div className="border border-[var(--gabi-border)] rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap gap-2 p-2 border-b border-[var(--gabi-border)] bg-slate-50">
        <ToolbarButton
          title="Negrito"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Itálico"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Título"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Lista"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>
        <span className="w-px h-6 bg-[var(--gabi-border)] self-center mx-1" />
        <ToolbarButton
          title="Inserir data"
          onClick={() => insertField('__date__')}
        >
          Data
        </ToolbarButton>
        <ToolbarButton
          title="Inserir título"
          onClick={() => insertField('__title__')}
        >
          Título
        </ToolbarButton>
      </div>

      {columns.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 border-b border-[var(--gabi-border)] bg-white">
          <span className="text-xs text-gabi-muted self-center mr-1">Campos:</span>
          {columns.map((c) => (
            <Button
              key={c.field}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertField(c.field)}
              disabled={disabled}
            >
              {c.header}
            </Button>
          ))}
        </div>
      )}

      <EditorContent
        editor={editor}
        className="gabi-report-editor min-h-[280px] p-4 prose prose-sm max-w-none focus:outline-none"
      />
    </div>
  );
}
