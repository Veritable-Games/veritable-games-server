'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';
import { logger } from '@/lib/utils/logger';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InformationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  Cog6ToothIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';

// Monaco Editor is loaded dynamically and attached to window
interface WindowWithMonaco extends Window {
  monaco?: any;
}

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then(mod => ({ default: mod.DiffEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-gray-900/20">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
            <div className="absolute inset-0 mx-auto h-8 w-8 rounded-full border-2 border-gray-700/20"></div>
          </div>
          <p className="text-sm font-medium text-gray-400">Loading diff editor...</p>
          <p className="mt-1 text-xs text-gray-500">Preparing comparison view</p>
        </div>
      </div>
    ),
  }
);

interface EnhancedDiffViewerProps {
  revisionManager: any;
}

export function EnhancedDiffViewer({ revisionManager }: EnhancedDiffViewerProps) {
  const formatting = useRevisionFormatting();
  const editorRef = useRef<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle editor mounting
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Configure editor options for enhanced view
    editor.updateOptions({
      minimap: { enabled: !isCollapsed },
      renderSideBySide: revisionManager.ui.diffViewMode === 'side-by-side',
      ignoreTrimWhitespace: false,
      renderWhitespace: 'boundary',
      renderOverviewRuler: true,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: true,
      wordWrap: 'on',
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
      cursorStyle: 'line',
      scrollbar: {
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 14,
      },
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 4,
      renderLineHighlight: 'all',
      selectionHighlight: false,
      occurrencesHighlight: false,
    });

    // Add keyboard shortcuts
    try {
      const monaco = (window as WindowWithMonaco).monaco;
      if (monaco) {
        editor.addAction({
          id: 'toggle-diff-view',
          label: 'Toggle Diff View Mode',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT],
          run: () => {
            const newMode =
              revisionManager.ui.diffViewMode === 'side-by-side' ? 'inline' : 'side-by-side';
            revisionManager.setDiffViewMode(newMode);
          },
        });

        editor.addAction({
          id: 'toggle-fullscreen',
          label: 'Toggle Fullscreen',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F11],
          run: () => {
            setIsFullscreen(!isFullscreen);
          },
        });
      }
    } catch (error) {
      logger.warn('Could not add Monaco editor actions:', error);
    }
  };

  // Update editor options when UI state changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        renderSideBySide: revisionManager.ui.diffViewMode === 'side-by-side',
        minimap: { enabled: !isCollapsed },
      });
    }
  }, [revisionManager.ui.diffViewMode, isCollapsed]);

  // Get content for comparison
  const getComparisonContent = () => {
    if (!revisionManager.canCompare || revisionManager.selectedRevisions.length !== 2) {
      return null;
    }

    const [firstId, secondId] = revisionManager.selectedRevisions.sort((a: number, b: number) => {
      const aIndex = revisionManager.processedRevisions.findIndex((r: any) => r.id === a);
      const bIndex = revisionManager.processedRevisions.findIndex((r: any) => r.id === b);
      return bIndex - aIndex; // Reverse order for proper diff (older -> newer)
    });

    const firstRevision = revisionManager.processedRevisions.find((r: any) => r.id === firstId);
    const secondRevision = revisionManager.processedRevisions.find((r: any) => r.id === secondId);

    if (!firstRevision || !secondRevision) return null;

    return {
      original: firstRevision.content || '',
      modified: secondRevision.content || '',
      originalRevision: firstRevision,
      modifiedRevision: secondRevision,
    };
  };

  // No selection state - enhanced version
  if (!revisionManager.hasSelections) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/20 p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gray-700 bg-gray-800/50">
            <DocumentTextIcon className="h-10 w-10 text-gray-500" />
          </div>
          <h3 className="mb-4 text-xl font-semibold text-white">Select Revisions to Compare</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <p className="leading-relaxed">
              Choose revisions from the list to view detailed differences and changes.
            </p>
            <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <h4 className="mb-3 text-sm font-medium text-gray-300">Selection Methods:</h4>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                  <span>Click to select individual revisions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-400"></div>
                  <span>Ctrl/Cmd + click for multiple selection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                  <span>Shift + click for range selection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400"></div>
                  <span>Use quick compare buttons for instant comparisons</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Single selection - show enhanced revision content
  if (revisionManager.selectedRevisions.length === 1) {
    const revision = revisionManager.processedRevisions.find(
      (r: any) => r.id === revisionManager.selectedRevisions[0]
    );

    if (!revision) return null;

    return (
      <div className="flex h-full flex-col bg-gray-900/20">
        {/* Enhanced single revision header */}
        <div className="flex-none border-b border-gray-700/50 bg-gray-800/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <DocumentTextIcon className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-400">#{revision.id}</span>
                  <span className="text-gray-400">•</span>
                  <span>{revision.author_name}</span>
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                  <span>{formatting.formatDate(revision.revision_timestamp)}</span>
                  <span>•</span>
                  <span>{formatting.formatSize(revision.size)}</span>
                  {revision.index === 0 && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-yellow-400">Latest</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`rounded p-2 transition-colors ${
                  showSettings
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
                title="View options"
              >
                <Cog6ToothIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronUpIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {revision.summary && !isCollapsed && (
            <div className="mt-3 rounded-lg border border-gray-600/30 bg-gray-700/30 p-3 text-sm text-gray-200">
              <span className="mb-1 block text-xs font-medium text-gray-400">Summary:</span>
              {revision.summary}
            </div>
          )}

          {/* Settings panel */}
          {showSettings && !isCollapsed && (
            <div className="mt-3 rounded-lg border border-gray-600/30 bg-gray-700/20 p-3">
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                <div>
                  <span className="font-medium text-gray-300">Position:</span> #{revision.index + 1}{' '}
                  of {revisionManager.processedRevisions.length}
                </div>
                <div>
                  <span className="font-medium text-gray-300">Full Date:</span>{' '}
                  {formatting.formatDate(revision.revision_timestamp, false)}
                </div>
                <div>
                  <span className="font-medium text-gray-300">Lines:</span>{' '}
                  {revision.content?.split('\n').length || 0}
                </div>
                <div>
                  <span className="font-medium text-gray-300">Characters:</span>{' '}
                  {revision.size.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Single revision content viewer */}
        {!isCollapsed && (
          <div className="flex-1">
            <MonacoDiffEditor
              height="100%"
              language="markdown"
              theme="vs-dark"
              original=""
              modified={revision.content || ''}
              options={{
                renderSideBySide: false,
                minimap: { enabled: false },
                readOnly: true,
                automaticLayout: true,
                wordWrap: 'on',
                fontSize: 13,
                lineHeight: 18,
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
                scrollBeyondLastLine: false,
                scrollbar: {
                  useShadows: true,
                  verticalScrollbarSize: 14,
                  horizontalScrollbarSize: 14,
                },
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 4,
                renderLineHighlight: 'all',
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Two selections - show enhanced diff
  const comparisonContent = getComparisonContent();

  if (!comparisonContent) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/20 p-6">
        <div className="text-center">
          <ArrowPathIcon className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm font-medium text-gray-400">Loading comparison...</p>
          <p className="mt-1 text-xs text-gray-500">Analyzing differences</p>
        </div>
      </div>
    );
  }

  const { original, modified, originalRevision, modifiedRevision } = comparisonContent;
  const originalLines = original.split('\n').length;
  const modifiedLines = modified.split('\n').length;
  const sizeDiff = modifiedRevision.size - originalRevision.size;

  return (
    <div
      className={`flex h-full flex-col bg-gray-900/20 ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}`}
    >
      {/* Enhanced comparison header */}
      <div className="flex-none border-b border-gray-700/50 bg-gray-800/40">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <InformationCircleIcon className="h-4 w-4 text-blue-400" />
                  <span className="text-red-400">#{originalRevision.id}</span>
                  <span className="text-lg text-gray-500">→</span>
                  <span className="text-green-400">#{modifiedRevision.id}</span>
                </h3>
                <div className="mt-1 flex items-center space-x-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-red-400"></div>
                    <span>From: {originalRevision.author_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-400"></div>
                    <span>To: {modifiedRevision.author_name}</span>
                  </div>
                  <div className="text-gray-500">
                    {formatting.formatSize(originalRevision.size)} →{' '}
                    {formatting.formatSize(modifiedRevision.size)}
                    {sizeDiff !== 0 && (
                      <span
                        className={`ml-1 font-medium ${
                          sizeDiff > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        ({sizeDiff > 0 ? '+' : ''}
                        {sizeDiff})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() =>
                  revisionManager.setDiffViewMode(
                    revisionManager.ui.diffViewMode === 'side-by-side' ? 'inline' : 'side-by-side'
                  )
                }
                className={`rounded p-2 transition-colors ${
                  revisionManager.ui.diffViewMode === 'side-by-side'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
                title={`Switch to ${revisionManager.ui.diffViewMode === 'side-by-side' ? 'inline' : 'side-by-side'} view`}
              >
                {revisionManager.ui.diffViewMode === 'side-by-side' ? (
                  <EyeIcon className="h-4 w-4" />
                ) : (
                  <EyeSlashIcon className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="h-4 w-4" />
                ) : (
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`rounded p-2 transition-colors ${
                  showSettings
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
                title="Comparison details"
              >
                <Cog6ToothIcon className="h-4 w-4" />
              </button>

              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronUpIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Enhanced summary comparison */}
          {(originalRevision.summary || modifiedRevision.summary) && !isCollapsed && (
            <div className="mt-3 space-y-2">
              {originalRevision.summary && (
                <div className="rounded border border-red-800/50 bg-red-900/20 p-2 text-xs">
                  <span className="font-medium text-red-400">Original: </span>
                  <span className="text-red-200">{originalRevision.summary}</span>
                </div>
              )}
              {modifiedRevision.summary && (
                <div className="rounded border border-green-800/50 bg-green-900/20 p-2 text-xs">
                  <span className="font-medium text-green-400">Modified: </span>
                  <span className="text-green-200">{modifiedRevision.summary}</span>
                </div>
              )}
            </div>
          )}

          {/* Detailed comparison stats */}
          {showSettings && !isCollapsed && (
            <div className="mt-3 rounded-lg border border-gray-600/30 bg-gray-700/20 p-3">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="mb-2 font-medium text-gray-300">Original Revision:</div>
                  <div className="text-gray-400">
                    <div>
                      Date: {formatting.formatDate(originalRevision.revision_timestamp, false)}
                    </div>
                    <div>Size: {originalRevision.size.toLocaleString()} chars</div>
                    <div>Lines: {originalLines.toLocaleString()}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="mb-2 font-medium text-gray-300">Modified Revision:</div>
                  <div className="text-gray-400">
                    <div>
                      Date: {formatting.formatDate(modifiedRevision.revision_timestamp, false)}
                    </div>
                    <div>Size: {modifiedRevision.size.toLocaleString()} chars</div>
                    <div>Lines: {modifiedLines.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-gray-600/30 pt-3">
                <div className="mb-2 font-medium text-gray-300">Changes:</div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>
                    Size: {sizeDiff > 0 ? '+' : ''}
                    {sizeDiff} chars
                  </span>
                  <span>
                    Lines: {modifiedLines - originalLines > 0 ? '+' : ''}
                    {modifiedLines - originalLines}
                  </span>
                  <span>View: {revisionManager.ui.diffViewMode}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced diff editor */}
      {!isCollapsed && (
        <div className="flex-1">
          <MonacoDiffEditor
            height="100%"
            language="markdown"
            theme="vs-dark"
            original={original}
            modified={modified}
            onMount={handleEditorDidMount}
            options={{
              renderSideBySide: revisionManager.ui.diffViewMode === 'side-by-side',
              minimap: { enabled: !isFullscreen ? false : true },
              ignoreTrimWhitespace: false,
              renderWhitespace: 'boundary',
              renderOverviewRuler: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: true,
              wordWrap: 'on',
              fontSize: isFullscreen ? 14 : 13,
              lineHeight: isFullscreen ? 20 : 18,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
              cursorStyle: 'line',
              originalEditable: false,
              diffWordWrap: 'on',
              scrollbar: {
                useShadows: true,
                verticalHasArrows: false,
                horizontalHasArrows: false,
                verticalScrollbarSize: 14,
                horizontalScrollbarSize: 14,
              },
              lineNumbers: 'on',
              glyphMargin: true,
              folding: true,
              lineDecorationsWidth: 10,
              lineNumbersMinChars: 4,
              renderLineHighlight: 'all',
              // Enhanced diff rendering
              diffAlgorithm: 'advanced',
              maxComputationTime: 5000,
            }}
          />
        </div>
      )}

      {/* Enhanced stats footer */}
      {!isCollapsed && (
        <div className="flex-none border-t border-gray-700/50 bg-gray-800/30 px-4 py-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-6 text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-400"></div>
                  <span>{originalLines.toLocaleString()} lines</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-400"></div>
                  <span>{modifiedLines.toLocaleString()} lines</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                  <span>
                    {original.length.toLocaleString()} → {modified.length.toLocaleString()} chars
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-gray-500">
              <div className="flex items-center gap-2">
                <kbd className="rounded border border-gray-600 bg-gray-700 px-2 py-1 font-mono text-xs">
                  Ctrl+T
                </kbd>
                <span>Toggle view</span>
              </div>
              {!isFullscreen && (
                <div className="flex items-center gap-2">
                  <kbd className="rounded border border-gray-600 bg-gray-700 px-2 py-1 font-mono text-xs">
                    Ctrl+F11
                  </kbd>
                  <span>Fullscreen</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedDiffViewer;
