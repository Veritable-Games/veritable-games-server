'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bold, Italic, Link, Heading2, MoreHorizontal } from 'lucide-react';
import { FormatType } from './types';

interface FloatingFormatToolbarProps {
  onFormat: (type: FormatType) => void;
  onMore: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
}

interface Position {
  x: number;
  y: number;
  show: boolean;
}

export function FloatingFormatToolbar({
  onFormat,
  onMore,
  textareaRef,
  disabled = false,
}: FloatingFormatToolbarProps) {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, show: false });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const updatePosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Only show if there's a selection
    if (start === end) {
      setPosition(prev => ({ ...prev, show: false }));
      setHasSelection(false);
      return;
    }

    setHasSelection(true);

    // Get textarea position relative to viewport
    const rect = textarea.getBoundingClientRect();

    // Calculate approximate position based on selection
    // This is a simplified calculation - for better accuracy, we'd need
    // to measure actual text positions
    const textBeforeSelection = textarea.value.substring(0, start);
    const lines = textBeforeSelection.split('\n');
    const currentLineNumber = lines.length - 1;

    // Approximate line height (adjust based on your CSS)
    const lineHeight = 24;
    const charWidth = 8;

    // Calculate Y position (above the selection)
    const scrollTop = textarea.scrollTop;
    const yOffset = currentLineNumber * lineHeight - scrollTop;
    const y = rect.top + yOffset - 50; // 50px above selection

    // Calculate X position (centered on selection)
    const lastLine = lines[lines.length - 1] || '';
    const lastLineLength = lastLine.length;
    const selectionLength = Math.min(end - start, 20); // Cap for centering
    const xOffset = (lastLineLength + selectionLength / 2) * charWidth;
    const x = Math.min(
      Math.max(rect.left + xOffset, rect.left + 100), // Min 100px from left
      rect.right - 200 // Max 200px from right edge
    );

    setPosition({ x, y: Math.max(y, 60), show: true }); // Min 60px from top
  }, [textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelectionChange = () => {
      // Small delay to ensure selection is complete
      setTimeout(updatePosition, 10);
    };

    const handleMouseUp = () => {
      setTimeout(updatePosition, 10);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Update on arrow keys with shift (selection) or on select all
      if (e.shiftKey || (e.ctrlKey && e.key === 'a')) {
        setTimeout(updatePosition, 10);
      }
    };

    const handleBlur = () => {
      // Delay hiding to allow button clicks
      setTimeout(() => {
        if (!document.activeElement?.closest('.floating-toolbar')) {
          setPosition(prev => ({ ...prev, show: false }));
        }
      }, 150);
    };

    textarea.addEventListener('mouseup', handleMouseUp);
    textarea.addEventListener('keyup', handleKeyUp);
    textarea.addEventListener('blur', handleBlur);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      textarea.removeEventListener('mouseup', handleMouseUp);
      textarea.removeEventListener('keyup', handleKeyUp);
      textarea.removeEventListener('blur', handleBlur);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [textareaRef, updatePosition]);

  // Hide on scroll
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleScroll = () => {
      if (hasSelection) {
        updatePosition();
      }
    };

    textarea.addEventListener('scroll', handleScroll);
    return () => textarea.removeEventListener('scroll', handleScroll);
  }, [textareaRef, hasSelection, updatePosition]);

  if (!position.show || disabled) return null;

  const handleButtonClick = (type: FormatType) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFormat(type);
    // Keep focus on textarea
    textareaRef.current?.focus();
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMore();
    setPosition(prev => ({ ...prev, show: false }));
  };

  return (
    <div
      ref={toolbarRef}
      className="floating-toolbar animate-in fade-in slide-in-from-bottom-2 fixed z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-600 bg-gray-800 p-1 shadow-xl">
        <button
          type="button"
          onMouseDown={handleButtonClick('bold')}
          className="flex h-9 w-9 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onMouseDown={handleButtonClick('italic')}
          className="flex h-9 w-9 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onMouseDown={handleButtonClick('link')}
          className="flex h-9 w-9 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          title="Link"
        >
          <Link size={18} />
        </button>
        <button
          type="button"
          onMouseDown={handleButtonClick('heading2')}
          className="flex h-9 w-9 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          title="Heading"
        >
          <Heading2 size={18} />
        </button>
        <div className="mx-0.5 h-6 w-px bg-gray-600" />
        <button
          type="button"
          onMouseDown={handleMoreClick}
          className="flex h-9 w-9 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          title="More formatting options"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
      {/* Arrow pointing down */}
      <div className="flex justify-center">
        <div className="h-2 w-4 overflow-hidden">
          <div className="-mt-2 h-3 w-3 rotate-45 transform border-b border-r border-gray-600 bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

export default FloatingFormatToolbar;
