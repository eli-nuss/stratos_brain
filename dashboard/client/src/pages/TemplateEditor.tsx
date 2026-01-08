import { useState, useEffect } from 'react';
import { Save, RefreshCw, FileText, Settings, AlertCircle, CheckCircle } from 'lucide-react';

interface Template {
  id: number;
  template_key: string;
  template_name: string;
  template_content: string | null;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1';

export function TemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/control-api/dashboard/templates`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setTemplates(data);
        // Select the first template by default
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

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setEditedContent(template.template_content || '');
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
        // Update local state
        setTemplates(prev => prev.map(t => 
          t.template_key === selectedTemplate.template_key 
            ? { ...t, template_content: editedContent, updated_at: data.updated_at }
            : t
        ));
        setSelectedTemplate({ ...selectedTemplate, template_content: editedContent, updated_at: data.updated_at });
        
        // Clear success status after 3 seconds
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasChanges = selectedTemplate && editedContent !== (selectedTemplate.template_content || '');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-white transition-colors">
              ← Back to Dashboard
            </a>
            <span className="text-gray-600">|</span>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              Template Editor
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {saveStatus === 'success' && (
              <span className="text-green-400 flex items-center gap-1 text-sm">
                <CheckCircle className="w-4 h-4" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-400 flex items-center gap-1 text-sm">
                <AlertCircle className="w-4 h-4" />
                Error
              </span>
            )}
            <button
              onClick={fetchTemplates}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={saveTemplate}
              disabled={saving || !hasChanges}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                hasChanges 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Template List Sidebar */}
          <div className="col-span-3">
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-3 border-b border-gray-800 bg-gray-800/50">
                <h2 className="text-sm font-medium text-gray-300">Templates</h2>
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

            {/* Info Panel */}
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-2">About Templates</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                These templates control how Gemini AI generates investment documents. 
                Changes take effect immediately for new document generations.
              </p>
              <ul className="mt-3 text-xs text-gray-500 space-y-1">
                <li>• <strong>System Prompt:</strong> AI behavior instructions</li>
                <li>• <strong>Memo Template:</strong> Full investment memo format</li>
                <li>• <strong>One Pager:</strong> Concise snapshot format</li>
              </ul>
            </div>
          </div>

          {/* Editor Panel */}
          <div className="col-span-9">
            {selectedTemplate ? (
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden h-[calc(100vh-180px)]">
                <div className="p-3 border-b border-gray-800 bg-gray-800/50 flex items-center justify-between">
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
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-[calc(100%-60px)] p-4 bg-gray-950 text-gray-100 font-mono text-sm resize-none focus:outline-none"
                  placeholder="Enter template content..."
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg border border-gray-800 h-[calc(100vh-180px)] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a template to edit</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;
