/**
 * Character Position Mapper
 *
 * Maps character offsets in text content to DOM positions.
 * Used for positioning traced content overlays at specific text locations.
 */

import type { CharacterPosition } from './types';

/**
 * Maps character offsets to DOM positions within a container element.
 * Uses TreeWalker to traverse text nodes and calculate precise positions.
 */
export class CharacterMapper {
  private positions: Map<number, CharacterPosition> = new Map();
  private containerRef: React.RefObject<HTMLElement>;
  private lastBuildTime: number = 0;

  constructor(containerRef: React.RefObject<HTMLElement>) {
    this.containerRef = containerRef;
  }

  /**
   * Build the character offset map from rendered DOM.
   * Should be called after the content is rendered and on resize.
   */
  buildMap(): void {
    this.positions.clear();

    if (!this.containerRef.current) return;

    const walker = document.createTreeWalker(this.containerRef.current, NodeFilter.SHOW_TEXT, null);

    let globalOffset = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent || '';

      // Skip empty text nodes
      if (text.length === 0) continue;

      const range = document.createRange();

      for (let i = 0; i < text.length; i++) {
        try {
          range.setStart(node, i);
          range.setEnd(node, i + 1);

          const rect = range.getBoundingClientRect();
          this.positions.set(globalOffset + i, {
            offset: globalOffset + i,
            rect,
            node,
            nodeOffset: i,
          });
        } catch {
          // Skip characters that can't be ranged
        }
      }

      globalOffset += text.length;
    }

    this.lastBuildTime = Date.now();
  }

  /**
   * Get the total number of characters mapped.
   */
  get length(): number {
    return this.positions.size;
  }

  /**
   * Check if the map needs rebuilding (e.g., after resize).
   */
  needsRebuild(): boolean {
    // Rebuild if more than 100ms has passed
    return Date.now() - this.lastBuildTime > 100;
  }

  /**
   * Get character position at a specific offset.
   */
  getPosition(offset: number): CharacterPosition | undefined {
    return this.positions.get(offset);
  }

  /**
   * Get bounding rect for a range of characters.
   * Returns a rect that encompasses all characters in the range.
   */
  getRectForRange(start: number, end: number): DOMRect | null {
    if (start >= end || this.positions.size === 0) return null;

    const startPos = this.positions.get(start);
    const endPos = this.positions.get(end - 1);

    if (!startPos || !endPos) return null;

    try {
      // Create range spanning from start to end
      const range = document.createRange();
      range.setStart(startPos.node, startPos.nodeOffset);
      range.setEnd(endPos.node, endPos.nodeOffset + 1);

      return range.getBoundingClientRect();
    } catch {
      // Fallback: calculate from individual positions
      const rects: DOMRect[] = [];
      for (let i = start; i < end; i++) {
        const pos = this.positions.get(i);
        if (pos) rects.push(pos.rect);
      }

      if (rects.length === 0) return null;

      // Calculate bounding box of all rects
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const rect of rects) {
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
      }

      return new DOMRect(minX, minY, maxX - minX, maxY - minY);
    }
  }

  /**
   * Get the character offset at a specific point (x, y).
   * Used for click-to-select functionality.
   */
  getOffsetFromPoint(x: number, y: number): number | null {
    // Use caretRangeFromPoint for more accurate positioning
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return null;

    // Find the global offset for this position
    for (const [offset, pos] of this.positions) {
      if (pos.node === range.startContainer && pos.nodeOffset === range.startOffset) {
        return offset;
      }
    }

    // Fallback: find closest position
    let closestOffset: number | null = null;
    let closestDistance = Infinity;

    for (const [offset, pos] of this.positions) {
      const centerX = pos.rect.left + pos.rect.width / 2;
      const centerY = pos.rect.top + pos.rect.height / 2;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

      if (distance < closestDistance) {
        closestDistance = distance;
        closestOffset = offset;
      }
    }

    return closestOffset;
  }

  /**
   * Get character range from a DOM Selection.
   */
  getRangeFromSelection(selection: Selection): { start: number; end: number; text: string } | null {
    if (!selection.rangeCount || !this.containerRef.current) return null;

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();

    if (!text || !this.containerRef.current.contains(range.commonAncestorContainer)) {
      return null;
    }

    // Walk the tree to find start and end offsets
    const walker = document.createTreeWalker(this.containerRef.current, NodeFilter.SHOW_TEXT, null);

    let textOffset = 0;
    let startOffset = -1;
    let endOffset = -1;
    let currentNode: Text | null;

    while ((currentNode = walker.nextNode() as Text | null)) {
      const nodeLength = currentNode.textContent?.length || 0;

      // Check if this node contains the start of selection
      if (startOffset === -1 && currentNode === range.startContainer) {
        startOffset = textOffset + range.startOffset;
      }

      // Check if this node contains the end of selection
      if (currentNode === range.endContainer) {
        endOffset = textOffset + range.endOffset;
        break;
      }

      textOffset += nodeLength;
    }

    if (startOffset === -1 || endOffset === -1) return null;

    return { start: startOffset, end: endOffset, text };
  }

  /**
   * Get text content at a specific range.
   */
  getTextAtRange(start: number, end: number): string {
    if (!this.containerRef.current) return '';

    let result = '';
    for (let i = start; i < end; i++) {
      const pos = this.positions.get(i);
      if (pos && pos.node.textContent) {
        result += pos.node.textContent[pos.nodeOffset];
      }
    }
    return result;
  }

  /**
   * Get position relative to the container (for absolute positioning within scroll container).
   */
  getRelativePosition(rect: DOMRect): { top: number; left: number } | null {
    if (!this.containerRef.current) return null;

    const containerRect = this.containerRef.current.getBoundingClientRect();

    return {
      top: rect.top - containerRect.top + this.containerRef.current.scrollTop,
      left: rect.left - containerRect.left + this.containerRef.current.scrollLeft,
    };
  }
}

/**
 * React hook for using CharacterMapper with automatic rebuild on resize.
 */
export function useCharacterMapper(containerRef: React.RefObject<HTMLElement>) {
  const mapperRef = { current: new CharacterMapper(containerRef) };

  return {
    mapper: mapperRef.current,
    buildMap: () => mapperRef.current.buildMap(),
    getRectForRange: (start: number, end: number) => mapperRef.current.getRectForRange(start, end),
    getRangeFromSelection: (selection: Selection) =>
      mapperRef.current.getRangeFromSelection(selection),
    getRelativePosition: (rect: DOMRect) => mapperRef.current.getRelativePosition(rect),
  };
}
