'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useReducer,
  useMemo,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
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

// ==================== STATE TYPES ====================

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
}

type ProjectVersioningAction =
  | { type: 'SET_PROJECT'; payload: string }
  | { type: 'SET_REVISIONS'; payload: Revision[] }
  | { type: 'ADD_REVISION'; payload: Revision }
  | { type: 'SELECT_REVISION'; payload: number }
  | { type: 'DESELECT_REVISION'; payload: number }
  | { type: 'SET_COMPARISON'; payload: RevisionComparison | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FILTER'; payload: Partial<RevisionFilter> }
  | {
      type: 'SET_SORT';
      payload: {
        sort_by: ProjectVersioningState['sort_by'];
        sort_order: ProjectVersioningState['sort_order'];
      };
    }
  | { type: 'SET_VIEW_MODE'; payload: ProjectVersioningState['view_mode'] }
  | { type: 'UPDATE_COLLABORATIVE_SESSION'; payload: Partial<CollaborativeSession> }
  | { type: 'ADD_ANNOTATION'; payload: RevisionAnnotation }
  | { type: 'UPDATE_ANNOTATION'; payload: { id: string; updates: Partial<RevisionAnnotation> } }
  | { type: 'REMOVE_ANNOTATION'; payload: { revision_id: number; annotation_id: string } }
  | { type: 'ADD_DISCUSSION'; payload: ProjectDiscussion }
  | { type: 'UPDATE_DISCUSSION'; payload: { id: string; updates: Partial<ProjectDiscussion> } }
  | { type: 'ADD_ACTIVITY'; payload: ProjectActivity }
  | { type: 'SET_WEBSOCKET_STATUS'; payload: boolean }
  | { type: 'UPDATE_VIRTUALIZATION'; payload: Partial<ProjectVersioningState['virtualization']> }
  | { type: 'BULK_UPDATE'; payload: Partial<ProjectVersioningState> };

// ==================== REDUCER ====================

const initialState: ProjectVersioningState = {
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
};

function projectVersioningReducer(
  state: ProjectVersioningState,
  action: ProjectVersioningAction
): ProjectVersioningState {
  switch (action.type) {
    case 'SET_PROJECT':
      return {
        ...initialState,
        project_slug: action.payload,
      };

    case 'SET_REVISIONS':
      return {
        ...state,
        revisions: action.payload,
        filtered_revisions: applyFilters(
          action.payload,
          state.filter,
          state.sort_by,
          state.sort_order
        ),
        loading: false,
        error: null,
      };

    case 'ADD_REVISION':
      const updatedRevisions = [action.payload, ...state.revisions];
      return {
        ...state,
        revisions: updatedRevisions,
        filtered_revisions: applyFilters(
          updatedRevisions,
          state.filter,
          state.sort_by,
          state.sort_order
        ),
      };

    case 'SELECT_REVISION':
      const newSelection = state.selected_revisions.includes(action.payload)
        ? state.selected_revisions.filter(id => id !== action.payload)
        : state.selected_revisions.length >= 2
          ? [state.selected_revisions[1], action.payload]
          : [...state.selected_revisions, action.payload];

      return {
        ...state,
        selected_revisions: newSelection.filter((id): id is number => id !== undefined),
        comparison: newSelection.length === 2 ? null : state.comparison, // Clear comparison when selection changes
      };

    case 'DESELECT_REVISION':
      return {
        ...state,
        selected_revisions: state.selected_revisions.filter(id => id !== action.payload),
        comparison: null,
      };

    case 'SET_COMPARISON':
      return {
        ...state,
        comparison: action.payload,
        loading: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        error: action.payload ? null : state.error,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'SET_FILTER':
      const newFilter = { ...state.filter, ...action.payload };
      return {
        ...state,
        filter: newFilter,
        filtered_revisions: applyFilters(
          state.revisions,
          newFilter,
          state.sort_by,
          state.sort_order
        ),
      };

    case 'SET_SORT':
      return {
        ...state,
        sort_by: action.payload.sort_by,
        sort_order: action.payload.sort_order,
        filtered_revisions: applyFilters(
          state.revisions,
          state.filter,
          action.payload.sort_by,
          action.payload.sort_order
        ),
      };

    case 'SET_VIEW_MODE':
      return {
        ...state,
        view_mode: action.payload,
        virtualization: {
          ...state.virtualization,
          enabled: action.payload === 'list' && state.revisions.length > 100,
        },
      };

    case 'UPDATE_COLLABORATIVE_SESSION':
      return {
        ...state,
        collaborative_session: state.collaborative_session
          ? { ...state.collaborative_session, ...action.payload }
          : (action.payload as CollaborativeSession),
        last_sync: new Date().toISOString(),
      };

    case 'ADD_ANNOTATION':
      const revisionAnnotations = state.annotations[action.payload.revision_id] || [];
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [action.payload.revision_id]: [...revisionAnnotations, action.payload],
        },
      };

    case 'UPDATE_ANNOTATION':
      const updatedAnnotations = { ...state.annotations };
      for (const revisionId in updatedAnnotations) {
        updatedAnnotations[revisionId] =
          updatedAnnotations[revisionId]?.map(annotation =>
            annotation.id === action.payload.id
              ? { ...annotation, ...action.payload.updates }
              : annotation
          ) || [];
      }
      return {
        ...state,
        annotations: updatedAnnotations,
      };

    case 'REMOVE_ANNOTATION':
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [action.payload.revision_id]: (
            state.annotations[action.payload.revision_id] || []
          ).filter(annotation => annotation.id !== action.payload.annotation_id),
        },
      };

    case 'ADD_DISCUSSION':
      return {
        ...state,
        discussions: [action.payload, ...state.discussions],
      };

    case 'UPDATE_DISCUSSION':
      return {
        ...state,
        discussions: state.discussions.map(discussion =>
          discussion.id === action.payload.id
            ? { ...discussion, ...action.payload.updates }
            : discussion
        ),
      };

    case 'ADD_ACTIVITY':
      return {
        ...state,
        activity_feed: [action.payload, ...state.activity_feed].slice(0, 100), // Keep last 100 activities
      };

    case 'SET_WEBSOCKET_STATUS':
      return {
        ...state,
        websocket_connected: action.payload,
      };

    case 'UPDATE_VIRTUALIZATION':
      return {
        ...state,
        virtualization: { ...state.virtualization, ...action.payload },
      };

    case 'BULK_UPDATE':
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
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
        // Natural version sorting
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

// ==================== CONTEXT ====================

interface ProjectVersioningContextType {
  // State
  state: ProjectVersioningState;

  // Core revision operations
  loadRevisions: (projectSlug: string, force?: boolean) => Promise<void>;
  compareRevisions: (revisionIds: number[]) => Promise<void>;
  createRevision: (data: Omit<Revision, 'id' | 'revision_timestamp'>) => Promise<Revision>;

  // Selection operations
  selectRevision: (revisionId: number) => void;
  deselectRevision: (revisionId: number) => void;
  clearSelection: () => void;

  // Filtering and sorting
  setFilter: (filter: Partial<RevisionFilter>) => void;
  clearFilter: () => void;
  setSort: (
    sortBy: ProjectVersioningState['sort_by'],
    sortOrder?: ProjectVersioningState['sort_order']
  ) => void;
  setViewMode: (mode: ProjectVersioningState['view_mode']) => void;

  // Collaborative features
  joinCollaborativeSession: (projectSlug: string) => Promise<void>;
  leaveCollaborativeSession: () => Promise<void>;
  updateUserPresence: (presence: Partial<CollaborativeUser>) => void;

  // Annotations
  addAnnotation: (
    annotation: Omit<RevisionAnnotation, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<RevisionAnnotation>;
  updateAnnotation: (id: string, updates: Partial<RevisionAnnotation>) => Promise<void>;
  deleteAnnotation: (revisionId: number, annotationId: string) => Promise<void>;
  resolveAnnotation: (id: string, resolved: boolean) => Promise<void>;

  // Discussions
  createDiscussion: (
    discussion: Omit<ProjectDiscussion, 'id' | 'created_at' | 'updated_at' | 'replies_count'>
  ) => Promise<ProjectDiscussion>;
  updateDiscussion: (id: string, updates: Partial<ProjectDiscussion>) => Promise<void>;

  // Real-time subscriptions
  subscribeToRevisions: (projectSlug: string) => () => void;
  subscribeToAnnotations: (revisionId: number) => () => void;
  subscribeToDiscussions: (projectSlug: string) => () => void;

  // Performance utilities
  enableVirtualization: (enabled: boolean) => void;
  updateVisibleRange: (start: number, end: number) => void;

  // Computed values
  isRevisionSelected: (revisionId: number) => boolean;
  canCompare: boolean;
  activeUsers: CollaborativeUser[];
  getRevisionAnnotations: (revisionId: number) => RevisionAnnotation[];
  getRelatedDiscussions: (revisionId: number) => ProjectDiscussion[];
}

const ProjectVersioningContext = createContext<ProjectVersioningContextType | undefined>(undefined);

// ==================== PROVIDER ====================

interface ProjectVersioningProviderProps {
  children: ReactNode;
}

export function ProjectVersioningProvider({ children }: ProjectVersioningProviderProps) {
  const { user, isAuthenticated } = useAuth();

  const [state, dispatch] = useReducer(projectVersioningReducer, initialState);
  const websocketRef = useRef<WebSocket | null>(null);

  // Memoized computed values
  const canCompare = useMemo(
    () => state.selected_revisions.length === 2,
    [state.selected_revisions]
  );

  const activeUsers = useMemo(
    () => state.collaborative_session?.active_users || [],
    [state.collaborative_session?.active_users]
  );

  // ==================== CORE OPERATIONS ====================

  const loadRevisions = useCallback(
    async (projectSlug: string, force = false) => {
      if (!force && state.project_slug === projectSlug && state.revisions.length > 0) {
        return; // Already loaded
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_PROJECT', payload: projectSlug });

      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/revisions`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to load revisions: ${response.status}`);
        }

        const data = await response.json();
        dispatch({ type: 'SET_REVISIONS', payload: data.revisions || [] });
      } catch (error) {
        logger.error('Error loading revisions:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to load revisions',
        });
      }
    },
    [state.project_slug, state.revisions.length]
  );

  const compareRevisions = useCallback(
    async (revisionIds: number[]) => {
      if (revisionIds.length !== 2) {
        throw new Error('Exactly two revisions must be selected for comparison');
      }

      dispatch({ type: 'SET_LOADING', payload: true });

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

        dispatch({
          type: 'SET_COMPARISON',
          payload: {
            from_revision: fromRevision,
            to_revision: toRevision,
            diff_content: comparison.diff,
            change_summary: comparison.summary,
          },
        });
      } catch (error) {
        logger.error('Error comparing revisions:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to compare revisions',
        });
      }
    },
    [state.project_slug, state.revisions]
  );

  const createRevision = useCallback(
    async (data: Omit<Revision, 'id' | 'revision_timestamp'>): Promise<Revision> => {
      if (!isAuthenticated || !user) {
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
        dispatch({ type: 'ADD_REVISION', payload: revision });

        // Add activity
        dispatch({
          type: 'ADD_ACTIVITY',
          payload: {
            id: `activity-${Date.now()}`,
            user_id: user.id,
            username: user.username,
            activity_type: 'revision_created',
            entity_id: revision.id.toString(),
            entity_type: 'revision',
            metadata: { summary: revision.summary },
            timestamp: new Date().toISOString(),
          },
        });

        return revision;
      } catch (error) {
        logger.error('Error creating revision:', error);
        throw error;
      }
    },
    [isAuthenticated, user, state.project_slug]
  );

  // ==================== SELECTION OPERATIONS ====================

  const selectRevision = useCallback(
    (revisionId: number) => {
      dispatch({ type: 'SELECT_REVISION', payload: revisionId });

      // Update collaborative presence
      if (state.collaborative_session && user) {
        updateUserPresence({ current_revision: revisionId });
      }
    },
    [state.collaborative_session, user]
  );

  const deselectRevision = useCallback((revisionId: number) => {
    dispatch({ type: 'DESELECT_REVISION', payload: revisionId });
  }, []);

  const clearSelection = useCallback(() => {
    state.selected_revisions.forEach(id => {
      dispatch({ type: 'DESELECT_REVISION', payload: id });
    });
  }, [state.selected_revisions]);

  // ==================== FILTERING AND SORTING ====================

  const setFilter = useCallback((filter: Partial<RevisionFilter>) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const clearFilter = useCallback(() => {
    dispatch({ type: 'SET_FILTER', payload: {} });
  }, []);

  const setSort = useCallback(
    (
      sortBy: ProjectVersioningState['sort_by'],
      sortOrder: ProjectVersioningState['sort_order'] = 'desc'
    ) => {
      dispatch({ type: 'SET_SORT', payload: { sort_by: sortBy, sort_order: sortOrder } });
    },
    []
  );

  const setViewMode = useCallback((mode: ProjectVersioningState['view_mode']) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  // ==================== COLLABORATIVE FEATURES ====================

  const joinCollaborativeSession = useCallback(
    async (projectSlug: string) => {
      if (!isAuthenticated || !user) {
        throw new Error('Must be authenticated to join collaborative sessions');
      }

      try {
        // Initialize WebSocket connection for real-time features
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.close();
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/api/socket?project=${encodeURIComponent(projectSlug)}`;

        websocketRef.current = new WebSocket(wsUrl);

        websocketRef.current.onopen = () => {
          dispatch({ type: 'SET_WEBSOCKET_STATUS', payload: true });

          // Send join message
          websocketRef.current?.send(
            JSON.stringify({
              type: 'join_project',
              project_slug: projectSlug,
              user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name || user.username,
              },
            })
          );
        };

        websocketRef.current.onmessage = event => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            logger.error('Failed to parse WebSocket message:', error);
          }
        };

        websocketRef.current.onerror = error => {
          logger.error('WebSocket error:', error);
          dispatch({ type: 'SET_WEBSOCKET_STATUS', payload: false });
        };

        websocketRef.current.onclose = () => {
          dispatch({ type: 'SET_WEBSOCKET_STATUS', payload: false });
        };
      } catch (error) {
        logger.error('Error joining collaborative session:', error);
        throw error;
      }
    },
    [isAuthenticated, user]
  );

  const leaveCollaborativeSession = useCallback(async () => {
    if (websocketRef.current) {
      websocketRef.current.send(
        JSON.stringify({
          type: 'leave_project',
          project_slug: state.project_slug,
        })
      );
      websocketRef.current.close();
    }

    dispatch({
      type: 'UPDATE_COLLABORATIVE_SESSION',
      payload: {
        project_slug: state.project_slug || '',
        active_users: [],
        revision_viewers: {},
        annotations: {},
        discussions: [],
        activity_feed: [],
      } as CollaborativeSession,
    });
  }, [state.project_slug]);

  const updateUserPresence = useCallback(
    (presence: Partial<CollaborativeUser>) => {
      if (websocketRef.current?.readyState === WebSocket.OPEN && user) {
        websocketRef.current.send(
          JSON.stringify({
            type: 'update_presence',
            presence: {
              ...presence,
              id: user.id,
              username: user.username,
              last_seen: new Date().toISOString(),
            },
          })
        );
      }
    },
    [user]
  );

  // WebSocket message handler
  const handleWebSocketMessage = useCallback(
    (message: any) => {
      switch (message.type) {
        case 'user_joined':
          dispatch({
            type: 'UPDATE_COLLABORATIVE_SESSION',
            payload: {
              active_users: message.active_users,
            },
          });
          dispatch({
            type: 'ADD_ACTIVITY',
            payload: {
              id: `activity-${Date.now()}`,
              user_id: message.user.id,
              username: message.user.username,
              activity_type: 'user_joined',
              entity_id: state.project_slug!,
              entity_type: 'revision',
              metadata: {},
              timestamp: new Date().toISOString(),
            },
          });
          break;

        case 'user_left':
          dispatch({
            type: 'UPDATE_COLLABORATIVE_SESSION',
            payload: {
              active_users: message.active_users,
            },
          });
          break;

        case 'presence_updated':
          dispatch({
            type: 'UPDATE_COLLABORATIVE_SESSION',
            payload: {
              revision_viewers: message.revision_viewers,
            },
          });
          break;

        case 'annotation_added':
          dispatch({ type: 'ADD_ANNOTATION', payload: message.annotation });
          break;

        case 'annotation_updated':
          dispatch({
            type: 'UPDATE_ANNOTATION',
            payload: {
              id: message.annotation.id,
              updates: message.annotation,
            },
          });
          break;

        case 'annotation_removed':
          dispatch({
            type: 'REMOVE_ANNOTATION',
            payload: {
              revision_id: message.revision_id,
              annotation_id: message.annotation_id,
            },
          });
          break;

        case 'discussion_added':
          dispatch({ type: 'ADD_DISCUSSION', payload: message.discussion });
          break;

        case 'revision_created':
          dispatch({ type: 'ADD_REVISION', payload: message.revision });
          dispatch({ type: 'ADD_ACTIVITY', payload: message.activity });
          break;
      }
    },
    [state.project_slug]
  );

  // ==================== ANNOTATIONS ====================

  const addAnnotation = useCallback(
    async (
      annotation: Omit<RevisionAnnotation, 'id' | 'created_at' | 'updated_at'>
    ): Promise<RevisionAnnotation> => {
      if (!isAuthenticated || !user) {
        throw new Error('Must be authenticated to add annotations');
      }

      try {
        const createdAnnotation = await fetchJSON(
          `/api/projects/${encodeURIComponent(state.project_slug!)}/annotations`,
          {
            method: 'POST',
            body: {
              ...annotation,
              author_id: user.id,
              author_name: user.display_name || user.username,
            },
          }
        );

        // WebSocket will handle the dispatch via real-time update
        return createdAnnotation;
      } catch (error) {
        logger.error('Error adding annotation:', error);
        throw error;
      }
    },
    [isAuthenticated, user, state.project_slug]
  );

  const updateAnnotation = useCallback(
    async (id: string, updates: Partial<RevisionAnnotation>) => {
      if (!isAuthenticated) {
        throw new Error('Must be authenticated to update annotations');
      }

      try {
        await fetchJSON(
          `/api/projects/${encodeURIComponent(state.project_slug!)}/annotations/${id}`,
          {
            method: 'PUT',
            body: updates,
          }
        );

        // WebSocket will handle the dispatch via real-time update
      } catch (error) {
        logger.error('Error updating annotation:', error);
        throw error;
      }
    },
    [isAuthenticated, state.project_slug]
  );

  const deleteAnnotation = useCallback(
    async (revisionId: number, annotationId: string) => {
      if (!isAuthenticated) {
        throw new Error('Must be authenticated to delete annotations');
      }

      try {
        await fetchJSON(
          `/api/projects/${encodeURIComponent(state.project_slug!)}/annotations/${annotationId}`,
          {
            method: 'DELETE',
          }
        );

        // WebSocket will handle the dispatch via real-time update
      } catch (error) {
        logger.error('Error deleting annotation:', error);
        throw error;
      }
    },
    [isAuthenticated, state.project_slug]
  );

  const resolveAnnotation = useCallback(
    async (id: string, resolved: boolean) => {
      await updateAnnotation(id, { resolved });
    },
    [updateAnnotation]
  );

  // ==================== DISCUSSIONS ====================

  const createDiscussion = useCallback(
    async (
      discussion: Omit<ProjectDiscussion, 'id' | 'created_at' | 'updated_at' | 'replies_count'>
    ): Promise<ProjectDiscussion> => {
      if (!isAuthenticated || !user) {
        throw new Error('Must be authenticated to create discussions');
      }

      try {
        const createdDiscussion = await fetchJSON(
          `/api/projects/${encodeURIComponent(state.project_slug!)}/discussions`,
          {
            method: 'POST',
            body: {
              ...discussion,
              author_id: user.id,
              author_name: user.display_name || user.username,
            },
          }
        );
        return createdDiscussion;
      } catch (error) {
        logger.error('Error creating discussion:', error);
        throw error;
      }
    },
    [isAuthenticated, user, state.project_slug]
  );

  const updateDiscussion = useCallback(
    async (id: string, updates: Partial<ProjectDiscussion>) => {
      if (!isAuthenticated) {
        throw new Error('Must be authenticated to update discussions');
      }

      try {
        await fetchJSON(
          `/api/projects/${encodeURIComponent(state.project_slug!)}/discussions/${id}`,
          {
            method: 'PUT',
            body: updates,
          }
        );

        // Local update
        dispatch({ type: 'UPDATE_DISCUSSION', payload: { id, updates } });
      } catch (error) {
        logger.error('Error updating discussion:', error);
        throw error;
      }
    },
    [isAuthenticated, state.project_slug]
  );

  // ==================== SUBSCRIPTIONS ====================

  const subscribeToRevisions = useCallback((projectSlug: string) => {
    // WebSocket subscription is handled in joinCollaborativeSession
    return () => {
      // Cleanup handled in leaveCollaborativeSession
    };
  }, []);

  const subscribeToAnnotations = useCallback((revisionId: number) => {
    // WebSocket subscription is handled globally
    return () => {
      // Cleanup handled globally
    };
  }, []);

  const subscribeToDiscussions = useCallback((projectSlug: string) => {
    // WebSocket subscription is handled globally
    return () => {
      // Cleanup handled globally
    };
  }, []);

  // ==================== PERFORMANCE UTILITIES ====================

  const enableVirtualization = useCallback((enabled: boolean) => {
    dispatch({ type: 'UPDATE_VIRTUALIZATION', payload: { enabled } });
  }, []);

  const updateVisibleRange = useCallback((start: number, end: number) => {
    dispatch({
      type: 'UPDATE_VIRTUALIZATION',
      payload: {
        visible_range: { start, end },
      },
    });
  }, []);

  // ==================== COMPUTED GETTERS ====================

  const isRevisionSelected = useCallback(
    (revisionId: number) => {
      return state.selected_revisions.includes(revisionId);
    },
    [state.selected_revisions]
  );

  const getRevisionAnnotations = useCallback(
    (revisionId: number) => {
      return state.annotations[revisionId] || [];
    },
    [state.annotations]
  );

  const getRelatedDiscussions = useCallback(
    (revisionId: number) => {
      return state.discussions.filter(discussion =>
        discussion.related_revisions.includes(revisionId)
      );
    },
    [state.discussions]
  );

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  // ==================== CONTEXT VALUE ====================

  const contextValue: ProjectVersioningContextType = useMemo(
    () => ({
      // State
      state,

      // Core operations
      loadRevisions,
      compareRevisions,
      createRevision,

      // Selection
      selectRevision,
      deselectRevision,
      clearSelection,

      // Filtering
      setFilter,
      clearFilter,
      setSort,
      setViewMode,

      // Collaborative
      joinCollaborativeSession,
      leaveCollaborativeSession,
      updateUserPresence,

      // Annotations
      addAnnotation,
      updateAnnotation,
      deleteAnnotation,
      resolveAnnotation,

      // Discussions
      createDiscussion,
      updateDiscussion,

      // Subscriptions
      subscribeToRevisions,
      subscribeToAnnotations,
      subscribeToDiscussions,

      // Performance
      enableVirtualization,
      updateVisibleRange,

      // Computed
      isRevisionSelected,
      canCompare,
      activeUsers,
      getRevisionAnnotations,
      getRelatedDiscussions,
    }),
    [
      state,
      loadRevisions,
      compareRevisions,
      createRevision,
      selectRevision,
      deselectRevision,
      clearSelection,
      setFilter,
      clearFilter,
      setSort,
      setViewMode,
      joinCollaborativeSession,
      leaveCollaborativeSession,
      updateUserPresence,
      addAnnotation,
      updateAnnotation,
      deleteAnnotation,
      resolveAnnotation,
      createDiscussion,
      updateDiscussion,
      subscribeToRevisions,
      subscribeToAnnotations,
      subscribeToDiscussions,
      enableVirtualization,
      updateVisibleRange,
      isRevisionSelected,
      canCompare,
      activeUsers,
      getRevisionAnnotations,
      getRelatedDiscussions,
    ]
  );

  return (
    <ProjectVersioningContext.Provider value={contextValue}>
      {children}
    </ProjectVersioningContext.Provider>
  );
}

// ==================== HOOK ====================

export function useProjectVersioning(): ProjectVersioningContextType {
  const context = useContext(ProjectVersioningContext);
  if (context === undefined) {
    throw new Error('useProjectVersioning must be used within a ProjectVersioningProvider');
  }
  return context;
}

export { ProjectVersioningContext };
