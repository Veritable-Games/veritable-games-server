/**
 * PostgreSQL Requirement Guard
 *
 * Ensures PostgreSQL is properly configured and available.
 * Used to validate production database setup.
 *
 * Usage:
 * ```typescript
 * import { requirePostgres } from '@/lib/utils/require-postgres';
 * requirePostgres();
 * // If PostgreSQL not configured, throws detailed error
 * ```
 */

/**
 * Check if PostgreSQL is properly configured
 */
function isPostgresConfigured(): boolean {
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  return !!postgresUrl && postgresUrl.startsWith('postgresql://');
}

/**
 * Require PostgreSQL to be configured - fail loudly if missing
 *
 * @param context - Where this requirement is being enforced (for error message)
 * @throws Error if PostgreSQL is not properly configured
 */
export function requirePostgres(context: string = 'Database operation'): void {
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!postgresUrl) {
    throw new Error(
      `[FATAL] PostgreSQL Configuration Missing\n` +
        `\n` +
        `Context: ${context}\n` +
        `Environment: ${process.env.NODE_ENV || 'unknown'}\n` +
        `\n` +
        `PostgreSQL is REQUIRED for this operation. Database URL is not configured.\n` +
        `\n` +
        `CONFIGURATION REQUIRED:\n` +
        `  Option 1: Set POSTGRES_URL environment variable\n` +
        `    Example: postgresql://user:password@host:5432/database\n` +
        `\n` +
        `  Option 2: Set DATABASE_URL environment variable\n` +
        `    Example: postgresql://user:password@host:5432/database\n` +
        `\n` +
        `ENVIRONMENT SETUP:\n` +
        `  Development (localhost):\n` +
        `    - POSTGRES_URL=postgresql://test:test@localhost:5432/test_db\n` +
        `    - Or use SQLite (frontend/data/*.db)\n` +
        `\n` +
        `  Production (192.168.1.15):\n` +
        `    - POSTGRES_URL=postgresql://user:password@host:5432/database\n` +
        `    - SQLite NOT supported\n` +
        `\n` +
        `  Staging/Testing:\n` +
        `    - POSTGRES_URL must be set\n` +
        `    - SQLite NOT supported\n` +
        `\n` +
        `TROUBLESHOOTING:\n` +
        `  1. Check .env.local or environment variables\n` +
        `  2. Verify PostgreSQL server is running\n` +
        `  3. Test connection: psql ${postgresUrl || 'YOUR_DATABASE_URL'}\n` +
        `  4. Review docs/DATABASE.md for configuration details\n`
    );
  }

  if (!postgresUrl.startsWith('postgresql://') && !postgresUrl.startsWith('postgres://')) {
    throw new Error(
      `[FATAL] Invalid PostgreSQL Connection String\n` +
        `\n` +
        `Context: ${context}\n` +
        `\n` +
        `Database URL does not start with postgresql:// or postgres://\n` +
        `Received: ${postgresUrl.substring(0, 50)}...\n` +
        `\n` +
        `Valid formats:\n` +
        `  - postgresql://user:password@host:5432/database\n` +
        `  - postgres://user:password@host:5432/database\n` +
        `  - postgresql://user:password@host:5432/database?sslmode=require\n` +
        `\n` +
        `Current value does not match expected pattern.\n` +
        `Please verify POSTGRES_URL or DATABASE_URL is correctly set.\n`
    );
  }
}

/**
 * Assert that PostgreSQL is available and return the connection string
 *
 * @param context - Where this requirement is being enforced
 * @returns The PostgreSQL connection string
 */
export function getPostgresUrl(context: string = 'Database operation'): string {
  requirePostgres(context);
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
}

/**
 * Check if this is a PostgreSQL-enabled environment
 */
export function isPostgresEnvironment(): boolean {
  return isPostgresConfigured();
}

/**
 * Get database configuration summary (for logging/debugging)
 */
export function getDatabaseConfig(): {
  type: 'postgresql' | 'sqlite' | 'unknown';
  configured: boolean;
  environment: string;
  details: string;
} {
  const environment = process.env.NODE_ENV || 'unknown';
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (postgresUrl && postgresUrl.startsWith('postgresql://')) {
    return {
      type: 'postgresql',
      configured: true,
      environment,
      details: `PostgreSQL configured: ${postgresUrl.split('@')[0]}@${postgresUrl.split('@')[1]?.split(':')[0] || 'unknown'}`,
    };
  }

  return {
    type: 'unknown',
    configured: false,
    environment,
    details: 'No PostgreSQL configuration detected, SQLite may be in use',
  };
}

export default {
  requirePostgres,
  getPostgresUrl,
  isPostgresEnvironment,
  getDatabaseConfig,
};
