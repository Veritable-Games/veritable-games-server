'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentSanitizer } from '@/lib/content/sanitization';
import { logger } from '@/lib/utils/logger';

interface TextEdit {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  status: 'needs-edit' | 'comparing' | 'verified' | 'amended';
  note?: string;
  timestamp: number;
}

interface LibraryTextEditorProps {
  content: string;
  pageSlug: string;
  onSave?: (edits: TextEdit[]) => void;
  readonly?: boolean;
}

export default function LibraryTextEditor({
  content,
  pageSlug,
  onSave,
  readonly = false,
}: LibraryTextEditorProps) {
  const [edits, setEdits] = useState<TextEdit[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Load saved edits from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`library-edits-${pageSlug}`);
    if (saved) {
      try {
        setEdits(JSON.parse(saved));
      } catch (e) {
        logger.error('Failed to load saved edits:', e);
      }
    }
  }, [pageSlug]);

  // Save edits to localStorage
  const saveEdits = useCallback(
    (newEdits: TextEdit[]) => {
      setEdits(newEdits);
      localStorage.setItem(`library-edits-${pageSlug}`, JSON.stringify(newEdits));
      if (onSave) {
        onSave(newEdits);
      }
    },
    [pageSlug, onSave]
  );

  // Handle text selection
  const handleSelection = useCallback(() => {
    if (!isEnabled || readonly) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setSelectedText('');
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();

    if (text && contentRef.current?.contains(range.commonAncestorContainer)) {
      // Calculate text offset within the content
      const contentText = contentRef.current.textContent || '';
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(contentRef.current);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const startOffset = beforeRange.toString().length;
      const endOffset = startOffset + text.length;

      setSelectedText(text);
      setSelection({ start: startOffset, end: endOffset });
    }
  }, [isEnabled, readonly]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEnabled || readonly || !selection) return;

      // Ctrl/Cmd + R: Mark as needs edit (red)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        addEdit('needs-edit');
      }
      // Ctrl/Cmd + Y: Mark as comparing (yellow)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        addEdit('comparing');
      }
      // Ctrl/Cmd + G: Mark as verified (green)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        addEdit('verified');
      }
      // Ctrl/Cmd + B: Mark as amended (blue)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        addEdit('amended');
      }
      // Delete: Remove edit
      else if (e.key === 'Delete' && e.shiftKey) {
        e.preventDefault();
        removeEditAtSelection();
      }
    };

    if (isEnabled) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('selectionchange', handleSelection);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [isEnabled, readonly, selection, handleSelection]);

  const addEdit = (status: TextEdit['status']) => {
    if (!selection || !selectedText) return;

    const newEdit: TextEdit = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: selectedText,
      startOffset: selection.start,
      endOffset: selection.end,
      status,
      timestamp: Date.now(),
    };

    // Remove any overlapping edits
    const filteredEdits = edits.filter(
      edit => !(edit.startOffset < selection.end && edit.endOffset > selection.start)
    );

    saveEdits([...filteredEdits, newEdit].sort((a, b) => a.startOffset - b.startOffset));

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectedText('');
    setSelection(null);
  };

  const removeEditAtSelection = () => {
    if (!selection) return;

    const editToRemove = edits.find(
      edit => edit.startOffset <= selection.start && edit.endOffset >= selection.end
    );

    if (editToRemove) {
      saveEdits(edits.filter(edit => edit.id !== editToRemove.id));
    }
  };

  const getStatusColor = (status: TextEdit['status']) => {
    switch (status) {
      case 'needs-edit':
        return 'bg-red-200 border-red-400';
      case 'comparing':
        return 'bg-yellow-200 border-yellow-400';
      case 'verified':
        return 'bg-green-200 border-green-400';
      case 'amended':
        return 'bg-purple-200 border-purple-400';
      default:
        return 'bg-gray-200 border-gray-400';
    }
  };

  const getStatusLabel = (status: TextEdit['status']) => {
    switch (status) {
      case 'needs-edit':
        return 'Needs Edit';
      case 'comparing':
        return 'Comparing';
      case 'verified':
        return 'Verified';
      case 'amended':
        return 'Amended';
      default:
        return 'Unknown';
    }
  };

  // Render content with highlights
  const renderHighlightedContent = () => {
    if (edits.length === 0) {
      return (
        <div dangerouslySetInnerHTML={{ __html: ContentSanitizer.sanitizeHtml(content, 'safe') }} />
      );
    }

    let result = '';
    let lastIndex = 0;
    const contentText = contentRef.current?.textContent || content.replace(/<[^>]*>/g, '');

    // Sort edits by start position
    const sortedEdits = [...edits].sort((a, b) => a.startOffset - b.startOffset);

    sortedEdits.forEach(edit => {
      // Add content before this edit
      result += contentText.slice(lastIndex, edit.startOffset);

      // Add highlighted content
      result += `<mark class="library-edit-highlight ${getStatusColor(edit.status)} px-1 py-0.5 rounded border-2" data-edit-id="${edit.id}" title="${getStatusLabel(edit.status)}: ${edit.text}">`;
      result += contentText.slice(edit.startOffset, edit.endOffset);
      result += '</mark>';

      lastIndex = edit.endOffset;
    });

    // Add remaining content
    result += contentText.slice(lastIndex);

    return (
      <div dangerouslySetInnerHTML={{ __html: ContentSanitizer.sanitizeHtml(result, 'safe') }} />
    );
  };

  const clearAllEdits = () => {
    if (confirm('Clear all edits? This cannot be undone.')) {
      saveEdits([]);
    }
  };

  if (readonly) {
    return (
      <div
        ref={contentRef}
        dangerouslySetInnerHTML={{ __html: ContentSanitizer.sanitizeHtml(content, 'safe') }}
      />
    );
  }

  return (
    <div className="library-text-editor">
      {/* Controls */}
      <div className="sticky top-0 z-10 mb-4 border-b border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={e => setIsEnabled(e.target.checked)}
              className="rounded"
            />
            <span className="font-medium">Enable Text Editor</span>
          </label>

          {isEnabled && (
            <>
              <div className="text-sm text-gray-600">
                Selected:{' '}
                <span className="rounded bg-gray-100 px-1 font-mono">{selectedText || 'None'}</span>
              </div>

              <button
                onClick={() => setShowHelp(!showHelp)}
                className="rounded bg-purple-500 px-3 py-1 text-sm text-white hover:bg-purple-600"
              >
                {showHelp ? 'Hide' : 'Show'} Shortcuts
              </button>

              <div className="flex gap-2">
                <button
                  onClick={clearAllEdits}
                  className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                  disabled={edits.length === 0}
                >
                  Clear All ({edits.length})
                </button>
              </div>
            </>
          )}
        </div>

        {/* Keyboard shortcuts help */}
        {isEnabled && showHelp && (
          <div className="mt-3 rounded border bg-gray-50 p-3 text-sm">
            <div className="mb-2 font-medium">Keyboard Shortcuts (after selecting text):</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div>
                <kbd className="rounded bg-red-200 px-1">Ctrl+R</kbd> Needs Edit
              </div>
              <div>
                <kbd className="rounded bg-yellow-200 px-1">Ctrl+Y</kbd> Comparing
              </div>
              <div>
                <kbd className="rounded bg-green-200 px-1">Ctrl+G</kbd> Verified
              </div>
              <div>
                <kbd className="rounded bg-purple-200 px-1">Ctrl+B</kbd> Amended
              </div>
            </div>
            <div className="mt-2 text-gray-600">
              <kbd className="rounded bg-gray-200 px-1">Shift+Delete</kbd> Remove highlight at
              selection
            </div>
          </div>
        )}

        {/* Edit summary */}
        {edits.length > 0 && (
          <div className="mt-3 flex gap-4 text-sm">
            {(['needs-edit', 'comparing', 'verified', 'amended'] as const).map(status => {
              const count = edits.filter(e => e.status === status).length;
              if (count === 0) return null;
              return (
                <div key={status} className={`rounded border px-2 py-1 ${getStatusColor(status)}`}>
                  {getStatusLabel(status)}: {count}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className={`prose max-w-none ${isEnabled ? 'cursor-text select-text' : ''}`}
        style={{ userSelect: isEnabled ? 'text' : 'inherit' }}
      >
        {isEnabled ? (
          renderHighlightedContent()
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: ContentSanitizer.sanitizeHtml(content, 'safe') }}
          />
        )}
      </div>

      {/* Edit list */}
      {isEnabled && edits.length > 0 && (
        <div className="mt-8 border-t pt-4">
          <h3 className="mb-3 text-lg font-semibold">Edit Annotations ({edits.length})</h3>
          <div className="space-y-2">
            {edits.map((edit, index) => (
              <div
                key={edit.id}
                className={`rounded border-l-4 p-3 ${getStatusColor(edit.status)} cursor-pointer hover:shadow-sm`}
                onClick={() => {
                  // Scroll to the edit
                  const element = document.querySelector(`[data-edit-id="${edit.id}"]`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 text-sm font-medium text-gray-600">
                      {getStatusLabel(edit.status)} #{index + 1}
                    </div>
                    <div className="rounded border bg-white p-2 font-mono text-sm">
                      "{edit.text}"
                    </div>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      saveEdits(edits.filter(e => e.id !== edit.id));
                    }}
                    className="ml-2 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
