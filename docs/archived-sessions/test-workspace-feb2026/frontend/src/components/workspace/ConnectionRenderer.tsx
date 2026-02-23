/**
 * Connection Renderer Component
 *
 * Renders all connections between nodes as SVG arrows.
 * Handles connection selection, deletion, and styling.
 */

'use client';

import React, { useMemo, memo } from 'react';
import { useWorkspaceStore } from '@/stores/workspace';
import { useYjsConnections, useYjsNodesMap } from '@/stores/workspace-selectors';
import {
  calculateAnchorPosition,
  generateConnectionPath,
  isPointNearLine,
} from '@/lib/workspace/connection-utils';
import { Connection, CanvasNode, AnchorSide } from '@/lib/workspace/types';
import { unsafeToConnectionId } from '@/lib/workspace/branded-types';

interface ConnectionRendererProps {
  /** Callback when connection is clicked */
  onConnectionClick?: (connectionId: string) => void;
  /** Callback when connection is deleted */
  onConnectionDelete?: (connectionId: string) => void;
  /** Preview connection (source anchor + cursor position) */
  previewConnection?: {
    sourceNode: CanvasNode;
    sourceAnchor: { side: AnchorSide; offset: number };
    cursorPosition: { x: number; y: number };
  } | null;
}

function ConnectionRenderer({
  onConnectionClick,
  onConnectionDelete,
  previewConnection,
}: ConnectionRendererProps) {
  // Use Yjs-first selectors for reactive data
  const connections = useYjsConnections();
  const nodesMap = useYjsNodesMap();
  const selectedConnectionIds = useWorkspaceStore(state => state.selectedConnectionIds);

  /**
   * Calculate connection paths with anchor positions
   * Memoized to avoid recalculations on every render
   */
  const connectionPaths = useMemo(() => {
    return connections
      .map(connection => {
        const sourceNode = nodesMap.get(connection.source_node_id);
        const targetNode = nodesMap.get(connection.target_node_id);

        // Skip if nodes don't exist (shouldn't happen, but defensive)
        if (!sourceNode || !targetNode) {
          return null;
        }

        // Calculate anchor positions
        const startPoint = calculateAnchorPosition(sourceNode, connection.source_anchor);
        const endPoint = calculateAnchorPosition(targetNode, connection.target_anchor);

        // Generate SVG path
        const path = generateConnectionPath(
          startPoint,
          endPoint,
          connection.source_anchor.side,
          connection.target_anchor.side
        );

        return {
          connection,
          path,
          startPoint,
          endPoint,
        };
      })
      .filter(item => item !== null);
  }, [connections, nodesMap]);

  /**
   * Handle connection click
   */
  const handleConnectionClick = (connectionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onConnectionClick) {
      onConnectionClick(connectionId);
    }
  };

  /**
   * Handle connection delete (via keyboard)
   */
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedConnectionIds.size > 0 &&
        onConnectionDelete
      ) {
        e.preventDefault();
        selectedConnectionIds.forEach(id => {
          onConnectionDelete(id);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnectionIds, onConnectionDelete]);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      {/* Define arrow markers for different types */}
      <defs>
        {/* Arrow marker */}
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="2.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,5 L7,2.5 z" fill="currentColor" />
        </marker>

        <marker
          id="arrowhead-selected"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="2.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,5 L7,2.5 z" fill="#3b82f6" />
        </marker>

        {/* Circle marker */}
        <marker
          id="circle"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <circle cx="3" cy="3" r="2.5" fill="currentColor" />
        </marker>

        <marker
          id="circle-selected"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <circle cx="3" cy="3" r="2.5" fill="#3b82f6" />
        </marker>

        {/* Diamond marker */}
        <marker
          id="diamond"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,4 L4,0 L8,4 L4,8 z" fill="currentColor" />
        </marker>

        <marker
          id="diamond-selected"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,4 L4,0 L8,4 L4,8 z" fill="#3b82f6" />
        </marker>
      </defs>

      {/* Preview connection (while creating) */}
      {previewConnection && (
        <g className="preview-layer">
          <line
            x1={
              calculateAnchorPosition(previewConnection.sourceNode, previewConnection.sourceAnchor)
                .x
            }
            y1={
              calculateAnchorPosition(previewConnection.sourceNode, previewConnection.sourceAnchor)
                .y
            }
            x2={previewConnection.cursorPosition.x}
            y2={previewConnection.cursorPosition.y}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="5,5"
            opacity={0.7}
            className="pointer-events-none"
          />
        </g>
      )}

      {/* Render all connections */}
      <g className="connections-layer">
        {connectionPaths.map(item => {
          if (!item) return null;

          const { connection, path, startPoint, endPoint } = item;
          const isSelected = selectedConnectionIds.has(connection.id);

          // Connection styling
          const strokeColor = connection.style?.color || (isSelected ? '#3b82f6' : '#6b7280');
          const strokeWidth = connection.style?.width || 1;
          const dashArray = connection.style?.dashArray?.join(',') || undefined;
          const opacity = connection.style?.opacity ?? 1;
          const arrowType = connection.style?.arrowType || 'arrow';

          // Determine marker based on arrow type and selection state
          const getMarker = () => {
            if (arrowType === 'none') return undefined;
            const suffix = isSelected ? '-selected' : '';
            return `url(#${arrowType}${suffix})`;
          };

          return (
            <g key={connection.id} className="connection-group">
              {/* Invisible wider path for easier clicking */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={strokeWidth + 10}
                className="pointer-events-auto cursor-pointer"
                onClick={e => handleConnectionClick(connection.id, e)}
              />

              {/* Visible connection path */}
              <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                opacity={opacity}
                markerEnd={getMarker()}
                className="pointer-events-none"
                style={{
                  transition: 'stroke 0.2s, stroke-width 0.2s',
                }}
              />

              {/* Connection label (if present) */}
              {connection.label && (
                <text
                  x={(startPoint.x + endPoint.x) / 2}
                  y={(startPoint.y + endPoint.y) / 2}
                  fill={strokeColor}
                  fontSize="12"
                  fontWeight="500"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  style={{
                    textShadow: '0 0 3px rgba(0,0,0,0.8)',
                  }}
                >
                  {connection.label}
                </text>
              )}

              {/* Selection indicator */}
              {isSelected && (
                <g>
                  {/* Start point indicator */}
                  <circle
                    cx={startPoint.x}
                    cy={startPoint.y}
                    r="3"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="1.5"
                    className="pointer-events-none"
                  />
                  {/* End point indicator */}
                  <circle
                    cx={endPoint.x}
                    cy={endPoint.y}
                    r="3"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="1.5"
                    className="pointer-events-none"
                  />
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when preview connection changes or callbacks change
 */
function arePropsEqual(
  prevProps: ConnectionRendererProps,
  nextProps: ConnectionRendererProps
): boolean {
  // Preview connection deep comparison
  const prevPreview = prevProps.previewConnection;
  const nextPreview = nextProps.previewConnection;

  // If one is null and the other isn't, they're different
  if ((prevPreview === null) !== (nextPreview === null)) {
    return false;
  }

  // If both are not null, compare their properties
  if (prevPreview && nextPreview) {
    // Compare source node ID (nodes are immutable, so ID comparison is sufficient)
    if (prevPreview.sourceNode.id !== nextPreview.sourceNode.id) {
      return false;
    }

    // Compare source anchor
    if (
      prevPreview.sourceAnchor.side !== nextPreview.sourceAnchor.side ||
      prevPreview.sourceAnchor.offset !== nextPreview.sourceAnchor.offset
    ) {
      return false;
    }

    // Compare cursor position
    if (
      prevPreview.cursorPosition.x !== nextPreview.cursorPosition.x ||
      prevPreview.cursorPosition.y !== nextPreview.cursorPosition.y
    ) {
      return false;
    }
  }

  // Callbacks are expected to be stable (wrapped in useCallback in parent)
  // but check them anyway for safety
  if (
    prevProps.onConnectionClick !== nextProps.onConnectionClick ||
    prevProps.onConnectionDelete !== nextProps.onConnectionDelete
  ) {
    return false;
  }

  // All relevant properties are equal - skip re-render
  return true;
}

/**
 * Memoized export - prevents unnecessary re-renders
 * The component will still re-render when Zustand selectors return new values
 * (connections, nodesMap, selectedConnectionIds)
 */
export default memo(ConnectionRenderer, arePropsEqual);
