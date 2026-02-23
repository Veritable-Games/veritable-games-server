import { randomUUID } from 'crypto';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Structured log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  includeTimestamp: boolean;
  includeStack: boolean;
  correlationIdHeader: string;
  component?: string;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  includeTimestamp: true,
  includeStack: process.env.NODE_ENV !== 'production',
  correlationIdHeader: 'x-correlation-id',
  component: 'veritable-games',
};

/**
 * Structured logger class
 */
export class Logger {
  private config: LoggerConfig;
  private correlationId?: string;
  private sessionId?: string;
  private userId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(id: string): Logger {
    const logger = new Logger(this.config);
    logger.correlationId = id;
    logger.sessionId = this.sessionId;
    logger.userId = this.userId;
    return logger;
  }

  /**
   * Set session ID for user session tracking
   */
  setSessionId(id: string): Logger {
    const logger = new Logger(this.config);
    logger.correlationId = this.correlationId;
    logger.sessionId = id;
    logger.userId = this.userId;
    return logger;
  }

  /**
   * Set user ID for user-specific logging
   */
  setUserId(id: string): Logger {
    const logger = new Logger(this.config);
    logger.correlationId = this.correlationId;
    logger.sessionId = this.sessionId;
    logger.userId = id;
    return logger;
  }

  /**
   * Create child logger with component context
   */
  child(component: string): Logger {
    const childConfig = { ...this.config, component };
    const logger = new Logger(childConfig);
    logger.correlationId = this.correlationId;
    logger.sessionId = this.sessionId;
    logger.userId = this.userId;
    return logger;
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    error?: Error,
    metadata?: Record<string, any>,
    operation?: string,
    duration?: number
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      userId: this.userId,
      component: this.config.component,
      operation,
      duration,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.config.includeStack ? error.stack : undefined,
      };
    }

    return entry;
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // In production, we might send to external logging service
    // For now, output to console with proper formatting
    const logMethod =
      entry.level === LogLevel.ERROR
        ? console.error
        : entry.level === LogLevel.WARN
          ? console.warn
          : entry.level === LogLevel.DEBUG
            ? console.debug
            : console.log;

    if (process.env.NODE_ENV === 'production') {
      // JSON output for production (easier for log aggregation)
      logMethod(JSON.stringify(entry));
    } else {
      // Formatted output for development
      const timestamp = entry.timestamp;
      const correlation = entry.correlationId ? ` [${entry.correlationId}]` : '';
      const component = entry.component ? ` (${entry.component})` : '';
      const operation = entry.operation ? ` ${entry.operation}` : '';
      const duration = entry.duration ? ` (${entry.duration}ms)` : '';

      logMethod(
        `${timestamp} [${entry.level.toUpperCase()}]${correlation}${component}${operation}${duration}: ${entry.message}`
      );

      if (entry.metadata) {
        logMethod('Metadata:', entry.metadata);
      }

      if (entry.error && entry.error.stack) {
        logMethod(entry.error.stack);
      }
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, error, metadata);
    this.output(entry);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, undefined, metadata);
    this.output(entry);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, undefined, metadata);
    this.output(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, undefined, metadata);
    this.output(entry);
  }

  /**
   * Log operation with timing
   */
  async logOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    const correlationId = this.correlationId || randomUUID();

    this.info(`Starting operation: ${operation}`, {
      ...metadata,
      correlationId,
      operation,
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.info(`Operation completed: ${operation}`, {
        ...metadata,
        correlationId,
        operation,
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.error(`Operation failed: ${operation}`, error as Error, {
        ...metadata,
        correlationId,
        operation,
        duration,
        success: false,
      });

      throw error;
    }
  }

  /**
   * Log API request
   */
  logRequest(
    method: string,
    url: string,
    statusCode?: number,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode && statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `${method} ${url}${statusCode ? ` - ${statusCode}` : ''}`;

    const entry = this.createLogEntry(
      level,
      message,
      undefined,
      {
        ...metadata,
        method,
        url,
        statusCode,
        type: 'api_request',
      },
      'api_request',
      duration
    );

    this.output(entry);
  }

  /**
   * Log database operation
   */
  logDatabase(
    operation: string,
    table: string,
    duration?: number,
    rowsAffected?: number,
    metadata?: Record<string, any>
  ): void {
    const message = `Database ${operation} on ${table}`;

    const entry = this.createLogEntry(
      LogLevel.DEBUG,
      message,
      undefined,
      {
        ...metadata,
        operation,
        table,
        rowsAffected,
        type: 'database',
      },
      'database',
      duration
    );

    this.output(entry);
  }

  /**
   * Log search operation
   */
  logSearch(
    query: string,
    resultsCount: number,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    const message = `Search query executed: "${query}" (${resultsCount} results)`;

    const entry = this.createLogEntry(
      LogLevel.INFO,
      message,
      undefined,
      {
        ...metadata,
        query,
        resultsCount,
        type: 'search',
      },
      'search',
      duration
    );

    this.output(entry);
  }

  /**
   * Log cache operation
   */
  logCache(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
    key: string,
    metadata?: Record<string, any>
  ): void {
    const message = `Cache ${operation}: ${key}`;

    const entry = this.createLogEntry(
      LogLevel.DEBUG,
      message,
      undefined,
      {
        ...metadata,
        operation,
        key,
        type: 'cache',
      },
      'cache'
    );

    this.output(entry);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Component-specific logger instances
 */
export const loggers = {
  server: logger.child('server'),
  database: logger.child('database'),
  search: logger.child('search'),
  cache: logger.child('cache'),
  api: logger.child('api'),
  auth: logger.child('auth'),
  fileSystem: logger.child('filesystem'),
};

/**
 * Request correlation ID middleware helper
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Extract correlation ID from headers
 */
export function extractCorrelationId(
  headers: Record<string, string | string[] | undefined>
): string {
  const correlationHeader = headers['x-correlation-id'] || headers['X-Correlation-ID'];
  if (typeof correlationHeader === 'string') {
    return correlationHeader;
  }
  if (Array.isArray(correlationHeader) && correlationHeader.length > 0) {
    return correlationHeader[0] ?? generateCorrelationId();
  }
  return generateCorrelationId();
}
