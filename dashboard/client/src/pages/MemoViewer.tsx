import { useState, useEffect } from "react";
import { useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";

export default function MemoViewer() {
  const params = useParams();
  const fileId = params.id;
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoInfo, setMemoInfo] = useState<any>(null);

  useEffect(() => {
    if (!fileId) return;

    // First fetch memo info to get the file path
    fetch(`/api/dashboard/memos`)
      .then(res => res.json())
      .then(memos => {
        const memo = memos.find((m: any) => m.file_id === parseInt(fileId));
        if (!memo) throw new Error('Memo not found');
        setMemoInfo(memo);
        return fetch(memo.file_path);
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch memo content');
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [fileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p className="text-xl font-semibold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print-friendly styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>
      
      {/* Header bar - hidden when printing */}
      <div className="no-print sticky top-0 bg-gray-100 border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-base sm:text-lg font-bold text-gray-900">{memoInfo?.symbol}</span>
          <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline">{memoInfo?.name}</span>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
            {memoInfo?.file_type === 'memo' ? 'Memo' : 'One Pager'}
          </span>
        </div>
        <button 
          onClick={() => window.print()}
          className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({children}) => (
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b-2 border-gray-200">
                {children}
              </h1>
            ),
            h2: ({children}) => (
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mt-8 sm:mt-10 mb-4 sm:mb-5">
                {children}
              </h2>
            ),
            h3: ({children}) => (
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mt-6 sm:mt-8 mb-3 sm:mb-4">
                {children}
              </h3>
            ),
            p: ({children}) => (
              <p className="text-gray-700 leading-7 sm:leading-8 mb-4 sm:mb-5 text-sm sm:text-base">
                {children}
              </p>
            ),
            strong: ({children}) => (
              <strong className="font-semibold text-gray-900">{children}</strong>
            ),
            em: ({children}) => (
              <em className="italic text-gray-700">{children}</em>
            ),
            ul: ({children}) => (
              <ul className="list-disc list-outside ml-5 sm:ml-8 mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-gray-700">
                {children}
              </ul>
            ),
            ol: ({children}) => (
              <ol className="list-decimal list-outside ml-5 sm:ml-8 mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-gray-700">
                {children}
              </ol>
            ),
            li: ({children}) => (
              <li className="leading-6 sm:leading-7 text-sm sm:text-base">{children}</li>
            ),
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-blue-500 pl-4 sm:pl-6 py-2 sm:py-3 my-4 sm:my-6 bg-blue-50 rounded-r-lg text-gray-600 italic text-sm sm:text-base">
                {children}
              </blockquote>
            ),
            code: ({className, children}) => {
              const isInline = !className;
              return isInline ? (
                <code className="px-2 py-1 bg-gray-100 text-blue-600 rounded text-sm font-mono">
                  {children}
                </code>
              ) : (
                <code className={className}>{children}</code>
              );
            },
            pre: ({children}) => (
              <pre className="bg-gray-100 border border-gray-200 rounded-lg p-5 my-6 overflow-x-auto text-sm">
                {children}
              </pre>
            ),
            table: ({children}) => (
              <div className="overflow-x-auto my-4 sm:my-8 -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full border-collapse text-xs sm:text-sm min-w-[400px]">
                  {children}
                </table>
              </div>
            ),
            thead: ({children}) => (
              <thead className="bg-gray-100">{children}</thead>
            ),
            th: ({children}) => (
              <th className="border border-gray-300 px-2 sm:px-5 py-2 sm:py-3 text-left font-semibold text-gray-800 whitespace-nowrap">
                {children}
              </th>
            ),
            td: ({children}) => (
              <td className="border border-gray-300 px-2 sm:px-5 py-2 sm:py-3 text-gray-700">
                {children}
              </td>
            ),
            hr: () => (
              <hr className="border-gray-300 my-10" />
            ),
            a: ({href, children}) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500 underline underline-offset-2"
              >
                {children}
              </a>
            ),
          }}
        >
          {content || ''}
        </ReactMarkdown>
      </article>
    </div>
  );
}
