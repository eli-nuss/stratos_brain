import { useState, useCallback, useRef, Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import type { Diagram, ExcalidrawScene } from '@/hooks/useDiagrams';

// Lazy load to prevent React 18 hydration/strict-mode clashes
const Excalidraw = lazy(() => import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw })));
const WelcomeScreen = lazy(() => import('@excalidraw/excalidraw').then(module => ({ default: module.WelcomeScreen })));
const MainMenu = lazy(() => import('@excalidraw/excalidraw').then(module => ({ default: module.MainMenu })));

interface ExcalidrawEditorProps {
  isOpen: boolean;
  diagram: Diagram | null;
  onClose: () => void;
  onSave: (diagramId: string, data: ExcalidrawScene) => Promise<void>;
  onExportPng: (diagramId: string) => Promise<void>;
  onExportJson: (diagramId: string) => Promise<void>;
}

export function ExcalidrawEditor({
  isOpen, diagram, onClose, onSave, onExportPng, onExportJson
}: ExcalidrawEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const excalidrawAPIRef = useRef<any>(null);

  const handleSave = useCallback(async () => {
    if (!diagram || !excalidrawAPIRef.current) return;
    setIsSaving(true);
    try {
      const elements = excalidrawAPIRef.current.getSceneElements();
      const appState = excalidrawAPIRef.current.getAppState();
      
      await onSave(diagram.diagram_id, {
        type: 'excalidraw',
        version: 2,
        source: 'stratos-brain',
        elements,
        appState: { viewBackgroundColor: appState.viewBackgroundColor || '#1e1e1e' },
        files: excalidrawAPIRef.current.getFiles()
      });
      alert("Diagram Saved Successfully!");
    } finally {
      setIsSaving(false);
    }
  }, [diagram, onSave]);

  if (!isOpen) return null;

  return (
    // 1. FIXED POSITION CONTAINER: Locks Excalidraw to the viewport, preventing infinite scrolling
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, backgroundColor: '#1e1e1e' }}>
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
      }>
        <Excalidraw
          excalidrawAPI={(api: any) => { excalidrawAPIRef.current = api; }}
          initialData={{
            elements: diagram?.excalidraw_data?.elements || [],
            appState: { viewBackgroundColor: '#1e1e1e', theme: 'dark' },
            scrollToContent: true,
          }}
          theme="dark"
        >
          {/* 2. NATIVE UI INTEGRATION: Uses Excalidraw's built-in menus so styles don't break */}
          <MainMenu>
            <MainMenu.Item onSelect={handleSave}>
              💾 Save to Stratos Brain
            </MainMenu.Item>
            <MainMenu.Item onSelect={() => diagram && onExportJson(diagram.diagram_id)}>
              📄 Export as JSON
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.Item onSelect={onClose} style={{ color: '#ff6b6b' }}>
              ❌ Close & Return to Chat
            </MainMenu.Item>
          </MainMenu>

          <WelcomeScreen>
            <WelcomeScreen.Hints.MenuHint />
            <WelcomeScreen.Hints.ToolbarHint />
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Heading>
                {diagram?.name || "Stratos Diagram Editor"}
              </WelcomeScreen.Center.Heading>
              {diagram?.is_ai_generated && (
                <p style={{ color: '#a78bfa', fontSize: '14px', marginTop: '8px' }}>✨ AI Generated</p>
              )}
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>
      </Suspense>
    </div>
  );
}

export default ExcalidrawEditor;
