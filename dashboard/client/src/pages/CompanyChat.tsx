import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { MessageSquare, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
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
    <DashboardLayout hideNavTabs>
      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:w-72 lg:flex-shrink-0 lg:h-full
          ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Mobile close button */}
          <button
            onClick={() => setShowMobileSidebar(false)}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground lg:hidden z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {selectedChat ? (
            <CompanyChatInterface chat={selectedChat} onRefresh={refresh} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 bg-background">
              <div className="text-center max-w-sm">
                <div className="inline-flex p-4 bg-muted rounded-full mb-4">
                  <MessageSquare className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Select a chat to continue
                </h2>
                <p className="text-muted-foreground mb-6 text-sm">
                  Or start a new research chat for any company
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors lg:hidden"
                  >
                    View Chats
                  </button>
                  <button
                    onClick={handleNewChat}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                  >
                    Start New Chat
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Start New Chat</h3>
              <p className="text-sm text-muted-foreground mt-1">
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
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Creating chat...
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button
                onClick={() => setShowNewChatDialog(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isCreatingChat}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
