'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';

// Dynamically import Monaco DiffEditor to avoid SSR issues
const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then(mod => ({ default: mod.DiffEditor })),
  {
    ssr: false,
    loading: () => null,
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

interface DiffViewerProps {
  leftRevision: Revision;
  rightRevision: Revision;
  onClearLeft: () => void;
  onClearRight: () => void;
  fontSize: number;
}

/**
 * DiffViewer - Monaco DiffEditor for side-by-side revision comparison
 *
 * Uses the same flex container pattern as EditorPanel for proper Monaco height rendering.
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  leftRevision,
  rightRevision,
  onClearLeft,
  onClearRight,
  fontSize,
}) => {
  const formatting = useRevisionFormatting();

  const getWordCount = (content: string) => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const characters = content.length;
    return { words, characters };
  };

  const leftStats = getWordCount(leftRevision.content || '');
  const rightStats = getWordCount(rightRevision.content || '');

  const handleEditorMount = (editor: any) => {
    editor.updateOptions({
      readOnly: true,
      automaticLayout: true,
      fontSize: fontSize,
      lineHeight: Math.floor(fontSize * 1.4),
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Fira Code", monospace',
      scrollBeyondLastLine: false,
      renderSideBySide: true,
      lineNumbers: 'on',
    });

    // Inject CSS to fix Monaco's textarea white box issue (CSP blocks Monaco's CDN styles)
    const container = editor.getDomNode();
    if (container && !container.querySelector('#monaco-fix-styles')) {
      const style = document.createElement('style');
      style.id = 'monaco-fix-styles';
      style.textContent = `
        .monaco-editor textarea.inputarea {
          background: transparent !important;
          background-color: transparent !important;
          color: transparent !important;
          caret-color: transparent !important;
        }
        .monaco-editor .inputarea.ime-input {
          background: transparent !important;
        }
        .monaco-editor .overflow-guard,
        .monaco-editor .margin,
        .monaco-editor .monaco-scrollable-element {
          background: #1e1e1e !important;
        }
      `;
      container.appendChild(style);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header - matches EditorPanel pattern */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800/30 px-3 py-2">
        <div className="flex items-center justify-between">
          {/* Left revision info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-400"></div>
              <span className="text-sm font-medium text-blue-300">Left #{leftRevision.id}</span>
              <button
                onClick={onClearLeft}
                className="rounded p-1 text-blue-300 transition-colors hover:bg-blue-500/20 hover:text-blue-200"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
            <span className="text-xs text-blue-200/70">
              {leftRevision.author_name} •{' '}
              {formatting.formatDate(leftRevision.revision_timestamp, true)}
            </span>
          </div>

          {/* Right revision info */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-red-200/70">
              {rightRevision.author_name} •{' '}
              {formatting.formatDate(rightRevision.revision_timestamp, true)}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-red-300">Right #{rightRevision.id}</span>
              <div className="h-2 w-2 rounded-full bg-red-400"></div>
              <button
                onClick={onClearRight}
                className="rounded p-1 text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content - matches EditorPanel flex pattern exactly */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <MonacoDiffEditor
            height="100%"
            language="markdown"
            theme="vs-dark"
            original={leftRevision.content || ''}
            modified={rightRevision.content || ''}
            onMount={handleEditorMount}
          />
        </div>

        {/* Footer - matches EditorPanel pattern */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800/20 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-3">
              <span className="text-blue-200/60">
                Left: {leftStats.words} words, {leftStats.characters} chars
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-red-200/60">
                Right: {rightStats.words} words, {rightStats.characters} chars
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
