/**
 * Revision Manager - Modular revision comparison system
 *
 * Main export for the revision manager component and related types.
 */

export { RevisionManager } from './RevisionManager';
export { RevisionListPanel } from './RevisionListPanel';
export { EditorPanel } from './EditorPanel';
export { ComparisonHeader } from './ComparisonHeader';

// Hooks
export { useRevisionData } from './hooks/useRevisionData';
export { useFullscreenManager } from './useFullscreenManager';
export { useSyncScrolling } from './useSyncScrolling';
export { useRevisionActions } from './useRevisionActions';

// Types
export type { Revision } from './hooks/useRevisionData';
