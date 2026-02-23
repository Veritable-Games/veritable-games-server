/**
 * SQLite Requirement Guard
 *
 * Prevents SQLite usage in production environments.
 * Allows SQLite only in development/testing contexts.
 *
 * Usage:
 * ```typescript
 * import { requireSQLite } from '@/lib/utils/require-sqlite';
 * requireSQLite('my-script');
 * // If in production without SQLite enabled, throws error
 * ```
 */

/**
 * Check if running in a development/testing context where SQLite is allowed
 */
function isDevEnvironment(): boolean {
  // Allow in development mode
  if (process.env.NODE_ENV === 'development') return true;

  // Allow in test environment with USE_REAL_DB flag
  if (process.env.NODE_ENV === 'test' && process.env.USE_REAL_DB === 'true') return true;

  // Allow in local/localhost contexts
  if (process.env.LOCALHOST === 'true') return true;

  // Allow during npm scripts marked as development
  const devScripts = [
    'dev',
    'test',
    'db:health',
    'db:backup',
    'workspace:check',
    'generate:sample',
  ];
  if (devScripts.some(script => process.env.npm_lifecycle_event?.includes(script))) return true;

  return false;
}

/**
 * Require SQLite functionality - fail loudly in production
 *
 * @param componentName - Name of component requiring SQLite (for error message)
 * @throws Error if SQLite is not available in this environment
 */
export function requireSQLite(componentName: string): void {
  if (isDevEnvironment()) {
    return; // SQLite allowed in development
  }

  // Production/staging environment detected
  const environment = process.env.NODE_ENV || 'unknown';
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  throw new Error(
    `[FATAL] SQLite Required in Production Environment\n` +
      `\n` +
      `Component: ${componentName}\n` +
      `Environment: ${environment}\n` +
      `\n` +
      `SQLite is NOT supported in production. This component must not be used in production environments.\n` +
      `\n` +
      `PRODUCTION DATABASE CONFIGURATION:\n` +
      `  - Database Engine: PostgreSQL 15 (REQUIRED)\n` +
      `  - Configuration: POSTGRES_URL or DATABASE_URL environment variable\n` +
      `  - Status: ${postgresUrl ? '✓ Configured' : '✗ MISSING - FATAL ERROR'}\n` +
      `\n` +
      `DEVELOPMENT DATABASE CONFIGURATION:\n` +
      `  - Database Engine: SQLite 3 (file-based)\n` +
      `  - Location: frontend/data/*.db\n` +
      `  - Use: localhost:3000 development only\n` +
      `\n` +
      `ACTION REQUIRED:\n` +
      `  1. Do NOT use SQLite components in production\n` +
      `  2. Use PostgreSQL equivalents instead\n` +
      `  3. Verify POSTGRES_URL is set in production environment\n` +
      `  4. See docs/DATABASE.md for migration details\n`
  );
}

/**
 * Assert that a database operation is safe for the current environment
 * Used in development-only utilities to prevent accidental production usage
 *
 * @param operation - Description of the operation (for error message)
 * @throws Error if running in production
 */
export function assertDevEnvironment(operation: string): void {
  if (!isDevEnvironment()) {
    const environment = process.env.NODE_ENV || 'unknown';
    throw new Error(
      `[FATAL] Development-Only Operation in Production\n` +
        `\n` +
        `Operation: ${operation}\n` +
        `Environment: ${environment}\n` +
        `\n` +
        `This operation is only available in development/testing environments.\n` +
        `Production deployments must use PostgreSQL-compatible operations.\n` +
        `\n` +
        `See docs/guides/COMMANDS_REFERENCE.md for production-safe operations.\n`
    );
  }
}

export default {
  requireSQLite,
  assertDevEnvironment,
};
