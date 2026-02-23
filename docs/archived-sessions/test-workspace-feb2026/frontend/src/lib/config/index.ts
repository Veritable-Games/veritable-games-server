/**
 * Centralized Configuration Management
 *
 * Validates all environment variables at startup using Zod schemas.
 * Provides structured access to configuration with type safety.
 *
 * Fails fast if required environment variables are missing or invalid.
 */

import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

/**
 * Environment variable schema definitions
 */
const EnvSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database configuration
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  POSTGRES_URL: z.string().url('POSTGRES_URL must be a valid URL').optional(),

  // API configuration
  API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL'),

  // Godot projects path
  GODOT_PROJECTS_PATH: z.string().default('/app/godot-projects'),

  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('text'),

  // MCP (Model Context Protocol) configuration
  MCP_IDLE_TIMEOUT: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, 'MCP_IDLE_TIMEOUT must be positive')
    .default(1800000), // 30 minutes default

  MCP_INSTANCE_MODE: z.enum(['true', 'false']).optional(),

  // Metrics configuration
  ENABLE_METRICS: z.enum(['true', 'false']).default('true'),

  // Alerting configuration
  ALERTING_ENABLED: z.enum(['true', 'false']).default('false'),
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // Optional feature flags
  FEATURE_DEBUG_TOOLS: z.enum(['true', 'false']).default('false'),
});

/**
 * Parsed configuration type
 */
type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Configuration section interfaces
 */
export interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  database: {
    url: string;
    postgresUrl?: string;
  };
  api: {
    baseUrl: string;
  };
  godot: {
    projectsPath: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
  mcp: {
    idleTimeoutMs: number;
    instanceMode: boolean;
  };
  metrics: {
    enabled: boolean;
  };
  alerting: {
    enabled: boolean;
    slackWebhookUrl?: string;
  };
  features: {
    debugTools: boolean;
  };
}

/**
 * Parse and validate environment variables
 * Called at startup - fails fast if config is invalid
 *
 * CRITICAL: Build-phase detection MUST be checked FIRST before any validation.
 * During Docker builds, Turbopack imports modules for page data collection,
 * but environment variables like DATABASE_URL are not available. Throwing here
 * would fail the build before any other code (including NEXT_IS_BUILD checks
 * in adapter.ts) can run.
 */
function parseEnv(): Config {
  // Build phase detection - check FIRST before any validation
  // This must happen here because this module is imported before adapter.ts
  // can check its own NEXT_IS_BUILD variable
  const isBuildPhase =
    process.env.NEXT_IS_BUILD === 'true' ||
    process.env.NEXT_PHASE?.includes('build') ||
    process.env.__NEXT_BUILDING === 'true';

  // During build phase, return safe defaults without validation
  // This allows Turbopack page data collection to succeed
  if (isBuildPhase) {
    logger.info('[Config] Build phase detected, using safe defaults');
    return {
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'production',
      database: {
        url: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
        postgresUrl: undefined,
      },
      api: {
        baseUrl: 'http://localhost:3000',
      },
      godot: {
        projectsPath: process.env.GODOT_PROJECTS_PATH || '/app/godot-projects',
      },
      logging: {
        level: 'info',
        format: 'text',
      },
      mcp: {
        idleTimeoutMs: 1800000,
        instanceMode: false,
      },
      metrics: {
        enabled: false,
      },
      alerting: {
        enabled: false,
        slackWebhookUrl: undefined,
      },
      features: {
        debugTools: false,
      },
    };
  }

  // Runtime validation - strict mode (only at runtime, not during build)
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');

    logger.error('Configuration validation failed:\n' + errors);
    throw new Error('Invalid configuration: see errors above');
  }

  const env = result.data;

  return {
    nodeEnv: env.NODE_ENV,
    database: {
      url: env.DATABASE_URL,
      postgresUrl: env.POSTGRES_URL,
    },
    api: {
      baseUrl: env.API_BASE_URL,
    },
    godot: {
      projectsPath: env.GODOT_PROJECTS_PATH,
    },
    logging: {
      level: env.LOG_LEVEL,
      format: env.LOG_FORMAT,
    },
    mcp: {
      idleTimeoutMs: env.MCP_IDLE_TIMEOUT,
      instanceMode: env.MCP_INSTANCE_MODE === 'true',
    },
    metrics: {
      enabled: env.ENABLE_METRICS === 'true',
    },
    alerting: {
      enabled: env.ALERTING_ENABLED === 'true',
      slackWebhookUrl: env.SLACK_WEBHOOK_URL,
    },
    features: {
      debugTools: env.FEATURE_DEBUG_TOOLS === 'true',
    },
  };
}

/**
 * Global configuration instance
 * Validated and parsed at module load time
 */
export const config: Config = parseEnv();

/**
 * Validate configuration is correct
 * Call this at application startup to ensure all required config is present
 */
export function validateConfig(): void {
  // Validate critical configuration
  if (!config.database.url && !config.database.postgresUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL must be set');
  }

  if (!config.api.baseUrl) {
    throw new Error('API_BASE_URL must be set');
  }

  if (config.alerting.enabled && !config.alerting.slackWebhookUrl) {
    throw new Error('ALERTING_ENABLED=true requires SLACK_WEBHOOK_URL');
  }

  logger.info('[Config] Configuration validated successfully');
}

/**
 * Get configuration (read-only)
 */
export function getConfig(): Readonly<Config> {
  return Object.freeze(config);
}

/**
 * Check if in production mode
 */
export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

/**
 * Check if in development mode
 */
export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}

/**
 * Check if in test mode
 */
export function isTest(): boolean {
  return config.nodeEnv === 'test';
}

/**
 * Check if JSON logging is enabled
 */
export function useJsonLogging(): boolean {
  return config.logging.format === 'json' || isProduction();
}

/**
 * Check if metrics are enabled
 */
export function metricsEnabled(): boolean {
  return config.metrics.enabled;
}

/**
 * Check if alerting is enabled
 */
export function alertingEnabled(): boolean {
  return config.alerting.enabled;
}
