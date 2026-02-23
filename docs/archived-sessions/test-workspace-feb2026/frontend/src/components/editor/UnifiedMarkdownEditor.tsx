'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { DesktopEditorToolbar } from './DesktopEditorToolbar';
import { FloatingFormatToolbar } from './FloatingFormatToolbar';
import { KeyboardAccessoryBar } from './KeyboardAccessoryBar';
import { FormatBottomSheet } from './FormatBottomSheet';
import { FormatType, FORMAT_ACTIONS, UnifiedEditorProps } from './types';

export function UnifiedMarkdownEditor({
  content,
  onChange,
  placeholder = 'Write your content here...',
  features = 'simple',
  showPreview = true,
  disabled = false,
  className = '',
  minRows = 10,
  onSave,
  readOnly = false,
}: UnifiedEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [isMobile, setIsMobile] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Detect keyboard visibility on mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleFocus = () => setIsKeyboardVisible(true);
    const handleBlur = () => {
      // Small delay to handle focus switching between elements
      setTimeout(() => {
        if (!document.activeElement?.closest('.format-bottom-sheet')) {
          setIsKeyboardVisible(false);
        }
      }, 100);
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('focus', handleFocus);
      textarea.addEventListener('blur', handleBlur);
    }

    return () => {
      if (textarea) {
        textarea.removeEventListener('focus', handleFocus);
        textarea.removeEventListener('blur', handleBlur);
      }
    };
  }, [isMobile]);

  // Format handler
  const handleFormat = useCallback(
    (type: FormatType) => {
      const textarea = textareaRef.current;
      if (!textarea || readOnly) return;

      const action = FORMAT_ACTIONS[type];
      if (!action) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const selectedText = value.substring(start, end);

      let newValue: string;
      let newCursorPos: number;

      if (action.isLinePrefix) {
        // Line prefix formatting (headings, lists, quotes)
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', start);
        const currentLine = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);

        // Check if line already has this prefix
        if (currentLine.startsWith(action.before)) {
          // Remove prefix
          newValue =
            value.substring(0, lineStart) +
            currentLine.substring(action.before.length) +
            value.substring(lineEnd === -1 ? value.length : lineEnd);
          newCursorPos = start - action.before.length;
        } else {
          // Add prefix
          newValue =
            value.substring(0, lineStart) +
            action.before +
            currentLine +
            value.substring(lineEnd === -1 ? value.length : lineEnd);
          newCursorPos = start + action.before.length;
        }
      } else if (action.isBlock) {
        // Block formatting (tables, code blocks, HR)
        const prefix = value.length > 0 && !value.endsWith('\n') ? '\n\n' : '';
        const suffix = '\n';
        newValue =
          value.substring(0, start) + prefix + action.before + suffix + value.substring(end);
        newCursorPos = start + prefix.length + action.before.length;
      } else {
        // Inline formatting (bold, italic, etc.)
        const before = action.before;
        const after = action.after || '';

        if (selectedText) {
          newValue =
            value.substring(0, start) + before + selectedText + after + value.substring(end);
          newCursorPos = start + before.length + selectedText.length + after.length;
        } else {
          const defaultText = action.defaultText || '';
          newValue =
            value.substring(0, start) + before + defaultText + after + value.substring(end);
          newCursorPos = start + before.length + defaultText.length;
        }
      }

      onChange(newValue);

      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [onChange, readOnly]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly || disabled) return;

      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key === 'b') {
        e.preventDefault();
        handleFormat('bold');
      } else if (isMod && e.key === 'i') {
        e.preventDefault();
        handleFormat('italic');
      } else if (isMod && e.key === 'k') {
        e.preventDefault();
        handleFormat('link');
      } else if (isMod && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleFormat, onSave, readOnly, disabled]);

  const containerClasses = `overflow-hidden rounded-lg border border-gray-700 bg-gray-900/50 ${className}`;

  return (
    <div className={containerClasses}>
      {/* Desktop Toolbar */}
      {!isMobile && (
        <DesktopEditorToolbar
          onFormat={handleFormat}
          mode={mode}
          onModeChange={setMode}
          onSave={onSave}
          disabled={disabled || readOnly}
          showWikiLinks={features === 'full'}
        />
      )}

      {/* Content Area */}
      <div className="relative flex-1">
        {mode === 'write' ? (
          <>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled || readOnly}
              className={`w-full resize-none border-none bg-transparent p-4 font-mono text-sm leading-relaxed text-gray-200 placeholder-gray-500 outline-none ${isMobile ? 'pb-16' : ''}`}
              style={{
                minHeight: `${minRows * 1.5}rem`,
              }}
              aria-label={placeholder}
            />

            {/* Floating Toolbar (Desktop only, when text selected) */}
            {!isMobile && (
              <FloatingFormatToolbar
                onFormat={handleFormat}
                onMore={() => setBottomSheetOpen(true)}
                textareaRef={textareaRef}
                disabled={disabled || readOnly}
              />
            )}
          </>
        ) : (
          <div className={`min-h-[15rem] bg-transparent p-4 ${isMobile ? 'pb-16' : ''}`}>
            {content.trim() ? (
              <HybridMarkdownRenderer
                content={content}
                className="prose prose-sm prose-invert max-w-none"
              />
            ) : (
              <div className="italic text-gray-500">
                Nothing to preview. Switch to Write mode to add content.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer (Desktop only) */}
      {!isMobile && showPreview && (
        <div className="border-t border-gray-700 bg-gray-800/50 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Markdown supported. Use toolbar or keyboard shortcuts.</span>
            <span>{content.length} characters</span>
          </div>
        </div>
      )}

      {/* Mobile: Keyboard Accessory Bar */}
      {isMobile && (
        <KeyboardAccessoryBar
          onFormat={handleFormat}
          onMore={() => setBottomSheetOpen(true)}
          mode={mode}
          onModeChange={setMode}
          visible={isKeyboardVisible || mode === 'preview'}
          disabled={disabled || readOnly}
        />
      )}

      {/* Mobile: Bottom Sheet */}
      <FormatBottomSheet
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        onFormat={handleFormat}
        showWikiLinks={features === 'full'}
      />
    </div>
  );
}

export default UnifiedMarkdownEditor;
