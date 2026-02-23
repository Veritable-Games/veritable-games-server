'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TraceEditorPopupProps {
  /** Position relative to scroll container */
  position: { top: number; left: number };
  /** The text being traced from background */
  anchorText: string;
  /** Callback when trace is saved */
  onSave: (content: string) => void;
  /** Callback when editing is cancelled */
  onCancel: () => void;
}

/**
 * TraceEditorPopup - Floating editor for creating traced content.
 * Appears when user selects text in the background to trace it.
 */
export function TraceEditorPopup({
  position,
  anchorText,
  onSave,
  onCancel,
}: TraceEditorPopupProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (content.trim()) {
        onSave(content);
      }
    }
  };

  const handleSave = () => {
    if (content.trim()) {
      onSave(content);
    }
  };

  return (
    <div
      className="absolute z-30 w-80 rounded-lg border border-gray-600 bg-gray-800 shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        maxWidth: 'calc(100% - 2rem)',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
        <span className="text-xs font-medium text-purple-400">Trace Content</span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-200" aria-label="Close">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Anchor text preview */}
      <div className="border-b border-gray-700 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Tracing:</p>
        <p className="mt-1 max-h-16 overflow-auto text-xs italic text-gray-400">
          &ldquo;{anchorText.slice(0, 200)}
          {anchorText.length > 200 ? '...' : ''}&rdquo;
        </p>
      </div>

      {/* Editor */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your traced content (markdown supported)..."
          className="min-h-[100px] w-full resize-none rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          rows={4}
        />

        {/* Help text */}
        <p className="mt-1 text-[10px] text-gray-500">
          Markdown supported. Press Ctrl/Cmd + Enter to save.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-gray-700 px-3 py-2">
        <button
          onClick={onCancel}
          className="rounded px-3 py-1 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!content.trim()}
          className="rounded bg-purple-600 px-3 py-1 text-sm text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Trace
        </button>
      </div>
    </div>
  );
}
