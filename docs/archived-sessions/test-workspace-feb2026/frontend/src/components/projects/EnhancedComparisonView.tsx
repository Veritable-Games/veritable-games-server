'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { ComparisonData, RevisionUIState } from '@/hooks/useRevisionManager';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';
import { logger } from '@/lib/utils/logger';

interface EnhancedComparisonViewProps {
  comparison: ComparisonData | null;
  ui: RevisionUIState;
  getRevisionContent: (id: number) => string;
  onDiffViewModeChange: (mode: RevisionUIState['diffViewMode']) => void;
  onToggleHideUnchanged: () => void;
  onToggleMinimap: () => void;
  comparing: boolean;
}

export function EnhancedComparisonView({
  comparison,
  ui,
  getRevisionContent,
  onDiffViewModeChange,
  onToggleHideUnchanged,
  onToggleMinimap,
  comparing,
}: EnhancedComparisonViewProps) {
  const { formatDate, formatChangesCount } = useRevisionFormatting();
  const [editorReady, setEditorReady] = useState(false);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const editorRef = useRef<any>(null);

  const changeStats = useMemo(() => {
    return comparison ? formatChangesCount(comparison.diff) : null;
  }, [comparison, formatChangesCount]);

  // Handle editor mounting and configuration
  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    setEditorReady(true);

    // Enhanced editor configuration for individual productivity
    editor.updateOptions({
      renderSideBySide: ui.diffViewMode === 'side-by-side',
      hideUnchangedRegions: { enabled: ui.hideUnchanged },
      readOnly: true,
      minimap: {
        enabled: ui.showMinimap,
        scale: 2,
        showSlider: 'always',
      },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
      lineHeight: 20,
      letterSpacing: 0.5,
      lineNumbers: 'on',
      lineNumbersMinChars: 4,
      glyphMargin: true,
      folding: true,
      foldingHighlight: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'mouseover',
      lineDecorationsWidth: 10,
      renderWhitespace: 'boundary',
      renderControlCharacters: true,
      diffWordWrap: 'on',
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      originalEditable: false,
      modifiedEditable: false,
      enableSplitViewResizing: true,
      scrollbar: {
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12,
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        arrowSize: 11,
        verticalSliderSize: 12,
        horizontalSliderSize: 12,
      },
      overviewRulerLanes: 3,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: false,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        bracketPairsHorizontal: true,
        highlightActiveBracketPair: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      unicodeHighlight: {
        nonBasicASCII: false,
        invisibleCharacters: true,
        ambiguousCharacters: true,
      },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: true,
      find: {
        addExtraSpaceOnTop: true,
        autoFindInSelection: 'multiline',
        seedSearchStringFromSelection: 'selection',
      },
    });

    // Enhanced syntax highlighting for markdown
    monaco.languages.setLanguageConfiguration('markdown', {
      wordPattern:
        /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      brackets: [
        ['[', ']'],
        ['(', ')'],
        ['{', '}'],
      ],
      autoClosingPairs: [
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '{', close: '}' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '`', close: '`' },
        { open: '*', close: '*' },
        { open: '_', close: '_' },
        { open: '**', close: '**' },
        { open: '__', close: '__' },
      ],
    });

    // Add cursor position tracking for better navigation
    editor.onDidChangeCursorPosition((e: any) => {
      setCurrentLine(e.position.lineNumber);
    });

    // Enhanced keyboard shortcuts for productivity
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find').run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.goToLine').run();
    });

    editor.addCommand(monaco.KeyCode.F3, () => {
      editor.getAction('editor.action.nextMatchFindAction').run();
    });

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F3, () => {
      editor.getAction('editor.action.previousMatchFindAction').run();
    });

    // Word wrap toggle
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
      const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
      editor.updateOptions({
        wordWrap: currentWrap === 'on' ? 'off' : 'on',
      });
    });

    logger.info('Enhanced Monaco diff editor mounted successfully with productivity features');
  };

  // Update editor options when UI state changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        renderSideBySide: ui.diffViewMode === 'side-by-side',
        hideUnchangedRegions: { enabled: ui.hideUnchanged },
        minimap: { enabled: ui.showMinimap },
      });
    }
  }, [ui.diffViewMode, ui.hideUnchanged, ui.showMinimap]);

  if (comparing) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <p className="mb-2 text-lg text-gray-300">Comparing Revisions</p>
          <p className="text-sm text-gray-500">Processing differences...</p>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/50">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🔄</div>
          <h3 className="mb-2 text-xl font-medium text-white">Ready to Compare</h3>
          <p className="mb-4 text-gray-400">
            Select two revisions from the list to see a detailed comparison of changes.
          </p>
          <div className="space-y-2 rounded bg-gray-800 p-4 text-left text-sm">
            <p className="font-medium text-gray-300">Tips for better comparisons:</p>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>• Use "vs Latest" for quick comparison with current version</li>
              <li>• Use "vs Prev" to see incremental changes</li>
              <li>• Toggle side-by-side or inline view for different perspectives</li>
              <li>• Hide unchanged regions to focus on modifications</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Enhanced Comparison Header */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800">
        {/* Primary Header */}
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium text-white">Comparison View</h3>
              {changeStats && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-green-600/20 px-2 py-1 text-green-400">
                    +{changeStats.added}
                  </span>
                  <span className="rounded bg-red-600/20 px-2 py-1 text-red-400">
                    -{changeStats.removed}
                  </span>
                  <span className="rounded bg-blue-600/20 px-2 py-1 text-blue-400">
                    ~{changeStats.modified}
                  </span>
                  <span className="text-xs text-gray-400">({changeStats.total} changes)</span>
                </div>
              )}
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded bg-gray-700">
                <button
                  onClick={() => onDiffViewModeChange('side-by-side')}
                  className={`px-3 py-1 text-xs ${
                    ui.diffViewMode === 'side-by-side'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Side by Side
                </button>
                <button
                  onClick={() => onDiffViewModeChange('inline')}
                  className={`px-3 py-1 text-xs ${
                    ui.diffViewMode === 'inline'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Inline
                </button>
              </div>

              <button
                onClick={onToggleHideUnchanged}
                className={`rounded px-3 py-1 text-xs ${
                  ui.hideUnchanged
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Hide unchanged regions"
              >
                Hide Unchanged
              </button>

              <button
                onClick={onToggleMinimap}
                className={`rounded px-3 py-1 text-xs ${
                  ui.showMinimap
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Toggle minimap"
              >
                Minimap
              </button>
            </div>
          </div>
        </div>

        {/* Revision Details */}
        <div className="p-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-gray-400">From Revision:</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-blue-400">#{comparison.from.id}</span>
                <span className="text-gray-300">{comparison.from.summary || 'No summary'}</span>
              </div>
              <div className="text-xs text-gray-500">{formatDate(comparison.from.timestamp)}</div>
            </div>

            <div className="space-y-1">
              <div className="text-gray-400">To Revision:</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-green-400">#{comparison.to.id}</span>
                <span className="text-gray-300">{comparison.to.summary || 'No summary'}</span>
              </div>
              <div className="text-xs text-gray-500">{formatDate(comparison.to.timestamp)}</div>
            </div>
          </div>
        </div>

        {/* Navigation Info */}
        {currentLine && editorReady && (
          <div className="px-3 pb-3">
            <div className="text-xs text-gray-500">Current line: {currentLine}</div>
          </div>
        )}
      </div>

      {/* Monaco Diff Editor */}
      <div className="relative flex-1">
        <DiffEditor
          height="100%"
          original={getRevisionContent(comparison.from.id)}
          modified={getRevisionContent(comparison.to.id)}
          language="markdown"
          theme="vs-dark"
          loading={
            <div className="flex h-full items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
                <p className="text-sm text-gray-400">Loading enhanced diff editor...</p>
              </div>
            </div>
          }
          onMount={handleEditorMount}
          options={{
            renderSideBySide: ui.diffViewMode === 'side-by-side',
            hideUnchangedRegions: { enabled: ui.hideUnchanged },
            readOnly: true,
            minimap: { enabled: ui.showMinimap },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            fontSize: 13,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            renderWhitespace: 'boundary',
            diffWordWrap: 'on',
            ignoreTrimWhitespace: true,
            renderIndicators: true,
            enableSplitViewResizing: true,
          }}
        />

        {/* Floating Navigation Controls */}
        {editorReady && changeStats && changeStats.total > 0 && (
          <div className="absolute right-4 top-4 space-y-1 rounded border border-gray-600 bg-gray-800/90 p-2 backdrop-blur">
            <div className="text-center text-xs text-gray-400">Quick Nav</div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.trigger('', 'editor.action.goToNextMatch', '');
                  }
                }}
                className="rounded bg-blue-600/70 px-2 py-1 text-xs text-white hover:bg-blue-600"
                title="Next change"
              >
                Next ↓
              </button>
              <button
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.trigger('', 'editor.action.goToPrevMatch', '');
                  }
                }}
                className="rounded bg-blue-600/70 px-2 py-1 text-xs text-white hover:bg-blue-600"
                title="Previous change"
              >
                Prev ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
