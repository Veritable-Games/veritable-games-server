'use client';

import React from 'react';
import { Bold, Italic, Link, Heading2, MoreHorizontal, Eye, Edit3 } from 'lucide-react';
import { FormatType } from './types';

interface KeyboardAccessoryBarProps {
  onFormat: (type: FormatType) => void;
  onMore: () => void;
  mode: 'write' | 'preview';
  onModeChange: (mode: 'write' | 'preview') => void;
  visible: boolean;
  disabled?: boolean;
}

export function KeyboardAccessoryBar({
  onFormat,
  onMore,
  mode,
  onModeChange,
  visible,
  disabled = false,
}: KeyboardAccessoryBarProps) {
  if (!visible) return null;

  const handleButtonClick = (type: FormatType) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    onFormat(type);
  };

  return (
    <div className="safe-area-inset-bottom fixed inset-x-0 bottom-0 z-40 border-t border-gray-700 bg-gray-800 md:hidden">
      <div className="flex h-12 items-center justify-between px-2">
        {/* Formatting tools */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onTouchStart={handleButtonClick('bold')}
            onClick={handleButtonClick('bold')}
            disabled={disabled || mode === 'preview'}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors active:bg-gray-700 disabled:opacity-50"
            aria-label="Bold"
          >
            <Bold size={20} />
          </button>
          <button
            type="button"
            onTouchStart={handleButtonClick('italic')}
            onClick={handleButtonClick('italic')}
            disabled={disabled || mode === 'preview'}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors active:bg-gray-700 disabled:opacity-50"
            aria-label="Italic"
          >
            <Italic size={20} />
          </button>
          <button
            type="button"
            onTouchStart={handleButtonClick('link')}
            onClick={handleButtonClick('link')}
            disabled={disabled || mode === 'preview'}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors active:bg-gray-700 disabled:opacity-50"
            aria-label="Link"
          >
            <Link size={20} />
          </button>
          <button
            type="button"
            onTouchStart={handleButtonClick('heading2')}
            onClick={handleButtonClick('heading2')}
            disabled={disabled || mode === 'preview'}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors active:bg-gray-700 disabled:opacity-50"
            aria-label="Heading"
          >
            <Heading2 size={20} />
          </button>
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              onMore();
            }}
            disabled={disabled || mode === 'preview'}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors active:bg-gray-700 disabled:opacity-50"
            aria-label="More formatting options"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* Write/Preview toggle */}
        <div className="flex overflow-hidden rounded-lg bg-gray-700/50">
          <button
            type="button"
            onClick={() => onModeChange('write')}
            className={`flex h-9 w-16 items-center justify-center text-sm font-medium transition-colors ${mode === 'write' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
            aria-label="Write mode"
          >
            <Edit3 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onModeChange('preview')}
            className={`flex h-9 w-16 items-center justify-center text-sm font-medium transition-colors ${mode === 'preview' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
            aria-label="Preview mode"
          >
            <Eye size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default KeyboardAccessoryBar;
