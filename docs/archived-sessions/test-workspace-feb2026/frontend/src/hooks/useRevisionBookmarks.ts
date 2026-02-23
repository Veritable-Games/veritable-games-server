'use client';

import { useState, useEffect, useCallback } from 'react';
import { Revision } from './useRevisionManager';
import { logger } from '@/lib/utils/logger';

export interface RevisionBookmark {
  revisionId: number;
  projectSlug: string;
  label: string;
  notes: string;
  createdAt: string;
  tags: string[];
  color: string;
}

interface BookmarkGroup {
  name: string;
  bookmarks: RevisionBookmark[];
  color: string;
}

const BOOKMARK_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
  '#f97316', // orange
];

export function useRevisionBookmarks(projectSlug: string) {
  const [bookmarks, setBookmarks] = useState<RevisionBookmark[]>([]);
  const [groups, setGroups] = useState<BookmarkGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Storage keys
  const bookmarksKey = `revision-bookmarks-${projectSlug}`;
  const groupsKey = `revision-bookmark-groups-${projectSlug}`;

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem(bookmarksKey);
      const savedGroups = localStorage.getItem(groupsKey);

      if (savedBookmarks) {
        setBookmarks(JSON.parse(savedBookmarks));
      }

      if (savedGroups) {
        setGroups(JSON.parse(savedGroups));
      } else {
        // Initialize with default groups
        setGroups([
          { name: 'Important', bookmarks: [], color: '#ef4444' },
          { name: 'Milestones', bookmarks: [], color: '#10b981' },
          { name: 'Issues', bookmarks: [], color: '#f59e0b' },
        ]);
      }
    } catch (error) {
      logger.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  }, [projectSlug, bookmarksKey, groupsKey]);

  // Save bookmarks to localStorage
  const saveBookmarks = useCallback(
    (newBookmarks: RevisionBookmark[]) => {
      try {
        localStorage.setItem(bookmarksKey, JSON.stringify(newBookmarks));
        setBookmarks(newBookmarks);
      } catch (error) {
        logger.error('Failed to save bookmarks:', error);
      }
    },
    [bookmarksKey]
  );

  // Save groups to localStorage
  const saveGroups = useCallback(
    (newGroups: BookmarkGroup[]) => {
      try {
        localStorage.setItem(groupsKey, JSON.stringify(newGroups));
        setGroups(newGroups);
      } catch (error) {
        logger.error('Failed to save groups:', error);
      }
    },
    [groupsKey]
  );

  // Add bookmark
  const addBookmark = useCallback(
    (
      revisionId: number,
      label: string = '',
      notes: string = '',
      tags: string[] = [],
      color: string = BOOKMARK_COLORS[0] || '#3B82F6'
    ) => {
      const bookmark: RevisionBookmark = {
        revisionId,
        projectSlug,
        label: label || `Revision #${revisionId}`,
        notes,
        createdAt: new Date().toISOString(),
        tags,
        color,
      };

      const newBookmarks = [...bookmarks, bookmark];
      saveBookmarks(newBookmarks);
      return bookmark;
    },
    [bookmarks, projectSlug, saveBookmarks]
  );

  // Remove bookmark
  const removeBookmark = useCallback(
    (revisionId: number) => {
      const newBookmarks = bookmarks.filter(b => b.revisionId !== revisionId);
      saveBookmarks(newBookmarks);
    },
    [bookmarks, saveBookmarks]
  );

  // Update bookmark
  const updateBookmark = useCallback(
    (revisionId: number, updates: Partial<RevisionBookmark>) => {
      const newBookmarks = bookmarks.map(bookmark =>
        bookmark.revisionId === revisionId ? { ...bookmark, ...updates } : bookmark
      );
      saveBookmarks(newBookmarks);
    },
    [bookmarks, saveBookmarks]
  );

  // Toggle bookmark (add if doesn't exist, remove if exists)
  const toggleBookmark = useCallback(
    (revisionId: number, label?: string) => {
      const existing = bookmarks.find(b => b.revisionId === revisionId);
      if (existing) {
        removeBookmark(revisionId);
        return null;
      } else {
        return addBookmark(revisionId, label);
      }
    },
    [bookmarks, addBookmark, removeBookmark]
  );

  // Check if revision is bookmarked
  const isBookmarked = useCallback(
    (revisionId: number) => {
      return bookmarks.some(b => b.revisionId === revisionId);
    },
    [bookmarks]
  );

  // Get bookmark for revision
  const getBookmark = useCallback(
    (revisionId: number) => {
      return bookmarks.find(b => b.revisionId === revisionId);
    },
    [bookmarks]
  );

  // Add bookmark group
  const addGroup = useCallback(
    (name: string, color: string = BOOKMARK_COLORS[0] || '#3B82F6') => {
      const newGroup: BookmarkGroup = {
        name,
        bookmarks: [],
        color,
      };
      const newGroups = [...groups, newGroup];
      saveGroups(newGroups);
    },
    [groups, saveGroups]
  );

  // Remove bookmark group
  const removeGroup = useCallback(
    (groupName: string) => {
      const newGroups = groups.filter(g => g.name !== groupName);
      saveGroups(newGroups);
    },
    [groups, saveGroups]
  );

  // Add bookmark to group
  const addBookmarkToGroup = useCallback(
    (groupName: string, bookmark: RevisionBookmark) => {
      const newGroups = groups.map(group =>
        group.name === groupName ? { ...group, bookmarks: [...group.bookmarks, bookmark] } : group
      );
      saveGroups(newGroups);
    },
    [groups, saveGroups]
  );

  // Remove bookmark from group
  const removeBookmarkFromGroup = useCallback(
    (groupName: string, revisionId: number) => {
      const newGroups = groups.map(group =>
        group.name === groupName
          ? { ...group, bookmarks: group.bookmarks.filter(b => b.revisionId !== revisionId) }
          : group
      );
      saveGroups(newGroups);
    },
    [groups, saveGroups]
  );

  // Get bookmarks by tag
  const getBookmarksByTag = useCallback(
    (tag: string) => {
      return bookmarks.filter(bookmark => bookmark.tags.includes(tag));
    },
    [bookmarks]
  );

  // Get all unique tags
  const getAllTags = useCallback(() => {
    const tags = new Set<string>();
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [bookmarks]);

  // Export bookmarks
  const exportBookmarks = useCallback(() => {
    // Check if running in browser environment
    if (typeof window === 'undefined') return;

    const exportData = {
      projectSlug,
      bookmarks,
      groups,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectSlug}-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [projectSlug, bookmarks, groups]);

  // Import bookmarks
  const importBookmarks = useCallback(
    (file: File) => {
      return new Promise<void>((resolve, reject) => {
        // Check if running in browser environment
        if (typeof window === 'undefined' || typeof FileReader === 'undefined') {
          reject(new Error('File operations not supported in server environment'));
          return;
        }

        const reader = new FileReader();
        reader.onload = e => {
          try {
            const data = JSON.parse(e.target?.result as string);
            if (data.bookmarks && Array.isArray(data.bookmarks)) {
              saveBookmarks([...bookmarks, ...data.bookmarks]);
            }
            if (data.groups && Array.isArray(data.groups)) {
              saveGroups([...groups, ...data.groups]);
            }
            resolve();
          } catch (error) {
            reject(new Error('Invalid bookmark file format'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    },
    [bookmarks, groups, saveBookmarks, saveGroups]
  );

  // Quick actions for common bookmark operations
  const quickActions = {
    // Bookmark as milestone
    bookmarkAsMilestone: (revisionId: number, label: string) =>
      addBookmark(revisionId, label, '', ['milestone'], '#10b981'),

    // Bookmark as bug fix
    bookmarkAsBugFix: (revisionId: number, label: string) =>
      addBookmark(revisionId, label, '', ['bugfix'], '#ef4444'),

    // Bookmark as feature
    bookmarkAsFeature: (revisionId: number, label: string) =>
      addBookmark(revisionId, label, '', ['feature'], '#3b82f6'),

    // Bookmark for review
    bookmarkForReview: (revisionId: number, notes: string) =>
      addBookmark(revisionId, 'Review Required', notes, ['review'], '#f59e0b'),
  };

  // Statistics
  const stats = {
    total: bookmarks.length,
    byTag: getAllTags().reduce(
      (acc, tag) => {
        acc[tag] = getBookmarksByTag(tag).length;
        return acc;
      },
      {} as Record<string, number>
    ),
    recentCount: bookmarks.filter(b => {
      const createdAt = new Date(b.createdAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return createdAt > weekAgo;
    }).length,
  };

  return {
    // State
    bookmarks,
    groups,
    loading,

    // Actions
    addBookmark,
    removeBookmark,
    updateBookmark,
    toggleBookmark,
    isBookmarked,
    getBookmark,

    // Group actions
    addGroup,
    removeGroup,
    addBookmarkToGroup,
    removeBookmarkFromGroup,

    // Filtering and search
    getBookmarksByTag,
    getAllTags,

    // Import/Export
    exportBookmarks,
    importBookmarks,

    // Quick actions
    ...quickActions,

    // Statistics
    stats,

    // Constants
    BOOKMARK_COLORS,
  };
}
