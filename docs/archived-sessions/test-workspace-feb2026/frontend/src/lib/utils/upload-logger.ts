/**
 * Upload Logger Utility
 *
 * Provides structured logging for upload operations with:
 * - Request ID tracking for tracing uploads through entire flow
 * - Log levels (debug, info, warn, error)
 * - Context tags (upload, transcode, validation, network)
 * - Timestamps in ISO format
 * - Structured data objects for filtering and analysis
 *
 * Replaces emoji-based logging with production-ready structured logs.
 *
 * @example
 * ```typescript
 * const logger = new UploadLogger('video-12345');
 * logger.info('upload', 'Starting upload', {
 *   fileName: 'video.mp4',
 *   fileSize: 1024000
 * });
 * logger.error('network', 'Upload failed', {
 *   status: 500,
 *   error: 'Server error'
 * });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = 'upload' | 'transcode' | 'validation' | 'network' | 'queue' | 'ffmpeg';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: Record<string, any>;
  requestId: string;
  component?: string;
}

export class UploadLogger {
  private requestId: string;
  private component: string;

  /**
   * Create a new logger instance
   * @param fileId - Unique identifier for this upload
   * @param component - Component name (default: 'UploadProcessor')
   */
  constructor(fileId: string, component: string = 'UploadProcessor') {
    this.requestId = `upload-${Date.now()}-${fileId.substring(0, 8)}`;
    this.component = component;
  }

  /**
   * Get the request ID for this upload
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * Log a message with specified level and context
   * @param level - Log severity level
   * @param context - Operational context
   * @param message - Human-readable message
   * @param data - Structured data object
   */
  log(level: LogLevel, context: LogContext, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
      requestId: this.requestId,
      component: this.component,
    };

    // Format prefix for console output
    const prefix = `[${level.toUpperCase()}][${this.component}][${context}][${this.requestId}]`;

    // Route to appropriate console method based on log level
    switch (level) {
      case 'error':
        console.error(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'debug':
        // Only log debug messages in development
        if (process.env.NODE_ENV === 'development') {
          console.debug(prefix, message, data || '');
        }
        break;
      case 'info':
      default:
        console.log(prefix, message, data || '');
    }

    // Future: Send to external logging service (Datadog, CloudWatch, etc.)
    // this.sendToExternalLogger(entry);
  }

  /**
   * Log debug message (development only)
   */
  debug(context: LogContext, message: string, data?: Record<string, any>) {
    this.log('debug', context, message, data);
  }

  /**
   * Log info message
   */
  info(context: LogContext, message: string, data?: Record<string, any>) {
    this.log('info', context, message, data);
  }

  /**
   * Log warning message
   */
  warn(context: LogContext, message: string, data?: Record<string, any>) {
    this.log('warn', context, message, data);
  }

  /**
   * Log error message
   */
  error(context: LogContext, message: string, data?: Record<string, any>) {
    this.log('error', context, message, data);
  }

  /**
   * Log XHR request details
   */
  logXHRStart(url: string, method: string, metadata: Record<string, any> = {}) {
    this.info('network', `Starting ${method} request`, {
      url,
      method,
      ...metadata,
    });
  }

  /**
   * Log XHR response details
   */
  logXHRResponse(status: number, statusText: string, responseData?: any) {
    const level: LogLevel = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    this.log(level, 'network', `HTTP ${status} ${statusText}`, {
      status,
      statusText,
      response: responseData,
    });
  }

  /**
   * Log upload progress
   */
  logProgress(loaded: number, total: number, percentage: number) {
    this.debug('upload', 'Upload progress', {
      loaded,
      total,
      percentage: `${percentage.toFixed(1)}%`,
      remaining: total - loaded,
    });
  }

  /**
   * Log file validation
   */
  logValidation(result: 'accepted' | 'rejected', reason?: string, metadata?: Record<string, any>) {
    const level: LogLevel = result === 'rejected' ? 'warn' : 'info';
    this.log(level, 'validation', `File ${result}`, {
      result,
      reason,
      ...metadata,
    });
  }

  /**
   * Log FFmpeg transcoding operation
   */
  logFFmpeg(
    operation: 'start' | 'progress' | 'complete' | 'error',
    metadata?: Record<string, any>
  ) {
    const level: LogLevel = operation === 'error' ? 'error' : 'info';
    const messages = {
      start: 'Starting FFmpeg transcoding',
      progress: 'FFmpeg transcoding in progress',
      complete: 'FFmpeg transcoding complete',
      error: 'FFmpeg transcoding failed',
    };

    this.log(level, 'ffmpeg', messages[operation], metadata);
  }
}

/**
 * Create a logger instance with file metadata
 * Convenience factory function for common use case
 */
export function createUploadLogger(file: File, component?: string): UploadLogger {
  const fileId = `${file.name}-${file.size}-${Date.now()}`;
  const logger = new UploadLogger(fileId, component);

  logger.debug('upload', 'Logger initialized', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    lastModified: new Date(file.lastModified).toISOString(),
  });

  return logger;
}
