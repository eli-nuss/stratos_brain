import { Brain } from 'lucide-react';
import {
  useBrainMessages,
  useSendBrainMessage,
  clearBrainMessages,
  BrainMessage,
  BrainChat,
} from '@/hooks/useBrainChats';
import { useAuth } from '@/contexts/AuthContext';
import { GLOBAL_CHAT_API_BASE, getJsonApiHeaders } from '@/lib/api-config';
import { BaseChatInterface, SuggestedQuestion, SummaryResult } from './chat';

interface BrainChatInterfaceProps {
  chat: BrainChat;
  onRefresh?: () => void;
}

const suggestedQuestions: SuggestedQuestion[] = [
  { text: "What are the top momentum stocks today?", icon: "🚀" },
  { text: "Screen for oversold quality names", icon: "🔍" },
  { text: "What's the current market regime?", icon: "📊" },
  { text: "Build a diversified tech portfolio", icon: "💼" },
];

export function BrainChatInterfaceNew({ chat, onRefresh }: BrainChatInterfaceProps) {
  const { user } = useAuth();
  const userId = user?.id || null;

  // Messages hook
  const { 
    messages, 
    isLoading: messagesLoading, 
    refresh: refreshMessages 
  } = useBrainMessages(chat.chat_id);

  // Send message hook with all streaming state
  const {
    sendMessage,
    reset: resetSendState,
    isSending,
    isRecovering,
    isProcessing,
    error,
    toolCalls,
    isComplete,
    streamingText,
    activeTools,
    isStreaming,
  } = useSendBrainMessage(chat.chat_id);

  // Handlers
  const handleClearChat = async () => {
    await clearBrainMessages(chat.chat_id);
  };

  const handleSummarize = async (): Promise<SummaryResult | null> => {
    const response = await fetch(`${GLOBAL_CHAT_API_BASE}/chats/${chat.chat_id}/summarize`, {
      method: 'POST',
      headers: getJsonApiHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to summarize chat');
    }
    
    return response.json();
  };

  return (
    <BaseChatInterface<BrainMessage>
      chatId={chat.chat_id}
      displayName={chat.title}
      theme="brain"
      messages={messages}
      messagesLoading={messagesLoading}
      refreshMessages={refreshMessages}
      sendMessage={sendMessage}
      resetSendState={resetSendState}
      isSending={isSending}
      isProcessing={isProcessing}
      isRecovering={isRecovering}
      isComplete={isComplete}
      error={error}
      streamingText={streamingText}
      activeTools={activeTools || []}
      isStreaming={isStreaming || false}
      toolCalls={toolCalls}
      onRefresh={onRefresh}
      onClearChat={handleClearChat}
      onSummarize={handleSummarize}
      suggestedQuestions={suggestedQuestions}
      welcomeTitle={<>Welcome to <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Stratos Brain</span></>}
      welcomeSubtitle="Your autonomous Chief Investment Officer. I can screen markets, analyze macro conditions, and help build investment theses."
      placeholder="Ask me anything..."
      AvatarIcon={Brain}
    />
  );
}

export default BrainChatInterfaceNew;
