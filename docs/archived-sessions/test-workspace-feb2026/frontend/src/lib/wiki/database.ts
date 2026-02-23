/**
 * Wiki Database Access - PostgreSQL Only
 *
 * All wiki data is now in PostgreSQL wiki schema.
 * Schema creation is handled by migrations, not runtime code.
 */

import { dbAdapter } from '../database/adapter';
import { logger } from '@/lib/utils/logger';

/**
 * Get wiki database connection
 * @deprecated Use dbAdapter.query() directly with { schema: 'wiki' }
 */
export function getWikiDatabase() {
  throw new Error(
    'getWikiDatabase() is deprecated. ' +
      'Use dbAdapter.query() with { schema: "wiki" } for wiki data. ' +
      'Schema is managed by PostgreSQL migrations, not runtime code.'
  );
}

/**
 * Initialize wiki database schema
 * @deprecated PostgreSQL schemas are managed by migrations
 */
export function initializeWikiDatabase() {
  // No-op: PostgreSQL schemas are managed by migrations
  logger.error('[Wiki] Schema managed by PostgreSQL migrations');
}

/**
 * Close wiki database
 * @deprecated Connection pooling handles cleanup
 */
export function closeWikiDatabase(): void {
  // No-op: Connection pooling handles cleanup
}

/**
 * Helper to query wiki schema
 */
export async function queryWiki<T = any>(sql: string, params: any[] = []) {
  return dbAdapter.query<T>(sql, params, { schema: 'wiki' });
}
