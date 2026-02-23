/**
 * Panel Storage Utility
 *
 * Handles persistence of Godot Developer Console panel positions
 * to the database via API calls with debouncing and error handling.
 */

import { pixelsToGrid, gridToPixels, GRID_SIZE } from '@/lib/godot/panelGridUtils';
import { logger } from '@/lib/utils/logger';

export interface Position {
  x: number;
  y: number;
}

export interface PanelPositionsMap {
  [panelId: string]: Position;
}

// In-memory cache of loaded positions to avoid redundant API calls
const positionCache = new Map<string, PanelPositionsMap>();

// Debounce timers for save operations
const saveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Snap a position to the grid
 * Converts to grid coordinates and back to pixels for alignment
 */
function snapPositionToGrid(position: Position): Position {
  const gridPos = pixelsToGrid(position);
  return gridToPixels(gridPos);
}

/**
 * Load all panel positions for a version from the database
 * Uses in-memory cache to avoid redundant API calls
 */
export async function loadAllPanelPositions(versionId: number): Promise<PanelPositionsMap> {
  const cacheKey = `v${versionId}`;

  // Return cached positions if available
  if (positionCache.has(cacheKey)) {
    return positionCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(`/api/godot/versions/${versionId}/panel-positions`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      logger.warn(`Failed to load panel positions: ${response.statusText}`);
      return {};
    }

    const positions: PanelPositionsMap = await response.json();
    // Cache the loaded positions
    positionCache.set(cacheKey, positions);
    return positions;
  } catch (error) {
    logger.warn('Error loading panel positions:', error);
    return {};
  }
}

/**
 * Load a single panel position with fallback to default
 */
export async function loadPanelPosition(
  versionId: number,
  panelId: string,
  defaultPosition: Position
): Promise<Position> {
  try {
    const positions = await loadAllPanelPositions(versionId);
    return positions[panelId] || defaultPosition;
  } catch (error) {
    logger.warn(`Error loading position for panel ${panelId}:`, error);
    return defaultPosition;
  }
}

/**
 * Save a panel position to the database (debounced)
 * Debouncing prevents excessive API calls while dragging
 */
export function savePanelPosition(
  versionId: number,
  panelId: string,
  position: Position,
  debounceMs: number = 500
): Promise<void> {
  return new Promise(resolve => {
    // Clear existing timer for this panel
    const timerKey = `${versionId}-${panelId}`;
    if (saveTimers.has(timerKey)) {
      clearTimeout(saveTimers.get(timerKey)!);
    }

    // Set new debounced timer
    const timer = setTimeout(async () => {
      try {
        // Snap position to grid before saving
        const snappedPosition = snapPositionToGrid(position);
        const roundedPosition = {
          x: Math.round(snappedPosition.x),
          y: Math.round(snappedPosition.y),
        };

        const response = await fetch(`/api/godot/versions/${versionId}/panel-positions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            panelId,
            position: roundedPosition,
          }),
        });

        if (!response.ok) {
          logger.warn(`Failed to save panel position: ${response.statusText}`);
        } else {
          // Update cache with saved position
          const cacheKey = `v${versionId}`;
          const positions = positionCache.get(cacheKey) || {};
          positions[panelId] = roundedPosition;
          positionCache.set(cacheKey, positions);
        }
      } catch (error) {
        logger.warn('Error saving panel position:', error);
      } finally {
        saveTimers.delete(timerKey);
        resolve();
      }
    }, debounceMs);

    saveTimers.set(timerKey, timer);
  });
}

/**
 * Reset a panel position to default (delete from database)
 */
export async function resetPanelPosition(versionId: number, panelId: string): Promise<void> {
  try {
    const response = await fetch(`/api/godot/versions/${versionId}/panel-positions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelId }),
    });

    if (response.ok) {
      // Update cache to remove the position
      const cacheKey = `v${versionId}`;
      const positions = positionCache.get(cacheKey);
      if (positions) {
        delete positions[panelId];
        positionCache.set(cacheKey, positions);
      }
    } else {
      logger.warn(`Failed to reset panel position: ${response.statusText}`);
    }
  } catch (error) {
    logger.warn('Error resetting panel position:', error);
  }
}

/**
 * Clear all panel positions for a version
 */
export async function clearAllPanelPositions(versionId: number): Promise<void> {
  const cacheKey = `v${versionId}`;
  positionCache.delete(cacheKey);

  // Cancel any pending saves for this version
  for (const [timerKey, timer] of saveTimers.entries()) {
    if (timerKey.startsWith(`${versionId}-`)) {
      clearTimeout(timer);
      saveTimers.delete(timerKey);
    }
  }
}

/**
 * Clear cache for testing or manual refresh
 */
export function clearCache(versionId?: number): void {
  if (versionId) {
    positionCache.delete(`v${versionId}`);
  } else {
    positionCache.clear();
  }
}
