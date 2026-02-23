'use client';

/**
 * Markdown Floating Format Toolbar
 *
 * Miro-style toolbar for markdown editor.
 * Inserts markdown syntax instead of using Tiptap commands.
 */

import { useState, useRef, useEffect } from 'react';
import { MarkdownEditorAPI } from '@/lib/workspace/markdown-utils';
import { insertHeading, insertListItem } from '@/lib/workspace/markdown-utils';

interface MarkdownFloatingToolbarProps {
  editor: MarkdownEditorAPI | null;
  visible: boolean;
  position?: { x: number; y: number } | null;
  nodeType?: 'note' | 'text';
  nodeColor?: string;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  fontSize?: number;
  onFontSizeChange?: (size: number | null) => void;
  // Border styling
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  onBorderWidthChange?: (width: number) => void;
  onBorderColorChange?: (color: string) => void;
  onBorderRadiusChange?: (radius: number) => void;
}

const NOTE_COLORS = [
  '#FEF08A', // Yellow
  '#BFDBFE', // Blue
  '#FCA5A5', // Red
  '#BBF7D0', // Green
  '#FBCFE8', // Pink
  '#DDD6FE', // Purple
  '#FED7AA', // Orange
  '#E5E7EB', // Gray
];

const FONT_SIZES = [
  { label: 'Auto', value: null },
  { label: '10', value: 10 },
  { label: '12', value: 12 },
  { label: '14', value: 14 },
  { label: '16', value: 16 },
  { label: '18', value: 18 },
  { label: '24', value: 24 },
  { label: '36', value: 36 },
  { label: '48', value: 48 },
  { label: '72', value: 72 },
];

export default function MarkdownFloatingToolbar({
  editor,
  visible,
  position,
  nodeType = 'text',
  nodeColor = '#FEF08A',
  onColorChange,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  fontSize,
  onFontSizeChange,
  borderWidth = 0,
  borderColor = '#6B7280',
  borderRadius = 0,
  onBorderWidthChange,
  onBorderColorChange,
  onBorderRadiusChange,
}: MarkdownFloatingToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fontSizePickerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close pickers on outside click
  useEffect(() => {
    if (!showColorPicker && !showFontSizePicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        showColorPicker &&
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
      if (
        showFontSizePicker &&
        fontSizePickerRef.current &&
        !fontSizePickerRef.current.contains(e.target as Node)
      ) {
        setShowFontSizePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker, showFontSizePicker]);

  if (!visible) {
    return null;
  }

  const toolbarStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y - 10}px`,
        transform: 'translate(-50%, -100%)',
      }
    : {
        position: 'fixed',
        top: '64px',
        left: '16px',
      };

  const isEditing = !!editor;

  return (
    <div
      ref={toolbarRef}
      style={{ ...toolbarStyle, fontFamily: 'Arial, sans-serif' }}
      className="z-50 flex items-center gap-0.5 rounded-lg border border-neutral-700 bg-neutral-800 p-1.5 shadow-2xl"
    >
      {isEditing ? (
        // EDITING MODE: Markdown formatting controls
        <>
          {/* Font Size Picker */}
          {onFontSizeChange && (
            <div className="relative" ref={fontSizePickerRef}>
              <button
                onMouseDown={e => {
                  e.preventDefault();
                  setShowFontSizePicker(!showFontSizePicker);
                }}
                className="flex min-w-[52px] items-center justify-between gap-1 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
                title="Font Size"
                type="button"
              >
                <span>{fontSize ? `${Math.round(fontSize)}` : 'Auto'}</span>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showFontSizePicker && (
                <div className="absolute left-0 top-full mt-1 w-20 rounded-lg border border-neutral-700 bg-neutral-800 shadow-2xl">
                  {FONT_SIZES.map(({ label, value }) => (
                    <button
                      key={label}
                      onMouseDown={e => {
                        e.preventDefault();
                        onFontSizeChange(value);
                        setShowFontSizePicker(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-neutral-200 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-neutral-700"
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Bold */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.wrapSelection('**', '**');
            }}
            className="rounded p-2 text-sm font-bold text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Bold (Ctrl+B)"
            type="button"
          >
            B
          </button>

          {/* Italic */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.wrapSelection('*', '*');
            }}
            className="rounded p-2 text-sm italic text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Italic (Ctrl+I)"
            type="button"
          >
            I
          </button>

          {/* Strikethrough */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.wrapSelection('~~', '~~');
            }}
            className="rounded p-2 text-sm text-neutral-200 line-through transition-colors hover:bg-neutral-700"
            title="Strikethrough"
            type="button"
          >
            S
          </button>

          {/* Underline - uses HTML */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.wrapSelection('<u>', '</u>');
            }}
            className="rounded p-2 text-sm text-neutral-200 underline transition-colors hover:bg-neutral-700"
            title="Underline (Ctrl+U)"
            type="button"
          >
            U
          </button>

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Heading 2 */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.insertAtCursor('## ');
            }}
            className="rounded px-2 py-1.5 text-sm font-bold text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Heading 2"
            type="button"
          >
            H2
          </button>

          {/* Heading 3 */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.insertAtCursor('### ');
            }}
            className="rounded px-2 py-1.5 text-sm font-bold text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Heading 3"
            type="button"
          >
            H3
          </button>

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Bullet List */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.insertAtCursor('- ');
            }}
            className="rounded p-2 text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Bullet List"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Numbered List */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              editor.insertAtCursor('1. ');
            }}
            className="rounded p-2 text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Numbered List"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </button>

          {/* Link */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              const selection = editor.getSelection();
              if (selection.text) {
                editor.wrapSelection('[', '](url)');
              } else {
                editor.insertAtCursor('[link text](url)');
              }
            }}
            className="rounded p-2 text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Link (Ctrl+K)"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </button>
        </>
      ) : (
        // SELECTED MODE (NOT EDITING): Node operations
        <>
          {/* Color Picker (Notes only) */}
          {nodeType === 'note' && onColorChange && (
            <div className="relative" ref={colorPickerRef}>
              <button
                onMouseDown={e => {
                  e.preventDefault();
                  setShowColorPicker(!showColorPicker);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
                title="Change Color"
                type="button"
              >
                <div
                  className="h-5 w-5 rounded border border-neutral-600"
                  style={{ backgroundColor: nodeColor }}
                />
                <span>Color</span>
              </button>

              {showColorPicker && (
                <div className="absolute left-0 top-full mt-1 grid grid-cols-4 gap-2 rounded-lg border border-neutral-700 bg-neutral-800 p-2 shadow-2xl">
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color}
                      onMouseDown={e => {
                        e.preventDefault();
                        onColorChange(color);
                        setShowColorPicker(false);
                      }}
                      className="h-8 w-8 rounded border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: color === nodeColor ? '#fff' : 'transparent',
                      }}
                      title={color}
                      type="button"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Duplicate */}
          {onDuplicate && (
            <button
              onMouseDown={e => {
                e.preventDefault();
                onDuplicate();
              }}
              className="rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Duplicate"
              type="button"
            >
              Duplicate
            </button>
          )}

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Bring to Front */}
          {onBringToFront && (
            <button
              onMouseDown={e => {
                e.preventDefault();
                onBringToFront();
              }}
              className="rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Bring to Front"
              type="button"
            >
              ↑ Front
            </button>
          )}

          {/* Send to Back */}
          {onSendToBack && (
            <button
              onMouseDown={e => {
                e.preventDefault();
                onSendToBack();
              }}
              className="rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Send to Back"
              type="button"
            >
              ↓ Back
            </button>
          )}

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Delete */}
          {onDelete && (
            <button
              onMouseDown={e => {
                e.preventDefault();
                onDelete();
              }}
              className="rounded px-2 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-900/30"
              title="Delete (Del)"
              type="button"
            >
              Delete
            </button>
          )}
        </>
      )}
    </div>
  );
}
