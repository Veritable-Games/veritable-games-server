/**
 * Messaging Database Access - PostgreSQL Only
 *
 * All messaging data is now in PostgreSQL messaging schema.
 */

import { dbAdapter } from '../database/adapter';

/**
 * Get messaging database connection
 * @deprecated Use dbAdapter.query() directly with { schema: 'messaging' }
 */
export function getMessagingDatabase() {
  throw new Error(
    'getMessagingDatabase() is deprecated. ' +
      'Use dbAdapter.query() with { schema: "messaging" } for messaging data.'
  );
}

/**
 * Helper to query messaging schema
 */
export async function queryMessaging<T = any>(sql: string, params: any[] = []) {
  return dbAdapter.query<T>(sql, params, { schema: 'messaging' });
}
