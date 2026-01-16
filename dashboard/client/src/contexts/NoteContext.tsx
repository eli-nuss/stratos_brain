import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { NoteContext as NoteContextData, NoteContextType } from '@/hooks/useResearchNotes';

interface NotepadContextType {
  isOpen: boolean;
  currentContext: NoteContextData | null;
  openNotepad: (context?: NoteContextData) => void;
  closeNotepad: () => void;
  toggleNotepad: () => void;
  setContext: (context: NoteContextData | null) => void;
}

const NotepadContext = createContext<NotepadContextType | undefined>(undefined);

export function NotepadProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState<NoteContextData | null>(null);

  const openNotepad = useCallback((context?: NoteContextData) => {
    if (context) {
      setCurrentContext(context);
    }
    setIsOpen(true);
  }, []);

  const closeNotepad = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleNotepad = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const setContext = useCallback((context: NoteContextData | null) => {
    setCurrentContext(context);
  }, []);

  return (
    <NotepadContext.Provider value={{
      isOpen,
      currentContext,
      openNotepad,
      closeNotepad,
      toggleNotepad,
      setContext,
    }}>
      {children}
    </NotepadContext.Provider>
  );
}

export function useNotepad() {
  const context = useContext(NotepadContext);
  if (context === undefined) {
    throw new Error('useNotepad must be used within a NotepadProvider');
  }
  return context;
}

// Helper hook to detect and set context based on current page
export function usePageContext(): NoteContextData {
  // This will be called from components that know their context
  // Default to general if no specific context
  return { type: 'general' };
}
