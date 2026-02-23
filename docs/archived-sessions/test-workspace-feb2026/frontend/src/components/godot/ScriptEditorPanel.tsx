'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import { logger } from '@/lib/utils/logger';

interface ScriptMetadata {
  filePath: string;
  className?: string;
  extendsClass?: string;
  functionCount: number;
  signalCount: number;
  exportCount: number;
  functions?: Array<{ name: string; params: string[]; line: number }>;
  signals?: Array<{ name: string; params?: string[]; line: number }>;
  exports?: Array<{ name: string; type?: string; line: number }>;
}

interface ScriptEditorPanelProps {
  versionId: number;
  scriptPath: string | null;
  onSave?: (filePath: string, content: string) => Promise<void>;
  onClose?: () => void;
}

/**
 * ScriptEditorPanel - Monaco editor with script metadata
 * Shows content, functions, signals, exports for selected script
 */
export function ScriptEditorPanel({
  versionId,
  scriptPath,
  onSave,
  onClose,
}: ScriptEditorPanelProps) {
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<ScriptMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'editor' | 'info'>('editor');

  // Load script when path changes
  useEffect(() => {
    if (!scriptPath || !versionId) {
      setContent('');
      setMetadata(null);
      return;
    }

    const loadScript = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setHasChanges(false);

        const url = `/api/godot/versions/${versionId}/scripts?path=${encodeURIComponent(scriptPath)}`;
        logger.info(`[ScriptEditorPanel] Loading script:`, { url, versionId, scriptPath });

        const response = await fetch(url);

        logger.info(`[ScriptEditorPanel] Response received:`, {
          status: response.status,
          ok: response.ok,
          contentType: response.headers.get('content-type'),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(`[ScriptEditorPanel] Failed to load script - HTTP ${response.status}`, {
            url,
            versionId,
            scriptPath,
            status: response.status,
            responseLength: errorText.length,
            responseSample: errorText.substring(0, 500),
            fullResponse: errorText,
          });
          throw new Error(
            `Failed to load script (HTTP ${response.status}): ${errorText.substring(0, 100)}`
          );
        }

        let data;
        try {
          const responseText = await response.text();
          logger.info(`[ScriptEditorPanel] Parsing script response:`, {
            length: responseText.length,
            sample: responseText.substring(0, 200),
          });
          data = JSON.parse(responseText);
        } catch (parseErr) {
          const responseClone = response.clone();
          const responseText = await responseClone.text();
          logger.error(`[ScriptEditorPanel] Failed to parse script response JSON`, {
            url,
            versionId,
            scriptPath,
            parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
            responseLength: responseText.length,
            responseSample: responseText.substring(0, 500),
            fullResponse: responseText,
          });
          throw new Error(
            `Failed to parse script response: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`
          );
        }

        logger.info(`[ScriptEditorPanel] Loaded script:`, {
          filePath: data.file_path,
          hasContent: !!data.content,
        });

        setContent(data.content || '');

        // Extract metadata from dependencies, functions, signals, exports
        const metadata: ScriptMetadata = {
          filePath: data.file_path,
          className: data.script_name,
          functionCount: 0,
          signalCount: 0,
          exportCount: 0,
        };

        // Helper to safely parse JSON fields (API may return strings or objects)
        const safeParse = (value: unknown, fieldName: string): any[] => {
          if (!value) return [];
          if (Array.isArray(value)) return value;
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              logger.error(`[ScriptEditorPanel] Failed to parse ${fieldName}: ${value}`, e);
              return [];
            }
          }
          return [];
        };

        const deps = safeParse(data.dependencies, 'dependencies');
        if (deps.length > 0) {
          metadata.extendsClass = deps.find((d: any) => d.type === 'extends')?.path;
        }

        const funcs = safeParse(data.functions, 'functions');
        metadata.functions = funcs;
        metadata.functionCount = funcs.length;

        const sigs = safeParse(data.signals, 'signals');
        metadata.signals = sigs;
        metadata.signalCount = sigs.length;

        const exps = safeParse(data.exports, 'exports');
        metadata.exports = exps;
        metadata.exportCount = exps.length;

        setMetadata(metadata);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load script';
        setError(message);
        logger.error('Error loading script:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadScript();
  }, [scriptPath, versionId]);

  const handleContentChange = useCallback((newContent: string | undefined) => {
    if (newContent !== undefined) {
      setContent(newContent);
      setHasChanges(true);
      setSaveStatus('idle');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!scriptPath || !onSave || !hasChanges) return;

    try {
      setIsSaving(true);
      setSaveStatus('idle');
      setError(null);

      await onSave(scriptPath, content);

      setSaveStatus('success');
      setHasChanges(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save script';
      setError(message);
      setSaveStatus('error');
      logger.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [scriptPath, content, hasChanges, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+S / Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && scriptPath) {
          handleSave();
        }
      }
    },
    [hasChanges, scriptPath, handleSave]
  );

  // Keyboard shortcuts don't work on editor blur, so we need to add to window
  useEffect(() => {
    if (!scriptPath) return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && scriptPath) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [hasChanges, scriptPath, handleSave]);

  if (!scriptPath) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900 text-gray-500">
        <div className="text-center">
          <p className="text-sm">Select a script from the dependency graph to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-700 bg-gray-800/50 px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-gray-500">{metadata?.filePath || scriptPath}</p>
            {metadata?.className && (
              <p className="truncate text-sm font-semibold text-gray-300">{metadata.className}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 text-gray-400 transition-colors hover:text-gray-200"
            title="Close editor"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-2 rounded border border-red-700 bg-red-900/20 p-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTab('editor')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedTab === 'editor'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setSelectedTab('info')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedTab === 'info'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Info
            </button>
          </div>

          {/* Status & Save */}
          <div className="flex items-center gap-2">
            {/* Modified indicator */}
            {hasChanges && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                Modified
              </span>
            )}

            {/* Save status */}
            {saveStatus === 'success' && <span className="text-xs text-green-400">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-400">✗ Save failed</span>}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                hasChanges && !isSaving
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'cursor-not-allowed bg-gray-700 text-gray-500'
              }`}
              title="Save (Ctrl+S)"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p className="text-sm">Loading script...</p>
          </div>
        ) : selectedTab === 'editor' ? (
          <MonacoEditorWrapper
            content={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <ScriptInfoTab metadata={metadata} />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-700 bg-gray-800/30 px-4 py-1.5 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <div>Lines: {content.split('\n').length}</div>
          <div>Press Ctrl+S to save</div>
        </div>
      </div>
    </div>
  );
}

/**
 * MonacoEditorWrapper - Separate component for Monaco editor
 */
function MonacoEditorWrapper({
  content,
  onChange,
  onKeyDown,
}: {
  content: string;
  onChange: (content: string | undefined) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const handleEditorMount = (editor: any, monaco: Monaco) => {
    // Define GDScript language (we use Python as closest match)
    monaco.languages.register({ id: 'gdscript' });
    monaco.languages.setMonarchTokensProvider('gdscript', {
      tokenizer: {
        root: [
          [
            /\b(extends|class_name|func|var|const|signal|enum|match|if|elif|else|for|while|break|continue|return|yield|pass|assert|remote|remotesync|master|puppet|puppet_sync|slave|slave_sync)\b/,
            'keyword',
          ],
          [/\b(true|false|null|self)\b/, 'constant'],
          [/@\w+/, 'decorator'],
          [/"(?:\\.|[^"\\])*"/, 'string'],
          [/'(?:\\.|[^'\\])*'/, 'string'],
          [/\d+/, 'number'],
          [/#.*$/, 'comment'],
        ],
      },
    });
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="gdscript"
      language="gdscript"
      value={content}
      onChange={onChange}
      onMount={handleEditorMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'Fira Code', monospace",
        tabSize: 4,
        wordWrap: 'on',
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}

/**
 * ScriptInfoTab - Shows script metadata (functions, signals, exports)
 */
function ScriptInfoTab({ metadata }: { metadata: ScriptMetadata | null }) {
  if (!metadata) {
    return (
      <div className="p-4 text-gray-500">
        <p className="text-sm">No metadata available</p>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      {/* Basic Info */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-300">Class Info</h3>
        <div className="space-y-2 rounded bg-gray-800/50 p-3 text-xs">
          {metadata.className && (
            <div>
              <span className="text-gray-500">Class:</span>
              <span className="ml-2 text-gray-300">{metadata.className}</span>
            </div>
          )}
          {metadata.extendsClass && (
            <div>
              <span className="text-gray-500">Extends:</span>
              <span className="ml-2 text-gray-300">{metadata.extendsClass}</span>
            </div>
          )}
        </div>
      </div>

      {/* Functions */}
      {metadata.functions && metadata.functions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300">
            Functions ({metadata.functionCount})
          </h3>
          <div className="space-y-2">
            {metadata.functions.map((func, idx) => (
              <div
                key={idx}
                className="rounded border-l-2 border-blue-500 bg-gray-800/50 p-3 text-xs"
              >
                <div className="font-mono text-blue-300">
                  {func.name}({func.params.join(', ')})
                </div>
                <div className="text-xs text-gray-600">Line {func.line}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signals */}
      {metadata.signals && metadata.signals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300">Signals ({metadata.signalCount})</h3>
          <div className="space-y-2">
            {metadata.signals.map((signal, idx) => (
              <div
                key={idx}
                className="rounded border-l-2 border-purple-500 bg-gray-800/50 p-3 text-xs"
              >
                <div className="font-mono text-purple-300">
                  {signal.name}({signal.params?.join(', ') || ''})
                </div>
                <div className="text-xs text-gray-600">Line {signal.line}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exports */}
      {metadata.exports && metadata.exports.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300">Exports ({metadata.exportCount})</h3>
          <div className="space-y-2">
            {metadata.exports.map((exp, idx) => (
              <div
                key={idx}
                className="rounded border-l-2 border-green-500 bg-gray-800/50 p-3 text-xs"
              >
                <div className="font-mono text-green-300">
                  {exp.name}: {exp.type || 'unknown'}
                </div>
                <div className="text-xs text-gray-600">Line {exp.line}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {metadata.functionCount === 0 && metadata.signalCount === 0 && metadata.exportCount === 0 && (
        <p className="py-8 text-center text-sm text-gray-600">
          No functions, signals, or exports found in this script
        </p>
      )}
    </div>
  );
}
