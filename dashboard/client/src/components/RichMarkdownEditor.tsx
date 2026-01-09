import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Table as TableIcon,
  Trash2,
  Plus,
  Pilcrow,
} from 'lucide-react';

interface RichMarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MenuButton = ({ 
  onClick, 
  isActive = false, 
  disabled = false,
  children,
  title 
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-md hover:bg-gray-700 transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-gray-700 mx-1" />;

export function RichMarkdownEditor({ content, onChange, placeholder = 'Start typing...' }: RichMarkdownEditorProps) {
  const isInitialMount = useRef(true);
  const lastContent = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-gray-800 rounded-lg p-4 font-mono text-sm overflow-x-auto',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-blue-500 pl-4 italic text-gray-300',
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc list-outside ml-6 space-y-1',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal list-outside ml-6 space-y-1',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'pl-1',
          },
        },
        horizontalRule: {
          HTMLAttributes: {
            class: 'border-gray-600 my-6',
          },
        },
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse w-full my-4',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: '',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-600 bg-gray-800 px-4 py-2 text-left font-semibold text-gray-200',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-600 px-4 py-2 text-gray-300',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'before:content-[attr(data-placeholder)] before:text-gray-500 before:float-left before:h-0 before:pointer-events-none',
      }),
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[500px] p-6',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      lastContent.current = markdown;
      onChange(markdown);
    },
  });

  // Update editor content when prop changes (e.g., from database refresh)
  useEffect(() => {
    if (editor && content !== lastContent.current) {
      // Only update if content actually changed from external source
      lastContent.current = content;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 4, withHeaderRow: true }).run();
  }, [editor]);

  const addRowAfter = useCallback(() => {
    editor?.chain().focus().addRowAfter().run();
  }, [editor]);

  const addColumnAfter = useCallback(() => {
    editor?.chain().focus().addColumnAfter().run();
  }, [editor]);

  const deleteTable = useCallback(() => {
    editor?.chain().focus().deleteTable().run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950 text-gray-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-3 bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        {/* Text formatting */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </MenuButton>

        <Divider />

        {/* Headings */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          title="Paragraph"
        >
          <Pilcrow className="w-4 h-4" />
        </MenuButton>

        <Divider />

        {/* Lists */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="w-4 h-4" />
        </MenuButton>

        <Divider />

        {/* Table */}
        <MenuButton
          onClick={insertTable}
          isActive={editor.isActive('table')}
          title="Insert Table"
        >
          <TableIcon className="w-4 h-4" />
        </MenuButton>
        
        {editor.isActive('table') && (
          <>
            <MenuButton
              onClick={addRowAfter}
              title="Add Row"
            >
              <div className="flex items-center gap-0.5">
                <Plus className="w-3 h-3" />
                <span className="text-xs">Row</span>
              </div>
            </MenuButton>
            <MenuButton
              onClick={addColumnAfter}
              title="Add Column"
            >
              <div className="flex items-center gap-0.5">
                <Plus className="w-3 h-3" />
                <span className="text-xs">Col</span>
              </div>
            </MenuButton>
            <MenuButton
              onClick={deleteTable}
              title="Delete Table"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </MenuButton>
          </>
        )}

        <Divider />

        {/* Undo/Redo */}
        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Editor Content with Notion-like styling */}
      <div className="flex-1 overflow-auto">
        <style>{`
          .ProseMirror {
            color: #e5e7eb;
            line-height: 1.7;
          }
          .ProseMirror h1 {
            font-size: 2.25rem;
            font-weight: 700;
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: #f9fafb;
            border-bottom: 1px solid #374151;
            padding-bottom: 0.5rem;
          }
          .ProseMirror h2 {
            font-size: 1.75rem;
            font-weight: 600;
            margin-top: 1.75rem;
            margin-bottom: 0.75rem;
            color: #f3f4f6;
          }
          .ProseMirror h3 {
            font-size: 1.35rem;
            font-weight: 600;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            color: #e5e7eb;
          }
          .ProseMirror p {
            margin-bottom: 0.75rem;
          }
          .ProseMirror ul,
          .ProseMirror ol {
            margin-bottom: 1rem;
            padding-left: 1.5rem;
          }
          .ProseMirror li {
            margin-bottom: 0.25rem;
          }
          .ProseMirror li p {
            margin-bottom: 0.25rem;
          }
          .ProseMirror blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 1rem;
            margin: 1rem 0;
            color: #9ca3af;
            font-style: italic;
          }
          .ProseMirror hr {
            border: none;
            border-top: 1px solid #4b5563;
            margin: 2rem 0;
          }
          .ProseMirror code {
            background-color: #374151;
            padding: 0.125rem 0.375rem;
            border-radius: 0.25rem;
            font-family: ui-monospace, monospace;
            font-size: 0.875rem;
            color: #fbbf24;
          }
          .ProseMirror pre {
            background-color: #1f2937;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin: 1rem 0;
          }
          .ProseMirror pre code {
            background: none;
            padding: 0;
            color: #e5e7eb;
          }
          .ProseMirror table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5rem 0;
            border: 1px solid #4b5563;
            border-radius: 0.5rem;
            overflow: hidden;
          }
          .ProseMirror th {
            background-color: #1f2937;
            font-weight: 600;
            text-align: left;
            padding: 0.75rem 1rem;
            border: 1px solid #4b5563;
            color: #f3f4f6;
          }
          .ProseMirror td {
            padding: 0.75rem 1rem;
            border: 1px solid #4b5563;
            color: #d1d5db;
          }
          .ProseMirror tr:hover td {
            background-color: #111827;
          }
          .ProseMirror strong {
            font-weight: 700;
            color: #f9fafb;
          }
          .ProseMirror em {
            font-style: italic;
            color: #d1d5db;
          }
          .ProseMirror a {
            color: #60a5fa;
            text-decoration: underline;
          }
          .ProseMirror a:hover {
            color: #93c5fd;
          }
          .ProseMirror .is-empty::before {
            content: attr(data-placeholder);
            color: #6b7280;
            pointer-events: none;
            float: left;
            height: 0;
          }
        `}</style>
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

export default RichMarkdownEditor;
