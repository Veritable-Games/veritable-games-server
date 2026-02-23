/**
 * Panel Snap Utilities
 *
 * Handles snapping logic for draggable panels:
 * - Edge snapping: Snap to viewport edges
 * - Panel snapping: Snap to other panel edges for alignment
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PanelRect extends Position {
  width: number;
  height: number;
}

/**
 * Snap position to viewport edges
 * Panels snap to edges when within threshold distance
 */
export function snapToEdges(
  position: Position,
  elementSize: Size,
  viewportSize: Size,
  threshold: number = 20
): Position {
  let x = position.x;
  let y = position.y;

  // Snap to left edge
  if (x < threshold) {
    x = 0;
  }

  // Snap to right edge
  const rightDistance = viewportSize.width - (x + elementSize.width);
  if (rightDistance < threshold && rightDistance > -elementSize.width) {
    x = viewportSize.width - elementSize.width;
  }

  // Snap to top edge
  if (y < threshold) {
    y = 0;
  }

  // Snap to bottom edge
  const bottomDistance = viewportSize.height - (y + elementSize.height);
  if (bottomDistance < threshold && bottomDistance > -elementSize.height) {
    y = viewportSize.height - elementSize.height;
  }

  return { x, y };
}

/**
 * Get edges of a rectangle for snapping calculations
 */
function getRectEdges(rect: PanelRect) {
  return {
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
    bottom: rect.y + rect.height,
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2,
  };
}

/**
 * Snap position to other panel edges for alignment
 * Panels align to each other when within threshold distance
 */
export function snapToPanels(
  position: Position,
  elementSize: Size,
  otherPanels: PanelRect[],
  threshold: number = 20
): Position {
  let x = position.x;
  let y = position.y;

  const currentRect: PanelRect = {
    x,
    y,
    width: elementSize.width,
    height: elementSize.height,
  };

  const currentEdges = getRectEdges(currentRect);

  // Check each other panel for alignment opportunities
  for (const otherPanel of otherPanels) {
    const otherEdges = getRectEdges(otherPanel);

    // Vertical alignment (left/right edges)
    const distLeftToLeft = Math.abs(currentEdges.left - otherEdges.left);
    const distRightToRight = Math.abs(currentEdges.right - otherEdges.right);
    const distLeftToRight = Math.abs(currentEdges.left - otherEdges.right);
    const distRightToLeft = Math.abs(currentEdges.right - otherEdges.left);

    // Snap left edge to other's left edge
    if (distLeftToLeft < threshold && distLeftToLeft > 0) {
      x = otherPanel.x;
    }

    // Snap right edge to other's right edge
    if (distRightToRight < threshold && distRightToRight > 0) {
      x = otherPanel.x + otherPanel.width - elementSize.width;
    }

    // Snap left edge to other's right edge
    if (distLeftToRight < threshold && distLeftToRight > 0) {
      x = otherPanel.x + otherPanel.width;
    }

    // Snap right edge to other's left edge
    if (distRightToLeft < threshold && distRightToLeft > 0) {
      x = otherPanel.x - elementSize.width;
    }

    // Horizontal alignment (top/bottom edges)
    const distTopToTop = Math.abs(currentEdges.top - otherEdges.top);
    const distBottomToBottom = Math.abs(currentEdges.bottom - otherEdges.bottom);
    const distTopToBottom = Math.abs(currentEdges.top - otherEdges.bottom);
    const distBottomToTop = Math.abs(currentEdges.bottom - otherEdges.top);

    // Snap top edge to other's top edge
    if (distTopToTop < threshold && distTopToTop > 0) {
      y = otherPanel.y;
    }

    // Snap bottom edge to other's bottom edge
    if (distBottomToBottom < threshold && distBottomToBottom > 0) {
      y = otherPanel.y + otherPanel.height - elementSize.height;
    }

    // Snap top edge to other's bottom edge
    if (distTopToBottom < threshold && distTopToBottom > 0) {
      y = otherPanel.y + otherPanel.height;
    }

    // Snap bottom edge to other's top edge
    if (distBottomToTop < threshold && distBottomToTop > 0) {
      y = otherPanel.y - elementSize.height;
    }
  }

  return { x, y };
}

/**
 * Apply both edge and panel snapping
 * Edge snapping takes precedence over panel snapping
 */
export function snapPosition(
  position: Position,
  elementSize: Size,
  viewportSize: Size,
  otherPanels: PanelRect[] = [],
  threshold: number = 20
): Position {
  // First apply panel-to-panel snapping
  let snappedPos = snapToPanels(position, elementSize, otherPanels, threshold);

  // Then apply viewport edge snapping (higher priority)
  snappedPos = snapToEdges(snappedPos, elementSize, viewportSize, threshold);

  return snappedPos;
}

/**
 * Clamp position to viewport bounds
 * Ensures panel doesn't go off-screen
 */
export function clampToBounds(position: Position, elementSize: Size, viewportSize: Size): Position {
  return {
    x: Math.max(0, Math.min(position.x, viewportSize.width - elementSize.width)),
    y: Math.max(0, Math.min(position.y, viewportSize.height - elementSize.height)),
  };
}
