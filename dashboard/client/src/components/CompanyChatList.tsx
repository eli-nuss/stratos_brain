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
    if (!dateStr) return '';
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
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Company Chats</h2>
        <button
          onClick={onNewChat}
          className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary"
          title="New Chat"
          aria-label="New Chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticker or name..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="inline-flex p-3 bg-muted/50 rounded-full mb-4">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No chats yet</p>
            <p className="text-xs text-muted-foreground mb-6">
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
          <div className="px-4 py-12 text-center">
            <Search className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No chats found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="px-2 py-1 space-y-1">
            {filteredChats.map((chat) => (
              <div
                key={chat.chat_id}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg transition-all',
                  selectedChatId === chat.chat_id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted/50 border border-transparent'
                )}
              >
                {/* Asset Type Icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                    chat.asset_type === 'crypto'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-blue-500/10 text-blue-500'
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {chat.display_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">
                      {formatDate(chat.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {chat.message_count === 0 ? 'No messages yet' : `${chat.message_count} message${chat.message_count !== 1 ? 's' : ''}`}
                  </p>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-muted transition-all"
                      aria-label="Chat options"
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => handleArchive(chat.chat_id, e as unknown as React.MouseEvent)}
                      className="text-destructive focus:text-destructive"
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
