'use client';

/**
 * Markdown Text Editor Component
 *
 * Custom markdown editor with live preview for workspace nodes.
 * Uses overlay approach: transparent textarea captures input,
 * visible HybridMarkdownRenderer shows rendered output.
 *
 * Replaces RichTextEditor (Tiptap) for markdown-first editing.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import {
  MarkdownEditorAPI,
  wrapSelection,
  insertAtCursor,
  getSelection,
  handleKeyboardShortcut,
} from '@/lib/workspace/markdown-utils';

interface MarkdownTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  onSave?: () => void;
  minimal?: boolean; // Hide toolbar for plain text nodes
  onEditorReady?: (editor: MarkdownEditorAPI) => void;
  fontSize?: number; // Calculated font size to match view mode (Miro-style)
  textAlign?: 'left' | 'center' | 'right'; // Text alignment
  isNote?: boolean; // Whether this is a note (true) or text box (false)
}

export default function MarkdownTextEditor({
  content,
  onChange,
  onBlur,
  onSave,
  minimal = false,
  onEditorReady,
  fontSize = 16,
  textAlign = 'left',
  isNote = true,
}: MarkdownTextEditorProps) {
  const [markdown, setMarkdown] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external content changes (e.g., when node prop updates)
  useEffect(() => {
    if (content !== markdown) {
      setMarkdown(content);
    }
  }, [content]);

  // Handle markdown changes
  const handleChange = useCallback(
    (newMarkdown: string) => {
      setMarkdown(newMarkdown);
      onChange(newMarkdown);
    },
    [onChange]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!textareaRef.current) return;

      // Try to handle as keyboard shortcut
      const handled = handleKeyboardShortcut(e, textareaRef.current, handleChange);

      // Save on Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }

      // Escape key - blur to exit edit mode
      if (e.key === 'Escape') {
        e.preventDefault();
        textareaRef.current?.blur();
      }
    },
    [handleChange, onSave]
  );

  // Create editor API for parent component
  const editorAPI = useMemo<MarkdownEditorAPI>(
    () => ({
      wrapSelection: (before: string, after: string) => {
        if (textareaRef.current) {
          wrapSelection(textareaRef.current, before, after, handleChange);
        }
      },
      insertAtCursor: (text: string) => {
        if (textareaRef.current) {
          insertAtCursor(textareaRef.current, text, handleChange);
        }
      },
      getSelection: () => {
        return textareaRef.current
          ? getSelection(textareaRef.current)
          : { start: 0, end: 0, text: '' };
      },
      focus: () => textareaRef.current?.focus(),
      getMarkdown: () => markdown,
      setMarkdown: (newMarkdown: string) => handleChange(newMarkdown),
    }),
    [markdown, handleChange]
  );

  // Pass editor API to parent when ready
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editorAPI);
    }
  }, [onEditorReady, editorAPI]);

  // Padding based on node type (matches TextNode display mode)
  const padding = isNote ? '12px' : '8px';

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ fontSize: `${fontSize}px` }}
    >
      {/* Input layer - transparent textarea for capturing user input */}
      <textarea
        ref={textareaRef}
        value={markdown}
        onChange={e => handleChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className="absolute inset-0 h-full w-full resize-none border-none bg-transparent text-transparent caret-white outline-none"
        style={{
          fontSize: `${fontSize}px`,
          textAlign,
          lineHeight: 1.5,
          padding,
          caretColor: 'white', // Visible caret
          color: 'transparent', // Invisible text
          WebkitTextFillColor: 'transparent', // Safari fix
          zIndex: 10, // Above preview for input capture
        }}
        spellCheck={true}
        placeholder={minimal ? '' : 'Type markdown here...'}
      />

      {/* Preview layer - visible rendered markdown */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          fontSize: `${fontSize}px`,
          textAlign,
          padding,
          zIndex: 5, // Below textarea
        }}
      >
        {markdown ? (
          <HybridMarkdownRenderer content={markdown} />
        ) : (
          <span className="italic text-neutral-500">{minimal ? '' : 'Type markdown here...'}</span>
        )}
      </div>
    </div>
  );
}
