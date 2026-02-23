'use client';

/**
 * Floating Format Toolbar Component
 *
 * Miro-style toolbar that appears above nodes when selected or editing.
 * Shows different controls based on context:
 * - Selected (not editing): Color picker, Delete
 * - Editing: Text formatting controls
 */

import { Editor } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';

interface FloatingFormatToolbarProps {
  editor: Editor | null;
  visible: boolean;
  position?: { x: number; y: number } | null; // Screen coordinates for positioning
  nodeType?: 'note' | 'text'; // Node type for toolbar variations
  nodeColor?: string; // Current node color (for notes)
  onColorChange?: (color: string) => void; // Color change callback
  onDelete?: () => void; // Delete callback
  onDuplicate?: () => void; // Duplicate callback
  onBringToFront?: () => void; // Bring to front callback
  onSendToBack?: () => void; // Send to back callback
  fontSize?: number; // Current node font size (for display in picker)
  onFontSizeChange?: (size: number | null) => void; // Font size change callback (null = auto)
  // Border styling
  borderWidth?: number; // Current border width (px)
  borderColor?: string; // Current border color
  borderRadius?: number; // Current border radius (px)
  onBorderWidthChange?: (width: number) => void; // Border width change callback
  onBorderColorChange?: (color: string) => void; // Border color change callback
  onBorderRadiusChange?: (radius: number) => void; // Border radius change callback
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

// Text colors for rich text editor
const TEXT_COLORS = [
  { label: 'Default', color: '#E5E7EB' }, // Light gray (default)
  { label: 'Black', color: '#000000' },
  { label: 'White', color: '#FFFFFF' },
  { label: 'Red', color: '#EF4444' },
  { label: 'Orange', color: '#F97316' },
  { label: 'Yellow', color: '#EAB308' },
  { label: 'Green', color: '#22C55E' },
  { label: 'Blue', color: '#3B82F6' },
  { label: 'Purple', color: '#A855F7' },
  { label: 'Pink', color: '#EC4899' },
];

// Font size options (null = auto-fit)
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

// Font family options
const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier', value: 'Courier New, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Comic Sans', value: 'Comic Sans MS, cursive' },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Trebuchet', value: 'Trebuchet MS, sans-serif' },
];

// Border width options (px)
const BORDER_WIDTHS = [
  { label: 'None', value: 0 },
  { label: '1px', value: 1 },
  { label: '2px', value: 2 },
  { label: '3px', value: 3 },
  { label: '4px', value: 4 },
  { label: '5px', value: 5 },
];

// Border radius options (px)
const BORDER_RADII = [
  { label: 'None', value: 0 },
  { label: '4px', value: 4 },
  { label: '8px', value: 8 },
  { label: '12px', value: 12 },
  { label: '16px', value: 16 },
  { label: '24px', value: 24 },
];

// Border colors (reuse text colors for consistency)
const BORDER_COLORS = [
  { label: 'Default', color: '#6B7280' }, // Gray-500
  { label: 'Black', color: '#000000' },
  { label: 'White', color: '#FFFFFF' },
  { label: 'Red', color: '#EF4444' },
  { label: 'Orange', color: '#F97316' },
  { label: 'Yellow', color: '#EAB308' },
  { label: 'Green', color: '#22C55E' },
  { label: 'Blue', color: '#3B82F6' },
  { label: 'Purple', color: '#A855F7' },
  { label: 'Pink', color: '#EC4899' },
];

export default function FloatingFormatToolbar({
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
}: FloatingFormatToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showFontFamilyPicker, setShowFontFamilyPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBorderWidthPicker, setShowBorderWidthPicker] = useState(false);
  const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
  const [showBorderRadiusPicker, setShowBorderRadiusPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fontSizePickerRef = useRef<HTMLDivElement>(null);
  const fontFamilyPickerRef = useRef<HTMLDivElement>(null);
  const textColorPickerRef = useRef<HTMLDivElement>(null);
  const borderWidthPickerRef = useRef<HTMLDivElement>(null);
  const borderColorPickerRef = useRef<HTMLDivElement>(null);
  const borderRadiusPickerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  // Close font size picker on outside click
  useEffect(() => {
    if (!showFontSizePicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (fontSizePickerRef.current && !fontSizePickerRef.current.contains(e.target as Node)) {
        setShowFontSizePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFontSizePicker]);

  // Close font family picker on outside click
  useEffect(() => {
    if (!showFontFamilyPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (fontFamilyPickerRef.current && !fontFamilyPickerRef.current.contains(e.target as Node)) {
        setShowFontFamilyPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFontFamilyPicker]);

  // Close text color picker on outside click
  useEffect(() => {
    if (!showTextColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (textColorPickerRef.current && !textColorPickerRef.current.contains(e.target as Node)) {
        setShowTextColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTextColorPicker]);

  // Close border width picker on outside click
  useEffect(() => {
    if (!showBorderWidthPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        borderWidthPickerRef.current &&
        !borderWidthPickerRef.current.contains(e.target as Node)
      ) {
        setShowBorderWidthPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBorderWidthPicker]);

  // Close border color picker on outside click
  useEffect(() => {
    if (!showBorderColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        borderColorPickerRef.current &&
        !borderColorPickerRef.current.contains(e.target as Node)
      ) {
        setShowBorderColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBorderColorPicker]);

  // Close border radius picker on outside click
  useEffect(() => {
    if (!showBorderRadiusPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        borderRadiusPickerRef.current &&
        !borderRadiusPickerRef.current.contains(e.target as Node)
      ) {
        setShowBorderRadiusPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBorderRadiusPicker]);

  if (!visible) {
    return null;
  }

  // Calculate toolbar position
  const toolbarStyle: React.CSSProperties = position
    ? {
        // Position above the node (Miro-style)
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y - 10}px`, // 10px above node (will subtract toolbar height in effect)
        transform: 'translate(-50%, -100%)', // Center horizontally, position above
      }
    : {
        // Fallback to top-left corner
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
        // EDITING MODE: Text formatting controls
        <>
          {/* Font Size Picker */}
          {onFontSizeChange && (
            <>
              <div className="relative" ref={fontSizePickerRef}>
                <button
                  onMouseDown={e => {
                    e.preventDefault(); // Prevent editor from losing focus
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
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
                    {FONT_SIZES.map(({ label, value }) => (
                      <button
                        key={label}
                        onMouseDown={e => {
                          e.preventDefault(); // Prevent editor from losing focus
                          onFontSizeChange(value);
                          setShowFontSizePicker(false);
                        }}
                        className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                          (value === null && !fontSize) || (value !== null && fontSize === value)
                            ? 'bg-neutral-600 text-white'
                            : 'text-neutral-200'
                        }`}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mx-1 h-6 w-px bg-neutral-600" />
            </>
          )}

          {/* Font Family Picker */}
          <div className="relative" ref={fontFamilyPickerRef}>
            <button
              onMouseDown={e => {
                e.preventDefault(); // Prevent editor from losing focus
                setShowFontFamilyPicker(!showFontFamilyPicker);
              }}
              className="flex min-w-[100px] items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Font Family"
              type="button"
            >
              <span className="truncate">
                {editor?.getAttributes('textStyle').fontFamily?.split(',')[0] || 'Arial'}
              </span>
              <svg
                className="h-3 w-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showFontFamilyPicker && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
                {FONT_FAMILIES.map(({ label, value }) => (
                  <button
                    key={value}
                    onMouseDown={e => {
                      e.preventDefault(); // Prevent editor from losing focus
                      editor!.chain().focus().setFontFamily(value).run();
                      setShowFontFamilyPicker(false);
                    }}
                    className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                      editor!.getAttributes('textStyle').fontFamily === value
                        ? 'bg-neutral-600 text-white'
                        : 'text-neutral-200'
                    }`}
                    style={{ fontFamily: value }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Text Color Picker */}
          <div className="relative" ref={textColorPickerRef}>
            <button
              onMouseDown={e => {
                e.preventDefault(); // Prevent editor from losing focus
                setShowTextColorPicker(!showTextColorPicker);
              }}
              className="flex items-center gap-1 rounded px-2 py-1.5 transition-colors hover:bg-neutral-700"
              title="Text Color"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
              <div
                className="h-3 w-3 rounded-sm border border-neutral-500"
                style={{
                  backgroundColor: editor!.getAttributes('textStyle').color || '#E5E7EB',
                }}
              />
            </button>

            {showTextColorPicker && (
              <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3 shadow-xl">
                <div className="grid grid-cols-5 gap-2">
                  {TEXT_COLORS.map(({ label, color }) => (
                    <button
                      key={color}
                      onMouseDown={e => {
                        e.preventDefault(); // Prevent editor from losing focus
                        if (color === '#E5E7EB') {
                          // Default color - unset the color
                          editor!.chain().focus().unsetColor().run();
                        } else {
                          editor!.chain().focus().setColor(color).run();
                        }
                        setShowTextColorPicker(false);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor:
                          (editor!.getAttributes('textStyle').color || '#E5E7EB') === color
                            ? '#3B82F6'
                            : 'transparent',
                      }}
                      title={label}
                      type="button"
                    >
                      {color === '#FFFFFF' && <span className="text-xs text-neutral-400">A</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().toggleBold().run();
            }}
            className={`rounded p-2 text-sm font-bold transition-colors hover:bg-neutral-700 ${
              editor!.isActive('bold') ? 'bg-neutral-600 text-white' : 'text-neutral-200'
            }`}
            title="Bold (Ctrl+B)"
            type="button"
          >
            B
          </button>

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().toggleItalic().run();
            }}
            className={`rounded p-2 text-sm italic transition-colors hover:bg-neutral-700 ${
              editor!.isActive('italic') ? 'bg-neutral-600 text-white' : 'text-neutral-200'
            }`}
            title="Italic (Ctrl+I)"
            type="button"
          >
            I
          </button>

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().toggleStrike().run();
            }}
            className={`rounded p-2 text-sm line-through transition-colors hover:bg-neutral-700 ${
              editor!.isActive('strike') ? 'bg-neutral-600 text-white' : 'text-neutral-200'
            }`}
            title="Strikethrough"
            type="button"
          >
            S
          </button>

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().toggleUnderline().run();
            }}
            className={`rounded p-2 text-sm underline transition-colors hover:bg-neutral-700 ${
              editor!.isActive('underline') ? 'bg-neutral-600 text-white' : 'text-neutral-200'
            }`}
            title="Underline (Ctrl+U)"
            type="button"
          >
            U
          </button>

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().setTextAlign('left').run();
            }}
            className={`rounded p-2 transition-colors hover:bg-neutral-700 ${
              editor!.isActive({ textAlign: 'left' })
                ? 'bg-neutral-600 text-white'
                : 'text-neutral-200'
            }`}
            title="Align Left"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h10M4 18h16"
              />
            </svg>
          </button>

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().setTextAlign('center').run();
            }}
            className={`rounded p-2 transition-colors hover:bg-neutral-700 ${
              editor!.isActive({ textAlign: 'center' })
                ? 'bg-neutral-600 text-white'
                : 'text-neutral-200'
            }`}
            title="Align Center"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M7 12h10M4 18h16"
              />
            </svg>
          </button>

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().setTextAlign('right').run();
            }}
            className={`rounded p-2 transition-colors hover:bg-neutral-700 ${
              editor!.isActive({ textAlign: 'right' })
                ? 'bg-neutral-600 text-white'
                : 'text-neutral-200'
            }`}
            title="Align Right"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M10 12h10M4 18h16"
              />
            </svg>
          </button>

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().toggleBulletList().run();
            }}
            className={`rounded p-2 transition-colors hover:bg-neutral-700 ${
              editor!.isActive('bulletList') ? 'bg-neutral-600 text-white' : 'text-neutral-200'
            }`}
            title="Bullet List"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              />
            </svg>
          </button>

          <button
            onMouseDown={e => {
              e.preventDefault(); // Prevent editor from losing focus
              editor!.chain().focus().toggleOrderedList().run();
            }}
            className={`rounded p-2 transition-colors hover:bg-neutral-700 ${
              editor!.isActive('orderedList') ? 'bg-neutral-600 text-white' : 'text-neutral-200'
            }`}
            title="Numbered List"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h.01M3 10h.01M3 16h.01M8 4h13M8 10h13M8 16h13"
              />
            </svg>
          </button>
        </>
      ) : (
        // SELECTED MODE: Node controls
        <>
          {nodeType === 'note' && onColorChange && (
            <>
              {/* Color Picker for Notes */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="rounded p-2 transition-colors hover:bg-neutral-700"
                  title="Change Color"
                  type="button"
                >
                  <div
                    className="h-5 w-5 rounded border border-neutral-600"
                    style={{ backgroundColor: nodeColor }}
                  />
                </button>

                {showColorPicker && (
                  <div
                    ref={colorPickerRef}
                    className="absolute left-0 top-full z-50 mt-2 rounded-lg border border-neutral-700 bg-neutral-800 p-3 shadow-xl"
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {NOTE_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            onColorChange(color);
                            setShowColorPicker(false);
                          }}
                          className="h-8 w-8 rounded border-2 transition-all hover:scale-110"
                          style={{
                            backgroundColor: color,
                            borderColor: color === nodeColor ? '#3B82F6' : 'transparent',
                          }}
                          title={color}
                          type="button"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mx-1 h-6 w-px bg-neutral-600" />
            </>
          )}

          {/* Border Width Picker */}
          {onBorderWidthChange && (
            <div className="relative" ref={borderWidthPickerRef}>
              <button
                onClick={() => setShowBorderWidthPicker(!showBorderWidthPicker)}
                className="flex min-w-[60px] items-center justify-between gap-1 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
                title="Border Width"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8h16M4 16h16"
                  />
                </svg>
                <span>{borderWidth || 0}px</span>
              </button>

              {showBorderWidthPicker && (
                <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
                  {BORDER_WIDTHS.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => {
                        onBorderWidthChange(value);
                        setShowBorderWidthPicker(false);
                      }}
                      className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                        borderWidth === value ? 'bg-neutral-600 text-white' : 'text-neutral-200'
                      }`}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Border Color Picker */}
          {onBorderColorChange && (
            <div className="relative" ref={borderColorPickerRef}>
              <button
                onClick={() => setShowBorderColorPicker(!showBorderColorPicker)}
                className="rounded p-2 transition-colors hover:bg-neutral-700"
                title="Border Color"
                type="button"
              >
                <div
                  className="h-5 w-5 rounded border-2"
                  style={{
                    borderColor: borderColor || '#6B7280',
                    backgroundColor: 'transparent',
                  }}
                />
              </button>

              {showBorderColorPicker && (
                <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3 shadow-xl">
                  <div className="grid grid-cols-5 gap-2">
                    {BORDER_COLORS.map(({ label, color }) => (
                      <button
                        key={color}
                        onClick={() => {
                          onBorderColorChange(color);
                          setShowBorderColorPicker(false);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded border-2 transition-all hover:scale-110"
                        style={{
                          backgroundColor: color,
                          borderColor: borderColor === color ? '#3B82F6' : 'transparent',
                        }}
                        title={label}
                        type="button"
                      >
                        {color === '#FFFFFF' && <span className="text-xs text-neutral-400">B</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Border Radius Picker */}
          {onBorderRadiusChange && (
            <div className="relative" ref={borderRadiusPickerRef}>
              <button
                onClick={() => setShowBorderRadiusPicker(!showBorderRadiusPicker)}
                className="flex min-w-[60px] items-center justify-between gap-1 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
                title="Border Radius"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>{borderRadius || 0}px</span>
              </button>

              {showBorderRadiusPicker && (
                <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
                  {BORDER_RADII.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => {
                        onBorderRadiusChange(value);
                        setShowBorderRadiusPicker(false);
                      }}
                      className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                        borderRadius === value ? 'bg-neutral-600 text-white' : 'text-neutral-200'
                      }`}
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

          {/* Duplicate Button */}
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="rounded p-2 text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Duplicate (Ctrl+D)"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Bring to Front Button */}
          {onBringToFront && (
            <button
              onClick={onBringToFront}
              className="rounded p-2 text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Bring to Front"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
            </button>
          )}

          {/* Send to Back Button */}
          {onSendToBack && (
            <button
              onClick={onSendToBack}
              className="rounded p-2 text-neutral-200 transition-colors hover:bg-neutral-700"
              title="Send to Back"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 13l-5 5m0 0l-5-5m5 5V6"
                />
              </svg>
            </button>
          )}

          <div className="mx-1 h-6 w-px bg-neutral-600" />

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded p-2 text-neutral-200 transition-colors hover:bg-red-900 hover:text-red-300"
              title="Delete (Del)"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}
