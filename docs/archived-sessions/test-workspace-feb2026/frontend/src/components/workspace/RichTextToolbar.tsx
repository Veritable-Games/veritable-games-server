'use client';

/**
 * Rich Text Toolbar Component
 *
 * Floating toolbar with formatting buttons for Tiptap editor.
 * Includes bold, italic, underline, strikethrough, color, alignment, and lists.
 */

import { Editor } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface RichTextToolbarProps {
  editor: Editor;
}

export default function RichTextToolbar({ editor }: RichTextToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  const applyColor = () => {
    editor.chain().focus().setColor(color).run();
  };

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1 border-t border-neutral-700 bg-neutral-800/50 p-1.5">
      {/* Format Buttons */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`rounded p-1.5 text-xs font-bold transition-colors hover:bg-neutral-700 ${
          editor.isActive('bold') ? 'bg-neutral-700 text-blue-400' : 'text-neutral-300'
        }`}
        title="Bold (Ctrl+B)"
        type="button"
      >
        <span className="flex h-5 w-5 items-center justify-center">B</span>
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`rounded p-1.5 text-xs italic transition-colors hover:bg-neutral-700 ${
          editor.isActive('italic') ? 'bg-neutral-700 text-blue-400' : 'text-neutral-300'
        }`}
        title="Italic (Ctrl+I)"
        type="button"
      >
        <span className="flex h-5 w-5 items-center justify-center">I</span>
      </button>

      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`rounded p-1.5 text-xs line-through transition-colors hover:bg-neutral-700 ${
          editor.isActive('strike') ? 'bg-neutral-700 text-blue-400' : 'text-neutral-300'
        }`}
        title="Strikethrough (Ctrl+Shift+S)"
        type="button"
      >
        <span className="flex h-5 w-5 items-center justify-center">S</span>
      </button>

      <div className="mx-1 h-5 w-px bg-neutral-700" />

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="flex items-center gap-1 rounded p-1.5 transition-colors hover:bg-neutral-700"
          title="Text Color"
          type="button"
        >
          <svg
            className="h-5 w-5 text-neutral-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          <div
            className="h-4 w-4 rounded border border-neutral-600"
            style={{ backgroundColor: color }}
          />
        </button>

        {showColorPicker && (
          <div
            ref={colorPickerRef}
            className="absolute left-0 top-10 z-50 rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
          >
            <HexColorPicker color={color} onChange={setColor} />
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="#ffffff"
              />
              <button
                onClick={() => {
                  applyColor();
                  setShowColorPicker(false);
                }}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                type="button"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mx-1 h-5 w-px bg-neutral-700" />

      {/* Alignment Buttons */}
      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={`rounded p-1.5 transition-colors hover:bg-neutral-700 ${
          editor.isActive({ textAlign: 'left' })
            ? 'bg-neutral-700 text-blue-400'
            : 'text-neutral-300'
        }`}
        title="Align Left"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h10M4 18h16"
          />
        </svg>
      </button>

      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={`rounded p-1.5 transition-colors hover:bg-neutral-700 ${
          editor.isActive({ textAlign: 'center' })
            ? 'bg-neutral-700 text-blue-400'
            : 'text-neutral-300'
        }`}
        title="Align Center"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M7 12h10M4 18h16"
          />
        </svg>
      </button>

      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={`rounded p-1.5 transition-colors hover:bg-neutral-700 ${
          editor.isActive({ textAlign: 'right' })
            ? 'bg-neutral-700 text-blue-400'
            : 'text-neutral-300'
        }`}
        title="Align Right"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M10 12h10M4 18h16"
          />
        </svg>
      </button>

      <button
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        className={`rounded p-1.5 transition-colors hover:bg-neutral-700 ${
          editor.isActive({ textAlign: 'justify' })
            ? 'bg-neutral-700 text-blue-400'
            : 'text-neutral-300'
        }`}
        title="Justify"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div className="mx-1 h-5 w-px bg-neutral-700" />

      {/* List Buttons */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`rounded p-1.5 transition-colors hover:bg-neutral-700 ${
          editor.isActive('bulletList') ? 'bg-neutral-700 text-blue-400' : 'text-neutral-300'
        }`}
        title="Bullet List"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
          />
        </svg>
      </button>

      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`rounded p-1.5 transition-colors hover:bg-neutral-700 ${
          editor.isActive('orderedList') ? 'bg-neutral-700 text-blue-400' : 'text-neutral-300'
        }`}
        title="Numbered List"
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h.01M3 10h.01M3 16h.01M8 4h13M8 10h13M8 16h13"
          />
        </svg>
      </button>

      <div className="mx-1 h-5 w-px bg-neutral-700" />

      {/* Heading Buttons */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`rounded p-1.5 text-xs font-bold transition-colors hover:bg-neutral-700 ${
          editor.isActive('heading', { level: 2 })
            ? 'bg-neutral-700 text-blue-400'
            : 'text-neutral-300'
        }`}
        title="Heading 2"
        type="button"
      >
        <span className="flex h-5 w-5 items-center justify-center">H2</span>
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`rounded p-1.5 text-xs font-bold transition-colors hover:bg-neutral-700 ${
          editor.isActive('heading', { level: 3 })
            ? 'bg-neutral-700 text-blue-400'
            : 'text-neutral-300'
        }`}
        title="Heading 3"
        type="button"
      >
        <span className="flex h-5 w-5 items-center justify-center">H3</span>
      </button>
    </div>
  );
}
