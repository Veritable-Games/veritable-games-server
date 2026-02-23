'use client';

/**
 * Selection Bounding Box Component
 *
 * Visual indicator for multi-select groups. Shows a blue bounding box
 * around all selected nodes and provides a drag target for group dragging.
 * Implements Miro/Figma-style selection visualization.
 */

import type { BoundingBox } from '@/lib/workspace/bounding-box-utils';

interface SelectionBoundingBoxProps {
  /** Bounding box dimensions in canvas coordinates */
  boundingBox: BoundingBox;
  /** Current canvas zoom level (for scale-invariant styling) */
  scale: number;
  /** Whether the selection is currently being dragged */
  isDragging: boolean;
  /** Callback when user starts dragging the bounding box */
  onDragStart: (e: React.MouseEvent) => void;
}

/**
 * Renders a selection bounding box around multiple selected nodes
 */
export default function SelectionBoundingBox({
  boundingBox,
  scale,
  isDragging,
  onDragStart,
}: SelectionBoundingBoxProps) {
  // Scale-invariant border width (stays consistent at all zoom levels)
  const borderWidth = Math.max(1, 2 / scale);
  const borderRadius = Math.max(2, 4 / scale);

  // Cursor changes based on drag state
  const cursor = isDragging ? 'grabbing' : 'grab';

  return (
    <div
      className="pointer-events-auto absolute select-none transition-opacity duration-150"
      style={{
        left: `${boundingBox.x}px`,
        top: `${boundingBox.y}px`,
        width: `${boundingBox.width}px`,
        height: `${boundingBox.height}px`,
        border: `${borderWidth}px solid #0D99FF`,
        background: 'rgba(13, 153, 255, 0.05)', // Subtle blue tint
        borderRadius: `${borderRadius}px`,
        cursor,
        zIndex: 9998, // Below floating toolbar (9999) but above nodes
        userSelect: 'none', // Prevent text selection
        WebkitUserSelect: 'none', // Safari
        MozUserSelect: 'none', // Firefox
      }}
      onMouseDown={onDragStart}
    />
  );
}
