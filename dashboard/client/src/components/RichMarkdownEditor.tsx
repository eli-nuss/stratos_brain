import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { useEffect, useCallback } from 'react';
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
  RowsIcon,
  ColumnsIcon,
  Pilcrow,
} from 'lucide-react';

interface RichMarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

// Convert Markdown to HTML for TipTap
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');
  
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Tables - convert markdown tables to HTML
  const tableRegex = /\|(.+)\|\n\|[-:\| ]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').filter((h: string) => h.trim()).map((h: string) => `<th>${h.trim()}</th>`).join('');
    const rows = bodyRows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });
  
  // Paragraphs - wrap remaining text in p tags
  html = html.split('\n\n').map(block => {
    if (block.startsWith('<') || block.trim() === '') return block;
    return `<p>${block}</p>`;
  }).join('\n');
  
  return html;
}

// Convert TipTap HTML back to Markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let md = html;
  
  // Headers
  md = md.replace(/<h1>(.*?)<\/h1>/g, '# $1\n');
  md = md.replace(/<h2>(.*?)<\/h2>/g, '## $1\n');
  md = md.replace(/<h3>(.*?)<\/h3>/g, '### $1\n');
  
  // Bold and Italic
  md = md.replace(/<strong><em>(.*?)<\/em><\/strong>/g, '***$1***');
  md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/g, '*$1*');
  
  // Strikethrough
  md = md.replace(/<s>(.*?)<\/s>/g, '~~$1~~');
  
  // Code blocks
  md = md.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```');
  
  // Inline code
  md = md.replace(/<code>(.*?)<\/code>/g, '`$1`');
  
  // Blockquotes
  md = md.replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n');
  
  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/g, '\n---\n');
  
  // Lists - handle lists with attributes/classes
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n');
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (match, content) => {
    let i = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/g, () => `${i++}. $1\n`);
  });
  
  // Tables - handle TipTap's styled tables with classes and attributes
  // This regex matches tables with any attributes (class, style, etc.)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (match, content) => {
    // First, strip colgroup elements entirely
    let cleanContent = content.replace(/<colgroup>[\s\S]*?<\/colgroup>/g, '');
    
    const headerMatch = cleanContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
    const bodyMatch = cleanContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
    
    let result = '';
    
    if (headerMatch) {
      // Match th tags with any attributes and capture content (including nested tags)
      const headerRowMatch = headerMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
      if (headerRowMatch) {
        const headerCells: string[] = [];
        const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/g;
        let thMatch;
        while ((thMatch = thRegex.exec(headerRowMatch[1])) !== null) {
          // Strip any remaining HTML tags and clean up whitespace
          const cellContent = thMatch[1]
            .replace(/<[^>]*>/g, '')
            .replace(/\n+/g, ' ')
            .trim();
          headerCells.push(cellContent);
        }
        if (headerCells.length > 0) {
          result += '| ' + headerCells.join(' | ') + ' |\n';
          result += '| ' + headerCells.map(() => '---').join(' | ') + ' |\n';
        }
      }
    }
    
    if (bodyMatch) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(bodyMatch[1])) !== null) {
        const cellValues: string[] = [];
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        let tdMatch;
        while ((tdMatch = tdRegex.exec(rowMatch[1])) !== null) {
          // Strip any remaining HTML tags and clean up whitespace
          const cellContent = tdMatch[1]
            .replace(/<[^>]*>/g, '')
            .replace(/\n+/g, ' ')
            .trim();
          cellValues.push(cellContent);
        }
        if (cellValues.length > 0) {
          result += '| ' + cellValues.join(' | ') + ' |\n';
        }
      }
    }
    
    // If we couldn't parse thead/tbody, try parsing rows directly (for tables without thead/tbody)
    if (!result) {
      const rows = cleanContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
      let isFirstRow = true;
      rows.forEach((row: string) => {
        const cellValues: string[] = [];
        // Try th first, then td
        const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(row)) !== null) {
          const cellContent = cellMatch[1]
            .replace(/<[^>]*>/g, '')
            .replace(/\n+/g, ' ')
            .trim();
          cellValues.push(cellContent);
        }
        if (cellValues.length > 0) {
          result += '| ' + cellValues.join(' | ') + ' |\n';
          if (isFirstRow) {
            result += '| ' + cellValues.map(() => '---').join(' | ') + ' |\n';
            isFirstRow = false;
          }
        }
      });
    }
    
    return result + '\n';
  });
  
  // Paragraphs
  md = md.replace(/<p>(.*?)<\/p>/g, '$1\n\n');
  
  // Clean up extra whitespace
  md = md.replace(/<br\s*\/?>/g, '\n');
  md = md.replace(/\n{3,}/g, '\n\n');
  
  return md.trim();
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
    className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-6 bg-gray-700 mx-1" />;

export function RichMarkdownEditor({ content, onChange, placeholder = 'Start typing...' }: RichMarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-600',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-600 bg-gray-800 px-3 py-2 text-left font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-600 px-3 py-2',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Highlight,
      Typography,
    ],
    content: markdownToHtml(content),
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== htmlToMarkdown(editor.getHTML())) {
      editor.commands.setContent(markdownToHtml(content));
    }
  }, [content, editor]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) {
    return <div className="p-4 text-gray-500">Loading editor...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-900 border-b border-gray-800">
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
          title="Blockquote"
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
          title="Insert Table"
        >
          <TableIcon className="w-4 h-4" />
        </MenuButton>
        
        {editor.isActive('table') && (
          <>
            <MenuButton
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              title="Add Column"
            >
              <ColumnsIcon className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().addRowAfter().run()}
              title="Add Row"
            >
              <RowsIcon className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().deleteTable().run()}
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

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* Editor styles */}
      <style>{`
        .ProseMirror {
          min-height: 500px;
          padding: 1rem;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #f3f4f6;
        }
        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #e5e7eb;
        }
        .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #d1d5db;
        }
        .ProseMirror p {
          margin-bottom: 0.75rem;
          color: #d1d5db;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror li {
          margin-bottom: 0.25rem;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #4b5563;
          padding-left: 1rem;
          margin-left: 0;
          color: #9ca3af;
          font-style: italic;
        }
        .ProseMirror code {
          background: #374151;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875rem;
        }
        .ProseMirror pre {
          background: #1f2937;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-bottom: 0.75rem;
        }
        .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid #4b5563;
          margin: 1.5rem 0;
        }
        .ProseMirror table {
          border-collapse: collapse;
          margin: 1rem 0;
          width: 100%;
        }
        .ProseMirror th, .ProseMirror td {
          border: 1px solid #4b5563;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .ProseMirror th {
          background: #374151;
          font-weight: 600;
        }
        .ProseMirror .is-empty::before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
          float: left;
          height: 0;
        }
        .ProseMirror-selectednode {
          outline: 2px solid #3b82f6;
        }
      `}</style>
    </div>
  );
}

export default RichMarkdownEditor;
