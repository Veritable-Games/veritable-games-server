/**
 * Unified State Management Stores
 *
 * This file exports all Zustand stores that replace the previous Context API implementations.
 *
 * Migration from Context API to Zustand provides:
 * - Better performance with selective re-rendering
 * - Type-safe state management with TypeScript
 * - Persistence and hydration out of the box
 * - Devtools integration
 * - Simplified testing
 * - Reduced boilerplate
 */

// Export all stores
export { useAuthStore } from './auth';
export { useProjectVersioningStore } from './project-versioning';
export { useAnnotationStore } from './annotation';

// Export types for external use
export type {
  // Auth types
  User,
} from '@/lib/auth/utils';

export type {
  // Project Versioning types
  Revision,
  RevisionAnnotation,
  AnnotationReply,
  CollaborativeSession,
  CollaborativeUser,
  ProjectDiscussion,
  ProjectActivity,
  RevisionFilter,
  RevisionComparison,
} from './project-versioning';

export type {
  // Annotation types
  AnnotationPosition,
  Annotation,
  AnnotationReaction,
  AnnotationAttachment,
  AnnotationThread,
  AnnotationFilter,
  AnnotationStats,
} from './annotation';

// Store initialization and hydration utilities
export const initializeStores = () => {
  // Stores are automatically initialized when first accessed due to Zustand's lazy initialization
  // This function can be used to force initialization if needed
  // The stores will initialize automatically when imported and first accessed
  // This is more efficient than the Context API which always renders providers
};

// Development utilities
export const getStoreSnapshot = () => {
  if (process.env.NODE_ENV === 'development') {
    // Import stores dynamically to avoid issues during build
    const authStore = require('./auth').useAuthStore;
    const projectVersioningStore = require('./project-versioning').useProjectVersioningStore;
    const annotationStore = require('./annotation').useAnnotationStore;

    return {
      auth: authStore.getState(),
      projectVersioning: projectVersioningStore.getState(),
      annotation: annotationStore.getState(),
    };
  }
  return null;
};
