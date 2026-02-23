/**
 * Journal Utilities
 * Helper functions for journal operations including soft delete filtering
 */

/**
 * SQL condition to filter out soft-deleted journals
 * Handles both FALSE and NULL values (NULL means not deleted)
 */
export const ACTIVE_JOURNAL_FILTER = '(is_deleted = FALSE OR is_deleted IS NULL)';

/**
 * Add active journal filter to an existing SQL query
 * Intelligently adds to WHERE clause or creates new one
 *
 * @param baseQuery - The SQL query to enhance
 * @returns Modified query with soft delete filter
 *
 * @example
 * ```typescript
 * const query = "SELECT * FROM wiki_pages WHERE namespace = 'journals'";
 * const filtered = addActiveFilter(query);
 * // Result: "SELECT * FROM wiki_pages WHERE (is_deleted = FALSE OR is_deleted IS NULL) AND namespace = 'journals'"
 * ```
 */
export function addActiveFilter(baseQuery: string): string {
  if (baseQuery.toUpperCase().includes('WHERE')) {
    return baseQuery.replace(/WHERE/i, `WHERE ${ACTIVE_JOURNAL_FILTER} AND`);
  }
  return `${baseQuery} WHERE ${ACTIVE_JOURNAL_FILTER}`;
}

/**
 * SQL condition to filter FOR soft-deleted journals (opposite of ACTIVE_JOURNAL_FILTER)
 * Used for recovery/trash views
 */
export const DELETED_JOURNAL_FILTER = 'is_deleted = TRUE';
