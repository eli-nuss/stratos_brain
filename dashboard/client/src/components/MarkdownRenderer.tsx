import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Custom code block with syntax highlighting and copy button
function CodeBlock({ 
  language, 
  children 
}: { 
  language: string | undefined; 
  children: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lang = language?.toLowerCase() || 'text';

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-zinc-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {lang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code */}
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'rgb(24 24 27 / 0.8)',
          fontSize: '0.8125rem',
          lineHeight: '1.6',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          }
        }}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
}

// Inline code styling
function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 bg-zinc-700/60 text-emerald-300 text-[0.8125rem] font-mono rounded">
      {children}
    </code>
  );
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Pre-process content to handle common issues
  const processedContent = useMemo(() => {
    return content
      // Fix double-escaped newlines
      .replace(/\\n/g, '\n')
      // Ensure proper spacing around headers
      .replace(/([^\n])(\n#{1,6} )/g, '$1\n$2');
  }, [content]);

  return (
    <div className={cn('markdown-content overflow-hidden break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mt-6 mb-3 pb-2 border-b border-zinc-700/50">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-white mt-5 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-white mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-zinc-200 mt-3 mb-1">
              {children}
            </h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-sm text-zinc-200 leading-relaxed mb-3 last:mb-0">
              {children}
            </p>
          ),

          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),

          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-zinc-300">{children}</em>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 decoration-emerald-400/30 hover:decoration-emerald-300/50 transition-colors inline-flex items-center gap-1"
            >
              {children}
              <ExternalLink className="w-3 h-3 inline-block" />
            </a>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="my-3 ml-1 space-y-1.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-1 space-y-1.5 list-decimal list-inside">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-zinc-200 leading-relaxed flex items-start gap-2">
              <span className="text-emerald-400 mt-1.5 flex-shrink-0">•</span>
              <span className="flex-1">{children}</span>
            </li>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-2 border-emerald-500/50 bg-emerald-500/5 py-2 pr-4 rounded-r-lg">
              <div className="text-sm text-zinc-300 italic">{children}</div>
            </blockquote>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="my-6 border-zinc-700/50" />
          ),

          // Code blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;
            
            if (isInline) {
              return <InlineCode>{children}</InlineCode>;
            }

            return (
              <CodeBlock language={match?.[1]}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },

          // Pre (wrapper for code blocks)
          pre: ({ children }) => (
            <>{children}</>
          ),

          // Tables
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-zinc-700/50">
              <table className="w-full text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-800/80 border-b border-zinc-700/50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-zinc-700/30">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-zinc-800/30 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-zinc-200 whitespace-normal break-words max-w-xs">
              {children}
            </td>
          ),

          // Images
          img: ({ src, alt }) => (
            <div className="my-4">
              <img
                src={src}
                alt={alt || ''}
                className="max-w-full h-auto rounded-lg border border-zinc-700/50"
              />
              {alt && (
                <p className="mt-2 text-xs text-zinc-500 text-center italic">
                  {alt}
                </p>
              )}
            </div>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
