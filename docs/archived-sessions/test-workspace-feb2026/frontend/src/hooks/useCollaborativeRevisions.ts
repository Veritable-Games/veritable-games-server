'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectVersioning } from '@/contexts/ProjectVersioningContext';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';

/**
 * Advanced hook for real-time collaborative revision viewing
 * Handles user presence, cursor tracking, and collaborative awareness
 */
export function useCollaborativeRevisions(projectSlug: string) {
  const { user } = useAuth();
  const {
    state,
    joinCollaborativeSession,
    leaveCollaborativeSession,
    updateUserPresence,
    loadRevisions,
  } = useProjectVersioning();

  const [isJoined, setIsJoined] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const presenceUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize collaborative session
  useEffect(() => {
    if (!projectSlug || !user || isJoined) return;

    const initSession = async () => {
      try {
        setConnectionError(null);
        await loadRevisions(projectSlug);
        await joinCollaborativeSession(projectSlug);
        setIsJoined(true);
      } catch (error) {
        logger.error('Failed to join collaborative session:', error);
        setConnectionError(error instanceof Error ? error.message : 'Failed to connect');
      }
    };

    initSession();

    return () => {
      if (isJoined) {
        leaveCollaborativeSession();
        setIsJoined(false);
      }
    };
  }, [
    projectSlug,
    user,
    isJoined,
    joinCollaborativeSession,
    leaveCollaborativeSession,
    loadRevisions,
  ]);

  // Debounced presence updates
  const updatePresenceDebounced = useCallback(
    (presence: Parameters<typeof updateUserPresence>[0]) => {
      if (presenceUpdateTimeoutRef.current) {
        clearTimeout(presenceUpdateTimeoutRef.current);
      }

      presenceUpdateTimeoutRef.current = setTimeout(() => {
        updateUserPresence(presence);
      }, 100); // 100ms debounce
    },
    [updateUserPresence]
  );

  // Track cursor/selection changes
  const updateCursorPosition = useCallback(
    (revisionId: number, line: number, column: number) => {
      if (!isJoined) return;

      updatePresenceDebounced({
        cursor_position: { line, column, revision_id: revisionId },
      });
    },
    [isJoined, updatePresenceDebounced]
  );

  const updateSelection = useCallback(
    (
      revisionId: number,
      startLine: number,
      startColumn: number,
      endLine: number,
      endColumn: number
    ) => {
      if (!isJoined) return;

      updatePresenceDebounced({
        selection: {
          start: { line: startLine, column: startColumn },
          end: { line: endLine, column: endColumn },
          revision_id: revisionId,
        },
      });
    },
    [isJoined, updatePresenceDebounced]
  );

  const clearSelection = useCallback(() => {
    if (!isJoined) return;

    updatePresenceDebounced({
      selection: undefined,
    });
  }, [isJoined, updatePresenceDebounced]);

  // Get users viewing a specific revision
  const getRevisionViewers = useCallback(
    (revisionId: number) => {
      if (!state.collaborative_session) return [];

      return state.collaborative_session.revision_viewers[revisionId] || [];
    },
    [state.collaborative_session]
  );

  // Get all active collaborators except current user
  const otherUsers = useMemo(() => {
    if (!state.collaborative_session || !user) return [];

    return state.collaborative_session.active_users.filter(u => u.id !== user.id);
  }, [state.collaborative_session?.active_users, user]);

  // Check if a revision has active viewers
  const hasActiveViewers = useCallback(
    (revisionId: number) => {
      return getRevisionViewers(revisionId).length > 0;
    },
    [getRevisionViewers]
  );

  // Get cursor positions for Monaco editor decorations
  const getCursorDecorations = useCallback(
    (revisionId: number) => {
      const viewers = getRevisionViewers(revisionId);

      return viewers
        .filter(user => user.cursor_position?.revision_id === revisionId)
        .map(user => ({
          userId: user.id,
          username: user.username,
          displayName: user.display_name,
          position: user.cursor_position!,
          color: getUserColor(user.id), // Consistent color per user
        }));
    },
    [getRevisionViewers]
  );

  // Get selection decorations for Monaco editor
  const getSelectionDecorations = useCallback(
    (revisionId: number) => {
      const viewers = getRevisionViewers(revisionId);

      return viewers
        .filter(user => user.selection?.revision_id === revisionId)
        .map(user => ({
          userId: user.id,
          username: user.username,
          displayName: user.display_name,
          selection: user.selection!,
          color: getUserColor(user.id),
        }));
    },
    [getRevisionViewers]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (presenceUpdateTimeoutRef.current) {
        clearTimeout(presenceUpdateTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Connection state
    isConnected: state.websocket_connected && isJoined,
    connectionError,
    activeUsers: state.collaborative_session?.active_users || [],
    otherUsers,

    // Presence tracking
    updateCursorPosition,
    updateSelection,
    clearSelection,

    // Viewer information
    getRevisionViewers,
    hasActiveViewers,
    getCursorDecorations,
    getSelectionDecorations,

    // Session management
    reconnect: () => {
      setIsJoined(false);
      setConnectionError(null);
    },
  };
}

/**
 * Hook for managing revision annotations with real-time collaboration
 */
export function useRevisionAnnotations(revisionId: number) {
  const {
    state,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resolveAnnotation,
    getRevisionAnnotations,
    subscribeToAnnotations,
  } = useProjectVersioning();

  const { user } = useAuth();

  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [replyingToAnnotation, setReplyingToAnnotation] = useState<string | null>(null);

  // Get annotations for this revision
  const annotations = useMemo(
    () => getRevisionAnnotations(revisionId),
    [getRevisionAnnotations, revisionId]
  );

  // Subscribe to real-time updates
  useEffect(() => {
    if (!revisionId) return;

    const unsubscribe = subscribeToAnnotations(revisionId);
    return unsubscribe;
  }, [revisionId, subscribeToAnnotations]);

  // Create annotation
  const createAnnotation = useCallback(
    async (
      lineNumber: number,
      columnStart: number,
      columnEnd: number,
      content: string,
      threadId?: string
    ) => {
      if (!user) throw new Error('Must be authenticated to create annotations');

      return await addAnnotation({
        revision_id: revisionId,
        line_number: lineNumber,
        column_start: columnStart,
        column_end: columnEnd,
        content,
        author_id: user.id,
        author_name: user.display_name || user.username,
        resolved: false,
        thread_id: threadId,
        replies: [],
      });
    },
    [revisionId, user, addAnnotation]
  );

  // Reply to annotation
  const replyToAnnotation = useCallback(
    async (annotationId: string, content: string) => {
      if (!user) throw new Error('Must be authenticated to reply to annotations');

      const annotation = annotations.find(a => a.id === annotationId);
      if (!annotation) throw new Error('Annotation not found');

      const reply = {
        id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        annotation_id: annotationId,
        content,
        author_id: user.id,
        author_name: user.display_name || user.username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await updateAnnotation(annotationId, {
        replies: [...(annotation.replies || []), reply],
      });

      return reply;
    },
    [annotations, user, updateAnnotation]
  );

  // Edit annotation
  const editAnnotation = useCallback(
    async (annotationId: string, content: string) => {
      await updateAnnotation(annotationId, { content });
      setEditingAnnotation(null);
    },
    [updateAnnotation]
  );

  // Delete annotation
  const removeAnnotation = useCallback(
    async (annotationId: string) => {
      await deleteAnnotation(revisionId, annotationId);
    },
    [revisionId, deleteAnnotation]
  );

  // Toggle annotation resolution
  const toggleResolution = useCallback(
    async (annotationId: string) => {
      const annotation = annotations.find(a => a.id === annotationId);
      if (!annotation) return;

      await resolveAnnotation(annotationId, !annotation.resolved);
    },
    [annotations, resolveAnnotation]
  );

  // Get annotations by line (for Monaco editor gutter decorations)
  const getAnnotationsByLine = useCallback(
    (lineNumber: number) => {
      return annotations.filter(annotation => annotation.line_number === lineNumber);
    },
    [annotations]
  );

  // Get annotation threads (grouped conversations)
  const annotationThreads = useMemo(() => {
    const threads: Record<string, typeof annotations> = {};

    annotations.forEach(annotation => {
      const threadId = annotation.thread_id || annotation.id;
      if (!threads[threadId]) {
        threads[threadId] = [];
      }
      threads[threadId].push(annotation);
    });

    return threads;
  }, [annotations]);

  // UI state management
  const startEditing = useCallback((annotationId: string) => {
    setEditingAnnotation(annotationId);
    setReplyingToAnnotation(null);
  }, []);

  const startReplying = useCallback((annotationId: string) => {
    setReplyingToAnnotation(annotationId);
    setEditingAnnotation(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingAnnotation(null);
    setReplyingToAnnotation(null);
  }, []);

  return {
    // Data
    annotations,
    annotationThreads,

    // Actions
    createAnnotation,
    replyToAnnotation,
    editAnnotation,
    removeAnnotation,
    toggleResolution,

    // Queries
    getAnnotationsByLine,

    // UI state
    editingAnnotation,
    replyingToAnnotation,
    startEditing,
    startReplying,
    cancelEditing,

    // Computed
    totalAnnotations: annotations.length,
    unresolvedAnnotations: annotations.filter(a => !a.resolved).length,
    myAnnotations: annotations.filter(a => a.author_id === user?.id).length,
  };
}

/**
 * Hook for managing project discussions
 */
export function useProjectDiscussions(projectSlug: string) {
  const { state, createDiscussion, updateDiscussion, subscribeToDiscussions } =
    useProjectVersioning();

  const { user } = useAuth();

  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'my_discussions'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'replies_count'>('updated_at');

  // Subscribe to real-time updates
  useEffect(() => {
    if (!projectSlug) return;

    const unsubscribe = subscribeToDiscussions(projectSlug);
    return unsubscribe;
  }, [projectSlug, subscribeToDiscussions]);

  // Filtered discussions
  const discussions = useMemo(() => {
    let filtered = [...state.discussions];

    // Apply filters
    switch (filter) {
      case 'open':
        filtered = filtered.filter(d => d.status === 'open');
        break;
      case 'resolved':
        filtered = filtered.filter(d => d.status === 'resolved');
        break;
      case 'my_discussions':
        filtered = filtered.filter(d => d.author_id === user?.id);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'updated_at':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'replies_count':
          return b.replies_count - a.replies_count;
        default:
          return 0;
      }
    });

    return filtered;
  }, [state.discussions, filter, sortBy, user?.id]);

  // Create new discussion
  const startDiscussion = useCallback(
    async (
      title: string,
      content: string,
      relatedRevisions: number[] = [],
      tags: string[] = []
    ) => {
      if (!user) throw new Error('Must be authenticated to start discussions');

      return await createDiscussion({
        title,
        content,
        author_id: user.id,
        author_name: user.display_name || user.username,
        related_revisions: relatedRevisions,
        tags,
        status: 'open',
      });
    },
    [user, createDiscussion]
  );

  // Update discussion status
  const closeDiscussion = useCallback(
    async (discussionId: string) => {
      await updateDiscussion(discussionId, { status: 'resolved' });
    },
    [updateDiscussion]
  );

  const reopenDiscussion = useCallback(
    async (discussionId: string) => {
      await updateDiscussion(discussionId, { status: 'open' });
    },
    [updateDiscussion]
  );

  const archiveDiscussion = useCallback(
    async (discussionId: string) => {
      await updateDiscussion(discussionId, { status: 'archived' });
    },
    [updateDiscussion]
  );

  // Get discussions related to specific revision
  const getDiscussionsForRevision = useCallback(
    (revisionId: number) => {
      return discussions.filter(discussion => discussion.related_revisions.includes(revisionId));
    },
    [discussions]
  );

  // Get discussions by tag
  const getDiscussionsByTag = useCallback(
    (tag: string) => {
      return discussions.filter(discussion => discussion.tags.includes(tag));
    },
    [discussions]
  );

  return {
    // Data
    discussions,

    // Actions
    startDiscussion,
    closeDiscussion,
    reopenDiscussion,
    archiveDiscussion,

    // Filtering
    filter,
    setFilter,
    sortBy,
    setSortBy,

    // Queries
    getDiscussionsForRevision,
    getDiscussionsByTag,

    // Stats
    totalDiscussions: state.discussions.length,
    openDiscussions: state.discussions.filter(d => d.status === 'open').length,
    myDiscussions: state.discussions.filter(d => d.author_id === user?.id).length,
  };
}

// ==================== UTILITIES ====================

/**
 * Generate consistent color for user based on ID
 */
function getUserColor(userId: number | undefined): string {
  if (userId === undefined) return '#94A3B8'; // fallback color
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FECA57',
    '#FF9FF3',
    '#54A0FF',
    '#5F27CD',
    '#00D2D3',
    '#FF9F43',
    '#A55EEA',
    '#26DE81',
    '#FD79A8',
    '#FDCB6E',
    '#6C5CE7',
  ];

  return colors[userId! % colors.length] || '#94A3B8';
}

/**
 * Hook for managing Monaco editor collaborative decorations
 */
export function useMonacoCollaboration(revisionId: number) {
  const { getCursorDecorations, getSelectionDecorations } = useCollaborativeRevisions('');
  const [editor, setEditor] = useState<any>(null);
  const decorationsRef = useRef<string[]>([]);

  // Update decorations when collaborators change
  useEffect(() => {
    if (!editor || !revisionId) return;

    const cursorDecorations = getCursorDecorations(revisionId);
    const selectionDecorations = getSelectionDecorations(revisionId);

    // Clear previous decorations
    if (decorationsRef.current.length > 0) {
      editor.deltaDecorations(decorationsRef.current, []);
    }

    // Create new decorations
    const newDecorations = [
      // Cursor decorations
      ...cursorDecorations.map(cursor => ({
        range: {
          startLineNumber: cursor.position.line,
          startColumn: cursor.position.column,
          endLineNumber: cursor.position.line,
          endColumn: cursor.position.column,
        },
        options: {
          className: `collaborative-cursor-${cursor.userId}`,
          beforeContentClassName: `collaborative-cursor-line-${cursor.userId}`,
          hoverMessage: { value: `${cursor.displayName}'s cursor` },
        },
      })),

      // Selection decorations
      ...selectionDecorations.map(selection => ({
        range: {
          startLineNumber: selection.selection.start.line,
          startColumn: selection.selection.start.column,
          endLineNumber: selection.selection.end.line,
          endColumn: selection.selection.end.column,
        },
        options: {
          className: `collaborative-selection-${selection.userId}`,
          hoverMessage: { value: `${selection.displayName}'s selection` },
        },
      })),
    ];

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations([], newDecorations);
  }, [editor, revisionId, getCursorDecorations, getSelectionDecorations]);

  // Dynamic CSS injection for user-specific colors
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cursorDecorations = getCursorDecorations(revisionId);
    const selectionDecorations = getSelectionDecorations(revisionId);
    const allUsers = [...cursorDecorations, ...selectionDecorations];

    if (allUsers.length === 0) return;

    // Create or update dynamic stylesheet
    let styleSheet = document.getElementById('collaborative-styles') as HTMLStyleElement;
    if (!styleSheet) {
      styleSheet = document.createElement('style');
      styleSheet.id = 'collaborative-styles';
      document.head.appendChild(styleSheet);
    }

    const css = allUsers
      .map(
        user => `
      .collaborative-cursor-${user.userId} {
        border-left: 2px solid ${user.color};
        background-color: ${user.color}40;
      }
      .collaborative-cursor-line-${user.userId}::before {
        content: '${user.displayName}';
        background-color: ${user.color};
        color: white;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 11px;
        position: absolute;
        top: -18px;
        left: 0;
        z-index: 1000;
      }
      .collaborative-selection-${user.userId} {
        background-color: ${user.color}20;
        border: 1px solid ${user.color}60;
      }
    `
      )
      .join('\n');

    styleSheet.textContent = css;
  }, [revisionId, getCursorDecorations, getSelectionDecorations]);

  return {
    setEditor,
    clearDecorations: () => {
      if (editor && decorationsRef.current.length > 0) {
        editor.deltaDecorations(decorationsRef.current, []);
        decorationsRef.current = [];
      }
    },
  };
}
