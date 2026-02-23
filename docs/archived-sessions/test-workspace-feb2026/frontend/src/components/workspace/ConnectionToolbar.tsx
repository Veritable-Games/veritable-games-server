'use client';

/**
 * Connection Toolbar Component
 *
 * Toolbar for styling connections (arrows between nodes).
 * Appears when a connection is selected.
 */

import { useState, useRef, useEffect } from 'react';

interface ConnectionToolbarProps {
  visible: boolean;
  position?: { x: number; y: number } | null; // Screen coordinates for positioning
  // Current connection style
  color?: string;
  width?: number;
  dashArray?: number[];
  arrowType?: 'none' | 'arrow' | 'circle' | 'diamond';
  opacity?: number;
  // Style change callbacks
  onColorChange?: (color: string) => void;
  onWidthChange?: (width: number) => void;
  onDashArrayChange?: (dashArray: number[] | undefined) => void;
  onArrowTypeChange?: (arrowType: 'none' | 'arrow' | 'circle' | 'diamond') => void;
  onOpacityChange?: (opacity: number) => void;
  onDelete?: () => void;
}

// Connection colors
const CONNECTION_COLORS = [
  { label: 'Gray', color: '#6B7280' },
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

// Line width options (px)
const LINE_WIDTHS = [
  { label: '1px', value: 1 },
  { label: '2px', value: 2 },
  { label: '3px', value: 3 },
  { label: '4px', value: 4 },
  { label: '5px', value: 5 },
  { label: '6px', value: 6 },
];

// Dash patterns
const DASH_PATTERNS = [
  { label: 'Solid', value: undefined },
  { label: 'Dashed', value: [5, 5] },
  { label: 'Dotted', value: [2, 3] },
  { label: 'Long Dash', value: [10, 5] },
  { label: 'Dash Dot', value: [10, 5, 2, 5] },
];

// Arrow types
const ARROW_TYPES = [
  { label: 'Arrow', value: 'arrow' as const },
  { label: 'Circle', value: 'circle' as const },
  { label: 'Diamond', value: 'diamond' as const },
  { label: 'None', value: 'none' as const },
];

// Opacity options
const OPACITY_VALUES = [
  { label: '100%', value: 1.0 },
  { label: '75%', value: 0.75 },
  { label: '50%', value: 0.5 },
  { label: '25%', value: 0.25 },
];

export default function ConnectionToolbar({
  visible,
  position,
  color = '#6B7280',
  width = 1,
  dashArray,
  arrowType = 'arrow',
  opacity = 1.0,
  onColorChange,
  onWidthChange,
  onDashArrayChange,
  onArrowTypeChange,
  onOpacityChange,
  onDelete,
}: ConnectionToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [showDashPicker, setShowDashPicker] = useState(false);
  const [showArrowTypePicker, setShowArrowTypePicker] = useState(false);
  const [showOpacityPicker, setShowOpacityPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const widthPickerRef = useRef<HTMLDivElement>(null);
  const dashPickerRef = useRef<HTMLDivElement>(null);
  const arrowTypePickerRef = useRef<HTMLDivElement>(null);
  const opacityPickerRef = useRef<HTMLDivElement>(null);
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

  // Close width picker on outside click
  useEffect(() => {
    if (!showWidthPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (widthPickerRef.current && !widthPickerRef.current.contains(e.target as Node)) {
        setShowWidthPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWidthPicker]);

  // Close dash picker on outside click
  useEffect(() => {
    if (!showDashPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dashPickerRef.current && !dashPickerRef.current.contains(e.target as Node)) {
        setShowDashPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDashPicker]);

  // Close arrow type picker on outside click
  useEffect(() => {
    if (!showArrowTypePicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (arrowTypePickerRef.current && !arrowTypePickerRef.current.contains(e.target as Node)) {
        setShowArrowTypePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showArrowTypePicker]);

  // Close opacity picker on outside click
  useEffect(() => {
    if (!showOpacityPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (opacityPickerRef.current && !opacityPickerRef.current.contains(e.target as Node)) {
        setShowOpacityPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOpacityPicker]);

  if (!visible) {
    return null;
  }

  // Calculate toolbar position
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

  // Helper to get current dash pattern label
  const getCurrentDashLabel = () => {
    if (!dashArray) return 'Solid';
    const pattern = DASH_PATTERNS.find(
      p => p.value && JSON.stringify(p.value) === JSON.stringify(dashArray)
    );
    return pattern?.label || 'Custom';
  };

  // Helper to get current arrow type label
  const getCurrentArrowTypeLabel = () => {
    const arrow = ARROW_TYPES.find(a => a.value === arrowType);
    return arrow?.label || 'Arrow';
  };

  return (
    <div
      ref={toolbarRef}
      style={{ ...toolbarStyle, fontFamily: 'Arial, sans-serif' }}
      className="z-50 flex items-center gap-0.5 rounded-lg border border-neutral-700 bg-neutral-800 p-1.5 shadow-2xl"
    >
      {/* Color Picker */}
      {onColorChange && (
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="rounded p-2 transition-colors hover:bg-neutral-700"
            title="Line Color"
            type="button"
          >
            <div
              className="h-5 w-5 rounded border border-neutral-600"
              style={{ backgroundColor: color }}
            />
          </button>

          {showColorPicker && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3 shadow-xl">
              <div className="grid grid-cols-5 gap-2">
                {CONNECTION_COLORS.map(({ label, color: c }) => (
                  <button
                    key={c}
                    onClick={() => {
                      onColorChange(c);
                      setShowColorPicker(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#3B82F6' : 'transparent',
                    }}
                    title={label}
                    type="button"
                  >
                    {c === '#FFFFFF' && <span className="text-xs text-neutral-400">L</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Line Width Picker */}
      {onWidthChange && (
        <div className="relative" ref={widthPickerRef}>
          <button
            onClick={() => setShowWidthPicker(!showWidthPicker)}
            className="flex min-w-[60px] items-center justify-between gap-1 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Line Width"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
            </svg>
            <span>{width}px</span>
          </button>

          {showWidthPicker && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
              {LINE_WIDTHS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => {
                    onWidthChange(value);
                    setShowWidthPicker(false);
                  }}
                  className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                    width === value ? 'bg-neutral-600 text-white' : 'text-neutral-200'
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

      {/* Dash Pattern Picker */}
      {onDashArrayChange && (
        <div className="relative" ref={dashPickerRef}>
          <button
            onClick={() => setShowDashPicker(!showDashPicker)}
            className="flex min-w-[80px] items-center justify-between gap-1 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Line Style"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                strokeDasharray={dashArray?.join(',') || ''}
                d="M4 12h16"
              />
            </svg>
            <span className="truncate">{getCurrentDashLabel()}</span>
          </button>

          {showDashPicker && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
              {DASH_PATTERNS.map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => {
                    onDashArrayChange(value);
                    setShowDashPicker(false);
                  }}
                  className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                    JSON.stringify(dashArray) === JSON.stringify(value)
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
      )}

      {/* Arrow Type Picker */}
      {onArrowTypeChange && (
        <div className="relative" ref={arrowTypePickerRef}>
          <button
            onClick={() => setShowArrowTypePicker(!showArrowTypePicker)}
            className="flex min-w-[80px] items-center justify-between gap-1 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Arrow Type"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            <span className="truncate">{getCurrentArrowTypeLabel()}</span>
          </button>

          {showArrowTypePicker && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
              {ARROW_TYPES.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => {
                    onArrowTypeChange(value);
                    setShowArrowTypePicker(false);
                  }}
                  className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                    arrowType === value ? 'bg-neutral-600 text-white' : 'text-neutral-200'
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

      {/* Opacity Picker */}
      {onOpacityChange && (
        <div className="relative" ref={opacityPickerRef}>
          <button
            onClick={() => setShowOpacityPicker(!showOpacityPicker)}
            className="flex min-w-[70px] items-center justify-between gap-1 rounded px-2 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
            title="Opacity"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span>{Math.round(opacity * 100)}%</span>
          </button>

          {showOpacityPicker && (
            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
              {OPACITY_VALUES.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => {
                    onOpacityChange(value);
                    setShowOpacityPicker(false);
                  }}
                  className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-neutral-700 ${
                    opacity === value ? 'bg-neutral-600 text-white' : 'text-neutral-200'
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
    </div>
  );
}
