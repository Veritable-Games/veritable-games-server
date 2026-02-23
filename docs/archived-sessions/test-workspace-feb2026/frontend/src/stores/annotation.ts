'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useAuthStore } from './auth';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

// ==================== TYPES ====================

export interface AnnotationPosition {
  line: number;
  column_start: number;
  column_end: number;
  length?: number;
  text_content?: string;
}

export interface Annotation {
  id: string;
  revision_id: number;
  position: AnnotationPosition;
  content: string;
  author_id: number;
  author_name: string;
  author_avatar?: string;
  created_at: string;
  updated_at: string;
  resolved: boolean;
  thread_id?: string;
  parent_id?: string;
  replies: Annotation[];
  reactions: AnnotationReaction[];
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'comment' | 'suggestion' | 'question' | 'issue' | 'approval';
  visibility: 'public' | 'private' | 'team';
  mentions: number[];
  attachments?: AnnotationAttachment[];
}

export interface AnnotationReaction {
  id: string;
  annotation_id: string;
  user_id: number;
  username: string;
  emoji: string;
  created_at: string;
}

export interface AnnotationAttachment {
  id: string;
  filename: string;
  url: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
}

export interface AnnotationThread {
  id: string;
  root_annotation: Annotation;
  replies: Annotation[];
  participants: number[];
  last_activity: string;
  status: 'active' | 'resolved' | 'archived';
  total_replies: number;
}

export interface AnnotationFilter {
  author_id?: number;
  resolved?: boolean;
  priority?: Annotation['priority'][];
  type?: Annotation['type'][];
  date_range?: { start: string; end: string };
  mentioned_user_id?: number;
  has_replies?: boolean;
  tags?: string[];
  text_search?: string;
}

export interface AnnotationStats {
  total: number;
  by_type: Record<Annotation['type'], number>;
  by_priority: Record<Annotation['priority'], number>;
  by_status: { resolved: number; unresolved: number };
  by_author: Record<number, { count: number; name: string }>;
  recent_activity: {
    created_today: number;
    resolved_today: number;
    active_discussions: number;
  };
}

// ==================== STATE INTERFACE ====================

interface AnnotationState {
  // Data
  annotations: Record<number, Annotation[]>; // Keyed by revision_id
  threads: Record<string, AnnotationThread>;

  // UI State
  selected_annotation: string | null;
  editing_annotation: string | null;
  replying_to_annotation: string | null;
  creating_annotation: {
    revision_id: number;
    position: AnnotationPosition;
    type: Annotation['type'];
    priority: Annotation['priority'];
  } | null;

  // Filtering and Display
  filter: AnnotationFilter;
  sort_by: 'created_at' | 'updated_at' | 'priority' | 'replies_count';
  sort_order: 'asc' | 'desc';
  group_by: 'none' | 'type' | 'priority' | 'author' | 'thread';

  // View State
  view_mode: 'sidebar' | 'inline' | 'popup' | 'overlay';
  show_resolved: boolean;
  highlight_mentions: boolean;

  // Collaboration State
  active_annotators: Record<
    number,
    {
      user_id: number;
      username: string;
      current_annotation?: string;
      last_seen: string;
    }[]
  >;

  // Loading and Error
  loading: boolean;
  error: string | null;

  // Performance
  virtualization_enabled: boolean;
  visible_annotations: string[];

  // Actions
  setAnnotations: (revisionId: number, annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (revisionId: number, annotationId: string) => void;
  selectAnnotation: (id: string | null) => void;
  startEditing: (id: string) => void;
  stopEditing: () => void;
  startReplying: (id: string) => void;
  stopReplying: () => void;
  startCreating: (
    revisionId: number,
    position: AnnotationPosition,
    type?: Annotation['type'],
    priority?: Annotation['priority']
  ) => void;
  stopCreating: () => void;
  setFilter: (filter: Partial<AnnotationFilter>) => void;
  clearFilter: () => void;
  setSort: (sortBy: AnnotationState['sort_by'], sortOrder?: AnnotationState['sort_order']) => void;
  setGroupBy: (groupBy: AnnotationState['group_by']) => void;
  setViewMode: (mode: AnnotationState['view_mode']) => void;
  toggleResolved: () => void;
  toggleMentions: () => void;
  updateThreads: (threads: Record<string, AnnotationThread>) => void;
  updateActiveAnnotators: (annotators: AnnotationState['active_annotators']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addReaction: (annotationId: string, reaction: AnnotationReaction) => void;
  removeReaction: (annotationId: string, reactionId: string) => void;

  // Complex actions
  loadAnnotations: (revisionId: number) => Promise<void>;
  createAnnotation: (
    annotation: Omit<Annotation, 'id' | 'created_at' | 'updated_at' | 'replies' | 'reactions'>
  ) => Promise<Annotation>;
  resolveThread: (threadId: string) => Promise<void>;
  reopenThread: (threadId: string) => Promise<void>;
  addReply: (parentId: string, content: string, type?: Annotation['type']) => Promise<Annotation>;

  // Queries
  getAnnotationsForRevision: (revisionId: number, filtered?: boolean) => Annotation[];
  getAnnotationById: (id: string) => Annotation | null;
  getThread: (threadId: string) => AnnotationThread | null;
  getStats: (revisionId?: number) => AnnotationStats;
  getAnnotationsAtPosition: (revisionId: number, line: number, column?: number) => Annotation[];
  getUserMentions: (userId: number, revisionId?: number) => Annotation[];
}

// ==================== HELPER FUNCTIONS ====================

function buildThreads(annotations: Annotation[]): Record<string, AnnotationThread> {
  const threads: Record<string, AnnotationThread> = {};

  annotations.forEach(annotation => {
    const threadId = annotation.thread_id || annotation.id;

    if (!threads[threadId]) {
      threads[threadId] = {
        id: threadId,
        root_annotation: annotation,
        replies: [],
        participants: [annotation.author_id],
        last_activity: annotation.updated_at,
        status: annotation.resolved ? 'resolved' : 'active',
        total_replies: 0,
      };
    }

    const thread = threads[threadId];

    // Update participants
    if (!thread.participants.includes(annotation.author_id)) {
      thread.participants.push(annotation.author_id);
    }

    // Update last activity
    if (new Date(annotation.updated_at) > new Date(thread.last_activity)) {
      thread.last_activity = annotation.updated_at;
    }

    // Add replies
    thread.replies.push(...annotation.replies);
    thread.total_replies += annotation.replies.length;

    // Add reply participants
    annotation.replies.forEach(reply => {
      if (!thread.participants.includes(reply.author_id)) {
        thread.participants.push(reply.author_id);
      }
    });
  });

  return threads;
}

function applyAnnotationFilters(
  annotations: Annotation[],
  filter: AnnotationFilter,
  userId?: number
): Annotation[] {
  let filtered = [...annotations];

  if (filter.author_id !== undefined) {
    filtered = filtered.filter(a => a.author_id === filter.author_id);
  }

  if (filter.resolved !== undefined) {
    filtered = filtered.filter(a => a.resolved === filter.resolved);
  }

  if (filter.priority?.length) {
    filtered = filtered.filter(a => filter.priority!.includes(a.priority));
  }

  if (filter.type?.length) {
    filtered = filtered.filter(a => filter.type!.includes(a.type));
  }

  if (filter.mentioned_user_id !== undefined) {
    filtered = filtered.filter(a => a.mentions.includes(filter.mentioned_user_id!));
  }

  if (filter.has_replies !== undefined) {
    filtered = filtered.filter(a =>
      filter.has_replies ? a.replies.length > 0 : a.replies.length === 0
    );
  }

  if (filter.tags?.length) {
    filtered = filtered.filter(a => filter.tags!.some(tag => a.tags.includes(tag)));
  }

  if (filter.text_search) {
    const searchLower = filter.text_search.toLowerCase();
    filtered = filtered.filter(
      a =>
        a.content.toLowerCase().includes(searchLower) ||
        a.replies.some(reply => reply.content.toLowerCase().includes(searchLower))
    );
  }

  if (filter.date_range) {
    const start = new Date(filter.date_range.start);
    const end = new Date(filter.date_range.end);
    filtered = filtered.filter(a => {
      const date = new Date(a.created_at);
      return date >= start && date <= end;
    });
  }

  return filtered;
}

/**
 * Extract @username mentions from content
 * Returns empty array - actual username->ID resolution requires server-side lookup
 * The extracted usernames could be sent to an API endpoint for resolution
 */
function extractMentions(content: string): number[] {
  // Extract @username patterns for potential server-side resolution
  const mentionRegex = /@(\w+)/g;
  const usernames = content.match(mentionRegex);

  // NOTE: To actually resolve mentions to user IDs, the caller should:
  // 1. Extract usernames using this pattern
  // 2. Call POST /api/users/lookup with the usernames
  // 3. Store the resolved IDs
  // For now, mentions are resolved server-side when the annotation is created

  return [];
}

// ==================== ZUSTAND STORE ====================

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      // Initial state
      annotations: {},
      threads: {},
      selected_annotation: null,
      editing_annotation: null,
      replying_to_annotation: null,
      creating_annotation: null,
      filter: {},
      sort_by: 'created_at',
      sort_order: 'desc',
      group_by: 'none',
      view_mode: 'sidebar',
      show_resolved: false,
      highlight_mentions: true,
      active_annotators: {},
      loading: false,
      error: null,
      virtualization_enabled: false,
      visible_annotations: [],

      // Basic actions
      setAnnotations: (revisionId, annotations) => {
        const threads = buildThreads(annotations);
        set(state => ({
          annotations: {
            ...state.annotations,
            [revisionId]: annotations,
          },
          threads: { ...state.threads, ...threads },
          loading: false,
          error: null,
        }));
      },

      addAnnotation: annotation => {
        const state = get();
        const revisionAnnotations = state.annotations[annotation.revision_id] || [];
        const updatedAnnotations = [...revisionAnnotations, annotation];
        const newThreads = buildThreads(updatedAnnotations);

        set({
          annotations: {
            ...state.annotations,
            [annotation.revision_id]: updatedAnnotations,
          },
          threads: { ...state.threads, ...newThreads },
          creating_annotation: null,
        });
      },

      updateAnnotation: (id, updates) => {
        const state = get();
        const updatedAnnotationState = { ...state.annotations };

        // Find and update the annotation across all revisions
        for (const revisionId in updatedAnnotationState) {
          updatedAnnotationState[revisionId] = updatedAnnotationState[revisionId]!.map(
            annotation =>
              annotation.id === id
                ? { ...annotation, ...updates, updated_at: new Date().toISOString() }
                : {
                    ...annotation,
                    replies:
                      annotation.replies?.map(reply =>
                        reply.id === id
                          ? { ...reply, ...updates, updated_at: new Date().toISOString() }
                          : reply
                      ) ?? [],
                  }
          );
        }

        // Rebuild threads for affected revisions
        const rebuiltThreads = { ...state.threads };
        for (const revisionId in updatedAnnotationState) {
          const threads = buildThreads(updatedAnnotationState[revisionId]!);
          Object.assign(rebuiltThreads, threads);
        }

        set({
          annotations: updatedAnnotationState,
          threads: rebuiltThreads,
          editing_annotation: null,
        });
      },

      removeAnnotation: (revisionId, annotationId) => {
        const state = get();
        const filteredAnnotations = (state.annotations[revisionId] || []).filter(
          annotation => annotation.id !== annotationId
        );

        const filteredThreads = { ...state.threads };
        delete filteredThreads[annotationId];

        set({
          annotations: {
            ...state.annotations,
            [revisionId]: filteredAnnotations,
          },
          threads: filteredThreads,
          selected_annotation:
            state.selected_annotation === annotationId ? null : state.selected_annotation,
        });
      },

      selectAnnotation: id =>
        set({
          selected_annotation: id,
          editing_annotation: null,
          replying_to_annotation: null,
        }),

      startEditing: id =>
        set({
          editing_annotation: id,
          replying_to_annotation: null,
          selected_annotation: id,
        }),

      stopEditing: () => set({ editing_annotation: null }),

      startReplying: id =>
        set({
          replying_to_annotation: id,
          editing_annotation: null,
          selected_annotation: id,
        }),

      stopReplying: () => set({ replying_to_annotation: null }),

      startCreating: (revisionId, position, type = 'comment', priority = 'medium') =>
        set({
          creating_annotation: { revision_id: revisionId, position, type, priority },
          editing_annotation: null,
          replying_to_annotation: null,
        }),

      stopCreating: () => set({ creating_annotation: null }),

      setFilter: newFilter => {
        const state = get();
        set({ filter: { ...state.filter, ...newFilter } });
      },

      clearFilter: () => set({ filter: {} }),

      setSort: (sortBy, sortOrder = 'desc') => set({ sort_by: sortBy, sort_order: sortOrder }),

      setGroupBy: groupBy => set({ group_by: groupBy }),

      setViewMode: viewMode => set({ view_mode: viewMode }),

      toggleResolved: () => {
        const state = get();
        set({ show_resolved: !state.show_resolved });
      },

      toggleMentions: () => {
        const state = get();
        set({ highlight_mentions: !state.highlight_mentions });
      },

      updateThreads: threads => {
        const state = get();
        set({ threads: { ...state.threads, ...threads } });
      },

      updateActiveAnnotators: annotators => set({ active_annotators: annotators }),

      setLoading: loading => set({ loading, error: loading ? null : get().error }),

      setError: error => set({ error, loading: false }),

      addReaction: (annotationId, reaction) => {
        const state = get();
        const stateWithReaction = { ...state.annotations };
        for (const revisionId in stateWithReaction) {
          stateWithReaction[revisionId] = stateWithReaction[revisionId]!.map(annotation =>
            annotation.id === annotationId
              ? {
                  ...annotation,
                  reactions: [...annotation.reactions, reaction],
                }
              : annotation
          );
        }
        set({ annotations: stateWithReaction });
      },

      removeReaction: (annotationId, reactionId) => {
        const state = get();
        const stateWithoutReaction = { ...state.annotations };
        for (const revisionId in stateWithoutReaction) {
          stateWithoutReaction[revisionId] = stateWithoutReaction[revisionId]!.map(annotation =>
            annotation.id === annotationId
              ? {
                  ...annotation,
                  reactions: annotation.reactions.filter(r => r.id !== reactionId),
                }
              : annotation
          );
        }
        set({ annotations: stateWithoutReaction });
      },

      // Complex actions
      loadAnnotations: async revisionId => {
        set({ loading: true });

        try {
          const response = await fetch(`/api/annotations?revision_id=${revisionId}`);

          if (!response.ok) {
            throw new Error(`Failed to load annotations: ${response.status}`);
          }

          const data = await response.json();
          get().setAnnotations(revisionId, data.annotations || []);
        } catch (error) {
          logger.error('Error loading annotations:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load annotations',
            loading: false,
          });
        }
      },

      createAnnotation: async annotation => {
        const authState = useAuthStore.getState();

        if (!authState.isAuthenticated || !authState.user) {
          throw new Error('Must be authenticated to create annotations');
        }

        try {
          const createdAnnotation = await fetchJSON('/api/annotations', {
            method: 'POST',
            body: {
              ...annotation,
              author_id: authState.user.id,
              author_name: authState.user.display_name || authState.user.username,
            },
          });

          return createdAnnotation;
        } catch (error) {
          logger.error('Error creating annotation:', error);
          throw error;
        }
      },

      resolveThread: async threadId => {
        const state = get();
        const thread = state.threads[threadId];
        if (!thread) return;

        await get().updateAnnotation(thread.root_annotation.id, { resolved: true });
      },

      reopenThread: async threadId => {
        const state = get();
        const thread = state.threads[threadId];
        if (!thread) return;

        await get().updateAnnotation(thread.root_annotation.id, { resolved: false });
      },

      addReply: async (parentId, content, type = 'comment') => {
        const authState = useAuthStore.getState();

        if (!authState.isAuthenticated || !authState.user) {
          throw new Error('Must be authenticated to add replies');
        }

        // Find the parent annotation to get revision_id and thread_id
        const state = get();
        let parentAnnotation: Annotation | null = null;
        let revisionId: number | null = null;

        for (const [revId, annotations] of Object.entries(state.annotations)) {
          const found = annotations.find(a => a.id === parentId);
          if (found) {
            parentAnnotation = found;
            revisionId = parseInt(revId);
            break;
          }
        }

        if (!parentAnnotation || !revisionId) {
          throw new Error('Parent annotation not found');
        }

        const reply: Omit<Annotation, 'id' | 'created_at' | 'updated_at'> = {
          revision_id: revisionId,
          position: parentAnnotation.position,
          content,
          author_id: authState.user.id,
          author_name: authState.user.display_name || authState.user.username,
          resolved: false,
          thread_id: parentAnnotation.thread_id || parentAnnotation.id,
          parent_id: parentId,
          replies: [],
          reactions: [],
          tags: [],
          priority: 'medium',
          type,
          visibility: 'public',
          mentions: extractMentions(content),
          attachments: [],
        };

        return await get().createAnnotation(reply);
      },

      // Query methods
      getAnnotationsForRevision: (revisionId, filtered = true) => {
        const state = get();
        const annotations = state.annotations[revisionId] || [];

        if (!filtered) {
          return annotations;
        }

        const authState = useAuthStore.getState();
        let result = applyAnnotationFilters(annotations, state.filter, authState.user?.id);

        // Apply show_resolved filter
        if (!state.show_resolved) {
          result = result.filter(a => !a.resolved);
        }

        // Sort annotations
        result.sort((a, b) => {
          let comparison = 0;

          switch (state.sort_by) {
            case 'created_at':
              comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              break;
            case 'updated_at':
              comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
              break;
            case 'priority':
              const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
              break;
            case 'replies_count':
              comparison = a.replies.length - b.replies.length;
              break;
          }

          return state.sort_order === 'asc' ? comparison : -comparison;
        });

        return result;
      },

      getAnnotationById: id => {
        const state = get();
        for (const annotations of Object.values(state.annotations)) {
          const found = annotations.find(a => a.id === id);
          if (found) return found;

          // Check replies
          for (const annotation of annotations) {
            const replyFound = annotation.replies.find(r => r.id === id);
            if (replyFound) return replyFound;
          }
        }
        return null;
      },

      getThread: threadId => {
        const state = get();
        return state.threads[threadId] || null;
      },

      getStats: revisionId => {
        const state = get();
        const allAnnotations = revisionId
          ? state.annotations[revisionId] || []
          : Object.values(state.annotations).flat();

        const stats: AnnotationStats = {
          total: allAnnotations.length,
          by_type: { comment: 0, suggestion: 0, question: 0, issue: 0, approval: 0 },
          by_priority: { low: 0, medium: 0, high: 0, critical: 0 },
          by_status: { resolved: 0, unresolved: 0 },
          by_author: {},
          recent_activity: {
            created_today: 0,
            resolved_today: 0,
            active_discussions: 0,
          },
        };

        const today = new Date().toDateString();

        allAnnotations.forEach(annotation => {
          // Count by type
          stats.by_type[annotation.type]++;

          // Count by priority
          stats.by_priority[annotation.priority]++;

          // Count by status
          if (annotation.resolved) {
            stats.by_status.resolved++;
          } else {
            stats.by_status.unresolved++;
          }

          // Count by author
          if (!stats.by_author[annotation.author_id]) {
            stats.by_author[annotation.author_id] = {
              count: 0,
              name: annotation.author_name,
            };
          }
          stats.by_author[annotation.author_id]!.count++;

          // Recent activity
          if (new Date(annotation.created_at).toDateString() === today) {
            stats.recent_activity.created_today++;
          }

          if (annotation.resolved && new Date(annotation.updated_at).toDateString() === today) {
            stats.recent_activity.resolved_today++;
          }

          if (!annotation.resolved && annotation.replies.length > 0) {
            stats.recent_activity.active_discussions++;
          }
        });

        return stats;
      },

      getAnnotationsAtPosition: (revisionId, line, column) => {
        const state = get();
        const annotations = state.annotations[revisionId] || [];

        return annotations.filter(annotation => {
          if (annotation.position.line !== line) return false;

          if (column !== undefined) {
            return (
              column >= annotation.position.column_start && column <= annotation.position.column_end
            );
          }

          return true;
        });
      },

      getUserMentions: (userId, revisionId) => {
        const state = get();
        const allAnnotations = revisionId
          ? state.annotations[revisionId] || []
          : Object.values(state.annotations).flat();

        return allAnnotations.filter(annotation => annotation.mentions.includes(userId));
      },
    }),
    {
      name: 'annotation-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: state => ({
        filter: state.filter,
        sort_by: state.sort_by,
        sort_order: state.sort_order,
        group_by: state.group_by,
        view_mode: state.view_mode,
        show_resolved: state.show_resolved,
        highlight_mentions: state.highlight_mentions,
        virtualization_enabled: state.virtualization_enabled,
      }),
    }
  )
);

export default useAnnotationStore;
