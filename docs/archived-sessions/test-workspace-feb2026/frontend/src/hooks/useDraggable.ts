'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPanelPosition, savePanelPosition } from '@/lib/godot/panelStorage';
import {
  GRID_SIZE,
  pixelsToGrid,
  gridToPixels,
  sizeToGridCells,
  resolveCollisions,
  PanelInfo,
  GridRect,
  Position,
} from '@/lib/godot/panelGridUtils';
import { usePanelLayout } from '@/contexts/PanelLayoutContext';

export interface UseDraggableOptions {
  id: string;
  defaultPosition: Position;
  versionId: number;
  disabled?: boolean;
  onPositionChange?: (position: Position) => void;
  // Legacy props (ignored - kept for compatibility)
  snapThreshold?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  allowDragFromAnywhere?: boolean;
}

export interface UseDraggableReturn {
  position: Position;
  isDragging: boolean;
  resetPosition: () => void;
  ref: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  isMoveBlocked: boolean;
}

export function useDraggable(options: UseDraggableOptions): UseDraggableReturn {
  const {
    id,
    defaultPosition,
    versionId,
    disabled = false,
    onPositionChange,
    isSelected = false,
    onSelect,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const { getAllPanelInfo, updateMultiplePanels } = usePanelLayout();

  const [position, setPosition] = useState<Position>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isMoveBlocked, setIsMoveBlocked] = useState(false);

  // Track drag offset and initial position
  const dragState = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    originalPosition: defaultPosition,
  });

  // Load saved position on mount
  useEffect(() => {
    let mounted = true;

    const loadPosition = async () => {
      const saved = await loadPanelPosition(versionId, id, defaultPosition);
      if (mounted) {
        setPosition(saved);
      }
    };

    loadPosition();

    return () => {
      mounted = false;
    };
  }, [id, versionId, defaultPosition]);

  // Handle mouse down - Ctrl+Click ONLY
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled || !e.ctrlKey) return;

      e.preventDefault();
      e.stopPropagation();

      // Store original position for potential cancel (ESC)
      dragState.current.originalPosition = position;

      // FIX: Calculate offset from position state, not rendered bounds
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - position.x,
        offsetY: e.clientY - position.y,
        originalPosition: position,
      };

      setIsDragging(true);
      setIsMoveBlocked(false);

      // Add global mouse event listeners
      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Calculate new position from state offset
        const newX = moveEvent.clientX - dragState.current.offsetX;
        const newY = moveEvent.clientY - dragState.current.offsetY;

        // Get element size
        const elementWidth = ref.current?.offsetWidth || 0;
        const elementHeight = ref.current?.offsetHeight || 0;
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight,
        };

        // Convert to grid coordinates and snap
        const gridPos = pixelsToGrid({ x: newX, y: newY });
        const gridSize = sizeToGridCells({ width: elementWidth, height: elementHeight });

        // Create current panel info with priority 0 (being dragged)
        const currentPanel: PanelInfo = {
          id,
          rect: {
            gridX: gridPos.gridX,
            gridY: gridPos.gridY,
            gridWidth: gridSize.width,
            gridHeight: gridSize.height,
          },
          priority: 0,
        };

        // Get all other panel positions
        const allPanels = getAllPanelInfo(id);

        // Resolve collisions
        const resolvedPositions = resolveCollisions(
          currentPanel,
          allPanels,
          viewport,
          5 // max depth
        );

        // If empty map, collision couldn't be resolved
        if (resolvedPositions.size === 0) {
          setIsMoveBlocked(true);
          return;
        }

        // Convert back to pixels
        const finalPixelPos = gridToPixels(gridPos);

        // Update this panel
        setPosition(finalPixelPos);
        onPositionChange?.(finalPixelPos);

        // Update other panels that were pushed
        const updates = new Map<string, Position>();
        for (const [panelId, newGridRect] of resolvedPositions) {
          updates.set(
            panelId,
            gridToPixels({ gridX: newGridRect.gridX, gridY: newGridRect.gridY })
          );
        }
        if (updates.size > 0) {
          updateMultiplePanels(updates);
        }

        setIsMoveBlocked(false);
      };

      const handleMouseUp = async () => {
        setIsDragging(false);

        // Save position to database (grid-snapped)
        await savePanelPosition(versionId, id, position);

        // Remove event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleKeyDown);
      };

      const handleKeyDown = async (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          // Cancel drag but keep current position
          setIsDragging(false);
          // Save current position to database
          await savePanelPosition(versionId, id, position);
          cleanup();
        }
      };

      const cleanup = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleKeyDown);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keydown', handleKeyDown);
    },
    [disabled, position, id, versionId, onPositionChange, getAllPanelInfo, updateMultiplePanels]
  );

  // Handler for Ctrl+Click selection
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.ctrlKey && onSelect) {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }
    },
    [onSelect]
  );

  const resetPosition = useCallback(async () => {
    setPosition(defaultPosition);
    // Delete from database to reset to default
    const { resetPanelPosition } = await import('@/lib/godot/panelStorage');
    await resetPanelPosition(versionId, id);
  }, [id, versionId, defaultPosition]);

  return {
    position,
    isDragging,
    resetPosition,
    ref,
    isSelected,
    onClick: handleClick,
    handleMouseDown,
    isMoveBlocked,
  };
}
