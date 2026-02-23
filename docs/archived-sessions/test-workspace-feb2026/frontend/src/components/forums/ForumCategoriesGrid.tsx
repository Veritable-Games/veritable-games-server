'use client';

/**
 * Forum Categories Grid
 *
 * Grid-based UI for managing forum categories with keyboard shortcuts.
 * Based on WikiCategoriesGrid architecture.
 *
 * Features:
 * - Ctrl+Click: Multi-select categories
 * - Shift+Click: Inline edit (name → icon)
 * - Alt+Click: Reorder mode (arrow keys to move)
 * - Tab (editing): Switch between name and icon
 * - Tab (selected): Toggle visibility
 * - Enter: Save changes
 * - Escape: Cancel/exit mode
 * - Delete: Delete selected categories
 * - Arrow keys (reorder): Move category position
 * - Arrow keys (icon edit): Cycle through icons
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ForumCategory } from '@/lib/forums/types';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

// Icon registry - common icons for forum categories
const iconRegistry = [
  { value: '', label: 'No Icon' },
  { value: '📢', label: 'Megaphone' },
  { value: '💬', label: 'Speech Bubble' },
  { value: '🎮', label: 'Game Controller' },
  { value: '🛠️', label: 'Tools' },
  { value: '📚', label: 'Books' },
  { value: '🌟', label: 'Star' },
  { value: '🔥', label: 'Fire' },
  { value: '💡', label: 'Light Bulb' },
  { value: '🚀', label: 'Rocket' },
  { value: '⚡', label: 'Lightning' },
  { value: '🎨', label: 'Art Palette' },
  { value: '🏆', label: 'Trophy' },
  { value: '🎯', label: 'Target' },
  { value: '📝', label: 'Memo' },
  { value: '🔧', label: 'Wrench' },
  { value: '💻', label: 'Laptop' },
  { value: '🎓', label: 'Graduation Cap' },
  { value: '🌍', label: 'Globe' },
  { value: '📊', label: 'Chart' },
  { value: '🔒', label: 'Lock' },
  { value: '🔓', label: 'Unlock' },
  { value: '⚙️', label: 'Gear' },
  { value: '🎭', label: 'Theater Masks' },
  { value: '🌈', label: 'Rainbow' },
  { value: '🔮', label: 'Crystal Ball' },
  { value: '🎪', label: 'Circus Tent' },
  { value: '🎬', label: 'Clapper Board' },
  { value: '🎵', label: 'Musical Note' },
  { value: '🏅', label: 'Medal' },
];

interface ForumCategoriesGridProps {
  initialCategories: ForumCategory[];
  isAdmin: boolean;
}

export default function ForumCategoriesGrid({
  initialCategories,
  isAdmin,
}: ForumCategoriesGridProps) {
  // State management
  const [categories, setCategories] = useState(initialCategories);
  const [isCreating, setIsCreating] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('');
  const [categorySection, setCategorySection] = useState('general');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editingPhase, setEditingPhase] = useState<'name' | 'icon'>('name');
  const [originalName, setOriginalName] = useState('');
  const [originalIcon, setOriginalIcon] = useState('');

  // Reorder state
  const [reorderingCategoryId, setReorderingCategoryId] = useState<number | null>(null);
  const [reorderPosition, setReorderPosition] = useState<number>(0);

  // Multi-select state
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());

  // Sections for dropdown
  const sections = useMemo(() => {
    const uniqueSections = Array.from(new Set(categories.map(c => c.section)));
    return ['general', 'games', 'modding', 'community', 'development', ...uniqueSections].filter(
      (s, i, arr) => arr.indexOf(s) === i
    );
  }, [categories]);

  // Update categories when props change
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  // Computed values
  const gridCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      // Sort by section first, then sort_order, then name
      if (a.section !== b.section) {
        return a.section.localeCompare(b.section);
      }
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  };

  // Refresh categories from server
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await fetchJSON('/api/forums/categories');
      if (data.success) {
        setCategories(data.data.categories || []);
      }
    } catch (err) {
      logger.error('Error refreshing categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh categories');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Handle create category
  const handleCreate = useCallback(async () => {
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const slug = generateSlug(categoryName);

      const data = await fetchJSON('/api/forums/categories', {
        method: 'POST',
        body: {
          name: categoryName.trim(),
          slug,
          icon: categoryIcon || undefined,
          section: categorySection,
          is_public: true,
        },
      });

      if (data.success) {
        // Optimistically add new category to state
        setCategories([...categories, data.data.category]);

        // Reset form
        setCategoryName('');
        setCategoryIcon('');
        setCategorySection('general');
        setIsCreating(false);

        // Verify persistence with delayed refresh
        setTimeout(() => handleRefresh(), 500);
      }
    } catch (err) {
      logger.error('Error creating category:', err);
      setError(err instanceof Error ? err.message : 'Failed to create category');

      // Rollback on error with delayed refresh
      setTimeout(() => handleRefresh(), 1000);
    } finally {
      setSaving(false);
    }
  }, [categoryName, categoryIcon, categorySection, categories, handleRefresh]);

  // Handle edit category
  const handleStartEdit = (category: ForumCategory) => {
    setEditingCategoryId(category.id as number);
    setEditName(category.name);
    setEditIcon(category.icon || '');
    setOriginalName(category.name);
    setOriginalIcon(category.icon || '');
    setEditingPhase('name');
  };

  const handleCancelEdit = useCallback(() => {
    setEditingCategoryId(null);
    setEditName('');
    setEditIcon('');
    setEditingPhase('name');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingCategoryId) return;

    const category = categories.find(c => c.id === editingCategoryId);
    if (!category) return;

    if (!editName.trim()) {
      // Cancel if name is empty
      handleCancelEdit();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = await fetchJSON(`/api/forums/categories/${category.slug}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          icon: editIcon || undefined,
        },
      });

      if (data.success) {
        // Optimistically update category in state
        setCategories(categories.map(c => (c.id === editingCategoryId ? data.data.category : c)));

        // Clear edit state
        setEditingCategoryId(null);
        setEditName('');
        setEditIcon('');
        setEditingPhase('name');

        // Verify persistence
        setTimeout(() => handleRefresh(), 500);
      }
    } catch (err) {
      logger.error('Error updating category:', err);
      setError(err instanceof Error ? err.message : 'Failed to update category');

      // Rollback on error
      setTimeout(() => {
        handleCancelEdit();
        handleRefresh();
      }, 1000);
    } finally {
      setSaving(false);
    }
  }, [editingCategoryId, editName, editIcon, categories, handleCancelEdit, handleRefresh]);

  // Handle reorder
  const handleStartReorder = (category: ForumCategory) => {
    const position = gridCategories.findIndex(c => c.id === category.id);
    setReorderingCategoryId(category.id as number);
    setReorderPosition(position);
  };

  const handleCancelReorder = useCallback(() => {
    setReorderingCategoryId(null);
    setReorderPosition(0);
  }, []);

  const handleSaveReorder = useCallback(async () => {
    if (reorderingCategoryId === null) return;

    const updates = gridCategories.map((cat, index) => ({
      id: cat.id as number,
      sort_order: index === reorderPosition ? reorderPosition : cat.sort_order,
    }));

    setSaving(true);
    setError(null);

    try {
      const data = await fetchJSON('/api/forums/categories/batch-update', {
        method: 'POST',
        body: { updates },
      });

      if (data.success) {
        // Clear reorder state
        setReorderingCategoryId(null);
        setReorderPosition(0);

        // Verify persistence with delayed refresh
        setTimeout(() => handleRefresh(), 500);
      }
    } catch (err) {
      logger.error('Error reordering categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder categories');

      // Rollback on error
      setTimeout(() => {
        setReorderingCategoryId(null);
        handleRefresh();
      }, 1000);
    } finally {
      setSaving(false);
    }
  }, [reorderingCategoryId, reorderPosition, gridCategories, handleRefresh]);

  // Handle multi-select toggle
  const handleToggleSelect = (categoryId: number) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
  };

  // Handle batch visibility toggle
  const handleBatchToggleVisibility = useCallback(async () => {
    if (selectedCategories.size === 0) return;

    setSaving(true);
    setError(null);

    try {
      // Optimistically toggle visibility in UI
      const categoryIds = Array.from(selectedCategories);
      setCategories(prev =>
        prev.map(c =>
          categoryIds.includes(c.id as number) ? { ...c, is_public: !c.is_public } : c
        )
      );

      // Send API requests in parallel
      const promises = categoryIds.map(async id => {
        const category = categories.find(c => c.id === id);
        if (!category) return;

        return fetchJSON(`/api/forums/categories/${category.slug}`, {
          method: 'PATCH',
          body: {
            is_public: !category.is_public,
          },
        });
      });

      await Promise.all(promises);

      // Clear selection
      setSelectedCategories(new Set());

      // Verify persistence
      setTimeout(() => handleRefresh(), 500);
    } catch (err) {
      logger.error('Error toggling visibility:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle visibility');

      // Rollback on error
      setTimeout(() => handleRefresh(), 1000);
    } finally {
      setSaving(false);
    }
  }, [selectedCategories, categories, handleRefresh]);

  // Handle batch delete
  const handleBatchDelete = useCallback(async () => {
    if (selectedCategories.size === 0) return;

    const categoryNames = Array.from(selectedCategories)
      .map(id => categories.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    if (
      !confirm(
        `Delete ${selectedCategories.size} categories?\n\n${categoryNames}\n\nTopics will be moved to Off-Topic.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const categoryIds = Array.from(selectedCategories);

      // Optimistically remove categories from UI
      setCategories(prev => prev.filter(c => !categoryIds.includes(c.id as number)));
      setSelectedCategories(new Set());

      // Send delete requests in parallel
      const promises = categoryIds.map(async id => {
        const category = categories.find(c => c.id === id);
        if (!category) return;

        // Check if system category
        if (category.slug === 'forum-rules' || category.slug === 'off-topic') {
          logger.warn(`Skipping system category: ${category.slug}`);
          return;
        }

        return fetchJSON(`/api/forums/categories/${category.slug}`, {
          method: 'DELETE',
        });
      });

      await Promise.all(promises);

      // Verify persistence
      setTimeout(() => handleRefresh(), 500);
    } catch (err) {
      logger.error('Error deleting categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete categories');

      // Rollback on error
      setTimeout(() => handleRefresh(), 1000);
    } finally {
      setSaving(false);
    }
  }, [selectedCategories, categories, handleRefresh]);

  // Handle category click
  const handleCategoryClick = (category: ForumCategory, event: React.MouseEvent) => {
    // Only allow interactions for admins/moderators
    if (!isAdmin) return;

    // Prevent interaction during save
    if (saving) return;

    // Ctrl+Click: Toggle multi-select
    if (event.ctrlKey || event.metaKey) {
      handleToggleSelect(category.id as number);
      return;
    }

    // Shift+Click: Edit mode
    if (event.shiftKey) {
      // Don't allow edit if already editing or reordering another category
      if (editingCategoryId !== null || reorderingCategoryId !== null) return;
      handleStartEdit(category);
      return;
    }

    // Alt+Click: Reorder mode
    if (event.altKey) {
      // Don't allow reorder if already editing or reordering another category
      if (editingCategoryId !== null || reorderingCategoryId !== null) return;
      handleStartReorder(category);
      return;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts for admins
      if (!isAdmin) return;

      // Escape: Cancel/exit current mode
      if (e.key === 'Escape') {
        if (editingCategoryId !== null) {
          handleCancelEdit();
        } else if (reorderingCategoryId !== null) {
          handleCancelReorder();
        } else if (selectedCategories.size > 0) {
          setSelectedCategories(new Set());
        } else if (isCreating) {
          setIsCreating(false);
          setCategoryName('');
          setCategoryIcon('');
        }
        return;
      }

      // Tab: Switch between name and icon in edit mode OR toggle visibility in multi-select
      if (e.key === 'Tab') {
        if (editingCategoryId !== null) {
          e.preventDefault();
          if (editingPhase === 'name' && editName.trim()) {
            setEditingPhase('icon');
          } else if (editingPhase === 'icon') {
            setEditingPhase('name');
          }
        } else if (selectedCategories.size > 0) {
          e.preventDefault();
          handleBatchToggleVisibility();
        }
        return;
      }

      // Enter: Save changes
      if (e.key === 'Enter') {
        if (editingCategoryId !== null) {
          handleSaveEdit();
        } else if (reorderingCategoryId !== null) {
          handleSaveReorder();
        }
        return;
      }

      // Delete: Delete selected categories
      if (e.key === 'Delete' && selectedCategories.size > 0) {
        handleBatchDelete();
        return;
      }

      // Arrow keys in reorder mode
      if (reorderingCategoryId !== null) {
        const cols = 8; // Grid columns (xl:grid-cols-8)
        let newPosition = reorderPosition;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          newPosition = Math.max(0, reorderPosition - cols);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          newPosition = Math.min(gridCategories.length - 1, reorderPosition + cols);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          newPosition = Math.max(0, reorderPosition - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          newPosition = Math.min(gridCategories.length - 1, reorderPosition + 1);
        }

        setReorderPosition(newPosition);
        return;
      }

      // Arrow keys in icon edit mode
      if (editingCategoryId !== null && editingPhase === 'icon') {
        const currentIndex = iconRegistry.findIndex(icon => icon.value === editIcon);

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : iconRegistry.length - 1;
          const prevIcon = iconRegistry[prevIndex];
          if (prevIcon) setEditIcon(prevIcon.value);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIndex = currentIndex < iconRegistry.length - 1 ? currentIndex + 1 : 0;
          const nextIcon = iconRegistry[nextIndex];
          if (nextIcon) setEditIcon(nextIcon.value);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAdmin,
    editingCategoryId,
    editingPhase,
    editName,
    editIcon,
    reorderingCategoryId,
    reorderPosition,
    selectedCategories,
    gridCategories.length,
    isCreating,
    handleCancelEdit,
    handleCancelReorder,
    handleSaveEdit,
    handleSaveReorder,
    handleBatchToggleVisibility,
    handleBatchDelete,
  ]);

  return (
    <div className="space-y-6">
      {/* Header with keyboard hints */}
      {isAdmin && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Category Management</h2>
            <button
              onClick={handleRefresh}
              disabled={refreshing || saving}
              className="rounded bg-gray-700 px-3 py-1 text-sm transition-colors hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500"
              title="Refresh categories from server"
            >
              {refreshing ? '⟳ Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
          <div className="space-y-1 text-sm text-gray-400">
            <div>
              <strong>Ctrl+Click:</strong> Multi-select | <strong>Shift+Click:</strong> Edit |{' '}
              <strong>Alt+Click:</strong> Reorder
            </div>
            {selectedCategories.size > 0 && (
              <div className="text-blue-400">
                {selectedCategories.size} selected | <strong>Tab:</strong> Toggle visibility |{' '}
                <strong>Delete:</strong> Remove
              </div>
            )}
            {editingCategoryId && (
              <div className="text-orange-400">
                Edit Mode | <strong>Tab:</strong> Switch field | <strong>Enter:</strong> Save |{' '}
                <strong>Esc:</strong> Cancel
              </div>
            )}
            {reorderingCategoryId && (
              <div className="text-purple-400">
                Reorder Mode | <strong>Arrow Keys:</strong> Move | <strong>Enter:</strong> Save |{' '}
                <strong>Esc:</strong> Cancel
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded border border-red-600 bg-red-900/50 p-3 text-red-200">{error}</div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-3 gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {gridCategories.map((category, index) => {
          const isEditing = editingCategoryId === category.id;
          const isReordering = reorderingCategoryId === category.id;
          const isSelected = selectedCategories.has(category.id as number);
          const isHidden = category.is_public === false;

          return (
            <div
              key={category.id}
              className={`relative block aspect-square cursor-pointer overflow-hidden rounded border bg-gray-900/30 p-3 transition-all hover:bg-gray-900/50 ${isEditing ? 'border-orange-500 ring-2 ring-orange-500/50' : ''} ${isReordering ? 'border-purple-500 ring-2 ring-purple-500/50' : ''} ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700'} ${isAdmin ? 'hover:border-gray-500' : ''} `}
              onClick={e => handleCategoryClick(category, e)}
            >
              {/* Admin-only overlay */}
              {isHidden && (
                <div
                  className="absolute right-1 top-1 z-10 rounded-full bg-red-900/80 p-1"
                  title="Admin Only"
                >
                  <svg
                    className="h-4 w-4 text-red-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                </div>
              )}

              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                {isEditing ? (
                  // Edit mode
                  <div className="w-full space-y-2">
                    {editingPhase === 'name' ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-orange-500 focus:outline-none"
                        placeholder="Name"
                        autoFocus
                      />
                    ) : (
                      <div className="space-y-1">
                        <div className="text-2xl">{editIcon || '❓'}</div>
                        <div className="text-xs text-gray-400">
                          {iconRegistry.find(i => i.value === editIcon)?.label || 'No Icon'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Display mode
                  <>
                    {category.icon && <div className="mb-1 text-2xl">{category.icon}</div>}
                    <div className="line-clamp-2 break-words text-sm font-medium">
                      {category.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">{category.topic_count} topics</div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Create New Category Card */}
        {isAdmin && (
          <div className="relative block aspect-square overflow-hidden rounded border border-gray-700 bg-gray-900/30 p-3">
            {!isCreating ? (
              <button
                onClick={() => setIsCreating(true)}
                className="relative z-10 flex h-full w-full flex-col items-center justify-center transition-colors hover:bg-gray-800/50"
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <div className="text-sm font-medium">New Category</div>
              </button>
            ) : (
              <div className="relative z-10 flex h-full flex-col">
                <input
                  type="text"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  className="mb-2 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
                  placeholder="Name"
                  autoFocus
                />
                <select
                  value={categoryIcon}
                  onChange={e => setCategoryIcon(e.target.value)}
                  className="mb-2 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
                >
                  {iconRegistry.map(icon => (
                    <option key={icon.value} value={icon.value}>
                      {icon.label}
                    </option>
                  ))}
                </select>
                <select
                  value={categorySection}
                  onChange={e => setCategorySection(e.target.value)}
                  className="mb-2 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
                >
                  {sections.map(section => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={saving || !categoryName.trim()}
                    className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:bg-gray-600"
                  >
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setCategoryName('');
                      setCategoryIcon('');
                      setError(null);
                    }}
                    className="flex-1 rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
                {error && (
                  <div className="mt-1 truncate text-xs text-red-400" title={error}>
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
