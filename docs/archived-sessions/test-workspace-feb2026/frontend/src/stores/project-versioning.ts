'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useAuthStore } from './auth';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

// ==================== TYPES ====================

export interface Revision {
  id: number;
  content: string;
  summary: string;
  revision_timestamp: string;
  author_name: string;
  author_id: number;
  size: number;
  project_slug: string;
  version_number?: string;
  tags?: string[];
}

export interface RevisionAnnotation {
  id: string;
  revision_id: number;
  line_number: number;
  column_start: number;
  column_end: number;
  content: string;
  author_id: number;
  author_name: string;
  created_at: string;
  updated_at: string;
  replies?: AnnotationReply[];
  resolved: boolean;
  thread_id?: string;
}

export interface AnnotationReply {
  id: string;
  annotation_id: string;
  content: string;
  author_id: number;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export interface CollaborativeSession {
  project_slug: string;
  active_users: CollaborativeUser[];
  revision_viewers: Record<number, CollaborativeUser[]>;
  annotations: Record<number, RevisionAnnotation[]>;
  discussions: ProjectDiscussion[];
  activity_feed: ProjectActivity[];
}

export interface CollaborativeUser {
  id: number;
  username: string;
  display_name: string;
  avatar?: string;
  current_revision?: number;
  last_seen: string;
  cursor_position?: {
    line: number;
    column: number;
    revision_id: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
    revision_id: number;
  };
}

export interface ProjectDiscussion {
  id: string;
  title: string;
  content: string;
  author_id: number;
  author_name: string;
  created_at: string;
  updated_at: string;
  replies_count: number;
  related_revisions: number[];
  tags: string[];
  status: 'open' | 'resolved' | 'archived';
}

export interface ProjectActivity {
  id: string;
  user_id: number;
  username: string;
  activity_type:
    | 'revision_created'
    | 'annotation_added'
    | 'discussion_started'
    | 'user_joined'
    | 'user_left';
  entity_id: string;
  entity_type: 'revision' | 'annotation' | 'discussion';
  metadata: Record<string, any>;
  timestamp: string;
}

export interface RevisionFilter {
  author_id?: number;
  date_range?: { start: string; end: string };
  content_search?: string;
  tags?: string[];
  min_size?: number;
  max_size?: number;
}

export interface RevisionComparison {
  from_revision: Revision;
  to_revision: Revision;
  diff_content?: string;
  change_summary?: {
    additions: number;
    deletions: number;
    modifications: number;
  };
}

// ==================== STATE INTERFACE ====================

interface ProjectVersioningState {
  // Core data
  project_slug: string | null;
  revisions: Revision[];
  filtered_revisions: Revision[];

  // Selection state
  selected_revisions: number[];
  comparison: RevisionComparison | null;

  // UI state
  loading: boolean;
  error: string | null;
  filter: RevisionFilter;
  sort_by: 'date' | 'author' | 'size' | 'version';
  sort_order: 'asc' | 'desc';
  view_mode: 'list' | 'timeline' | 'graph';

  // Collaborative state
  collaborative_session: CollaborativeSession | null;
  annotations: Record<number, RevisionAnnotation[]>;
  discussions: ProjectDiscussion[];
  activity_feed: ProjectActivity[];

  // Performance state
  virtualization: {
    enabled: boolean;
    visible_range: { start: number; end: number };
    item_height: number;
  };

  // Real-time state
  websocket_connected: boolean;
  last_sync: string | null;

  // Actions
  setProject: (projectSlug: string) => void;
  setRevisions: (revisions: Revision[]) => void;
  addRevision: (revision: Revision) => void;
  selectRevision: (revisionId: number) => void;
  deselectRevision: (revisionId: number) => void;
  clearSelection: () => void;
  setComparison: (comparison: RevisionComparison | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilter: (filter: Partial<RevisionFilter>) => void;
  clearFilter: () => void;
  setSort: (
    sortBy: ProjectVersioningState['sort_by'],
    sortOrder?: ProjectVersioningState['sort_order']
  ) => void;
  setViewMode: (mode: ProjectVersioningState['view_mode']) => void;
  updateCollaborativeSession: (session: Partial<CollaborativeSession>) => void;
  addAnnotation: (annotation: RevisionAnnotation) => void;
  updateAnnotation: (id: string, updates: Partial<RevisionAnnotation>) => void;
  removeAnnotation: (revisionId: number, annotationId: string) => void;
  addDiscussion: (discussion: ProjectDiscussion) => void;
  updateDiscussion: (id: string, updates: Partial<ProjectDiscussion>) => void;
  addActivity: (activity: ProjectActivity) => void;
  setWebsocketStatus: (connected: boolean) => void;
  updateVirtualization: (updates: Partial<ProjectVersioningState['virtualization']>) => void;

  // Complex actions
  loadRevisions: (projectSlug: string, force?: boolean) => Promise<void>;
  compareRevisions: (revisionIds: number[]) => Promise<void>;
  createRevision: (data: Omit<Revision, 'id' | 'revision_timestamp'>) => Promise<Revision>;
  isRevisionSelected: (revisionId: number) => boolean;
  canCompare: boolean;
  activeUsers: CollaborativeUser[];
  getRevisionAnnotations: (revisionId: number) => RevisionAnnotation[];
  getRelatedDiscussions: (revisionId: number) => ProjectDiscussion[];
}

// ==================== HELPER FUNCTIONS ====================

function applyFilters(
  revisions: Revision[],
  filter: RevisionFilter,
  sortBy: ProjectVersioningState['sort_by'],
  sortOrder: ProjectVersioningState['sort_order']
): Revision[] {
  let filtered = [...revisions];

  // Apply filters
  if (filter.author_id) {
    filtered = filtered.filter(r => r.author_id === filter.author_id);
  }

  if (filter.date_range) {
    const start = new Date(filter.date_range.start);
    const end = new Date(filter.date_range.end);
    filtered = filtered.filter(r => {
      const date = new Date(r.revision_timestamp);
      return date >= start && date <= end;
    });
  }

  if (filter.content_search) {
    const search = filter.content_search.toLowerCase();
    filtered = filtered.filter(
      r => r.content.toLowerCase().includes(search) || r.summary.toLowerCase().includes(search)
    );
  }

  if (filter.tags?.length) {
    filtered = filtered.filter(r => r.tags?.some(tag => filter.tags!.includes(tag)));
  }

  if (filter.min_size !== undefined) {
    filtered = filtered.filter(r => r.size >= filter.min_size!);
  }

  if (filter.max_size !== undefined) {
    filtered = filtered.filter(r => r.size <= filter.max_size!);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        comparison =
          new Date(a.revision_timestamp).getTime() - new Date(b.revision_timestamp).getTime();
        break;
      case 'author':
        comparison = a.author_name.localeCompare(b.author_name);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'version':
        comparison = naturalVersionCompare(a.version_number || '0', b.version_number || '0');
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}

function naturalVersionCompare(a: string, b: string): number {
  const aParts = a.split('.').map(n => parseInt(n) || 0);
  const bParts = b.split('.').map(n => parseInt(n) || 0);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    if (aPart !== bPart) {
      return aPart - bPart;
    }
  }
  return 0;
}

// ==================== ZUSTAND STORE ====================

export const useProjectVersioningStore = create<ProjectVersioningState>()(
  persist(
    (set, get) => ({
      // Initial state
      project_slug: null,
      revisions: [],
      filtered_revisions: [],
      selected_revisions: [],
      comparison: null,
      loading: false,
      error: null,
      filter: {},
      sort_by: 'date',
      sort_order: 'desc',
      view_mode: 'list',
      collaborative_session: null,
      annotations: {},
      discussions: [],
      activity_feed: [],
      virtualization: {
        enabled: false,
        visible_range: { start: 0, end: 50 },
        item_height: 80,
      },
      websocket_connected: false,
      last_sync: null,

      // Basic actions
      setProject: projectSlug =>
        set({
          project_slug: projectSlug,
          revisions: [],
          filtered_revisions: [],
          selected_revisions: [],
          comparison: null,
          loading: false,
          error: null,
          filter: {},
          collaborative_session: null,
          annotations: {},
          discussions: [],
          activity_feed: [],
          last_sync: null,
        }),

      setRevisions: revisions => {
        const state = get();
        const filtered = applyFilters(revisions, state.filter, state.sort_by, state.sort_order);
        set({
          revisions,
          filtered_revisions: filtered,
          loading: false,
          error: null,
        });
      },

      addRevision: revision => {
        const state = get();
        const updatedRevisions = [revision, ...state.revisions];
        const filtered = applyFilters(
          updatedRevisions,
          state.filter,
          state.sort_by,
          state.sort_order
        );
        set({
          revisions: updatedRevisions,
          filtered_revisions: filtered,
        });
      },

      selectRevision: revisionId => {
        const state = get();
        const newSelection = state.selected_revisions.includes(revisionId)
          ? state.selected_revisions.filter(id => id !== revisionId)
          : state.selected_revisions.length >= 2
            ? [state.selected_revisions[1]!, revisionId]
            : [...state.selected_revisions, revisionId];

        set({
          selected_revisions: newSelection,
          comparison: newSelection.length === 2 ? null : state.comparison,
        });
      },

      deselectRevision: revisionId => {
        const state = get();
        set({
          selected_revisions: state.selected_revisions.filter(id => id !== revisionId),
          comparison: null,
        });
      },

      clearSelection: () => set({ selected_revisions: [], comparison: null }),

      setComparison: comparison => set({ comparison, loading: false }),

      setLoading: loading => set({ loading, error: loading ? null : get().error }),

      setError: error => set({ error, loading: false }),

      setFilter: newFilter => {
        const state = get();
        const filter = { ...state.filter, ...newFilter };
        const filtered = applyFilters(state.revisions, filter, state.sort_by, state.sort_order);
        set({ filter, filtered_revisions: filtered });
      },

      clearFilter: () => {
        const state = get();
        const filtered = applyFilters(state.revisions, {}, state.sort_by, state.sort_order);
        set({ filter: {}, filtered_revisions: filtered });
      },

      setSort: (sortBy, sortOrder = 'desc') => {
        const state = get();
        const filtered = applyFilters(state.revisions, state.filter, sortBy, sortOrder);
        set({ sort_by: sortBy, sort_order: sortOrder, filtered_revisions: filtered });
      },

      setViewMode: viewMode => {
        const state = get();
        set({
          view_mode: viewMode,
          virtualization: {
            ...state.virtualization,
            enabled: viewMode === 'list' && state.revisions.length > 100,
          },
        });
      },

      updateCollaborativeSession: sessionUpdates => {
        const state = get();
        set({
          collaborative_session: state.collaborative_session
            ? { ...state.collaborative_session, ...sessionUpdates }
            : (sessionUpdates as CollaborativeSession),
          last_sync: new Date().toISOString(),
        });
      },

      addAnnotation: annotation => {
        const state = get();
        const revisionAnnotations = state.annotations[annotation.revision_id] || [];
        set({
          annotations: {
            ...state.annotations,
            [annotation.revision_id]: [...revisionAnnotations, annotation],
          },
        });
      },

      updateAnnotation: (id, updates) => {
        const state = get();
        const updatedAnnotations = { ...state.annotations };
        for (const revisionId in updatedAnnotations) {
          updatedAnnotations[revisionId] = updatedAnnotations[revisionId]!.map(annotation =>
            annotation.id === id ? { ...annotation, ...updates } : annotation
          );
        }
        set({ annotations: updatedAnnotations });
      },

      removeAnnotation: (revisionId, annotationId) => {
        const state = get();
        set({
          annotations: {
            ...state.annotations,
            [revisionId]: (state.annotations[revisionId] || []).filter(
              annotation => annotation.id !== annotationId
            ),
          },
        });
      },

      addDiscussion: discussion => {
        const state = get();
        set({ discussions: [discussion, ...state.discussions] });
      },

      updateDiscussion: (id, updates) => {
        const state = get();
        set({
          discussions: state.discussions.map(discussion =>
            discussion.id === id ? { ...discussion, ...updates } : discussion
          ),
        });
      },

      addActivity: activity => {
        const state = get();
        set({
          activity_feed: [activity, ...state.activity_feed].slice(0, 100), // Keep last 100 activities
        });
      },

      setWebsocketStatus: connected => set({ websocket_connected: connected }),

      updateVirtualization: updates => {
        const state = get();
        set({ virtualization: { ...state.virtualization, ...updates } });
      },

      // Complex actions
      loadRevisions: async (projectSlug, force = false) => {
        const state = get();

        if (!force && state.project_slug === projectSlug && state.revisions.length > 0) {
          return; // Already loaded
        }

        set({ loading: true, project_slug: projectSlug });

        try {
          const response = await fetch(
            `/api/projects/${encodeURIComponent(projectSlug)}/revisions`
          );

          if (!response.ok) {
            throw new Error(`Failed to load revisions: ${response.status}`);
          }

          const data = await response.json();
          get().setRevisions(data.revisions || []);
        } catch (error) {
          logger.error('Error loading revisions:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load revisions',
            loading: false,
          });
        }
      },

      compareRevisions: async revisionIds => {
        if (revisionIds.length !== 2) {
          throw new Error('Exactly two revisions must be selected for comparison');
        }

        const state = get();
        const authState = useAuthStore.getState();

        set({ loading: true });

        try {
          const comparison = await fetchJSON(
            `/api/projects/${encodeURIComponent(state.project_slug!)}/revisions/compare`,
            {
              method: 'POST',
              body: {
                fromRevisionId: revisionIds[0],
                toRevisionId: revisionIds[1],
              },
            }
          );

          // Find the revision objects
          const fromRevision = state.revisions.find(r => r.id === revisionIds[0]);
          const toRevision = state.revisions.find(r => r.id === revisionIds[1]);

          if (!fromRevision || !toRevision) {
            throw new Error('Selected revisions not found');
          }

          set({
            comparison: {
              from_revision: fromRevision,
              to_revision: toRevision,
              diff_content: comparison.diff,
              change_summary: comparison.summary,
            },
            loading: false,
          });
        } catch (error) {
          logger.error('Error comparing revisions:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to compare revisions',
            loading: false,
          });
        }
      },

      createRevision: async data => {
        const state = get();
        const authState = useAuthStore.getState();

        if (!authState.isAuthenticated || !authState.user) {
          throw new Error('Must be authenticated to create revisions');
        }

        try {
          const revision = await fetchJSON(
            `/api/projects/${encodeURIComponent(state.project_slug!)}/revisions`,
            {
              method: 'POST',
              body: data,
            }
          );
          get().addRevision(revision);

          // Add activity
          get().addActivity({
            id: `activity-${Date.now()}`,
            user_id: authState.user.id,
            username: authState.user.username,
            activity_type: 'revision_created',
            entity_id: revision.id.toString(),
            entity_type: 'revision',
            metadata: { summary: revision.summary },
            timestamp: new Date().toISOString(),
          });

          return revision;
        } catch (error) {
          logger.error('Error creating revision:', error);
          throw error;
        }
      },

      // Computed getters
      get isRevisionSelected() {
        return (revisionId: number) => {
          return get().selected_revisions.includes(revisionId);
        };
      },

      get canCompare() {
        return get().selected_revisions.length === 2;
      },

      get activeUsers() {
        return get().collaborative_session?.active_users || [];
      },

      getRevisionAnnotations: (revisionId: number) => {
        return get().annotations[revisionId] || [];
      },

      getRelatedDiscussions: (revisionId: number) => {
        return get().discussions.filter(discussion =>
          discussion.related_revisions.includes(revisionId)
        );
      },
    }),
    {
      name: 'project-versioning-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: state => ({
        project_slug: state.project_slug,
        filter: state.filter,
        sort_by: state.sort_by,
        sort_order: state.sort_order,
        view_mode: state.view_mode,
        virtualization: state.virtualization,
      }),
    }
  )
);

export default useProjectVersioningStore;
