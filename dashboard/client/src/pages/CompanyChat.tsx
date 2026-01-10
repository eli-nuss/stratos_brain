import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { MessageSquare, ArrowLeft, Menu, X } from 'lucide-react';
import { CompanyChatList } from '@/components/CompanyChatList';
import { CompanyChatInterface } from '@/components/CompanyChatInterface';
import { useCompanyChats, createOrGetChat, CompanyChat } from '@/hooks/useCompanyChats';
import { AssetSearchForChat } from '@/components/AssetSearchForChat';
import { useAuth } from '@/contexts/AuthContext';

export default function CompanyChatPage() {
  const [, params] = useRoute('/chat/:chatId');
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { chats, refresh } = useCompanyChats();
  const [selectedChat, setSelectedChat] = useState<CompanyChat | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Handle URL query parameters for auto-creating chats
  useEffect(() => {
    if (autoCreateAttempted) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('asset_id');
    const symbol = urlParams.get('symbol');
    const name = urlParams.get('name');
    const assetType = urlParams.get('asset_type') as 'equity' | 'crypto' | null;
    
    if (assetId && !params?.chatId) {
      setAutoCreateAttempted(true);
      const displayName = name && symbol ? `${name} (${symbol})` : symbol || `Asset ${assetId}`;
      
      createOrGetChat(assetId, assetType || 'equity', displayName, userId)
        .then((chat) => {
          refresh();
          setSelectedChat(chat);
          // Clean up URL
          window.history.replaceState({}, '', `/chat/${chat.chat_id}`);
        })
        .catch((err) => {
          console.error('Failed to auto-create chat:', err);
        });
    }
  }, [autoCreateAttempted, params?.chatId, refresh]);

  // Load chat from URL parameter
  useEffect(() => {
    if (params?.chatId && chats.length > 0) {
      const chat = chats.find((c) => c.chat_id === params.chatId);
      if (chat) {
        setSelectedChat(chat);
      }
    }
  }, [params?.chatId, chats]);

  // Close mobile sidebar when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      setShowMobileSidebar(false);
    }
  }, [selectedChat]);

  const handleSelectChat = (chat: CompanyChat) => {
    setSelectedChat(chat);
    setLocation(`/chat/${chat.chat_id}`);
  };

  const handleNewChat = () => {
    setShowNewChatDialog(true);
  };

  const handleCreateChat = async (asset: { asset_id: number; symbol: string; name: string; asset_type: string }) => {
    setIsCreatingChat(true);
    try {
      const chat = await createOrGetChat(
        asset.asset_id,
        asset.asset_type as 'equity' | 'crypto',
        `${asset.name} (${asset.symbol})`,
        userId
      );
      await refresh();
      setSelectedChat(chat);
      setLocation(`/chat/${chat.chat_id}`);
      setShowNewChatDialog(false);
    } catch (error) {
      console.error('Failed to create chat:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    setLocation('/chat');
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile unless toggled, always visible on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:w-72 lg:flex-shrink-0
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile close button */}
        <button
          onClick={() => setShowMobileSidebar(false)}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white lg:hidden z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        <CompanyChatList
          selectedChatId={selectedChat?.chat_id || null}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center gap-3 px-3 sm:px-4 py-2 border-b border-zinc-800 bg-zinc-900">
          {/* Mobile menu button - only show when no chat selected or always on mobile */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Back button - show on mobile when chat is selected */}
          {selectedChat && (
            <button
              onClick={handleBackToList}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Desktop back to dashboard link */}
          <a
            href="/"
            className="hidden sm:flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>

          {/* Mobile: Show current chat name */}
          {selectedChat && (
            <span className="text-sm font-medium text-white truncate lg:hidden flex-1">
              {selectedChat.display_name}
            </span>
          )}
        </div>

        {/* Chat Area */}
        {selectedChat ? (
          <CompanyChatInterface chat={selectedChat} onRefresh={refresh} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
              <div className="inline-flex p-4 bg-zinc-800/50 rounded-full mb-4">
                <MessageSquare className="w-10 h-10 text-zinc-600" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-300 mb-2">
                Select a chat to continue
              </h2>
              <p className="text-zinc-500 mb-6 text-sm">
                Or start a new research chat for any company
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowMobileSidebar(true)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors lg:hidden"
                >
                  View Chats
                </button>
                <button
                  onClick={handleNewChat}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                >
                  Start New Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white">Start New Chat</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Search for a company to start researching
              </p>
            </div>
            <div className="p-4 sm:p-6">
              <AssetSearchForChat
                onSelect={(asset) => handleCreateChat(asset as { asset_id: number; symbol: string; name: string; asset_type: string })}
                placeholder="Search for a company or crypto..."
                disabled={isCreatingChat}
              />
              {isCreatingChat && (
                <p className="text-sm text-zinc-500 mt-4 text-center">
                  Creating chat...
                </p>
              )}
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowNewChatDialog(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                disabled={isCreatingChat}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
