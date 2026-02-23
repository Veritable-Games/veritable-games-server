/**
 * Serialize Error objects to readable strings
 *
 * JavaScript Error objects serialize to empty objects {} in JSON.stringify()
 * This utility extracts the useful error information for logging and debugging.
 */

export interface SerializedError {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  severity?: string;
  file?: string;
  line?: string;
  routine?: string;
  stack?: string;
}

/**
 * PostgreSQL error with additional fields
 */
interface PostgreSQLError extends Error {
  code?: string;
  detail?: string;
  hint?: string;
  severity?: string;
  file?: string;
  line?: string;
  routine?: string;
}

/**
 * Generic error-like object
 */
interface ErrorLikeObject {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
}

/**
 * Convert an unknown error to a readable string
 */
export function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

/**
 * Convert an error to a detailed object for logging
 * Filters out undefined values to prevent {} serialization
 */
export function serializeErrorDetail(error: unknown): SerializedError {
  if (error instanceof Error) {
    const pgError = error as PostgreSQLError;
    const raw = {
      message: error.message,
      code: pgError.code,
      detail: pgError.detail,
      hint: pgError.hint,
      severity: pgError.severity,
      file: pgError.file,
      line: pgError.line,
      routine: pgError.routine,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };

    // Filter out undefined values to prevent {} serialization
    return Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined)
    ) as unknown as SerializedError;
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as ErrorLikeObject;
    const raw = {
      message: obj.message || String(error),
      code: obj.code,
      detail: obj.detail,
      hint: obj.hint,
    };

    // Filter out undefined values
    return Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined)
    ) as unknown as SerializedError;
  }

  return {
    message: String(error),
  };
}
