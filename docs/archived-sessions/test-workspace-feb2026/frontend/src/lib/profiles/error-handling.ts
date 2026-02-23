/**
 * Profile Aggregation Error Handling
 *
 * This module provides specialized error handling, type guards, and utilities
 * for the ProfileAggregatorService system. It includes error classification,
 * retry logic, and comprehensive error reporting.
 *
 * Key Features:
 * - Type-safe error handling with Result types
 * - Error classification and severity levels
 * - Retry logic with exponential backoff
 * - Error aggregation and reporting
 * - Circuit breaker integration
 * - Logging and monitoring hooks
 */

import {
  ServiceError,
  AggregationError,
  ServiceType,
  UserId,
  ValidationError,
  ProfileTypeGuards,
  ProfileValidationSchemas,
  HealthStatus,
  CircuitBreakerError,
  PartialAggregationError,
  CacheError,
  ConfigurationError,
  DatabaseConnectionError,
  QueryExecutionError,
  PermissionDeniedError,
  UserNotFoundError,
  ServiceUnavailableError,
} from '@/types/profile-aggregation';
import { Result, Ok, Err } from '@/lib/utils/result';

/**
 * Error severity levels for monitoring and alerting
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error context for better debugging and monitoring
 */
export interface ErrorContext {
  userId?: UserId;
  service?: ServiceType;
  operation?: string;
  timestamp: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Enhanced error with context and metadata
 */
export interface EnhancedError {
  error: ServiceError | AggregationError | ValidationError;
  severity: ErrorSeverity;
  context: ErrorContext;
  retryable: boolean;
  retryAfter?: number;
  suggestedAction?: string;
}

/**
 * Error classification utility
 */
export class ErrorClassifier {
  /**
   * Classify error severity based on type and context
   */
  static classifyError(error: ServiceError | AggregationError | ValidationError): ErrorSeverity {
    switch (error.type) {
      // Critical errors - require immediate attention
      case 'database_connection':
        return ErrorSeverity.CRITICAL;

      case 'configuration_error':
        return ErrorSeverity.CRITICAL;

      // High severity - affects functionality
      case 'service_unavailable':
        return ErrorSeverity.HIGH;

      case 'partial_aggregation':
        const partialError = error as PartialAggregationError;
        // If core services fail, it's high severity
        if (partialError.failedServices.has('profile')) {
          return ErrorSeverity.HIGH;
        }
        return ErrorSeverity.MEDIUM;

      // Medium severity - impacts performance or features
      case 'circuit_breaker':
        return ErrorSeverity.MEDIUM;

      case 'cache_error':
        return ErrorSeverity.MEDIUM;

      case 'query_execution':
        return ErrorSeverity.MEDIUM;

      // Low severity - user errors or expected failures
      case 'permission_denied':
        return ErrorSeverity.LOW;

      case 'user_not_found':
        return ErrorSeverity.LOW;

      case 'validation_error':
        return ErrorSeverity.LOW;

      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Determine if error is retryable
   */
  static isRetryable(error: ServiceError | AggregationError): boolean {
    // Check explicit retryable field
    if ('retryable' in error && typeof error.retryable === 'boolean') {
      return error.retryable;
    }

    // Default retryability based on error type
    const retryableTypes = [
      'database_connection',
      'service_unavailable',
      'query_execution',
      'cache_error',
      'circuit_breaker',
      'partial_aggregation',
    ];

    const nonRetryableTypes = [
      'permission_denied',
      'user_not_found',
      'configuration_error',
      'validation_error',
    ];

    if (retryableTypes.includes(error.type)) {
      return true;
    }

    if (nonRetryableTypes.includes(error.type)) {
      return false;
    }

    return false;
  }

  /**
   * Get suggested action for error
   */
  static getSuggestedAction(error: ServiceError | AggregationError | ValidationError): string {
    switch (error.type) {
      case 'database_connection':
        return 'Check database connectivity and connection pool status';

      case 'service_unavailable':
        return 'Check service health and restart if necessary';

      case 'circuit_breaker':
        return 'Wait for circuit breaker to reset or check service health';

      case 'permission_denied':
        return 'Verify user permissions and authentication status';

      case 'user_not_found':
        return 'Verify user ID exists and is active';

      case 'validation_error':
        return 'Check input data format and requirements';

      case 'cache_error':
        return 'Check cache service health or disable caching temporarily';

      case 'configuration_error':
        return 'Review service configuration and environment variables';

      case 'partial_aggregation':
        return 'Check failed services and retry with fallback data';

      case 'query_execution':
        return 'Review query parameters and database schema';

      default:
        return 'Check service logs and monitoring for more details';
    }
  }
}

/**
 * Enhanced error factory for creating rich error objects
 */
export class ProfileErrorFactory {
  /**
   * Create enhanced error with context and metadata
   */
  static createEnhancedError(
    error: ServiceError | AggregationError | ValidationError,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const severity = ErrorClassifier.classifyError(error);
    // isRetryable only accepts ServiceError | AggregationError, not ValidationError
    const retryable =
      error.type !== 'validation_error' ? ErrorClassifier.isRetryable(error) : false;
    const suggestedAction = ErrorClassifier.getSuggestedAction(error);

    const fullContext: ErrorContext = {
      timestamp: new Date().toISOString(),
      correlationId: this.generateCorrelationId(),
      ...context,
    };

    return {
      error,
      severity,
      context: fullContext,
      retryable,
      retryAfter: this.getRetryAfter(error),
      suggestedAction,
    };
  }

  /**
   * Create database connection error
   */
  static createDatabaseError(
    service: ServiceType,
    message: string,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const error: DatabaseConnectionError = {
      type: 'database_connection',
      service,
      message,
      retryable: true,
    };

    return this.createEnhancedError(error, context);
  }

  /**
   * Create query execution error
   */
  static createQueryError(
    service: ServiceType,
    query: string,
    message: string,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const error: QueryExecutionError = {
      type: 'query_execution',
      service,
      query,
      message,
      retryable: true,
    };

    return this.createEnhancedError(error, { ...context, operation: query });
  }

  /**
   * Create permission denied error
   */
  static createPermissionError(
    service: ServiceType,
    requiredPermission: string,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const error: PermissionDeniedError = {
      type: 'permission_denied',
      service,
      requiredPermission,
      message: `Permission denied: ${requiredPermission}`,
      retryable: false,
    };

    return this.createEnhancedError(error, context);
  }

  /**
   * Create user not found error
   */
  static createUserNotFoundError(
    service: ServiceType,
    userId: UserId,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const error: UserNotFoundError = {
      type: 'user_not_found',
      service,
      userId,
      message: `User not found: ${userId}`,
      retryable: false,
    };

    return this.createEnhancedError(error, { ...context, userId });
  }

  /**
   * Create validation error
   */
  static createValidationError(
    field: string,
    message: string,
    value: unknown,
    context: Partial<ErrorContext> = {}
  ): EnhancedError {
    const error: ValidationError = {
      type: 'validation_error',
      field,
      message,
      value,
    };

    return this.createEnhancedError(error, context);
  }

  private static generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private static getRetryAfter(
    error: ServiceError | AggregationError | ValidationError
  ): number | undefined {
    if (error.type === 'circuit_breaker') {
      return (error as CircuitBreakerError).retryAfter;
    }

    if (error.type === 'service_unavailable') {
      return (error as ServiceUnavailableError).retryAfter;
    }

    return undefined;
  }
}

/**
 * Retry logic with exponential backoff
 */
export class RetryHandler {
  private readonly maxAttempts: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly backoffMultiplier: number;
  private readonly jitter: boolean;

  constructor(
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true
  ) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.backoffMultiplier = backoffMultiplier;
    this.jitter = jitter;
  }

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<Result<T, ServiceError | AggregationError>>,
    context: Partial<ErrorContext> = {}
  ): Promise<Result<T, EnhancedError>> {
    let lastError: ServiceError | AggregationError | null = null;
    let attempt = 0;

    while (attempt < this.maxAttempts) {
      attempt++;

      try {
        const result = await operation();

        if (result.isOk()) {
          return Ok(result.value);
        }

        lastError = result.error;

        // Check if error is retryable
        if (!ErrorClassifier.isRetryable(lastError)) {
          break;
        }

        // Don't retry on last attempt
        if (attempt === this.maxAttempts) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      } catch (error) {
        const serviceError: ServiceUnavailableError = {
          type: 'service_unavailable',
          service: 'profile',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        };

        lastError = serviceError;

        if (attempt === this.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    // Create enhanced error from last error
    const enhancedError = ProfileErrorFactory.createEnhancedError(lastError!, {
      ...context,
      additionalData: {
        attempts: attempt,
        maxAttempts: this.maxAttempts,
      },
    });

    return Err(enhancedError);
  }

  private calculateDelay(attempt: number): number {
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.maxDelay);

    if (this.jitter) {
      // Add random jitter (±20%)
      const jitterAmount = delay * 0.2;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(delay, 0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Error aggregation for collecting multiple errors
 */
export class ErrorAggregator {
  private errors: EnhancedError[] = [];

  /**
   * Add error to aggregation
   */
  add(error: EnhancedError): void {
    this.errors.push(error);
  }

  /**
   * Add service error with context
   */
  addServiceError(
    error: ServiceError | AggregationError | ValidationError,
    context: Partial<ErrorContext> = {}
  ): void {
    const enhancedError = ProfileErrorFactory.createEnhancedError(error, context);
    this.add(enhancedError);
  }

  /**
   * Check if any errors have been collected
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get all collected errors
   */
  getErrors(): readonly EnhancedError[] {
    return [...this.errors];
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): readonly EnhancedError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Get highest severity level
   */
  getHighestSeverity(): ErrorSeverity | null {
    if (this.errors.length === 0) return null;

    const severityOrder = [
      ErrorSeverity.LOW,
      ErrorSeverity.MEDIUM,
      ErrorSeverity.HIGH,
      ErrorSeverity.CRITICAL,
    ];

    for (let i = severityOrder.length - 1; i >= 0; i--) {
      const severity = severityOrder[i];
      if (severity && this.errors.some(error => error.severity === severity)) {
        return severity;
      }
    }

    return null;
  }

  /**
   * Create summary of all errors
   */
  createSummary(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    errorsByService: Record<ServiceType, number>;
    retryableErrors: number;
    criticalErrors: number;
  } {
    const summary = {
      totalErrors: this.errors.length,
      errorsByType: {} as Record<string, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByService: {} as Record<ServiceType, number>,
      retryableErrors: 0,
      criticalErrors: 0,
    };

    for (const error of this.errors) {
      // Count by type
      summary.errorsByType[error.error.type] = (summary.errorsByType[error.error.type] || 0) + 1;

      // Count by severity
      summary.errorsBySeverity[error.severity] =
        (summary.errorsBySeverity[error.severity] || 0) + 1;

      // Count by service
      if ('service' in error.error) {
        const service = error.error.service;
        summary.errorsByService[service] = (summary.errorsByService[service] || 0) + 1;
      }

      // Count retryable and critical errors
      if (error.retryable) {
        summary.retryableErrors++;
      }

      if (error.severity === ErrorSeverity.CRITICAL) {
        summary.criticalErrors++;
      }
    }

    return summary;
  }

  /**
   * Clear all collected errors
   */
  clear(): void {
    this.errors = [];
  }
}

/**
 * Minimal interfaces for type guard checks
 * Using Record allows property access while maintaining type safety
 */
type UnknownProfile = Record<string, unknown>;
type UnknownError = Record<string, unknown>;

/**
 * Type guards implementation
 */
export const profileTypeGuards: ProfileTypeGuards = {
  isUserId(value: unknown): value is UserId {
    return typeof value === 'number' && value > 0 && Number.isInteger(value);
  },

  isServiceType(value: unknown): value is ServiceType {
    return typeof value === 'string' && ['profile', 'forum', 'wiki', 'messaging'].includes(value);
  },

  isVisibilityLevel(value: unknown): value is any {
    return typeof value === 'string' && ['public', 'members', 'private'].includes(value);
  },

  isHealthStatus(value: unknown): value is HealthStatus {
    return (
      typeof value === 'string' && ['healthy', 'degraded', 'unhealthy', 'unknown'].includes(value)
    );
  },

  isValidProfile(value: unknown): value is any {
    if (!value || typeof value !== 'object') return false;

    const profile = value as UnknownProfile;
    return (
      !!profile.core &&
      !!profile.stats &&
      !!profile.activities &&
      !!profile.privacy &&
      typeof profile.aggregatedAt === 'string'
    );
  },

  isServiceError(value: unknown): value is ServiceError {
    if (!value || typeof value !== 'object') return false;

    const error = value as UnknownError;
    return (
      typeof error.type === 'string' &&
      [
        'database_connection',
        'query_execution',
        'permission_denied',
        'user_not_found',
        'service_unavailable',
      ].includes(error.type) &&
      typeof error.message === 'string'
    );
  },

  isAggregationError(value: unknown): value is AggregationError {
    if (!value || typeof value !== 'object') return false;

    const error = value as UnknownError;
    return (
      typeof error.type === 'string' &&
      ['partial_aggregation', 'cache_error', 'configuration_error', 'circuit_breaker'].includes(
        error.type
      ) &&
      typeof error.message === 'string'
    );
  },
};

/**
 * Validation schemas implementation
 */
export const profileValidationSchemas = {
  userIdSchema: (value: unknown): Result<UserId, ValidationError> => {
    if (!profileTypeGuards.isUserId(value)) {
      return Err({
        type: 'validation_error' as const,
        field: 'userId',
        message: 'User ID must be a positive integer',
        value,
      } as ValidationError);
    }
    return Ok(value);
  },

  privacySettingsSchema: (value: unknown): Result<any, ValidationError> => {
    if (!value || typeof value !== 'object') {
      return Err({
        type: 'validation_error' as const,
        field: 'privacySettings',
        message: 'Privacy settings must be an object',
        value,
      } as ValidationError);
    }

    // Additional validation would go here
    return Ok(value);
  },

  configSchema: (value: unknown): Result<any, ValidationError> => {
    if (!value || typeof value !== 'object') {
      return Err({
        type: 'validation_error' as const,
        field: 'config',
        message: 'Configuration must be an object',
        value,
      } as ValidationError);
    }

    // Additional validation would go here
    return Ok(value);
  },
} as const;

/**
 * Utility functions for error handling
 */
export const errorUtils = {
  /**
   * Check if error indicates temporary failure
   */
  isTemporaryFailure(error: ServiceError | AggregationError): boolean {
    return ['database_connection', 'service_unavailable', 'circuit_breaker'].includes(error.type);
  },

  /**
   * Check if error requires immediate attention
   */
  isCriticalError(error: ServiceError | AggregationError): boolean {
    return ErrorClassifier.classifyError(error) === ErrorSeverity.CRITICAL;
  },

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: ServiceError | AggregationError | ValidationError): string {
    switch (error.type) {
      case 'user_not_found':
        return 'The requested user profile could not be found.';

      case 'permission_denied':
        return 'You do not have permission to view this profile.';

      case 'service_unavailable':
        return 'The service is temporarily unavailable. Please try again later.';

      case 'partial_aggregation':
        return 'Some profile information is temporarily unavailable.';

      case 'validation_error':
        return 'Invalid input provided. Please check your request.';

      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  },

  /**
   * Format error for logging
   */
  formatForLogging(error: EnhancedError): string {
    return JSON.stringify(
      {
        type: error.error.type,
        severity: error.severity,
        message: error.error.message,
        context: error.context,
        retryable: error.retryable,
        suggestedAction: error.suggestedAction,
      },
      null,
      2
    );
  },
};
