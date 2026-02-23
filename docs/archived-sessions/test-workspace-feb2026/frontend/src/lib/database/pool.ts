/**
 * Database Pool Export
 *
 * Re-exports PostgreSQL pool instance as dbPool for backward compatibility
 * and to match the interface expected by tests and legacy code.
 *
 * ⚠️ DEPRECATION NOTICE:
 * - dbPool is DEPRECATED - use dbAdapter instead for all new code
 * - pgPool is DEPRECATED - use dbAdapter instead for all new code
 * - These exports exist ONLY for backward compatibility with tests and legacy code
 * - See docs/architecture/CRITICAL_PATTERNS.md for the correct pattern
 *
 * ✅ CORRECT (use this):
 *   import { dbAdapter } from '@/lib/database/adapter';
 *   const result = await dbAdapter.query(sql, params, { schema: 'users' });
 *
 * ❌ WRONG (do not use):
 *   import { dbPool } from '@/lib/database/pool';
 *   import { pgPool } from '@/lib/database/pool-postgres';
 */

import { pgPool } from './pool-postgres';

// Export as both pgPool (new) and dbPool (legacy/tests)
// DEPRECATED: Use dbAdapter instead
export { pgPool };
/** @deprecated Use dbAdapter from '@/lib/database/adapter' instead */
export const dbPool = pgPool;

// Re-export types, interfaces, and functions
export type { DatabaseSchema, PostgresQueryResult } from './pool-postgres';
export { query, transaction } from './pool-postgres';
