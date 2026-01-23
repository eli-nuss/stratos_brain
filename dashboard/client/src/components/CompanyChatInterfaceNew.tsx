import { Sparkles } from 'lucide-react';
import { SourcesPanel } from './SourcesPanel';
import { StudioPanel } from './StudioPanel';
import { useSources } from '@/hooks/useSources';
import { useStudio } from '@/hooks/useStudio';
import {
  useChatMessages,
  useSendMessage,
  refreshChatContext,
  clearChatMessages,
  ChatMessage,
  CompanyChat,
} from '@/hooks/useCompanyChats';
import { useAuth } from '@/contexts/AuthContext';
import { CompanySidePanel } from './CompanySidePanel';
import { BaseChatInterface, SuggestedQuestion, SummaryResult } from './chat';

interface CompanyChatInterfaceProps {
  chat: CompanyChat;
  onRefresh?: () => void;
}

const suggestedQuestions: SuggestedQuestion[] = [
  { text: "What are the key financial metrics?", icon: "📊" },
  { text: "Analyze the recent price action", icon: "📈" },
  { text: "What are the main risks?", icon: "⚠️" },
  { text: "Compare to sector peers", icon: "🔍" },
];

export function CompanyChatInterfaceNew({ chat, onRefresh }: CompanyChatInterfaceProps) {
  const { user } = useAuth();
  const userId = user?.id || null;

  // Messages hook
  const { 
    messages, 
    isLoading: messagesLoading, 
    refresh: refreshMessages 
  } = useChatMessages(chat.chat_id);

  // Sources hook
  const {
    sources,
    isLoading: sourcesLoading,
    addSource,
    toggleSource,
    deleteSource,
    reprocessSource,
    getSourceContext,
  } = useSources({ chatId: chat.chat_id });

  // Studio hook
  const {
    outputs,
    isGenerating,
    isLoading: studioLoading,
    generate,
    deleteOutput,
  } = useStudio({ chatId: chat.chat_id });

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
  } = useSendMessage(chat.chat_id);

  // Handlers
  const handleRefreshContext = async () => {
    await refreshChatContext(chat.chat_id, userId);
  };

  const handleClearChat = async () => {
    await clearChatMessages(chat.chat_id, userId);
  };

  const handleSummarize = async (): Promise<SummaryResult | null> => {
    const response = await fetch(`/api/company-chat-api/chats/${chat.chat_id}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId || '',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to summarize chat');
    }
    
    return response.json();
  };

  // Sources panel with Studio - always visible on the right
  const sourcesPanel = (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sources Panel */}
      <SourcesPanel
        chatId={chat.chat_id}
        sources={sources}
        isLoading={sourcesLoading}
        onAddSource={addSource}
        onToggleSource={toggleSource}
        onDeleteSource={deleteSource}
        onReprocessSource={reprocessSource}
      />
      {/* Studio Panel */}
      <StudioPanel
        chatId={chat.chat_id}
        outputs={outputs}
        isGenerating={isGenerating}
        isLoading={studioLoading}
        onGenerate={generate}
        onDelete={deleteOutput}
      />
    </div>
  );

  // Data panel - optional popout with Technicals/Fundamentals
  const dataPanel = (
    <CompanySidePanel
      assetId={chat.asset_id}
      assetType={chat.asset_type}
      className="h-full"
    />
  );

  return (
    <BaseChatInterface<ChatMessage>
      chatId={chat.chat_id}
      displayName={chat.display_name}
      theme="company"
      messages={messages}
      messagesLoading={messagesLoading}
      refreshMessages={refreshMessages}
      sendMessage={async (message, model) => {
        // Get source context before sending
        const sourceContext = await getSourceContext();
        // Include source context in the message if there are sources
        const messageWithContext = sourceContext.sourceCount > 0
          ? `[User has provided ${sourceContext.sourceCount} sources with ${sourceContext.totalWords} words of context]\n\n${message}`
          : message;
        return sendMessage(messageWithContext, model);
      }}
      resetSendState={resetSendState}
      isSending={isSending}
      isProcessing={isProcessing}
      isRecovering={isRecovering}
      isComplete={isComplete}
      error={error}
      streamingText={streamingText}
      activeTools={activeTools}
      isStreaming={isStreaming}
      toolCalls={toolCalls}
      onRefresh={onRefresh}
      onClearChat={handleClearChat}
      onSummarize={handleSummarize}
      onRefreshContext={handleRefreshContext}
      sourcesPanel={sourcesPanel}
      dataPanel={dataPanel}
      dataPanelTitle="Data"
      suggestedQuestions={suggestedQuestions}
      placeholder="Ask about the company..."
      AvatarIcon={Sparkles}
    />
  );
}

export default CompanyChatInterfaceNew;
