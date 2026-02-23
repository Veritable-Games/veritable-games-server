/**
 * Distributed Tracing with Correlation Context
 *
 * Uses AsyncLocalStorage to track request correlation IDs and context
 * throughout the entire execution chain (router → instance → API).
 *
 * This enables:
 * - Cross-process request tracing
 * - Correlation of logs across multiple services
 * - Request tracking for debugging and monitoring
 *
 * Example:
 * ```typescript
 * await withCorrelation(async () => {
 *   // correlationId automatically available in any nested async calls
 *   const correlationId = getCorrelationId();
 *   logger.info(`[${correlationId}] Processing request`);
 * }, { versionId: 1, instanceId: 'abc123' });
 * ```
 */

import { AsyncLocalStorage } from 'async_hooks';
import { logger } from '@/lib/utils/logger';

// Use Web Crypto API (Edge Runtime compatible) instead of Node.js crypto
const randomUUID = (): string => {
  // crypto.randomUUID() is available in Edge Runtime, browsers, and Node.js 19+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Correlation context stored in AsyncLocalStorage
 */
export interface CorrelationContext {
  /** Unique ID for the entire request chain */
  correlationId: string;

  /** Unique ID for this specific request */
  requestId: string;

  /** Godot version being processed */
  versionId?: number;

  /** MCP instance ID if applicable */
  instanceId?: string;

  /** User ID if applicable */
  userId?: string;

  /** Start time of the request */
  startTime: number;
}

/**
 * AsyncLocalStorage for correlation context
 * Automatically propagates through async calls
 */
const contextStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Get current correlation context
 * Returns null if not within a correlated request
 */
export function getContext(): CorrelationContext | undefined {
  return contextStorage.getStore();
}

/**
 * Get correlation ID for current request
 * Generates a new one if not in a correlated context
 */
export function getCorrelationId(): string {
  const context = contextStorage.getStore();
  return context?.correlationId || generateCorrelationId();
}

/**
 * Get request ID for current request
 */
export function getRequestId(): string {
  const context = contextStorage.getStore();
  return context?.requestId || generateRequestId();
}

/**
 * Get version ID from context
 */
export function getVersionId(): number | undefined {
  return contextStorage.getStore()?.versionId;
}

/**
 * Get instance ID from context
 */
export function getInstanceId(): string | undefined {
  return contextStorage.getStore()?.instanceId;
}

/**
 * Get user ID from context
 */
export function getUserId(): string | undefined {
  return contextStorage.getStore()?.userId;
}

/**
 * Get request duration in milliseconds
 */
export function getRequestDuration(): number {
  const context = contextStorage.getStore();
  if (!context) return 0;
  return Date.now() - context.startTime;
}

/**
 * Generate a new correlation ID
 */
function generateCorrelationId(): string {
  return `corr-${randomUUID()}`;
}

/**
 * Generate a new request ID
 */
function generateRequestId(): string {
  return `req-${randomUUID()}`;
}

/**
 * Execute function within a correlation context
 *
 * Creates a new correlation context with the provided metadata,
 * automatically propagating it through all async calls within the handler.
 */
export async function withCorrelation<T>(
  handler: () => Promise<T>,
  metadata?: Partial<CorrelationContext>
): Promise<T> {
  const context: CorrelationContext = {
    correlationId: metadata?.correlationId || generateCorrelationId(),
    requestId: metadata?.requestId || generateRequestId(),
    versionId: metadata?.versionId,
    instanceId: metadata?.instanceId,
    userId: metadata?.userId,
    startTime: metadata?.startTime || Date.now(),
  };

  return contextStorage.run(context, handler);
}

/**
 * Create a new correlation context (for propagating to external calls)
 * Useful when calling other services that need correlation context
 */
export function createContextHeaders(): Record<string, string> {
  const context = contextStorage.getStore();
  if (!context) {
    return {};
  }

  const headers: Record<string, string> = {
    'x-correlation-id': context.correlationId,
    'x-request-id': context.requestId,
  };

  if (context.versionId) {
    headers['x-version-id'] = context.versionId.toString();
  }

  if (context.instanceId) {
    headers['x-instance-id'] = context.instanceId;
  }

  if (context.userId) {
    headers['x-user-id'] = context.userId;
  }

  return headers;
}

/**
 * Extract correlation context from headers (for service-to-service calls)
 * Useful when receiving requests from other services
 */
export function extractContextFromHeaders(
  headers: Record<string, string>
): Partial<CorrelationContext> {
  return {
    correlationId: headers['x-correlation-id'],
    requestId: headers['x-request-id'],
    versionId: headers['x-version-id'] ? parseInt(headers['x-version-id'], 10) : undefined,
    instanceId: headers['x-instance-id'],
    userId: headers['x-user-id'],
  };
}

/**
 * Run a function with context extracted from headers
 * Useful for service-to-service integration
 */
export async function withContextFromHeaders<T>(
  handler: () => Promise<T>,
  headers: Record<string, string>
): Promise<T> {
  const metadata = extractContextFromHeaders(headers);
  return withCorrelation(handler, metadata);
}

/**
 * Format context for logging
 * Returns a string suitable for log prefixes
 */
export function formatContextForLogging(): string {
  const context = contextStorage.getStore();
  if (!context) {
    return '';
  }

  const parts = [
    `[${context.correlationId.substring(0, 8)}]`,
    `[${context.requestId.substring(0, 8)}]`,
  ];

  if (context.versionId !== undefined) {
    parts.push(`[v${context.versionId}]`);
  }

  if (context.instanceId) {
    parts.push(`[${context.instanceId.substring(0, 8)}]`);
  }

  return parts.join(' ');
}

/**
 * Get context as JSON for structured logging
 */
export function getContextAsJson() {
  const context = contextStorage.getStore();
  if (!context) {
    return {};
  }

  return {
    correlationId: context.correlationId,
    requestId: context.requestId,
    versionId: context.versionId,
    instanceId: context.instanceId,
    userId: context.userId,
    durationMs: getRequestDuration(),
  };
}
