/**
 * Journals Store Exports
 *
 * Provides a central export point for all journal stores and types.
 * Import individual stores or types as needed:
 *
 * @example
 * import { useJournalsData } from '@/stores/journals';
 * import type { JournalNode } from '@/stores/journals';
 */

// Export all stores
export { useJournalsData } from './useJournalsData';
export { useJournalsUI } from './useJournalsUI';
export { useJournalsSearch } from './useJournalsSearch';
export { useJournalsSelection } from './useJournalsSelection';
export { useJournalsEditor } from './useJournalsEditor';
export { useJournalsHistory } from './useJournalsHistory';

// Export all types
export type { JournalNode, JournalCategory, JournalSearchResult, HistoryAction } from './types';
