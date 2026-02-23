/**
 * Node Anchors Component
 *
 * Displays interactive anchor points on nodes for creating connections.
 * Shows anchors on all 5 positions: top, right, bottom, left, center.
 * Uses CSS positioning to stay attached to nodes during drag/resize.
 */

'use client';

import React from 'react';
import { CanvasNode, AnchorSide } from '@/lib/workspace/types';

interface NodeAnchorsProps {
  /** The node to show anchors for */
  node: CanvasNode;
  /** Whether to show anchors */
  visible: boolean;
  /** Current zoom level (for scaling anchor size) */
  scale: number;
  /** Callback when anchor is clicked */
  onAnchorClick: (nodeId: string, side: AnchorSide, offset: number) => void;
  /** Selected source anchor (for green highlight) */
  selectedSource?: { nodeId: string; side: AnchorSide; offset: number } | null;
  /** Currently hovered anchor (for targeting cursor) */
  hoveredAnchor?: { nodeId: string; side: AnchorSide; offset: number } | null;
  /** Callback when anchor is hovered */
  onAnchorHover?: (nodeId: string, side: AnchorSide, offset: number) => void;
  /** Callback when anchor hover ends */
  onAnchorLeave?: () => void;
}

/**
 * Individual anchor point
 */
interface AnchorPointProps {
  side: AnchorSide;
  offset: number;
  scale: number;
  style: React.CSSProperties;
  onAnchorClick: () => void;
  isSelected: boolean;
  isValidTarget: boolean;
  isInvalidTarget: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function AnchorPoint({
  side,
  offset,
  scale,
  style,
  onAnchorClick,
  isSelected,
  isValidTarget,
  isInvalidTarget,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: AnchorPointProps) {
  // Anchor size scales with zoom (but not too small) - consistent size for all states
  const size = Math.max(8, 10 / scale);

  // Determine color based on state
  let backgroundColor = '#6b7280'; // Default gray
  let boxShadow = '';

  if (isSelected) {
    // Selected source anchor - green
    backgroundColor = '#10b981';
    boxShadow = '0 0 8px rgba(16, 185, 129, 0.6)';
  } else if (isInvalidTarget && isHovered) {
    // Invalid target (same node) - red
    backgroundColor = '#ef4444';
    boxShadow = '0 0 4px rgba(239, 68, 68, 0.6)';
  } else if (isValidTarget && isHovered) {
    // Valid target (different node) - blue
    backgroundColor = '#3b82f6';
    boxShadow = '0 0 6px rgba(59, 130, 246, 0.6)';
  } else if (isHovered) {
    // Just hovered, no connection active - blue
    backgroundColor = '#3b82f6';
    boxShadow = '0 0 4px rgba(59, 130, 246, 0.6)';
  }

  return (
    <div
      className="absolute cursor-pointer transition-all duration-150"
      style={style}
      onClick={e => {
        e.stopPropagation();
        onAnchorClick();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="rounded-full border border-white"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor,
          boxShadow,
          borderWidth: '1.5px',
        }}
      />
    </div>
  );
}

/**
 * Main component - renders all anchor points for a node
 */
export default function NodeAnchors({
  node,
  visible,
  scale,
  onAnchorClick,
  selectedSource,
  hoveredAnchor,
  onAnchorHover,
  onAnchorLeave,
}: NodeAnchorsProps) {
  if (!visible) return null;

  // Define anchor positions using CSS
  const anchors: Array<{
    side: AnchorSide;
    offset: number;
    style: React.CSSProperties;
  }> = [
    // Top (center of top edge)
    {
      side: 'top',
      offset: 0.5,
      style: {
        left: '50%',
        top: '-10px',
        transform: 'translateX(-50%)',
      },
    },
    // Right (center of right edge)
    {
      side: 'right',
      offset: 0.5,
      style: {
        right: '-10px',
        top: '50%',
        transform: 'translateY(-50%)',
      },
    },
    // Bottom (center of bottom edge)
    {
      side: 'bottom',
      offset: 0.5,
      style: {
        left: '50%',
        bottom: '-10px',
        transform: 'translateX(-50%)',
      },
    },
    // Left (center of left edge)
    {
      side: 'left',
      offset: 0.5,
      style: {
        left: '-10px',
        top: '50%',
        transform: 'translateY(-50%)',
      },
    },
  ];

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        height: `${node.size.height}px`,
        zIndex: node.z_index + 1,
      }}
    >
      {anchors.map(anchor => {
        const isSelected =
          selectedSource?.nodeId === node.id &&
          selectedSource?.side === anchor.side &&
          selectedSource?.offset === anchor.offset;

        const isHovered =
          hoveredAnchor?.nodeId === node.id &&
          hoveredAnchor?.side === anchor.side &&
          hoveredAnchor?.offset === anchor.offset;

        const isValidTarget = selectedSource && selectedSource.nodeId !== node.id;

        const isInvalidTarget = selectedSource && selectedSource.nodeId === node.id;

        return (
          <AnchorPoint
            key={`${node.id}-${anchor.side}`}
            side={anchor.side}
            offset={anchor.offset}
            scale={scale}
            style={{ ...anchor.style, pointerEvents: 'auto' }}
            onAnchorClick={() => onAnchorClick(node.id, anchor.side, anchor.offset)}
            isSelected={isSelected}
            isValidTarget={!!isValidTarget}
            isInvalidTarget={!!isInvalidTarget}
            isHovered={isHovered}
            onMouseEnter={() => onAnchorHover?.(node.id, anchor.side, anchor.offset)}
            onMouseLeave={() => onAnchorLeave?.()}
          />
        );
      })}
    </div>
  );
}
