/**
 * MCP Router Logger Utility
 *
 * Structured logging for the MCP router with support for:
 * - JSON formatting for production
 * - Text formatting for development
 * - Context metadata (component, versionId, instanceId, etc.)
 * - Log level filtering
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  versionId?: number;
  instanceId?: string;
  [key: string]: any;
}

class MCPLogger {
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  private useJson = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';

  private shouldLog(level: LogLevel): boolean {
    if (level === 'error') return true;
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  private formatJson(level: LogLevel, message: string, context?: LogContext, error?: any): string {
    const entry: any = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      environment: process.env.NODE_ENV || 'development',
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return JSON.stringify(entry);
  }

  private formatText(level: LogLevel, message: string, context?: LogContext, error?: any): string {
    const timestamp = new Date().toISOString();
    const levelTag = level.toUpperCase().padEnd(5);
    let output = `[${timestamp}] [${levelTag}] ${message}`;

    if (context?.component) {
      output += ` [${context.component}]`;
    }

    if (context && Object.keys(context).length > 0) {
      const contextKeys = Object.keys(context).filter(k => !['component'].includes(k));
      if (contextKeys.length > 0) {
        output += ' ' + JSON.stringify(context);
      }
    }

    if (error) {
      output += `\n  Error: ${error.message}`;
      if (process.env.NODE_ENV === 'development' && error.stack) {
        output += `\n  Stack: ${error.stack}`;
      }
    }

    return output;
  }

  private log(level: LogLevel, message: string, context?: LogContext | any, error?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const output = this.useJson
      ? this.formatJson(level, message, context, error)
      : this.formatText(level, message, context, error);

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

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const actualError = error instanceof Error || (error && error.message) ? error : undefined;
    const actualContext =
      actualError === undefined && error && typeof error === 'object' ? error : context;
    this.log('error', message, actualContext, actualError);
  }
}

export const logger = new MCPLogger();
