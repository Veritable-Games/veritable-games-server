'use client';

/**
 * Node Header Component
 *
 * Header bar for canvas nodes with title, color picker, and controls.
 * Draggable handle for moving nodes.
 */

import { useState, useCallback, useRef } from 'react';
import { CanvasNode } from '@/lib/workspace/types';

interface NodeHeaderProps {
  node: CanvasNode;
  isSelected: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<CanvasNode>) => void;
}

const NODE_COLORS = [
  { name: 'Gray', value: '#404040' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Yellow', value: '#CA8A04' },
  { name: 'Green', value: '#059669' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Pink', value: '#DB2777' },
];

export default function NodeHeader({
  node,
  isSelected,
  onDragStart,
  onDelete,
  onUpdate,
}: NodeHeaderProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(node.content.title || 'Untitled');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const nodeColor = node.style?.backgroundColor || '#404040';

  /**
   * Handle title edit start
   */
  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  }, []);

  /**
   * Handle title save
   */
  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    if (title !== node.content.title) {
      onUpdate({
        content: { ...node.content, title },
      });
    }
  }, [title, node.content, onUpdate]);

  /**
   * Handle title change
   */
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  /**
   * Handle title keyboard
   */
  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      titleInputRef.current?.blur();
    }
  }, []);

  /**
   * Handle color change
   */
  const handleColorChange = useCallback(
    (color: string) => {
      onUpdate({
        style: { ...node.style, backgroundColor: color },
      });
      setShowColorPicker(false);
    },
    [node.style, onUpdate]
  );

  /**
   * Handle delete click
   */
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm('Delete this note?')) {
        onDelete();
      }
    },
    [onDelete]
  );

  /**
   * Toggle color picker
   */
  const toggleColorPicker = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowColorPicker(!showColorPicker);
    },
    [showColorPicker]
  );

  return (
    <div
      className="relative cursor-move select-none px-3 py-2"
      style={{ backgroundColor: nodeColor }}
      onMouseDown={onDragStart}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Title */}
        <div className="min-w-0 flex-1">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              className="w-full border-b border-white/30 bg-transparent text-sm font-medium text-white outline-none"
            />
          ) : (
            <div
              onClick={handleTitleClick}
              className="cursor-text truncate text-sm font-medium text-white hover:opacity-80"
            >
              {title}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Color Picker Button */}
          <button
            onClick={toggleColorPicker}
            onMouseDown={e => e.stopPropagation()}
            className="rounded p-1 transition-colors hover:bg-black/20"
            title="Change color"
          >
            <svg
              className="h-4 w-4 text-white"
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
          </button>

          {/* Delete Button */}
          {isSelected && (
            <button
              onClick={handleDelete}
              onMouseDown={e => e.stopPropagation()}
              className="rounded p-1 transition-colors hover:bg-red-600/30"
              title="Delete note"
            >
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
      </div>

      {/* Color Picker Dropdown */}
      {showColorPicker && (
        <div
          className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-2">
            {NODE_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => handleColorChange(color.value)}
                className="h-8 w-8 rounded border-2 border-transparent transition-colors hover:border-white"
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
