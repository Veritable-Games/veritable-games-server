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
  Cog6ToothIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';

// Monaco Editor is loaded dynamically and attached to window
interface WindowWithMonaco extends Window {
  monaco?: any;
}

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then(mod => ({ default: mod.Editor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-gray-900/20">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
          </div>
          <p className="text-xs font-medium text-gray-400">Loading editor...</p>
        </div>
      </div>
    ),
  }
);

interface SideBySideComparisonViewerProps {
  revisionManager: any;
}

export function SideBySideComparisonViewer({ revisionManager }: SideBySideComparisonViewerProps) {
  const formatting = useRevisionFormatting();
  const originalEditorRef = useRef<any>(null);
  const modifiedEditorRef = useRef<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [syncScrolling, setSyncScrolling] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');

  // Handle synchronized scrolling
  const handleScroll = (sourceEditor: any, targetEditor: any) => {
    if (!syncScrolling || !sourceEditor || !targetEditor) return;

    const sourceScrollTop = sourceEditor.getScrollTop();
    const sourceScrollLeft = sourceEditor.getScrollLeft();

    targetEditor.setScrollTop(sourceScrollTop);
    targetEditor.setScrollLeft(sourceScrollLeft);
  };

  // Handle editor mounting
  const handleOriginalEditorMount = (editor: any) => {
    originalEditorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: !isCollapsed },
      readOnly: true,
      automaticLayout: true,
      wordWrap: wordWrap,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
      scrollBeyondLastLine: false,
      cursorStyle: 'line',
      scrollbar: {
        useShadows: true,
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 14,
      },
      lineNumbers: showLineNumbers ? 'on' : 'off',
      glyphMargin: true,
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 4,
      renderLineHighlight: 'all',
      selectionHighlight: false,
      occurrencesHighlight: 'off',
    });

    // Add synchronized scrolling listener
    editor.onDidScrollChange(() => {
      if (syncScrolling && modifiedEditorRef.current) {
        handleScroll(editor, modifiedEditorRef.current);
      }
    });

    // Add keyboard shortcuts
    try {
      const monaco = (window as WindowWithMonaco).monaco;
      if (monaco) {
        editor.addAction({
          id: 'toggle-sync-scrolling',
          label: 'Toggle Synchronized Scrolling',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY],
          run: () => setSyncScrolling(!syncScrolling),
        });

        editor.addAction({
          id: 'toggle-fullscreen',
          label: 'Toggle Fullscreen',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F11],
          run: () => setIsFullscreen(!isFullscreen),
        });
      }
    } catch (error) {
      logger.warn('Could not add Monaco editor actions:', error);
    }
  };

  const handleModifiedEditorMount = (editor: any) => {
    modifiedEditorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: !isCollapsed },
      readOnly: true,
      automaticLayout: true,
      wordWrap: wordWrap,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
      scrollBeyondLastLine: false,
      cursorStyle: 'line',
      scrollbar: {
        useShadows: true,
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 14,
      },
      lineNumbers: showLineNumbers ? 'on' : 'off',
      glyphMargin: true,
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 4,
      renderLineHighlight: 'all',
      selectionHighlight: false,
      occurrencesHighlight: 'off',
    });

    // Add synchronized scrolling listener
    editor.onDidScrollChange(() => {
      if (syncScrolling && originalEditorRef.current) {
        handleScroll(editor, originalEditorRef.current);
      }
    });
  };

  // Update editor options when settings change
  useEffect(() => {
    const updateEditorOptions = (editor: any) => {
      if (editor) {
        editor.updateOptions({
          minimap: { enabled: !isCollapsed },
          wordWrap: wordWrap,
          lineNumbers: showLineNumbers ? 'on' : 'off',
        });
      }
    };

    updateEditorOptions(originalEditorRef.current);
    updateEditorOptions(modifiedEditorRef.current);
  }, [isCollapsed, wordWrap, showLineNumbers]);

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

  // No selection state
  if (!revisionManager.hasSelections) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/20 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gray-700 bg-gray-800/50">
            <DocumentTextIcon className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="mb-4 text-lg font-semibold text-white">Select Revisions to Compare</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <p className="leading-relaxed">
              Choose two revisions from the list to view side-by-side comparison with synchronized
              editors.
            </p>
            <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
              <h4 className="mb-2 text-sm font-medium text-gray-300">Side-by-Side Features:</h4>
              <div className="space-y-1 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                  <span>Synchronized scrolling between editors</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400"></div>
                  <span>Independent content navigation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-400"></div>
                  <span>Professional diff highlighting</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400"></div>
                  <span>Fullscreen comparison mode</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Single selection - show single revision
  if (revisionManager.selectedRevisions.length === 1) {
    const revision = revisionManager.processedRevisions.find(
      (r: any) => r.id === revisionManager.selectedRevisions[0]
    );

    if (!revision) return null;

    return (
      <div className="flex h-full flex-col bg-gray-900/20">
        {/* Single revision header */}
        <div className="flex-none border-b border-gray-700/50 bg-gray-800/40 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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

          {revision.summary && !isCollapsed && (
            <div className="mt-2 rounded border border-gray-600/30 bg-gray-700/30 p-2 text-sm text-gray-200">
              <span className="text-xs font-medium text-gray-400">Summary: </span>
              {revision.summary}
            </div>
          )}
        </div>

        {/* Single revision content */}
        {!isCollapsed && (
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language="markdown"
              theme="vs-dark"
              value={revision.content || ''}
              options={{
                readOnly: true,
                automaticLayout: true,
                wordWrap: 'on',
                fontSize: 13,
                lineHeight: 18,
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
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

  // Two selections - show side-by-side comparison
  const comparisonContent = getComparisonContent();

  if (!comparisonContent) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/20 p-6">
        <div className="text-center">
          <ArrowPathIcon className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm font-medium text-gray-400">Loading comparison...</p>
          <p className="mt-1 text-xs text-gray-500">Preparing side-by-side view</p>
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
      {/* Comparison header */}
      <div className="flex-none border-b border-gray-700/50 bg-gray-800/40">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <InformationCircleIcon className="h-4 w-4 text-blue-400" />
                  <span className="text-red-400">#{originalRevision.id}</span>
                  <ArrowTopRightOnSquareIcon className="h-3 w-3 text-gray-500" />
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

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setSyncScrolling(!syncScrolling)}
                className={`rounded p-1.5 text-xs transition-colors ${
                  syncScrolling
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
                title={`${syncScrolling ? 'Disable' : 'Enable'} synchronized scrolling`}
              >
                <ArrowUturnLeftIcon className="h-3 w-3" />
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="h-3 w-3" />
                ) : (
                  <ArrowsPointingOutIcon className="h-3 w-3" />
                )}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`rounded p-1.5 transition-colors ${
                  showSettings
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
                title="Editor settings"
              >
                <Cog6ToothIcon className="h-3 w-3" />
              </button>

              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? (
                  <ChevronDownIcon className="h-3 w-3" />
                ) : (
                  <ChevronUpIcon className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && !isCollapsed && (
            <div className="mt-3 rounded-lg border border-gray-600/30 bg-gray-700/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={showLineNumbers}
                      onChange={e => setShowLineNumbers(e.target.checked)}
                      className="h-3 w-3 rounded border-gray-600 text-blue-600"
                    />
                    <span className="text-gray-300">Line Numbers</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={wordWrap === 'on'}
                      onChange={e => setWordWrap(e.target.checked ? 'on' : 'off')}
                      className="h-3 w-3 rounded border-gray-600 text-blue-600"
                    />
                    <span className="text-gray-300">Word Wrap</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={syncScrolling}
                      onChange={e => setSyncScrolling(e.target.checked)}
                      className="h-3 w-3 rounded border-gray-600 text-blue-600"
                    />
                    <span className="text-gray-300">Sync Scroll</span>
                  </label>
                </div>
                <div className="text-gray-400">
                  Lines: {originalLines} → {modifiedLines} (
                  {modifiedLines - originalLines >= 0 ? '+' : ''}
                  {modifiedLines - originalLines})
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-side editors - responsive layout */}
      {!isCollapsed && (
        <div className="flex flex-1 flex-col lg:flex-row">
          {/* Original/Left Editor */}
          <div className="flex flex-1 flex-col border-b border-r-0 border-gray-700/50 lg:border-b-0 lg:border-r">
            <div className="flex-none border-b border-red-800/30 bg-red-900/10 px-2 py-1 lg:px-3 lg:py-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-300 lg:gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-400 lg:h-2 lg:w-2"></div>
                <span className="hidden sm:inline">Original</span>
                <span className="sm:hidden">Orig</span>
                <span className="text-red-200/60">(#{originalRevision.id})</span>
              </div>
              <div className="mt-0.5 hidden text-xs text-red-200/70 sm:block">
                {originalRevision.author_name} •{' '}
                {formatting.formatDate(originalRevision.revision_timestamp, true)}
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <MonacoEditor
                height="100%"
                language="markdown"
                theme="vs-dark"
                value={original}
                onMount={handleOriginalEditorMount}
                options={{
                  readOnly: true,
                  automaticLayout: true,
                  minimap: { enabled: false }, // Always disabled on mobile-responsive
                  wordWrap: wordWrap,
                  fontSize: 12, // Smaller font for mobile
                  lineHeight: 16,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
                  scrollBeyondLastLine: false,
                  cursorStyle: 'line',
                  scrollbar: {
                    useShadows: true,
                    verticalScrollbarSize: 12, // Thinner scrollbars for mobile
                    horizontalScrollbarSize: 12,
                  },
                  lineNumbers: showLineNumbers ? 'on' : 'off',
                  glyphMargin: false, // Reduce glyph margin on small screens
                  folding: true,
                  lineDecorationsWidth: 5, // Smaller decoration width
                  lineNumbersMinChars: 3, // Fewer chars for line numbers
                  renderLineHighlight: 'all',
                  selectionHighlight: false,
                  occurrencesHighlight: 'off',
                }}
              />
            </div>
          </div>

          {/* Modified/Right Editor */}
          <div className="flex flex-1 flex-col">
            <div className="flex-none border-b border-green-800/30 bg-green-900/10 px-2 py-1 lg:px-3 lg:py-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-300 lg:gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 lg:h-2 lg:w-2"></div>
                <span className="hidden sm:inline">Modified</span>
                <span className="sm:hidden">Mod</span>
                <span className="text-green-200/60">(#{modifiedRevision.id})</span>
              </div>
              <div className="mt-0.5 hidden text-xs text-green-200/70 sm:block">
                {modifiedRevision.author_name} •{' '}
                {formatting.formatDate(modifiedRevision.revision_timestamp, true)}
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <MonacoEditor
                height="100%"
                language="markdown"
                theme="vs-dark"
                value={modified}
                onMount={handleModifiedEditorMount}
                options={{
                  readOnly: true,
                  automaticLayout: true,
                  minimap: { enabled: false }, // Always disabled on mobile-responsive
                  wordWrap: wordWrap,
                  fontSize: 12, // Smaller font for mobile
                  lineHeight: 16,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
                  scrollBeyondLastLine: false,
                  cursorStyle: 'line',
                  scrollbar: {
                    useShadows: true,
                    verticalScrollbarSize: 12, // Thinner scrollbars for mobile
                    horizontalScrollbarSize: 12,
                  },
                  lineNumbers: showLineNumbers ? 'on' : 'off',
                  glyphMargin: false, // Reduce glyph margin on small screens
                  folding: true,
                  lineDecorationsWidth: 5, // Smaller decoration width
                  lineNumbersMinChars: 3, // Fewer chars for line numbers
                  renderLineHighlight: 'all',
                  selectionHighlight: false,
                  occurrencesHighlight: 'off',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Status footer */}
      {!isCollapsed && (
        <div className="flex-none border-t border-gray-700/50 bg-gray-800/30 px-3 py-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-6 text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400"></div>
                  <span>{originalLines.toLocaleString()} lines</span>
                </div>
                <span>|</span>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400"></div>
                  <span>{modifiedLines.toLocaleString()} lines</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-400"></div>
                  <span>Sync: {syncScrolling ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <kbd className="rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 font-mono text-xs">
                  Ctrl+Y
                </kbd>
                <span>Toggle sync</span>
              </div>
              {!isFullscreen && (
                <div className="flex items-center gap-1">
                  <kbd className="rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 font-mono text-xs">
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
