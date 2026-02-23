'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then(mod => ({ default: mod.Editor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-gray-900/20">
        <div className="text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
          <p className="text-xs text-gray-400">Loading editor...</p>
        </div>
      </div>
    ),
  }
);

interface Revision {
  id: number;
  content: string;
  summary: string;
  revision_timestamp: string;
  author_name: string;
  size: number;
}

interface EditorPanelProps {
  side: 'left' | 'right';
  revision: Revision | null;
  onClear: () => void;
  onEditorMount: (editor: any) => void;
  fontSize: number;
  showDiff: boolean;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  side,
  revision,
  onClear,
  onEditorMount,
  fontSize,
  showDiff,
}) => {
  const formatting = useRevisionFormatting();
  const isLeft = side === 'left';

  const colorClasses = isLeft
    ? {
        headerBg: 'bg-blue-900/10',
        dotColor: 'bg-blue-400',
        textColor: 'text-blue-300',
        idColor: 'text-blue-200/60',
        metaColor: 'text-blue-200/70',
        buttonHover: 'hover:text-blue-200 hover:bg-blue-500/20',
        footerBg: 'bg-blue-900/5',
        footerText: 'text-blue-200/60',
        footerLabel: 'text-blue-300/40',
      }
    : {
        headerBg: 'bg-red-900/10',
        dotColor: 'bg-red-400',
        textColor: 'text-red-300',
        idColor: 'text-red-200/60',
        metaColor: 'text-red-200/70',
        buttonHover: 'hover:text-red-200 hover:bg-red-500/20',
        footerBg: 'bg-red-900/5',
        footerText: 'text-red-200/60',
        footerLabel: 'text-red-300/40',
      };

  const getWordCount = (content: string) => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;
    return { words, characters, charactersNoSpaces };
  };

  const handleEditorMount = (editor: any) => {
    editor.updateOptions({
      readOnly: true,
      automaticLayout: true,
      wordWrap: showDiff ? 'off' : 'on',
      fontSize: fontSize,
      lineHeight: Math.floor(fontSize * 1.4),
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
      scrollBeyondLastLine: false,
      minimap: { enabled: showDiff },
      lineNumbers: 'on',
      scrollbar: { useShadows: true, verticalScrollbarSize: 14 },
      stopRenderingLineAfter: 10000,
    });
    onEditorMount(editor);
  };

  return (
    <div
      className={`flex flex-1 flex-col ${isLeft ? 'border-r border-gray-700' : ''} revision-editor-panel`}
    >
      {/* Header */}
      <div className={`flex-shrink-0 border-b border-gray-700 px-3 py-2 ${colorClasses.headerBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 ${colorClasses.dotColor} rounded-full`}></div>
            <span className={`text-sm font-medium ${colorClasses.textColor}`}>
              {isLeft ? 'Left' : 'Right'}
            </span>
            {revision && <span className={`text-xs ${colorClasses.idColor}`}>#{revision.id}</span>}
          </div>
          {revision && (
            <button
              onClick={onClear}
              className={`p-1 ${colorClasses.textColor} ${colorClasses.buttonHover} rounded transition-colors`}
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </div>
        {revision && (
          <div className={`text-xs ${colorClasses.metaColor} mt-1`}>
            {revision.author_name} • {formatting.formatDate(revision.revision_timestamp, true)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {revision ? (
            <MonacoEditor
              height="100%"
              language="markdown"
              theme="vs-dark"
              value={revision.content || ''}
              onMount={handleEditorMount}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gray-900/20">
              <div className="text-center text-gray-400">
                <p className="text-sm">Select a revision for {side} panel</p>
                <p className="mt-1 text-xs">
                  {isLeft
                    ? 'Click any revision from the list'
                    : 'Click another revision from the list'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Word Count Footer */}
        <div
          className={`flex-shrink-0 border-t border-gray-700 px-3 py-2 ${colorClasses.footerBg} revision-editor-footer`}
        >
          <div className={`flex items-center justify-between text-xs ${colorClasses.footerText}`}>
            <div className="flex items-center gap-3">
              {revision ? (
                <>
                  <span>{getWordCount(revision.content || '').words} words</span>
                  <span>{getWordCount(revision.content || '').characters} chars</span>
                  <span>
                    {getWordCount(revision.content || '').charactersNoSpaces} chars (no spaces)
                  </span>
                </>
              ) : (
                <span className="text-gray-500">No content selected</span>
              )}
            </div>
            <div className={colorClasses.footerLabel}>{isLeft ? 'Left Panel' : 'Right Panel'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
