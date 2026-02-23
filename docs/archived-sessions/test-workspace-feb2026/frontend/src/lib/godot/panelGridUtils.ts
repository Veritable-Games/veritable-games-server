/**
 * Grid-based panel layout system with collision resolution
 * Handles 16px grid snapping, collision detection, and automatic repositioning
 */

// Grid constants
export const GRID_SIZE = 16; // pixels per grid cell

// Type definitions
export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface GridPosition {
  gridX: number;
  gridY: number;
}

export interface GridRect {
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
}

export interface PanelInfo {
  id: string;
  rect: GridRect;
  priority: number; // 0 = being dragged (highest), 1+ = other panels
}

export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

// ============================================================================
// GRID CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert pixel position to grid coordinates
 * Snaps to nearest grid cell
 */
export function pixelsToGrid(pixels: Position): GridPosition {
  return {
    gridX: Math.round(pixels.x / GRID_SIZE),
    gridY: Math.round(pixels.y / GRID_SIZE),
  };
}

/**
 * Convert grid coordinates to pixel position
 */
export function gridToPixels(grid: GridPosition): Position {
  return {
    x: grid.gridX * GRID_SIZE,
    y: grid.gridY * GRID_SIZE,
  };
}

/**
 * Convert pixel size to grid cells (rounds up)
 * Ensures panels always have at least 1 cell width/height
 */
export function sizeToGridCells(size: Size): Size {
  return {
    width: Math.max(1, Math.ceil(size.width / GRID_SIZE)),
    height: Math.max(1, Math.ceil(size.height / GRID_SIZE)),
  };
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/**
 * Check if two grid rectangles overlap
 * Returns true if they share any cells
 */
export function detectCollision(rectA: GridRect, rectB: GridRect): boolean {
  // No collision if rectangles are separated
  if (
    rectA.gridX + rectA.gridWidth <= rectB.gridX || // A is left of B
    rectB.gridX + rectB.gridWidth <= rectA.gridX || // B is left of A
    rectA.gridY + rectA.gridHeight <= rectB.gridY || // A is above B
    rectB.gridY + rectB.gridHeight <= rectA.gridY // B is above A
  ) {
    return false;
  }

  return true;
}

/**
 * Find all panels that collide with the target rectangle
 */
export function findCollisions(target: GridRect, allPanels: PanelInfo[]): PanelInfo[] {
  return allPanels.filter(panel => detectCollision(target, panel.rect));
}

// ============================================================================
// DIRECTION CALCULATION
// ============================================================================

/**
 * Calculate the primary push direction based on two rectangles
 * Determines whether to push a panel up, down, left, or right
 */
export function calculatePushDirection(
  fromRect: GridRect, // Rectangle being dragged
  toRect: GridRect // Rectangle being collided with
): Direction {
  // Calculate centroids
  const fromCenterX = fromRect.gridX + fromRect.gridWidth / 2;
  const fromCenterY = fromRect.gridY + fromRect.gridHeight / 2;
  const toCenterX = toRect.gridX + toRect.gridWidth / 2;
  const toCenterY = toRect.gridY + toRect.gridHeight / 2;

  // Calculate differences
  const deltaX = fromCenterX - toCenterX;
  const deltaY = fromCenterY - toCenterY;

  // Determine primary axis (larger difference)
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  if (absDeltaX > absDeltaY) {
    // Push left or right
    return deltaX > 0 ? 'right' : 'left';
  } else {
    // Push up or down
    return deltaY > 0 ? 'down' : 'up';
  }
}

/**
 * Calculate new position by pushing panel in a direction
 * Moves panel by one step (grid cell width/height) in the specified direction
 */
export function calculatePushPosition(
  panel: PanelInfo,
  direction: Direction,
  distance: number = 1
): GridRect {
  const newRect = { ...panel.rect };

  switch (direction) {
    case 'left':
      newRect.gridX -= distance;
      break;
    case 'right':
      newRect.gridX += distance;
      break;
    case 'up':
      newRect.gridY -= distance;
      break;
    case 'down':
      newRect.gridY += distance;
      break;
    case 'none':
      // No movement
      break;
  }

  return newRect;
}

// ============================================================================
// VIEWPORT CONSTRAINTS
// ============================================================================

/**
 * Convert viewport size to grid cells
 */
export function viewportToGridCells(viewport: Size): Size {
  return {
    width: Math.floor(viewport.width / GRID_SIZE),
    height: Math.floor(viewport.height / GRID_SIZE),
  };
}

/**
 * Clamp grid position and size to viewport bounds
 * Prevents panels from being pushed off-screen
 */
export function clampToViewport(rect: GridRect, viewport: Size): GridRect {
  const viewportGridSize = viewportToGridCells(viewport);

  return {
    gridX: Math.max(0, Math.min(rect.gridX, viewportGridSize.width - rect.gridWidth)),
    gridY: Math.max(0, Math.min(rect.gridY, viewportGridSize.height - rect.gridHeight)),
    gridWidth: rect.gridWidth,
    gridHeight: rect.gridHeight,
  };
}

// ============================================================================
// COLLISION RESOLUTION
// ============================================================================

const MAX_RESOLUTION_DEPTH = 5;
const PUSH_DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

/**
 * Main collision resolution algorithm
 * Attempts to push colliding panels out of the way
 * Returns a map of panelId -> new GridPosition for all panels that need to move
 * Returns empty map if collision cannot be resolved
 */
export function resolveCollisions(
  draggingPanel: PanelInfo,
  allPanels: PanelInfo[],
  viewport: Size,
  maxDepth: number = MAX_RESOLUTION_DEPTH
): Map<string, GridRect> {
  const result = new Map<string, GridRect>();
  const visited = new Set<string>();
  const panelMap = new Map(allPanels.map(p => [p.id, p]));

  /**
   * Recursively resolve collisions for a panel
   * Returns true if successfully resolved, false if impossible
   */
  function tryPushPanel(panelId: string, preferredDirection: Direction, depth: number): boolean {
    if (depth > maxDepth || visited.has(panelId)) {
      return false;
    }

    visited.add(panelId);

    const panel = panelMap.get(panelId);
    if (!panel) return false;

    // Get current position (from result map or original position)
    const currentRect = result.get(panelId) || panel.rect;

    // Try to push in preferred direction first
    const directionsToTry = [
      preferredDirection,
      ...PUSH_DIRECTIONS.filter(d => d !== preferredDirection),
    ];

    for (const direction of directionsToTry) {
      if (direction === 'none') continue;

      // Try pushing incrementally to find the minimum distance needed
      for (let pushDistance = 1; pushDistance <= 10; pushDistance++) {
        const newRect = calculatePushPosition(
          { ...panel, rect: currentRect },
          direction,
          pushDistance
        );

        // Clamp to viewport
        const clampedRect = clampToViewport(newRect, viewport);

        // Check if clamped (meaning we hit viewport edge)
        if (clampedRect.gridX !== newRect.gridX || clampedRect.gridY !== newRect.gridY) {
          // Hit viewport edge, skip this distance
          continue;
        }

        // Check if this position still collides with the dragging panel
        if (detectCollision(clampedRect, draggingPanel.rect)) {
          continue; // Still collides, try more distance or next direction
        }

        // Check if this position collides with other panels
        const otherCollisions = allPanels
          .filter(p => p.id !== panelId && p.id !== draggingPanel.id)
          .filter(p => {
            const otherCurrentRect = result.get(p.id) || p.rect;
            return detectCollision(clampedRect, otherCurrentRect);
          });

        if (otherCollisions.length === 0) {
          // No collisions! We found a valid position
          result.set(panelId, clampedRect);
          return true;
        }

        // There are collisions with other panels, try to resolve them
        let allOthersResolved = true;
        for (const otherPanel of otherCollisions) {
          const otherDirection = calculatePushDirection(
            clampedRect,
            result.get(otherPanel.id) || otherPanel.rect
          );

          if (!tryPushPanel(otherPanel.id, otherDirection, depth + 1)) {
            allOthersResolved = false;
            break;
          }
        }

        if (allOthersResolved) {
          // All cascading collisions resolved
          result.set(panelId, clampedRect);
          return true;
        }
      }
    }

    return false; // Could not find valid position
  }

  // Find all panels that collide with the dragging panel
  const directCollisions = findCollisions(draggingPanel.rect, allPanels).filter(
    p => p.id !== draggingPanel.id
  );

  // Try to resolve each collision
  for (const collider of directCollisions) {
    const direction = calculatePushDirection(draggingPanel.rect, collider.rect);

    if (!tryPushPanel(collider.id, direction, 0)) {
      // Could not resolve this collision
      // Return empty map to signal failure
      return new Map();
    }
  }

  return result;
}

// ============================================================================
// INITIAL LAYOUT RESOLUTION
// ============================================================================

/**
 * Detect which panels overlap at initial load
 * Useful for migrating from the old free-floating system
 */
export function detectInitialOverlaps(panels: Map<string, PanelInfo>): string[] {
  const panelList = Array.from(panels.values());
  const overlapping = new Set<string>();

  for (let i = 0; i < panelList.length; i++) {
    const panelI = panelList[i];
    if (!panelI) continue;

    for (let j = i + 1; j < panelList.length; j++) {
      const panelJ = panelList[j];
      if (!panelJ) continue;

      if (detectCollision(panelI.rect, panelJ.rect)) {
        overlapping.add(panelI.id);
        overlapping.add(panelJ.id);
      }
    }
  }

  return Array.from(overlapping);
}

/**
 * Resolve initial overlaps by repositioning panels
 * Assigns priority based on panel type (lower = higher priority)
 */
export function resolveInitialLayout(
  panels: Map<string, PanelInfo>,
  viewport: Size
): Map<string, GridRect> {
  const panelList = Array.from(panels.values()).sort((a, b) => {
    // Panels with lower priority numbers should be moved less
    return a.priority - b.priority;
  });

  const result = new Map<string, GridRect>();

  // Try to find valid positions for each panel
  for (const panel of panelList) {
    const currentRect = result.get(panel.id) || panel.rect;

    // Check collisions with already-placed panels
    const collisions = Array.from(result.entries()).filter(([_, rect]) =>
      detectCollision(currentRect, rect)
    );

    if (collisions.length === 0) {
      // No collisions, keep original position (clamped to viewport)
      result.set(panel.id, clampToViewport(currentRect, viewport));
    } else {
      // Try to find a valid position by scanning the viewport
      let foundPosition = false;

      for (
        let gridY = 0;
        gridY <= Math.floor(viewport.height / GRID_SIZE) - currentRect.gridHeight;
        gridY++
      ) {
        for (
          let gridX = 0;
          gridX <= Math.floor(viewport.width / GRID_SIZE) - currentRect.gridWidth;
          gridX++
        ) {
          const testRect: GridRect = {
            gridX,
            gridY,
            gridWidth: currentRect.gridWidth,
            gridHeight: currentRect.gridHeight,
          };

          const hasCollision = Array.from(result.values()).some(rect =>
            detectCollision(testRect, rect)
          );

          if (!hasCollision) {
            result.set(panel.id, testRect);
            foundPosition = true;
            break;
          }
        }

        if (foundPosition) break;
      }

      // If still no position found, keep clamped original
      if (!foundPosition) {
        result.set(panel.id, clampToViewport(currentRect, viewport));
      }
    }
  }

  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if two grid positions are the same (within floating point tolerance)
 */
export function gridPositionsEqual(a: GridPosition, b: GridPosition): boolean {
  return a.gridX === b.gridX && a.gridY === b.gridY;
}

/**
 * Check if two grid rectangles are the same
 */
export function gridRectsEqual(a: GridRect, b: GridRect): boolean {
  return (
    a.gridX === b.gridX &&
    a.gridY === b.gridY &&
    a.gridWidth === b.gridWidth &&
    a.gridHeight === b.gridHeight
  );
}

/**
 * Calculate the distance (in grid cells) between two rectangles' centroids
 */
export function gridDistance(rectA: GridRect, rectB: GridRect): number {
  const centerAX = rectA.gridX + rectA.gridWidth / 2;
  const centerAY = rectA.gridY + rectA.gridHeight / 2;
  const centerBX = rectB.gridX + rectB.gridWidth / 2;
  const centerBY = rectB.gridY + rectB.gridHeight / 2;

  const deltaX = centerBX - centerAX;
  const deltaY = centerBY - centerAY;

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}
