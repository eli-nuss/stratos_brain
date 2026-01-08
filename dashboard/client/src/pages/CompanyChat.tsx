import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { CompanyChatList } from '@/components/CompanyChatList';
import { CompanyChatInterface } from '@/components/CompanyChatInterface';
import { useCompanyChats, createOrGetChat, CompanyChat } from '@/hooks/useCompanyChats';
import { AssetSearchForChat } from '@/components/AssetSearchForChat';

export default function CompanyChatPage() {
  const [, params] = useRoute('/chat/:chatId');
  const [location, setLocation] = useLocation();
  const { chats, refresh } = useCompanyChats();
  const [selectedChat, setSelectedChat] = useState<CompanyChat | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);

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
      
      createOrGetChat(assetId, assetType || 'equity', displayName)
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
        `${asset.name} (${asset.symbol})`
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

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0">
        <CompanyChatList
          selectedChatId={selectedChat?.chat_id || null}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800 bg-zinc-900">
          <a
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
        </div>

        {/* Chat Area */}
        {selectedChat ? (
          <CompanyChatInterface chat={selectedChat} onRefresh={refresh} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex p-4 bg-zinc-800/50 rounded-full mb-4">
                <MessageSquare className="w-10 h-10 text-zinc-600" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-300 mb-2">
                Select a chat to continue
              </h2>
              <p className="text-zinc-500 mb-6">
                Or start a new research chat for any company
              </p>
              <button
                onClick={handleNewChat}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white">Start New Chat</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Search for a company to start researching
              </p>
            </div>
            <div className="p-6">
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
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
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
