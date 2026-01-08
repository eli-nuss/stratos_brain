import { useState } from 'react';
import { MessageSquare, Plus, Trash2, MoreVertical, Loader2 } from 'lucide-react';
import { useCompanyChats, archiveChat, CompanyChat } from '@/hooks/useCompanyChats';
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
  const { chats, isLoading, refresh } = useCompanyChats();
  const [archiving, setArchiving] = useState<string | null>(null);

  const handleArchive = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to archive this chat?')) return;
    
    setArchiving(chatId);
    try {
      await archiveChat(chatId);
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

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
            <p className="text-sm text-zinc-500">No chats yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Start a chat from any asset's detail page
            </p>
          </div>
        ) : (
          <div className="py-2">
            {chats.map((chat) => (
              <div
                key={chat.chat_id}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  'group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                  selectedChatId === chat.chat_id
                    ? 'bg-zinc-800 border-l-2 border-emerald-500'
                    : 'hover:bg-zinc-800/50 border-l-2 border-transparent'
                )}
              >
                {/* Asset Type Icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    chat.asset_type === 'crypto'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-blue-500/20 text-blue-400'
                  )}
                >
                  {chat.display_name.slice(0, 2).toUpperCase()}
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {chat.display_name}
                    </span>
                    <span className="text-xs text-zinc-500 ml-2 flex-shrink-0">
                      {formatDate(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">
                      {chat.message_count} messages
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        chat.asset_type === 'crypto'
                          ? 'bg-orange-500/10 text-orange-400'
                          : 'bg-blue-500/10 text-blue-400'
                      )}
                    >
                      {chat.asset_type}
                    </span>
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
