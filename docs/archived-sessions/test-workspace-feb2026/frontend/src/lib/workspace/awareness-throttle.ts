/**
 * Awareness Throttle Utility
 *
 * Throttles cursor position and selection updates to avoid overwhelming
 * the awareness protocol and network bandwidth
 */

import { WorkspaceId } from './branded-types';

interface ThrottleConfig {
  cursorUpdateInterval: number; // Milliseconds between cursor updates
  selectionUpdateInterval: number; // Milliseconds between selection updates
}

const DEFAULT_CONFIG: ThrottleConfig = {
  cursorUpdateInterval: 50, // 20 updates/second max
  selectionUpdateInterval: 100, // 10 updates/second max
};

export class AwarenessThrottle {
  private cursorTimer: NodeJS.Timeout | null = null;
  private selectionTimer: NodeJS.Timeout | null = null;
  private pendingCursor: { x: number; y: number } | null = null;
  private pendingSelection: Set<string> | null = null;
  private config: ThrottleConfig;

  constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Throttle cursor position updates
   */
  updateCursor(awareness: any, position: { x: number; y: number }, callback?: () => void) {
    this.pendingCursor = position;

    if (!this.cursorTimer) {
      this.cursorTimer = setTimeout(() => {
        if (this.pendingCursor && awareness) {
          const currentState = awareness.getLocalState();
          awareness.setLocalStateField('user', {
            ...currentState?.user,
            cursor: this.pendingCursor,
          });
          callback?.();
        }
        this.pendingCursor = null;
        this.cursorTimer = null;
      }, this.config.cursorUpdateInterval);
    }
  }

  /**
   * Throttle selection updates
   */
  updateSelection(awareness: any, selection: Set<string>, callback?: () => void) {
    this.pendingSelection = selection;

    if (!this.selectionTimer) {
      this.selectionTimer = setTimeout(() => {
        if (this.pendingSelection && awareness) {
          const currentState = awareness.getLocalState();
          awareness.setLocalStateField('user', {
            ...currentState?.user,
            selection: Array.from(this.pendingSelection),
          });
          callback?.();
        }
        this.pendingSelection = null;
        this.selectionTimer = null;
      }, this.config.selectionUpdateInterval);
    }
  }

  /**
   * Clear cursor from awareness (user left canvas)
   */
  clearCursor(awareness: any) {
    if (this.cursorTimer) {
      clearTimeout(this.cursorTimer);
      this.cursorTimer = null;
    }
    this.pendingCursor = null;

    if (awareness) {
      const currentState = awareness.getLocalState();
      awareness.setLocalStateField('user', {
        ...currentState?.user,
        cursor: null,
      });
    }
  }

  /**
   * Cleanup timers
   */
  destroy() {
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    if (this.selectionTimer) clearTimeout(this.selectionTimer);
    this.cursorTimer = null;
    this.selectionTimer = null;
    this.pendingCursor = null;
    this.pendingSelection = null;
  }
}
