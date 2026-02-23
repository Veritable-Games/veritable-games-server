/**
 * Branded Types for Workspace Module
 *
 * Provides compile-time type safety for ID types to prevent mixing different
 * entity IDs (e.g., passing a NodeId where a WorkspaceId is expected).
 *
 * Following the same pattern as forums/branded-types.ts
 */

// ============================================================================
// Brand Symbols - Unique symbols for each branded type
// ============================================================================

declare const WorkspaceIdBrand: unique symbol;
declare const NodeIdBrand: unique symbol;
declare const ConnectionIdBrand: unique symbol;
declare const ViewportStateIdBrand: unique symbol;

// ============================================================================
// Branded Type Definitions
// ============================================================================

/**
 * Type-safe ID for workspaces
 * One workspace per project (1:1 relationship via project slug)
 */
export type WorkspaceId = string & {
  readonly [WorkspaceIdBrand]: typeof WorkspaceIdBrand;
};

/**
 * Type-safe ID for canvas nodes (text boxes on canvas)
 */
export type NodeId = string & { readonly [NodeIdBrand]: typeof NodeIdBrand };

/**
 * Type-safe ID for node connections (lines between nodes)
 */
export type ConnectionId = string & {
  readonly [ConnectionIdBrand]: typeof ConnectionIdBrand;
};

/**
 * Type-safe ID for viewport states (user's view position)
 */
export type ViewportStateId = number & {
  readonly [ViewportStateIdBrand]: typeof ViewportStateIdBrand;
};

// ============================================================================
// Type Guards - Runtime validation with type narrowing
// ============================================================================

export function isWorkspaceId(value: unknown): value is WorkspaceId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    /^[a-z0-9-_]+$/.test(value)
  ); // project slug pattern
}

export function isNodeId(value: unknown): value is NodeId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    /^node_[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/.test(value)
  );
}

export function isConnectionId(value: unknown): value is ConnectionId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    /^conn_[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/.test(value)
  );
}

export function isViewportStateId(value: unknown): value is ViewportStateId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

// ============================================================================
// Conversion Utilities - Safe conversion with validation
// ============================================================================

export function toWorkspaceId(value: unknown): WorkspaceId {
  if (isWorkspaceId(value)) return value;
  throw new TypeError(
    `Invalid WorkspaceId: expected project slug, got ${typeof value} (${String(value)})`
  );
}

export function toNodeId(value: unknown): NodeId {
  if (isNodeId(value)) return value;
  throw new TypeError(
    `Invalid NodeId: expected node_uuid format, got ${typeof value} (${String(value)})`
  );
}

export function toConnectionId(value: unknown): ConnectionId {
  if (isConnectionId(value)) return value;
  throw new TypeError(
    `Invalid ConnectionId: expected conn_uuid format, got ${typeof value} (${String(value)})`
  );
}

export function toViewportStateId(value: unknown): ViewportStateId {
  if (isViewportStateId(value)) return value;
  throw new TypeError(
    `Invalid ViewportStateId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

// Safe conversions (return null on failure)
export function toWorkspaceIdSafe(value: unknown): WorkspaceId | null {
  try {
    return toWorkspaceId(value);
  } catch {
    return null;
  }
}

export function toNodeIdSafe(value: unknown): NodeId | null {
  try {
    return toNodeId(value);
  } catch {
    return null;
  }
}

export function toConnectionIdSafe(value: unknown): ConnectionId | null {
  try {
    return toConnectionId(value);
  } catch {
    return null;
  }
}

export function toViewportStateIdSafe(value: unknown): ViewportStateId | null {
  try {
    return toViewportStateId(value);
  } catch {
    return null;
  }
}

// ============================================================================
// Unsafe Conversions - Use with caution (for database layer only)
// ============================================================================

export function unsafeToWorkspaceId(value: string): WorkspaceId {
  return value as WorkspaceId;
}

export function unsafeToNodeId(value: string): NodeId {
  return value as NodeId;
}

export function unsafeToConnectionId(value: string): ConnectionId {
  return value as ConnectionId;
}

export function unsafeToViewportStateId(value: number): ViewportStateId {
  return value as ViewportStateId;
}
