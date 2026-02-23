'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
  RefObject,
} from 'react';
import {
  GRID_SIZE,
  PanelInfo,
  GridRect,
  Position,
  Size,
  pixelsToGrid,
  sizeToGridCells,
} from '@/lib/godot/panelGridUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PanelLayoutData {
  position: Position;
  size: Size;
  ref: RefObject<HTMLDivElement>;
}

export interface PanelLayoutContextValue {
  panels: Map<string, PanelLayoutData>;
  registerPanel: (
    id: string,
    initialPosition: Position,
    initialSize: Size,
    ref: RefObject<HTMLDivElement>
  ) => void;
  unregisterPanel: (id: string) => void;
  updatePanel: (id: string, position: Position) => void;
  updateMultiplePanels: (updates: Map<string, Position>) => void;
  getAllPanelInfo: (excludeId?: string) => PanelInfo[];
  showGrid: boolean;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const PanelLayoutContext = createContext<PanelLayoutContextValue | undefined>(undefined);

// ============================================================================
// CONTEXT PROVIDER
// ============================================================================

export interface PanelLayoutProviderProps {
  children: ReactNode;
  versionId?: number;
}

export function PanelLayoutProvider({ children, versionId }: PanelLayoutProviderProps) {
  const [panels, setPanels] = useState<Map<string, PanelLayoutData>>(new Map());
  const [showGrid, setShowGrid] = useState(false);
  const gridTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================
  // CTRL KEY DETECTION FOR GRID OVERLAY
  // ========================================================================

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.ctrlKey) {
        setShowGrid(true);
        // Clear any existing timeout
        if (gridTimeoutRef.current) {
          clearTimeout(gridTimeoutRef.current);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || !e.ctrlKey) {
        setShowGrid(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (gridTimeoutRef.current) {
        clearTimeout(gridTimeoutRef.current);
      }
    };
  }, []);

  // ========================================================================
  // PANEL REGISTRATION & UPDATE
  // ========================================================================

  const registerPanel = useCallback(
    (id: string, initialPosition: Position, initialSize: Size, ref: RefObject<HTMLDivElement>) => {
      setPanels(prev => {
        const newMap = new Map(prev);
        newMap.set(id, {
          position: initialPosition,
          size: initialSize,
          ref,
        });
        return newMap;
      });
    },
    []
  );

  const unregisterPanel = useCallback((id: string) => {
    setPanels(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const updatePanel = useCallback((id: string, position: Position) => {
    setPanels(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;

      const newMap = new Map(prev);
      newMap.set(id, {
        ...existing,
        position,
      });
      return newMap;
    });
  }, []);

  const updateMultiplePanels = useCallback((updates: Map<string, Position>) => {
    setPanels(prev => {
      const newMap = new Map(prev);
      for (const [id, position] of updates) {
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, {
            ...existing,
            position,
          });
        }
      }
      return newMap;
    });
  }, []);

  // ========================================================================
  // PANEL INFO AGGREGATION
  // ========================================================================

  const getAllPanelInfo = useCallback(
    (excludeId?: string): PanelInfo[] => {
      const info: PanelInfo[] = [];

      for (const [id, data] of panels) {
        if (excludeId && id === excludeId) continue;

        const gridPos = pixelsToGrid(data.position);
        const gridSize = sizeToGridCells(data.size);

        info.push({
          id,
          rect: {
            gridX: gridPos.gridX,
            gridY: gridPos.gridY,
            gridWidth: gridSize.width,
            gridHeight: gridSize.height,
          },
          priority: 1, // Non-dragging panels have priority 1
        });
      }

      return info;
    },
    [panels]
  );

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const value: PanelLayoutContextValue = {
    panels,
    registerPanel,
    unregisterPanel,
    updatePanel,
    updateMultiplePanels,
    getAllPanelInfo,
    showGrid,
  };

  return (
    <PanelLayoutContext.Provider value={value}>
      <GridOverlay show={showGrid} />
      {children}
    </PanelLayoutContext.Provider>
  );
}

// ============================================================================
// CONTEXT HOOK
// ============================================================================

export function usePanelLayout(): PanelLayoutContextValue {
  const context = useContext(PanelLayoutContext);
  if (!context) {
    throw new Error('usePanelLayout must be used within PanelLayoutProvider');
  }
  return context;
}

// ============================================================================
// GRID OVERLAY COMPONENT
// ============================================================================

interface GridOverlayProps {
  show: boolean;
}

function GridOverlay({ show }: GridOverlayProps) {
  if (!show) return null;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  // Generate grid lines
  const verticalLines = [];
  const horizontalLines = [];

  for (let x = 0; x < viewportWidth; x += GRID_SIZE) {
    verticalLines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={viewportHeight}
        stroke="rgba(96, 165, 250, 0.3)"
        strokeWidth="1"
      />
    );
  }

  for (let y = 0; y < viewportHeight; y += GRID_SIZE) {
    horizontalLines.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={viewportWidth}
        y2={y}
        stroke="rgba(96, 165, 250, 0.3)"
        strokeWidth="1"
      />
    );
  }

  return (
    <svg
      className="pointer-events-none fixed inset-0"
      width={viewportWidth}
      height={viewportHeight}
      style={{ zIndex: 5 }}
    >
      <g>
        {verticalLines}
        {horizontalLines}
      </g>
    </svg>
  );
}
