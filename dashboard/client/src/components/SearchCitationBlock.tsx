import { ExternalLink, Search, Globe } from 'lucide-react';
import { GroundingMetadata } from '@/hooks/useCompanyChats';

interface SearchCitationBlockProps {
  metadata: GroundingMetadata;
}

export function SearchCitationBlock({ metadata }: SearchCitationBlockProps) {
  const { groundingChunks, webSearchQueries } = metadata;

  if (!groundingChunks?.length && !webSearchQueries?.length) {
    return null;
  }

  return (
    <div className="mt-3 p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
      {/* Search Queries */}
      {webSearchQueries && webSearchQueries.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              Search Queries
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {webSearchQueries.map((query, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
              >
                {query}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {groundingChunks && groundingChunks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
              Sources
            </span>
          </div>
          <div className="space-y-1.5">
            {groundingChunks.map((chunk, idx) => {
              if (!chunk.web) return null;
              const { uri, title } = chunk.web;
              const domain = new URL(uri).hostname.replace('www.', '');
              
              return (
                <a
                  key={idx}
                  href={uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800 transition-colors group"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate group-hover:text-white transition-colors">
                      {title || domain}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {domain}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
