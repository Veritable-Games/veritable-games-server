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
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading diff editor...</p>
        </div>
      </div>
    ),
  }
);

interface DiffViewerProps {
  revisionManager: any;
}

export function DiffViewer({ revisionManager }: DiffViewerProps) {
  const formatting = useRevisionFormatting();
  const editorRef = useRef<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('light');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setEditorTheme(mediaQuery.matches ? 'vs-dark' : 'light');

    const handler = (e: MediaQueryListEvent) => {
      setEditorTheme(e.matches ? 'vs-dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Handle editor mounting
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: revisionManager.ui.showMinimap },
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
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      cursorStyle: 'line',
      scrollbar: {
        useShadows: false,
        verticalHasArrows: true,
        horizontalHasArrows: true,
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 14,
      },
    });

    // Add custom actions (using Monaco's built-in keybindings)
    try {
      // Access Monaco through the editor instance
      const monaco = (window as WindowWithMonaco).monaco;
      if (monaco) {
        editor.addAction({
          id: 'toggle-minimap',
          label: 'Toggle Minimap',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyM],
          run: () => {
            revisionManager.toggleMinimap();
          },
        });

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
        minimap: { enabled: revisionManager.ui.showMinimap },
        renderSideBySide: revisionManager.ui.diffViewMode === 'side-by-side',
      });
    }
  }, [revisionManager.ui.showMinimap, revisionManager.ui.diffViewMode]);

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
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <DocumentTextIcon className="mx-auto mb-6 h-16 w-16 text-gray-400 dark:text-gray-600" />
          <h3 className="mb-3 text-lg font-medium text-gray-900 dark:text-gray-100">
            Select Revisions to Compare
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>Choose one or two revisions from the list to view differences.</p>
            <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="mb-2 font-medium text-gray-900 dark:text-gray-100">How to select:</h4>
              <ul className="space-y-1 text-left">
                <li>• Click a revision to select it</li>
                <li>• Hold Ctrl/Cmd to select multiple</li>
                <li>• Hold Shift to select a range</li>
                <li>• Use quick compare buttons</li>
              </ul>
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
        {/* Header */}
        <div className="flex-none border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Revision #{revision.id}
              </h3>
              <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{revision.author_name}</span>
                <span>•</span>
                <span>{formatting.formatDate(revision.revision_timestamp)}</span>
                <span>•</span>
                <span>{formatting.formatSize(revision.size, true)}</span>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {isCollapsed ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronUpIcon className="h-4 w-4" />
              )}
              <span className="ml-1">{isCollapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          </div>

          {revision.summary && !isCollapsed && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">{revision.summary}</p>
            </div>
          )}
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="flex-1">
            <MonacoDiffEditor
              height="100%"
              language="markdown"
              theme={editorTheme}
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
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Two selections - show diff
  const comparisonContent = getComparisonContent();

  if (!comparisonContent) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <ArrowPathIcon className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading comparison...</p>
        </div>
      </div>
    );
  }

  const { original, modified, originalRevision, modifiedRevision } = comparisonContent;

  return (
    <div className="flex h-full flex-col">
      {/* Comparison Header */}
      <div className="flex-none border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center text-lg font-medium text-gray-900 dark:text-gray-100">
                <span className="mr-2 text-red-600 dark:text-red-400">#{originalRevision.id}</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="text-green-600 dark:text-green-400">#{modifiedRevision.id}</span>
                <InformationCircleIcon
                  className="ml-3 h-5 w-5 text-gray-400"
                  title="Comparison view"
                />
              </h3>
              <div className="mt-1 flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium text-red-600 dark:text-red-400">From:</span>{' '}
                  {originalRevision.author_name} •{' '}
                  {formatting.formatDate(originalRevision.revision_timestamp, true)}
                </div>
                <div>
                  <span className="font-medium text-green-600 dark:text-green-400">To:</span>{' '}
                  {modifiedRevision.author_name} •{' '}
                  {formatting.formatDate(modifiedRevision.revision_timestamp, true)}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Size: {formatting.formatSize(originalRevision.size)} →{' '}
                {formatting.formatSize(modifiedRevision.size)}
              </span>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {isCollapsed ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronUpIcon className="h-4 w-4" />
                )}
                <span className="ml-1">{isCollapsed ? 'Expand' : 'Collapse'}</span>
              </button>
            </div>
          </div>

          {/* Summary comparison */}
          {(originalRevision.summary || modifiedRevision.summary) && !isCollapsed && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {originalRevision.summary && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/10">
                  <h4 className="mb-1 text-sm font-medium text-red-800 dark:text-red-300">
                    Original Summary
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {originalRevision.summary}
                  </p>
                </div>
              )}
              {modifiedRevision.summary && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/10">
                  <h4 className="mb-1 text-sm font-medium text-green-800 dark:text-green-300">
                    Modified Summary
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    {modifiedRevision.summary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diff Editor */}
      {!isCollapsed && (
        <div className="flex-1">
          <MonacoDiffEditor
            height="100%"
            language="markdown"
            theme={editorTheme}
            original={original}
            modified={modified}
            onMount={handleEditorDidMount}
            options={{
              renderSideBySide: revisionManager.ui.diffViewMode === 'side-by-side',
              minimap: { enabled: revisionManager.ui.showMinimap },
              ignoreTrimWhitespace: !revisionManager.ui.hideUnchanged,
              renderWhitespace: 'boundary',
              renderOverviewRuler: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: true,
              wordWrap: 'on',
              fontSize: 13,
              lineHeight: 18,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              cursorStyle: 'line',
              originalEditable: false,
              diffWordWrap: 'on',
              scrollbar: {
                useShadows: false,
                verticalHasArrows: true,
                horizontalHasArrows: true,
              },
              // Enhanced diff rendering
              diffAlgorithm: 'advanced',
              maxComputationTime: 5000,
            }}
          />
        </div>
      )}

      {/* Quick stats */}
      {!isCollapsed && (
        <div className="flex-none border-t border-gray-200 bg-gray-50 px-6 py-2 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>
                Lines: {original.split('\n').length} → {modified.split('\n').length}
              </span>
              <span>
                Characters: {original.length} → {modified.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <kbd className="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                Ctrl+M
              </kbd>
              <span>Toggle minimap</span>
              <kbd className="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-700">
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
