'use client';

import { useState, useRef, useCallback } from 'react';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';

interface HybridMarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}

interface ToolbarButton {
  id: string;
  label: string;
  icon: string;
  action: (textarea: HTMLTextAreaElement) => void;
  shortcut?: string;
}

export function HybridMarkdownEditor({
  content,
  onChange,
  placeholder = 'Write your content here...',
  className = '',
  rows = 10,
  autoFocus = false,
  disabled = false,
  onSubmit,
  submitLabel = 'Submit',
  submitDisabled = false,
}: HybridMarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper function to wrap selected text or insert at cursor
  const wrapOrInsert = useCallback(
    (before: string, after: string = '', defaultText: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);

      let newText;
      let newCursorPos;

      if (selectedText) {
        // Wrap selected text
        newText = before + selectedText + after;
        newCursorPos = start + before.length + selectedText.length + after.length;
      } else {
        // Insert with default text
        newText = before + defaultText + after;
        newCursorPos = start + before.length + defaultText.length;
      }

      // Replace the selected text or insert at cursor
      const newValue = textarea.value.substring(0, start) + newText + textarea.value.substring(end);

      onChange(newValue);

      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [onChange]
  );

  // Helper function to insert at line start
  const insertAtLineStart = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const value = textarea.value;

      // Find the start of the current line
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(lineStart, value.indexOf('\n', start));

      let newValue;
      let newCursorPos;

      // Check if line already has the prefix
      if (currentLine.startsWith(prefix)) {
        // Remove the prefix
        newValue =
          value.substring(0, lineStart) +
          currentLine.substring(prefix.length) +
          value.substring(lineStart + currentLine.length);
        newCursorPos = start - prefix.length;
      } else {
        // Add the prefix
        newValue =
          value.substring(0, lineStart) +
          prefix +
          currentLine +
          value.substring(lineStart + currentLine.length);
        newCursorPos = start + prefix.length;
      }

      onChange(newValue);

      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [onChange]
  );

  // Helper function to insert table
  const insertTable = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const tableTemplate = `\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n`;
    const start = textarea.selectionStart;
    const newValue =
      textarea.value.substring(0, start) + tableTemplate + textarea.value.substring(start);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1);
    }, 0);
  }, [onChange]);

  // Helper function to insert horizontal rule
  const insertHR = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const hr = '\n---\n';
    const newValue = textarea.value.substring(0, start) + hr + textarea.value.substring(start);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + hr.length, start + hr.length);
    }, 0);
  }, [onChange]);

  // Toolbar button definitions
  const toolbarButtons: ToolbarButton[] = [
    {
      id: 'bold',
      label: 'Bold',
      icon: 'B',
      action: () => wrapOrInsert('**', '**', 'bold text'),
      shortcut: 'Ctrl+B',
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: 'I',
      action: () => wrapOrInsert('*', '*', 'italic text'),
      shortcut: 'Ctrl+I',
    },
    {
      id: 'strikethrough',
      label: 'Strikethrough',
      icon: 'S',
      action: () => wrapOrInsert('~~', '~~', 'strikethrough text'),
    },
    {
      id: 'code',
      label: 'Code',
      icon: '</>',
      action: () => wrapOrInsert('`', '`', 'code'),
    },
    {
      id: 'link',
      label: 'Link',
      icon: '🔗',
      action: () => {
        const url = prompt('Enter URL:');
        if (url) {
          wrapOrInsert('[', `](${url})`, 'link text');
        }
      },
    },
    {
      id: 'quote',
      label: 'Quote',
      icon: '"',
      action: () => insertAtLineStart('> '),
    },
    {
      id: 'table',
      label: 'Table',
      icon: '⊞',
      action: insertTable,
    },
    {
      id: 'hr',
      label: 'Horizontal Rule',
      icon: '—',
      action: insertHR,
    },
    {
      id: 'code-block',
      label: 'Code Block',
      icon: '[]',
      action: () => wrapOrInsert('\n```\n', '\n```\n', 'code block'),
    },
  ];

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            wrapOrInsert('**', '**', 'bold text');
            break;
          case 'i':
            e.preventDefault();
            wrapOrInsert('*', '*', 'italic text');
            break;
          case 'k':
            e.preventDefault();
            const url = prompt('Enter URL:');
            if (url) {
              wrapOrInsert('[', `](${url})`, 'link text');
            }
            break;
        }
      }
    },
    [wrapOrInsert]
  );

  return (
    <div
      className={`overflow-hidden rounded-lg border border-gray-700 bg-gray-900 transition-all focus-within:border-blue-500 focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.5)] ${className}`}
    >
      {/* Toolbar */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between p-2">
          {/* Toolbar Buttons */}
          <div className="flex flex-wrap items-center space-x-1">
            {/* Text formatting group */}
            <div className="flex items-center space-x-0.5 rounded bg-gray-700/50 px-1 py-0.5">
              {toolbarButtons.slice(0, 4).map(button => (
                <button
                  key={button.id}
                  type="button"
                  onClick={() => button.action(textareaRef.current!)}
                  className={`rounded px-2 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white ${
                    button.id === 'strikethrough' ? 'line-through' : ''
                  }`}
                  title={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ''}`}
                  disabled={disabled}
                >
                  <span className="font-mono">{button.icon}</span>
                </button>
              ))}
            </div>

            {/* Heading dropdown */}
            <select
              onChange={e => {
                if (e.target.value) {
                  insertAtLineStart(e.target.value + ' ');
                  e.target.value = '';
                }
              }}
              className="h-7 rounded border-none bg-gray-700 px-2 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={disabled}
              defaultValue=""
            >
              <option value="">H</option>
              <option value="#">H1</option>
              <option value="##">H2</option>
              <option value="###">H3</option>
              <option value="####">H4</option>
            </select>

            {/* List dropdown */}
            <select
              onChange={e => {
                if (e.target.value) {
                  insertAtLineStart(e.target.value);
                  e.target.value = '';
                }
              }}
              className="h-7 rounded border-none bg-gray-700 px-2 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={disabled}
              defaultValue=""
            >
              <option value="">List</option>
              <option value="- ">• Bullet</option>
              <option value="1. ">1. Number</option>
              <option value="- [ ] ">☐ Task</option>
            </select>

            {/* Other tools */}
            <div className="flex items-center space-x-0.5 rounded bg-gray-700/50 px-1 py-0.5">
              {toolbarButtons.slice(4).map(button => (
                <button
                  key={button.id}
                  type="button"
                  onClick={() => button.action(textareaRef.current!)}
                  className="rounded px-2 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
                  title={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ''}`}
                  disabled={disabled}
                >
                  <span className="font-mono text-[10px]">{button.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex overflow-hidden rounded-md" role="group" aria-label="Editor mode">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={`px-4 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'write'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
              disabled={disabled}
              aria-pressed={activeTab === 'write'}
              aria-label="Switch to write mode"
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
              disabled={disabled}
              aria-pressed={activeTab === 'preview'}
              aria-label="Switch to preview mode"
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            autoFocus={autoFocus}
            disabled={disabled}
            className="w-full resize-none border-none bg-gray-900 p-4 font-mono text-sm leading-relaxed text-gray-200 placeholder-gray-500 outline-none"
            style={{ minHeight: `${rows * 1.5}rem` }}
            aria-label={placeholder || 'Write your content in Markdown'}
            aria-required="true"
          />
        ) : (
          <div className="min-h-96 bg-gray-900 p-4">
            {content.trim() ? (
              <HybridMarkdownRenderer
                content={content}
                className="prose prose-sm prose-invert max-w-none"
              />
            ) : (
              <div className="italic text-gray-500">
                Nothing to preview. Switch to Write tab to add content.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with Help and Submit Button */}
      <div className="border-t border-gray-700 bg-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Help text and shortcuts */}
          <div className="flex-1 text-xs text-gray-400">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Use the toolbar buttons for easy formatting</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">
                Ctrl+B for bold, Ctrl+I for italic, Ctrl+K for links
              </span>
            </div>
          </div>

          {/* Right side - Character count and Submit button */}
          <div className="flex items-center gap-3">
            <div className="whitespace-nowrap text-xs text-gray-400">
              <span>{content.length}</span>
              <span className="hidden sm:inline"> characters</span>
            </div>
            {onSubmit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitDisabled || disabled || !content.trim()}
                className="whitespace-nowrap rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
              >
                {submitLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HybridMarkdownEditor;
