/**
 * Compatibility re-export for SimplifiedRevisionManager
 *
 * This file maintains backwards compatibility by re-exporting the new
 * modular RevisionManager component under the old name.
 *
 * @deprecated Use RevisionManager from './revision-manager' instead
 */

import { RevisionManager } from './revision-manager';

export { RevisionManager as SimplifiedRevisionManager };
export default RevisionManager;
