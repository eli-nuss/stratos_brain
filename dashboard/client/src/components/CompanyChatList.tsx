import { useState, useMemo } from 'react';
import { MessageSquare, Plus, Trash2, MoreVertical, Loader2, Search, X, TrendingUp, Bitcoin } from 'lucide-react';
import { useCompanyChats, archiveChat, CompanyChat } from '@/hooks/useCompanyChats';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CompanyChatListProps {
  selectedChatId: string | null;
  onSelectChat: (chat: CompanyChat) => void;
  onNewChat: () => void;
}

export function CompanyChatList({ selectedChatId, onSelectChat, onNewChat }: CompanyChatListProps) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { chats, isLoading, refresh } = useCompanyChats();
  const [archiving, setArchiving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter chats based on search query (matches display_name which contains company name and ticker)
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    
    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) => 
      chat.display_name.toLowerCase().includes(query)
    );
  }, [chats, searchQuery]);

  const handleArchive = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to archive this chat?')) return;
    
    setArchiving(chatId);
    try {
      await archiveChat(chatId, userId);
      refresh();
    } catch (error) {
      console.error('Failed to archive chat:', error);
    } finally {
      setArchiving(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No messages';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">Company Chats</h2>
        <button
          onClick={onNewChat}
          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          title="New Chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticker or name..."
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No chats yet</p>
            <p className="text-xs text-zinc-600 mt-1 mb-4">
              Start researching any company with AI
            </p>
            <button
              onClick={onNewChat}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Start New Chat
            </button>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Search className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
            <p className="text-sm text-zinc-500">No chats found</p>
            <p className="text-xs text-zinc-600 mt-1">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredChats.map((chat) => (
              <div
                key={chat.chat_id}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                  selectedChatId === chat.chat_id
                    ? 'bg-zinc-800/80 border-l-2 border-primary'
                    : 'hover:bg-zinc-800/40 border-l-2 border-transparent'
                )}
              >
                {/* Asset Type Icon - More subtle */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                    chat.asset_type === 'crypto'
                      ? 'bg-zinc-800 text-amber-500/70'
                      : 'bg-zinc-800 text-blue-400/70'
                  )}
                >
                  {chat.asset_type === 'crypto' ? (
                    <Bitcoin className="w-4 h-4" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {chat.display_name}
                    </span>
                    <span className="text-[11px] text-zinc-500 ml-2 flex-shrink-0">
                      {formatDate(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">
                      {chat.message_count} messages
                    </span>
                    {/* Subtle dot indicator instead of badge */}
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        chat.asset_type === 'crypto'
                          ? 'bg-amber-500/50'
                          : 'bg-blue-400/50'
                      )}
                    />
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 transition-all"
                    >
                      <MoreVertical className="w-4 h-4 text-zinc-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => handleArchive(chat.chat_id, e as unknown as React.MouseEvent)}
                      className="text-red-400 focus:text-red-400"
                      disabled={archiving === chat.chat_id}
                    >
                      {archiving === chat.chat_id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
