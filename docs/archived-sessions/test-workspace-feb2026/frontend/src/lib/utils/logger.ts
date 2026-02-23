/**
 * Production-safe logging utility with structured logging support
 *
 * Features:
 * - JSON formatting for production (configurable)
 * - Structured logging with context (component, userId, correlationId, etc.)
 * - Environment-aware logging (debug suppressed in production)
 * - Log level configuration
 * - Optional correlation ID threading
 *
 * NOTE: Config import is deferred to avoid client-side validation of server-only env vars
 */

// Server-side imports (only available in Node.js environment)
let getCorrelationId: (() => string) | undefined;
let getRequestId: (() => string) | undefined;
let getVersionId: (() => number | undefined) | undefined;
let getInstanceId: (() => string | undefined) | undefined;
let getContextAsJson: (() => Record<string, unknown>) | undefined;

// Lazy-load correlation context on the server
if (typeof window === 'undefined') {
  try {
    const ctx = require('../mcp/correlation-context');
    getCorrelationId = ctx.getCorrelationId;
    getRequestId = ctx.getRequestId;
    getVersionId = ctx.getVersionId;
    getInstanceId = ctx.getInstanceId;
    getContextAsJson = ctx.getContextAsJson;
  } catch (e) {
    // Correlation context not available, proceed without it
  }
}

/**
 * Lazy-load config functions only when needed
 * This avoids triggering environment variable validation on the client side
 * where server-only env vars (DATABASE_URL, API_BASE_URL) aren't available
 */
function isDevelopmentEnv(): boolean {
  if (typeof window !== 'undefined') {
    // Client side - use NODE_ENV directly to avoid config import
    return process.env.NODE_ENV === 'development';
  }

  // Server side - safe to import config
  try {
    const { isDevelopment } = require('../config');
    return isDevelopment();
  } catch (e) {
    // Fallback if config import fails
    return process.env.NODE_ENV === 'development';
  }
}

function isProductionEnv(): boolean {
  if (typeof window !== 'undefined') {
    // Client side - use NODE_ENV directly to avoid config import
    return process.env.NODE_ENV === 'production';
  }

  // Server side - safe to import config
  try {
    const { isProduction } = require('../config');
    return isProduction();
  } catch (e) {
    // Fallback if config import fails
    return process.env.NODE_ENV === 'production';
  }
}

function useJsonLoggingFormat(): boolean {
  if (typeof window !== 'undefined') {
    // Client side - use NODE_ENV directly to avoid config import
    return process.env.NODE_ENV === 'production';
  }

  // Server side - safe to import config
  try {
    const { useJsonLogging } = require('../config');
    return useJsonLogging();
  } catch (e) {
    // Fallback if config import fails
    return process.env.NODE_ENV === 'production';
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context for structured logging
 */
export interface LogContext {
  /** Component or module name */
  component?: string;

  /** User ID (if applicable) */
  userId?: string;

  /** Correlation ID from request */
  correlationId?: string;

  /** Request ID from request */
  requestId?: string;

  /** Godot version ID (if applicable) */
  versionId?: number;

  /** MCP instance ID (if applicable) */
  instanceId?: string;

  /** Additional contextual data */
  [key: string]: any;
}

class Logger {
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  private shouldLog(level: LogLevel): boolean {
    // Always log errors
    if (level === 'error') return true;

    // Suppress debug in production
    if (isProductionEnv() && level === 'debug') return false;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Format log entry as JSON for structured logging
   */
  private formatJson(level: LogLevel, message: string, context?: LogContext, error?: any): string {
    const entry: any = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      environment: process.env.NODE_ENV || 'development',
    };

    // Add correlation context if available
    const requestContext = getContextAsJson ? getContextAsJson() : {};
    if (Object.keys(requestContext).length > 0) {
      entry.context = {
        ...requestContext,
        ...context,
      };
    } else if (context) {
      entry.context = context;
    }

    // Add error information
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return JSON.stringify(entry);
  }

  /**
   * Format log entry as text for human reading
   */
  private formatText(level: LogLevel, message: string, context?: LogContext, error?: any): string {
    const timestamp = new Date().toISOString();
    const levelTag = level.toUpperCase().padEnd(5);
    let output = `[${timestamp}] [${levelTag}] ${message}`;

    // Add correlation IDs if available (only on server)
    const correlationId =
      context?.correlationId || (getCorrelationId ? getCorrelationId() : undefined);
    const requestId = context?.requestId || (getRequestId ? getRequestId() : undefined);
    if (correlationId || requestId) {
      output += ` [${(correlationId || '').substring(0, 8)}:${(requestId || '').substring(0, 8)}]`;
    }

    // Add component if provided
    if (context?.component) {
      output += ` [${context.component}]`;
    }

    // Add context data
    if (context && Object.keys(context).length > 0) {
      const contextKeys = Object.keys(context).filter(
        k => !['component', 'correlationId', 'requestId'].includes(k)
      );
      if (contextKeys.length > 0) {
        output += ' ' + JSON.stringify(context);
      }
    }

    // Add error if present
    if (error) {
      output += `\n  Error: ${error.message}`;
      if (isDevelopmentEnv() && error.stack) {
        output += `\n  Stack: ${error.stack}`;
      }
    }

    return output;
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext | any, error?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const useJson = useJsonLoggingFormat();
    const output = useJson
      ? this.formatJson(level, message, context, error)
      : this.formatText(level, message, context, error);

    // Always output to stderr (or console methods which map to stderr)
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  // Public API

  debug(message: string, ...args: any[]): void {
    // Support console.log-style multiple arguments for easier migration
    const context =
      args.length > 0 &&
      typeof args[args.length - 1] === 'object' &&
      !Array.isArray(args[args.length - 1]) &&
      args[args.length - 1] !== null
        ? args.pop()
        : undefined;

    const fullMessage =
      args.length > 0
        ? message +
          ' ' +
          args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
        : message;

    this.log('debug', fullMessage, context);
  }

  info(message: string, ...args: any[]): void {
    // Support console.log-style multiple arguments for easier migration
    const context =
      args.length > 0 &&
      typeof args[args.length - 1] === 'object' &&
      !Array.isArray(args[args.length - 1]) &&
      args[args.length - 1] !== null
        ? args.pop()
        : undefined;

    const fullMessage =
      args.length > 0
        ? message +
          ' ' +
          args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
        : message;

    this.log('info', fullMessage, context);
  }

  warn(message: string, ...args: any[]): void {
    // Support console.log-style multiple arguments for easier migration
    const context =
      args.length > 0 &&
      typeof args[args.length - 1] === 'object' &&
      !Array.isArray(args[args.length - 1]) &&
      args[args.length - 1] !== null
        ? args.pop()
        : undefined;

    const fullMessage =
      args.length > 0
        ? message +
          ' ' +
          args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
        : message;

    this.log('warn', fullMessage, context);
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    // Support both (message, error, context) and (message, context) signatures
    const actualError = error instanceof Error || (error && error.message) ? error : undefined;
    const actualContext =
      actualError === undefined && error && typeof error === 'object' ? error : context;

    this.log('error', message, actualContext, actualError);
  }

  /**
   * Security-specific logging
   */
  security(message: string, context?: LogContext): void {
    const securityContext = { ...context, component: context?.component || 'security' };
    this.log('warn', `[SECURITY] ${message}`, securityContext);
  }
}

export const logger = new Logger();

// Note: Logger automatically suppresses console output in production
// All logging should use the logger utility instead of console directly
