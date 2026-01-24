import { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { SourcesPanel } from './SourcesPanel';
import { StudioPanel } from './StudioPanel';
import { ExcalidrawEditor } from './ExcalidrawEditor';
import { useSources } from '@/hooks/useSources';
import { useDiagrams, type ExcalidrawScene } from '@/hooks/useDiagrams';
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

  // Diagrams hook
  const {
    diagrams,
    isLoading: diagramsLoading,
    isGenerating: diagramGenerating,
    createDiagram,
    generateDiagram,
    updateDiagram,
    deleteDiagram,
    getDiagram,
    exportDiagram,
  } = useDiagrams({ chatId: chat.chat_id });

  // Diagram editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeDiagram, setActiveDiagram] = useState<typeof diagrams[0] | null>(null);

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

  // Diagram handlers
  const handleCreateDiagram = useCallback(async (prompt?: string) => {
    if (prompt) {
      // AI-generated diagram - use the dedicated diagram generator endpoint
      try {
        const newDiagram = await generateDiagram(
          prompt,
          chat.symbol, // company symbol
          chat.name,   // company name
          undefined    // chat summary (could be added later)
        );
        // Automatically open the generated diagram
        setActiveDiagram(newDiagram);
        setEditorOpen(true);
      } catch (err) {
        console.error('Failed to generate diagram:', err);
        // Error is already set in the hook
      }
    } else {
      // Blank canvas - create empty diagram directly
      const newDiagram = await createDiagram({
        name: 'Untitled Diagram',
        description: 'New blank diagram',
        is_ai_generated: false,
      });
      setActiveDiagram(newDiagram);
      setEditorOpen(true);
    }
  }, [createDiagram, generateDiagram, chat.symbol, chat.name]);

  const handleOpenDiagram = useCallback(async (diagramId: string) => {
    const diagram = await getDiagram(diagramId);
    setActiveDiagram(diagram);
    setEditorOpen(true);
  }, [getDiagram]);

  const handleSaveDiagram = useCallback(async (diagramId: string, data: ExcalidrawScene) => {
    await updateDiagram(diagramId, { excalidraw_data: data });
  }, [updateDiagram]);

  const handleExportDiagram = useCallback(async (diagramId: string, format: 'png' | 'json') => {
    const diagram = await getDiagram(diagramId);
    
    if (format === 'json') {
      // Export as Excalidraw JSON
      const blob = new Blob([JSON.stringify(diagram.excalidraw_data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagram.name.replace(/[^a-z0-9]/gi, '_')}.excalidraw`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // PNG export would require rendering Excalidraw - for now, open the editor
      setActiveDiagram(diagram);
      setEditorOpen(true);
    }
  }, [getDiagram]);

  const handleExportPng = useCallback(async (diagramId: string) => {
    // This will be handled by the Excalidraw editor's export functionality
    console.log('PNG export for diagram:', diagramId);
  }, []);

  const handleExportJson = useCallback(async (diagramId: string) => {
    await handleExportDiagram(diagramId, 'json');
  }, [handleExportDiagram]);

  // Sources panel - always visible on the right
  const sourcesPanel = (
    <>
      <SourcesPanel
        chatId={chat.chat_id}
        sources={sources}
        isLoading={sourcesLoading}
        onAddSource={addSource}
        onToggleSource={toggleSource}
        onDeleteSource={deleteSource}
        onReprocessSource={reprocessSource}
      />
      <StudioPanel
        chatId={chat.chat_id}
        diagrams={diagrams}
        isLoading={diagramsLoading}
        isGenerating={diagramGenerating}
        onCreateDiagram={handleCreateDiagram}
        onOpenDiagram={handleOpenDiagram}
        onDeleteDiagram={deleteDiagram}
        onExportDiagram={handleExportDiagram}
      />
    </>
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
    <>
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
      
      {/* Excalidraw Editor Modal */}
      <ExcalidrawEditor
        isOpen={editorOpen}
        diagram={activeDiagram}
        onClose={() => {
          setEditorOpen(false);
          setActiveDiagram(null);
        }}
        onSave={handleSaveDiagram}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
      />
    </>
  );
}

export default CompanyChatInterfaceNew;
