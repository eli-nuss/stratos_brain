import { useState, useEffect } from 'react';
import { Brain, Plus, MessageSquare, Trash2, Loader2, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { BrainChatInterface } from '@/components/BrainChatInterface';
import {
  useBrainChats,
  createBrainChat,
  deleteBrainChat,
  BrainChat,
} from '@/hooks/useBrainChats';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function StratosBrain() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { chats, isLoading, refresh } = useBrainChats();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Select the first chat by default, or create one if none exist
  useEffect(() => {
    if (!isLoading && chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].chat_id);
    }
  }, [chats, isLoading, selectedChatId]);

  const selectedChat = chats.find((c) => c.chat_id === selectedChatId);

  const handleCreateChat = async () => {
    setIsCreating(true);
    try {
      const newChat = await createBrainChat('New Chat', userId);
      await refresh();
      setSelectedChatId(newChat.chat_id);
      setMobileSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create chat:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;

    setDeletingChatId(chatId);
    try {
      await deleteBrainChat(chatId, userId);
      await refresh();
      if (selectedChatId === chatId) {
        setSelectedChatId(chats.find((c) => c.chat_id !== chatId)?.chat_id || null);
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setMobileSidebarOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="lg:hidden fixed bottom-4 left-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Sidebar Overlay for mobile */}
        {mobileSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={cn(
            'flex-shrink-0 bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out',
            'fixed lg:relative inset-y-0 left-0 z-50 lg:z-0',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            sidebarCollapsed ? 'w-16' : 'w-72'
          )}
        >
          {/* Sidebar Header */}
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className={cn('flex items-center', sidebarCollapsed ? 'justify-center' : 'justify-between')}>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                    <Brain className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="font-semibold text-foreground">Stratos Brain</span>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 hover:bg-muted rounded-md transition-colors hidden lg:block"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="flex-shrink-0 p-3">
            <button
              onClick={handleCreateChat}
              disabled={isCreating}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all disabled:opacity-50',
                sidebarCollapsed && 'justify-center px-2'
              )}
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {!sidebarCollapsed && <span className="text-sm font-medium">New Chat</span>}
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-minimal">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : chats.length === 0 ? (
              <div className={cn('text-center py-8', sidebarCollapsed && 'hidden')}>
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No chats yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "New Chat" to get started
                </p>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.chat_id}
                  onClick={() => handleSelectChat(chat.chat_id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all group',
                    selectedChatId === chat.chat_id
                      ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                    sidebarCollapsed && 'justify-center px-2'
                  )}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{chat.title}</p>
                        {chat.last_message_at && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(chat.last_message_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(chat.chat_id, e)}
                        disabled={deletingChatId === chat.chat_id}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                      >
                        {deletingChatId === chat.chat_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Sidebar Footer */}
          {!sidebarCollapsed && (
            <div className="flex-shrink-0 p-4 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center">
                Powered by Gemini 3 Pro
              </p>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedChat ? (
            <BrainChatInterface chat={selectedChat} onRefresh={refresh} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <div className="inline-flex p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4">
                  <Brain className="w-12 h-12 text-purple-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Stratos Brain
                </h2>
                <p className="text-muted-foreground mb-6">
                  Your autonomous Chief Investment Officer. Screen markets, analyze macro conditions, and build investment theses.
                </p>
                <button
                  onClick={handleCreateChat}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all disabled:opacity-50 font-medium"
                >
                  {isCreating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  Start a New Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
