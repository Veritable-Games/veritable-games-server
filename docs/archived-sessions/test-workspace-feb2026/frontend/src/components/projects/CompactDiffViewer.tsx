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
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
          <p className="text-sm text-gray-400">Loading diff editor...</p>
        </div>
      </div>
    ),
  }
);

interface CompactDiffViewerProps {
  revisionManager: any;
}

export function CompactDiffViewer({ revisionManager }: CompactDiffViewerProps) {
  const formatting = useRevisionFormatting();
  const editorRef = useRef<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Handle editor mounting
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Configure editor options for compact view
    editor.updateOptions({
      minimap: { enabled: false }, // Always off for compact view
      renderSideBySide: revisionManager.ui.diffViewMode === 'side-by-side',
      ignoreTrimWhitespace: false,
      renderWhitespace: 'boundary',
      renderOverviewRuler: false, // Disabled for compact view
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: true,
      wordWrap: 'on',
      fontSize: 12, // Smaller font for compact view
      lineHeight: 16,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      cursorStyle: 'line',
      scrollbar: {
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12,
      },
      lineNumbers: 'on',
      glyphMargin: false,
      folding: false, // Disabled for compact view
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
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
      });
    }
  }, [revisionManager.ui.diffViewMode]);

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

  // No selection state - compact version
  if (!revisionManager.hasSelections) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <DocumentTextIcon className="mx-auto mb-4 h-12 w-12 text-gray-500" />
          <h3 className="mb-3 text-lg font-medium text-white">Select Revisions to Compare</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <p>Choose revisions from the list to view differences.</p>
            <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
              <div className="space-y-1 text-xs text-gray-300">
                <div>• Click to select</div>
                <div>• Ctrl/Cmd for multiple</div>
                <div>• Shift for range</div>
                <div>• Quick compare buttons</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Single selection - show revision content
  if (revisionManager.selectedRevisions.length === 1) {
    const revision = revisionManager.processedRevisions.find(
      (r: any) => r.id === revisionManager.selectedRevisions[0]
    );

    if (!revision) return null;

    return (
      <div className="flex h-full flex-col">
        {/* Compact header */}
        <div className="flex-none border-b border-gray-700 bg-gray-800/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center text-sm font-medium text-white">
                <span className="mr-2 text-blue-400">#{revision.id}</span>
                <span className="text-xs text-gray-400">• {revision.author_name}</span>
              </h3>
              <div className="mt-1 text-xs text-gray-400">
                {formatting.formatDate(revision.revision_timestamp)} •{' '}
                {formatting.formatSize(revision.size)}
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 text-gray-400 transition-colors hover:text-gray-300"
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
            <div className="mt-2 rounded bg-gray-700/50 p-2 text-xs text-gray-300">
              {revision.summary}
            </div>
          )}
        </div>

        {/* Content */}
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
                fontSize: 12,
                lineHeight: 16,
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                scrollBeyondLastLine: false,
                scrollbar: {
                  useShadows: false,
                  verticalScrollbarSize: 12,
                  horizontalScrollbarSize: 12,
                },
                lineNumbers: 'on',
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Two selections - show compact diff
  const comparisonContent = getComparisonContent();

  if (!comparisonContent) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <ArrowPathIcon className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-400" />
          <p className="text-sm text-gray-400">Loading comparison...</p>
        </div>
      </div>
    );
  }

  const { original, modified, originalRevision, modifiedRevision } = comparisonContent;

  return (
    <div className="flex h-full flex-col">
      {/* Compact comparison header */}
      <div className="flex-none border-b border-gray-700 bg-gray-800/50">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center text-sm font-medium text-white">
                <span className="mr-1 text-red-400">#{originalRevision.id}</span>
                <span className="mx-1 text-gray-500">→</span>
                <span className="mr-2 text-green-400">#{modifiedRevision.id}</span>
                <InformationCircleIcon className="h-4 w-4 text-gray-500" title="Comparison view" />
              </h3>
              <div className="mt-1 flex items-center space-x-3 text-xs text-gray-400">
                <div>
                  <span className="text-red-400">From:</span> {originalRevision.author_name}
                </div>
                <div>
                  <span className="text-green-400">To:</span> {modifiedRevision.author_name}
                </div>
                <div className="text-gray-500">
                  {formatting.formatSize(originalRevision.size)} →{' '}
                  {formatting.formatSize(modifiedRevision.size)}
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
                className="p-1 text-gray-400 transition-colors hover:text-gray-300"
                title={`Switch to ${revisionManager.ui.diffViewMode === 'side-by-side' ? 'inline' : 'side-by-side'} view`}
              >
                {revisionManager.ui.diffViewMode === 'side-by-side' ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 text-gray-400 transition-colors hover:text-gray-300"
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

          {/* Compact summary comparison */}
          {(originalRevision.summary || modifiedRevision.summary) && !isCollapsed && (
            <div className="mt-2 space-y-1">
              {originalRevision.summary && (
                <div className="rounded border border-red-800/50 bg-red-900/20 p-2 text-xs">
                  <span className="font-medium text-red-400">Original: </span>
                  <span className="text-red-300">{originalRevision.summary}</span>
                </div>
              )}
              {modifiedRevision.summary && (
                <div className="rounded border border-green-800/50 bg-green-900/20 p-2 text-xs">
                  <span className="font-medium text-green-400">Modified: </span>
                  <span className="text-green-300">{modifiedRevision.summary}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compact diff editor */}
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
              minimap: { enabled: false },
              ignoreTrimWhitespace: false,
              renderWhitespace: 'boundary',
              renderOverviewRuler: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: true,
              wordWrap: 'on',
              fontSize: 12,
              lineHeight: 16,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              cursorStyle: 'line',
              originalEditable: false,
              diffWordWrap: 'on',
              scrollbar: {
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false,
                verticalScrollbarSize: 12,
                horizontalScrollbarSize: 12,
              },
              lineNumbers: 'on',
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 3,
              // Enhanced diff rendering
              diffAlgorithm: 'advanced',
              maxComputationTime: 5000,
            }}
          />
        </div>
      )}

      {/* Compact stats footer */}
      {!isCollapsed && (
        <div className="flex-none border-t border-gray-700 bg-gray-800/50 p-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center space-x-3">
              <span>
                {original.split('\n').length} → {modified.split('\n').length} lines
              </span>
              <span>
                {original.length} → {modified.length} chars
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <kbd className="rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 font-mono text-xs">
                Ctrl+T
              </kbd>
              <span>Toggle view</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
