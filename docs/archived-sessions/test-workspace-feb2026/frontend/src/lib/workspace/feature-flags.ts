/**
 * Workspace Feature Flags
 *
 * Controls progressive rollout of new workspace features.
 * Flags can be toggled via environment variables for safe deployment.
 */

/**
 * Workspace feature flags
 *
 * All flags default to false for safety. Enable via environment variables.
 */
import { logger } from '@/lib/utils/logger';

export const WORKSPACE_FEATURES = {
  /**
   * Enable Yjs-first architecture (single source of truth)
   *
   * When false: Uses legacy dual-write pattern (Zustand ↔ Yjs bidirectional sync)
   * When true: Yjs is source of truth, Zustand is read-only cache
   *
   * Purpose: Migration from dual-state to single-source-of-truth architecture
   * Status: Phase 1 - Type safety infrastructure complete, Phase 2 in progress
   *
   * Environment variable: NEXT_PUBLIC_WORKSPACE_YJS_MIGRATION
   *
   * Rollback: Set to 'false' and redeploy (3-5 minutes)
   *
   * @default false (legacy mode)
   */
  YJS_SINGLE_SOURCE: process.env.NEXT_PUBLIC_WORKSPACE_YJS_MIGRATION === 'true',

  /**
   * Enable observer debouncing for performance
   *
   * When true: Yjs observer updates are batched (max 1 update per 16ms)
   * When false: Observer updates trigger immediately on every Yjs change
   *
   * Purpose: Reduce re-render overhead during high-frequency operations (drag)
   * Status: Phase 3 - Observer optimization
   *
   * Environment variable: NEXT_PUBLIC_WORKSPACE_OBSERVER_DEBOUNCE
   *
   * @default false
   */
  OBSERVER_DEBOUNCE: process.env.NEXT_PUBLIC_WORKSPACE_OBSERVER_DEBOUNCE === 'true',

  /**
   * Enable origin tracking to skip local observer callbacks
   *
   * When true: Local writes skip observer callback (data already in Zustand)
   * When false: All Yjs changes trigger observer (including local writes)
   *
   * Purpose: Eliminate duplicate re-renders on user actions
   * Status: Phase 3 - Observer optimization
   *
   * Environment variable: NEXT_PUBLIC_WORKSPACE_ORIGIN_TRACKING
   *
   * @default false
   */
  ORIGIN_TRACKING: process.env.NEXT_PUBLIC_WORKSPACE_ORIGIN_TRACKING === 'true',

  /**
   * Enable WebSocket server for real-time collaboration
   *
   * When true: Client connects to WebSocket server for multi-user sync
   * When false: Offline-only mode (IndexedDB persistence only)
   *
   * Purpose: Enable real-time multi-user collaboration
   * Status: Phase 5 - WebSocket server deployment
   *
   * Environment variable: NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED
   *
   * @default false
   */
  WEBSOCKET_ENABLED: process.env.NEXT_PUBLIC_WORKSPACE_WEBSOCKET_ENABLED === 'true',
} as const;

/**
 * Check if Yjs-first migration is enabled
 *
 * Helper function for cleaner conditional checks in workspace code.
 *
 * @returns true if YJS_SINGLE_SOURCE is enabled
 */
export function isYjsFirstEnabled(): boolean {
  return WORKSPACE_FEATURES.YJS_SINGLE_SOURCE;
}

/**
 * Get WebSocket server URL
 *
 * @returns WebSocket URL or null if disabled
 */
export function getWebSocketUrl(): string | null {
  if (!WORKSPACE_FEATURES.WEBSOCKET_ENABLED) {
    return null;
  }

  return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';
}

/**
 * Log feature flag status to console (development only)
 *
 * Helps developers understand which features are enabled.
 */
export function logFeatureFlags(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  logger.info('[Workspace] Feature Flags ━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('YJS_SINGLE_SOURCE:', WORKSPACE_FEATURES.YJS_SINGLE_SOURCE);
  logger.info('OBSERVER_DEBOUNCE:', WORKSPACE_FEATURES.OBSERVER_DEBOUNCE);
  logger.info('ORIGIN_TRACKING:', WORKSPACE_FEATURES.ORIGIN_TRACKING);
  logger.info('WEBSOCKET_ENABLED:', WORKSPACE_FEATURES.WEBSOCKET_ENABLED);
  if (WORKSPACE_FEATURES.WEBSOCKET_ENABLED) {
    logger.info('WebSocket URL:', getWebSocketUrl());
  }
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
