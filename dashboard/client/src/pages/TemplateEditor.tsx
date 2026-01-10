import { useState, useEffect } from 'react';
import { Save, RefreshCw, FileText, Settings, AlertCircle, CheckCircle, Code, Eye, MessageSquare, Sliders, Activity } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import RichMarkdownEditor from '@/components/RichMarkdownEditor';

interface Template {
  id: number;
  template_key: string;
  template_name: string;
  template_content: string | null;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface ChatConfig {
  id: number;
  config_key: string;
  config_name: string;
  config_value: string | null;
  config_type: string;
  description: string | null;
  category: string;
  options: string[] | null;
  display_order: number;
  updated_at: string;
}

const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1';

export function TemplateEditor() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents');
  
  // Document templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedContent, setEditedContent] = useState('');
  
  // Chat config state
  const [chatConfigs, setChatConfigs] = useState<ChatConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ChatConfig | null>(null);
  const [editedConfigValue, setEditedConfigValue] = useState('');
  
  // Shared state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'rich' | 'raw'>('rich');

  useEffect(() => {
    if (activeTab === 'documents') {
      fetchTemplates();
    } else {
      fetchChatConfigs();
    }
  }, [activeTab]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/control-api/dashboard/templates`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setTemplates(data);
        if (data.length > 0 && !selectedTemplate) {
          setSelectedTemplate(data[0]);
          setEditedContent(data[0].template_content || '');
        }
      } else {
        setError('Failed to load templates');
      }
    } catch (err) {
      setError('Network error loading templates');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/control-api/dashboard/chat-config`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setChatConfigs(data);
        if (data.length > 0 && !selectedConfig) {
          // Select first prompt config by default
          const firstPrompt = data.find((c: ChatConfig) => c.category === 'prompts') || data[0];
          setSelectedConfig(firstPrompt);
          setEditedConfigValue(firstPrompt.config_value || '');
        }
      } else {
        setError('Failed to load chat configuration');
      }
    } catch (err) {
      setError('Network error loading chat configuration');
      console.error('Error fetching chat configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setEditedContent(template.template_content || '');
    setSaveStatus('idle');
  };

  const selectConfig = (config: ChatConfig) => {
    setSelectedConfig(config);
    setEditedConfigValue(config.config_value || '');
    setSaveStatus('idle');
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;
    
    setSaving(true);
    setSaveStatus('idle');
    
    try {
      const response = await fetch(
        `${API_BASE}/control-api/dashboard/templates/${selectedTemplate.template_key}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_content: editedContent
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setSaveStatus('success');
        setTemplates(prev => prev.map(t => 
          t.template_key === selectedTemplate.template_key 
            ? { ...t, template_content: editedContent, updated_at: data.updated_at }
            : t
        ));
        setSelectedTemplate({ ...selectedTemplate, template_content: editedContent, updated_at: data.updated_at });
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setError(data.error || 'Failed to save template');
      }
    } catch (err) {
      setSaveStatus('error');
      setError('Network error saving template');
      console.error('Error saving template:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveChatConfig = async () => {
    if (!selectedConfig) return;
    
    setSaving(true);
    setSaveStatus('idle');
    
    try {
      const response = await fetch(
        `${API_BASE}/control-api/dashboard/chat-config/${selectedConfig.config_key}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_value: editedConfigValue
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setSaveStatus('success');
        setChatConfigs(prev => prev.map(c => 
          c.config_key === selectedConfig.config_key 
            ? { ...c, config_value: editedConfigValue, updated_at: data.updated_at }
            : c
        ));
        setSelectedConfig({ ...selectedConfig, config_value: editedConfigValue, updated_at: data.updated_at });
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setSaveStatus('error');
      setError('Network error saving configuration');
      console.error('Error saving chat config:', err);
    } finally {
      setSaving(false);
    }
  };

  const getTemplateIcon = (key: string) => {
    switch (key) {
      case 'system_prompt':
        return <Settings className="w-4 h-4" />;
      case 'memo_template':
        return <FileText className="w-4 h-4" />;
      case 'one_pager_template':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getConfigIcon = (category: string, key: string) => {
    if (category === 'generation') {
      return <Sliders className="w-4 h-4" />;
    }
    if (key.includes('grounding') || key.includes('rules')) {
      return <AlertCircle className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasChanges = activeTab === 'documents' 
    ? selectedTemplate && editedContent !== (selectedTemplate.template_content || '')
    : selectedConfig && editedConfigValue !== (selectedConfig.config_value || '');

  const handleSave = () => {
    if (activeTab === 'documents') {
      saveTemplate();
    } else {
      saveChatConfig();
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'documents') {
      fetchTemplates();
    } else {
      fetchChatConfigs();
    }
  };

  // Group chat configs by category
  const generationConfigs = chatConfigs.filter(c => c.category === 'generation');
  const promptConfigs = chatConfigs.filter(c => c.category === 'prompts');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader
        title="Templates"
        subtitle="Configure document templates and chat AI settings"
        icon={<Settings className="w-4 h-4 text-primary" />}
        actions={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Tab Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 min-h-[36px] sm:min-h-0 ${
                  activeTab === 'documents' 
                    ? 'bg-background text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Documents</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 min-h-[36px] sm:min-h-0 ${
                  activeTab === 'chat' 
                    ? 'bg-background text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat AI</span>
              </button>
            </div>
            
            {/* Editor Mode Toggle - only for textarea configs */}
            {(activeTab === 'documents' || (selectedConfig?.config_type === 'textarea')) && (
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setEditorMode('rich')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 min-h-[36px] sm:min-h-0 ${
                    editorMode === 'rich' 
                      ? 'bg-background text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rich</span>
                </button>
                <button
                  onClick={() => setEditorMode('raw')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 min-h-[36px] sm:min-h-0 ${
                    editorMode === 'raw' 
                      ? 'bg-background text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Raw</span>
                </button>
              </div>
            )}
            
            {saveStatus === 'success' && (
              <span className="text-green-400 flex items-center gap-1 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-400 flex items-center gap-1 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Error</span>
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-2 min-h-[44px] sm:min-h-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`p-2 sm:px-4 sm:py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 min-h-[44px] sm:min-h-0 ${
                hasChanges 
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            {activeTab === 'documents' ? (
              /* Document Templates Sidebar */
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <div className="p-3 border-b border-gray-800 bg-gray-800/50">
                  <h2 className="text-sm font-medium text-gray-300">Document Templates</h2>
                </div>
                <div className="divide-y divide-gray-800">
                  {loading ? (
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                  ) : templates.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No templates found</div>
                  ) : (
                    templates.map(template => (
                      <button
                        key={template.template_key}
                        onClick={() => selectTemplate(template)}
                        className={`w-full p-3 text-left hover:bg-gray-800/50 transition-colors ${
                          selectedTemplate?.template_key === template.template_key 
                            ? 'bg-blue-900/30 border-l-2 border-blue-500' 
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getTemplateIcon(template.template_key)}
                          <span className="font-medium text-sm">{template.template_name}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {template.description || 'No description'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Updated: {formatDate(template.updated_at)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Chat Config Sidebar */
              <div className="space-y-4">
                {/* Generation Settings */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                  <div className="p-3 border-b border-gray-800 bg-gray-800/50">
                    <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Sliders className="w-4 h-4" />
                      Generation Settings
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">Loading...</div>
                    ) : generationConfigs.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No settings found</div>
                    ) : (
                      generationConfigs.map(config => (
                        <button
                          key={config.config_key}
                          onClick={() => selectConfig(config)}
                          className={`w-full p-3 text-left hover:bg-gray-800/50 transition-colors ${
                            selectedConfig?.config_key === config.config_key 
                              ? 'bg-blue-900/30 border-l-2 border-blue-500' 
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {getConfigIcon(config.category, config.config_key)}
                            <span className="font-medium text-sm">{config.config_name}</span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            Current: {config.config_value || 'Not set'}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Prompt Templates */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                  <div className="p-3 border-b border-gray-800 bg-gray-800/50">
                    <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Prompt Templates
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">Loading...</div>
                    ) : promptConfigs.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No prompts found</div>
                    ) : (
                      promptConfigs.map(config => (
                        <button
                          key={config.config_key}
                          onClick={() => selectConfig(config)}
                          className={`w-full p-3 text-left hover:bg-gray-800/50 transition-colors ${
                            selectedConfig?.config_key === config.config_key 
                              ? 'bg-blue-900/30 border-l-2 border-blue-500' 
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {getConfigIcon(config.category, config.config_key)}
                            <span className="font-medium text-sm">{config.config_name}</span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {config.description || 'No description'}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Info Panel */}
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                {activeTab === 'documents' ? 'Editor Tips' : 'Chat Config Tips'}
              </h3>
              <ul className="text-xs text-gray-500 space-y-1.5">
                {activeTab === 'documents' ? (
                  <>
                    <li>• <strong>Rich mode:</strong> Visual editing with toolbar</li>
                    <li>• <strong>Raw mode:</strong> Direct Markdown editing</li>
                    <li>• Use the toolbar to insert tables</li>
                    <li>• Select text for quick formatting</li>
                    <li>• Ctrl+B for bold, Ctrl+I for italic</li>
                  </>
                ) : (
                  <>
                    <li>• <strong>Model:</strong> AI model for chat responses</li>
                    <li>• <strong>Temperature:</strong> 0 = deterministic, 1 = creative</li>
                    <li>• <strong>Prompts:</strong> Use placeholders like {'{asset_id}'}, {'{today}'}</li>
                    <li>• Changes take effect on next chat message</li>
                  </>
                )}
              </ul>
            </div>

            {/* About Panel */}
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                {activeTab === 'documents' ? 'About Templates' : 'About Chat AI'}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {activeTab === 'documents' 
                  ? 'These templates control how Gemini AI generates investment documents. Changes take effect immediately for new document generations.'
                  : 'Configure how the Company Chat AI responds. Adjust the model, creativity, and system prompts to optimize responses for your trading analysis needs.'}
              </p>
            </div>
          </div>

          {/* Editor Panel */}
          <div className="lg:col-span-9">
            {activeTab === 'documents' ? (
              /* Document Editor */
              selectedTemplate ? (
                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-180px)] flex flex-col">
                  <div className="p-3 border-b border-gray-800 bg-gray-800/50 flex items-center justify-between flex-shrink-0">
                    <div>
                      <h2 className="font-medium flex items-center gap-2">
                        {getTemplateIcon(selectedTemplate.template_key)}
                        {selectedTemplate.template_name}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedTemplate.description}
                      </p>
                    </div>
                    {hasChanges && (
                      <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-1 rounded">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    {editorMode === 'rich' ? (
                      <RichMarkdownEditor
                        content={editedContent}
                        onChange={setEditedContent}
                        placeholder="Start typing your template..."
                      />
                    ) : (
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full h-full p-4 bg-gray-950 text-gray-100 font-mono text-sm resize-none focus:outline-none"
                        placeholder="Enter template content..."
                        spellCheck={false}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg border border-gray-800 h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-180px)] flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a template to edit</p>
                  </div>
                </div>
              )
            ) : (
              /* Chat Config Editor */
              selectedConfig ? (
                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-180px)] flex flex-col">
                  <div className="p-3 border-b border-gray-800 bg-gray-800/50 flex items-center justify-between flex-shrink-0">
                    <div>
                      <h2 className="font-medium flex items-center gap-2">
                        {getConfigIcon(selectedConfig.category, selectedConfig.config_key)}
                        {selectedConfig.config_name}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedConfig.description}
                      </p>
                    </div>
                    {hasChanges && (
                      <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-1 rounded">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    {selectedConfig.config_type === 'textarea' ? (
                      editorMode === 'rich' ? (
                        <RichMarkdownEditor
                          content={editedConfigValue}
                          onChange={setEditedConfigValue}
                          placeholder="Enter prompt content..."
                        />
                      ) : (
                        <textarea
                          value={editedConfigValue}
                          onChange={(e) => setEditedConfigValue(e.target.value)}
                          className="w-full h-full p-4 bg-gray-950 text-gray-100 font-mono text-sm resize-none focus:outline-none"
                          placeholder="Enter configuration value..."
                          spellCheck={false}
                        />
                      )
                    ) : selectedConfig.config_type === 'select' ? (
                      <div className="p-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Select Value
                        </label>
                        <select
                          value={editedConfigValue}
                          onChange={(e) => setEditedConfigValue(e.target.value)}
                          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        >
                          {selectedConfig.options?.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-gray-500">
                          {selectedConfig.description}
                        </p>
                      </div>
                    ) : selectedConfig.config_type === 'number' ? (
                      <div className="p-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {selectedConfig.config_name}
                        </label>
                        <input
                          type="number"
                          value={editedConfigValue}
                          onChange={(e) => setEditedConfigValue(e.target.value)}
                          step={selectedConfig.config_key === 'temperature' ? '0.1' : '1'}
                          min={selectedConfig.config_key === 'temperature' ? '0' : '1'}
                          max={selectedConfig.config_key === 'temperature' ? '2' : '32768'}
                          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          {selectedConfig.description}
                        </p>
                        {selectedConfig.config_key === 'temperature' && (
                          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-gray-400">
                              <strong>0.0:</strong> Very deterministic, consistent responses<br/>
                              <strong>0.5:</strong> Balanced creativity and consistency<br/>
                              <strong>1.0:</strong> More creative, varied responses<br/>
                              <strong>1.5+:</strong> Highly creative, may be less coherent
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {selectedConfig.config_name}
                        </label>
                        <input
                          type="text"
                          value={editedConfigValue}
                          onChange={(e) => setEditedConfigValue(e.target.value)}
                          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          {selectedConfig.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg border border-gray-800 h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-180px)] flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a configuration to edit</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;
