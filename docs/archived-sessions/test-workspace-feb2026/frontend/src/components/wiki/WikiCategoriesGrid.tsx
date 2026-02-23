'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import WikiCategoryIcon from '@/components/ui/WikiCategoryIcon';
import { fetchJSON } from '@/lib/utils/csrf';
import { iconRegistry } from '@/lib/icons/iconRegistry';
import { logger } from '@/lib/utils/logger';

interface Category {
  id: string;
  name: string;
  page_count?: number;
  icon?: string | null;
  sort_order?: number;
  is_public?: boolean;
}

interface WikiCategoriesGridProps {
  initialCategories: Category[];
  isAdmin: boolean;
}

// Available icon options from the registry
const iconOptions = [
  { value: '', label: 'No Icon' },
  { value: 'book-open', label: 'Book' },
  { value: 'bolt', label: 'Lightning' },
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'moon', label: 'Moon' },
  { value: 'fire', label: 'Fire' },
  { value: 'cube', label: 'Cube' },
  { value: 'star', label: 'Star' },
  { value: 'trophy', label: 'Trophy' },
  { value: 'rocket-launch', label: 'Rocket' },
  { value: 'puzzle-piece', label: 'Puzzle' },
  { value: 'code-bracket-square', label: 'Code' },
  { value: 'command-line', label: 'Terminal' },
  { value: 'cog-8-tooth', label: 'Settings' },
  { value: 'wrench-screwdriver', label: 'Tools' },
  { value: 'beaker', label: 'Science' },
  { value: 'cpu-chip', label: 'CPU' },
  { value: 'server', label: 'Server' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'document-text', label: 'Document' },
  { value: 'folder', label: 'Folder' },
  { value: 'archive-box', label: 'Archive' },
  { value: 'newspaper', label: 'News' },
  { value: 'chat-bubble-left-right', label: 'Chat' },
  { value: 'users', label: 'Users' },
  { value: 'user-group', label: 'Group' },
  { value: 'academic-cap', label: 'Education' },
  { value: 'light-bulb', label: 'Idea' },
  { value: 'map', label: 'Map' },
  { value: 'globe-alt', label: 'Globe' },
  { value: 'building-library', label: 'Library' },
  { value: 'magnifying-glass', label: 'Search' },
  { value: 'wrench', label: 'Wrench' },
  { value: 'shield-check', label: 'Shield' },
  { value: 'lock-closed', label: 'Lock' },
  { value: 'photo', label: 'Photo' },
  { value: 'video-camera', label: 'Video' },
  { value: 'musical-note', label: 'Music' },
  { value: 'paint-brush', label: 'Art' },
  { value: 'flag', label: 'Flag' },
  { value: 'gift', label: 'Gift' },
  { value: 'heart', label: 'Heart' },
];

export default function WikiCategoriesGrid({
  initialCategories,
  isAdmin,
}: WikiCategoriesGridProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reorderingCategoryId, setReorderingCategoryId] = useState<string | null>(null);
  const [reorderedCategories, setReorderedCategories] = useState<Category[]>(categories);

  // Edit mode state (two-phase editing: name or icon)
  const [editMode, setEditMode] = useState<'name' | 'icon'>('name');
  const [originalName, setOriginalName] = useState('');
  const [originalIcon, setOriginalIcon] = useState('');

  // Sync reorderedCategories when categories prop changes
  useEffect(() => {
    if (!reorderingCategoryId) {
      setReorderedCategories(categories);
    }
  }, [categories, reorderingCategoryId]);

  // Sync categories state when initialCategories prop changes (e.g., on page refresh)
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const handleCreate = async () => {
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    // Generate ID from name (lowercase, replace spaces with hyphens)
    const categoryId = categoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    if (!categoryId) {
      setError('Invalid category name');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = await fetchJSON('/api/wiki/categories', {
        method: 'POST',
        body: {
          id: categoryId,
          name: categoryName.trim(),
          icon: categoryIcon || null,
        },
      });

      if (data.success) {
        // Add new category to the list
        const newCategory = {
          id: categoryId,
          name: categoryName.trim(),
          page_count: 0,
          icon: categoryIcon || null,
        };
        setCategories([...categories, newCategory]);

        // Reset form
        setCategoryName('');
        setCategoryIcon('');
        setIsCreating(false);
      } else {
        setError(data.error || 'Failed to create category');
      }
    } catch (err: any) {
      logger.error('Error creating category', { error: err });
      // Extract error message from Error object
      const errorMessage = err?.message || 'Failed to create category';
      setError(errorMessage);

      // If it's a duplicate error, refresh to show existing categories
      if (errorMessage.includes('already exists')) {
        await handleRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingCategoryId(null);
    setReorderingCategoryId(null);
    setReorderedCategories(categories);
    setSelectedCategories(new Set()); // Clear selections when canceling
    setCategoryName('');
    setCategoryIcon('');
    setOriginalName('');
    setOriginalIcon('');
    setEditMode('name');
    setError(null);
  };

  // Icon cycling helper functions for edit mode
  const cycleToPreviousIcon = () => {
    const currentIndex = iconOptions.findIndex(opt => opt.value === categoryIcon);
    const prevIndex = currentIndex <= 0 ? iconOptions.length - 1 : currentIndex - 1;
    setCategoryIcon(iconOptions[prevIndex]?.value ?? 'book-open');
  };

  const cycleToNextIcon = () => {
    const currentIndex = iconOptions.findIndex(opt => opt.value === categoryIcon);
    const nextIndex = currentIndex >= iconOptions.length - 1 ? 0 : currentIndex + 1;
    setCategoryIcon(iconOptions[nextIndex]?.value ?? 'book-open');
  };

  const toggleIconNone = () => {
    if (categoryIcon === '' || categoryIcon === null) {
      // Restore to original icon or first non-empty icon
      setCategoryIcon(originalIcon || iconOptions[0]?.value || 'book-open');
    } else {
      setCategoryIcon('');
    }
  };

  const getAdjacentIcons = () => {
    const currentIndex = iconOptions.findIndex(opt => opt.value === categoryIcon);
    const prevIndex = currentIndex <= 0 ? iconOptions.length - 1 : currentIndex - 1;
    const nextIndex = currentIndex >= iconOptions.length - 1 ? 0 : currentIndex + 1;

    return {
      previous: iconOptions[prevIndex]?.value || '',
      current: categoryIcon,
      next: iconOptions[nextIndex]?.value || '',
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchJSON('/api/wiki/categories');
      if (data.success) {
        setCategories(data.data);
        setError(null);
      }
    } catch (err) {
      logger.error('Error refreshing categories', { error: err });
    } finally {
      setRefreshing(false);
    }
  };

  const handleReorderSave = async () => {
    if (!reorderingCategoryId) return;

    setSaving(true);
    setError(null);

    try {
      // Update all categories with their new positions
      const updates = reorderedCategories.map((cat, index) => ({
        id: cat.id,
        sort_order: index,
      }));

      // Optimistically update UI immediately for instant feedback
      setCategories(reorderedCategories);
      setReorderingCategoryId(null);

      // Send batch update to server (single transaction)
      const result = await fetchJSON('/api/wiki/categories/batch-update', {
        method: 'POST',
        body: { updates },
      });

      if (!result.success) {
        // Rollback on error
        setError(result.error || 'Failed to save category order');
        setTimeout(() => {
          handleRefresh();
        }, 1000);
        return;
      }

      // Success - do a delayed background refresh to verify persistence
      setTimeout(() => {
        handleRefresh();
      }, 500);
    } catch (err) {
      logger.error('Error updating sort order', { error: err });
      setError('Failed to update sort order');
      // Rollback on exception
      setTimeout(() => {
        handleRefresh();
      }, 1000);
    } finally {
      setSaving(false);
    }
  };

  const moveCategory = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!reorderingCategoryId) return;

    const currentIndex = reorderedCategories.findIndex(c => c.id === reorderingCategoryId);
    if (currentIndex === -1) return;

    let newIndex = currentIndex;

    // Calculate grid columns based on screen size (approximate)
    const gridCols = 8; // xl:grid-cols-8 as default

    if (direction === 'left') {
      newIndex = Math.max(0, currentIndex - 1);
    } else if (direction === 'right') {
      newIndex = Math.min(reorderedCategories.length - 1, currentIndex + 1);
    } else if (direction === 'up') {
      newIndex = Math.max(0, currentIndex - gridCols);
    } else if (direction === 'down') {
      newIndex = Math.min(reorderedCategories.length - 1, currentIndex + gridCols);
    }

    if (newIndex === currentIndex) return;

    // Swap categories
    const newCategories = [...reorderedCategories];
    const [movedCategory] = newCategories.splice(currentIndex, 1);
    if (!movedCategory) return; // Guard against undefined
    newCategories.splice(newIndex, 0, movedCategory);

    setReorderedCategories(newCategories);
  };

  const handleEdit = async () => {
    if (!editingCategoryId) return;
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = await fetchJSON(
        `/api/wiki/categories/${encodeURIComponent(editingCategoryId)}`,
        {
          method: 'PATCH',
          body: {
            name: categoryName.trim(),
            icon: categoryIcon || null,
          },
        }
      );

      if (data.success) {
        // Update category in the list
        setCategories(
          categories.map(c =>
            c.id === editingCategoryId
              ? { ...c, name: categoryName.trim(), icon: categoryIcon || null }
              : c
          )
        );

        // Reset form
        setEditingCategoryId(null);
        setCategoryName('');
        setCategoryIcon('');
      } else {
        setError(data.error || 'Failed to update category');
      }
    } catch (err) {
      logger.error('Error updating category', { error: err });
      setError('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryVisibility = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const newIsPublic = !category.is_public;

    try {
      const data = await fetchJSON(`/api/wiki/categories/${encodeURIComponent(categoryId)}`, {
        method: 'PATCH',
        body: {
          is_public: newIsPublic,
        },
      });

      if (data.success) {
        // Update category in the list
        setCategories(
          categories.map(c => (c.id === categoryId ? { ...c, is_public: newIsPublic } : c))
        );
        // Refresh server-rendered components to reflect visibility changes
        router.refresh();
      } else {
        setError(data.error || 'Failed to update visibility');
      }
    } catch (err) {
      logger.error('Error updating category visibility', { error: err });
      setError('Failed to update visibility');
    }
  };

  const toggleMultipleCategoriesVisibility = async (categoryIds: Set<string>) => {
    if (categoryIds.size === 0) return;

    // Determine the target visibility state
    // If all selected are public, make them admin-only
    // If any are admin-only, make all public
    const selectedCats = categories.filter(c => categoryIds.has(c.id));
    const allPublic = selectedCats.every(c => c.is_public === true);
    const targetIsPublic = !allPublic;

    // Optimistically update UI immediately
    setCategories(prev =>
      prev.map(c => (categoryIds.has(c.id) ? { ...c, is_public: targetIsPublic } : c))
    );

    // Send all API requests in parallel
    try {
      const updatePromises = Array.from(categoryIds).map(categoryId =>
        fetchJSON(`/api/wiki/categories/${encodeURIComponent(categoryId)}`, {
          method: 'PATCH',
          body: {
            is_public: targetIsPublic,
          },
        })
      );

      const results = await Promise.all(updatePromises);

      // Check for failures
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        setError(`Failed to update ${failures.length} category/categories`);
        // Refresh to get correct state from server
        setTimeout(() => {
          handleRefresh();
        }, 1000);
      } else {
        // Successfully updated all categories - refresh server-rendered components
        router.refresh();
      }
    } catch (err) {
      logger.error('Error updating multiple categories visibility', { error: err });
      setError('Failed to update visibility');
      // Rollback by refreshing
      setTimeout(() => {
        handleRefresh();
      }, 1000);
    }
  };

  const handleCategoryClick = (e: React.MouseEvent, categoryId: string) => {
    if (!isAdmin) return;

    // Block normal clicks (no modifiers) when any mode is active
    const isNormalClick = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (isNormalClick) {
      if (selectedCategories.size > 0 || reorderingCategoryId || editingCategoryId) {
        e.preventDefault();
        return;
      }
    }

    // Cannot edit or select "Uncategorized"
    if (categoryId.toLowerCase() === 'uncategorized') {
      // Still allow normal navigation
      if (isNormalClick) {
        return; // Let the Link handle navigation
      }
      e.preventDefault();
      return;
    }

    // Alt+click to reorder
    if (e.altKey) {
      e.preventDefault();

      // If already reordering this category, deselect it (exit reorder mode)
      if (reorderingCategoryId === categoryId) {
        setReorderingCategoryId(null);
        setReorderedCategories(categories);
        setError(null);
        return;
      }

      // If reordering a different category, show error
      if (reorderingCategoryId) {
        setError('Exit current reorder first (press Esc or Alt+click the category)');
        return;
      }

      // Block if already in edit mode or have selections
      if (editingCategoryId) {
        setError('Exit edit mode first (press Esc)');
        return;
      }
      if (selectedCategories.size > 0) {
        setError('Clear selections first (press Esc)');
        return;
      }

      const category = categories.find(c => c.id === categoryId);
      if (category) {
        setReorderingCategoryId(categoryId);
        setReorderedCategories([...categories]);
        setError(null);
      }
      return;
    }

    // Shift+click to edit (only one category at a time)
    if (e.shiftKey) {
      e.preventDefault();

      // If already editing this category, deselect it (exit edit mode)
      if (editingCategoryId === categoryId) {
        setEditingCategoryId(null);
        setCategoryName('');
        setCategoryIcon('');
        setOriginalName('');
        setOriginalIcon('');
        setEditMode('name');
        setError(null);
        return;
      }

      // If editing a different category, show error
      if (editingCategoryId) {
        setError('Exit current edit first (press Esc or Shift+click the category)');
        return;
      }

      // Block if already in reorder mode or have selections
      if (reorderingCategoryId) {
        setError('Exit reorder mode first (press Esc)');
        return;
      }
      if (selectedCategories.size > 0) {
        setError('Clear selections first (press Esc)');
        return;
      }

      const category = categories.find(c => c.id === categoryId);
      if (category) {
        setEditingCategoryId(categoryId);
        setCategoryName(category.name);
        setCategoryIcon(category.icon || '');
        // Store original values for revert on Escape
        setOriginalName(category.name);
        setOriginalIcon(category.icon || '');
        // Start in name editing mode
        setEditMode('name');
        setError(null);
      }
      return;
    }

    // Ctrl+click for selection
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      // Block if already in edit or reorder mode
      if (editingCategoryId) {
        setError('Exit edit mode first (press Esc)');
        return;
      }
      if (reorderingCategoryId) {
        setError('Exit reorder mode first (press Esc)');
        return;
      }

      setSelectedCategories(prev => {
        const next = new Set(prev);
        if (next.has(categoryId)) {
          next.delete(categoryId);
        } else {
          next.add(categoryId);
        }
        return next;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCategories.size === 0) return;

    const categoriesToDelete = Array.from(selectedCategories);
    const categoryNames = categories
      .filter(c => categoriesToDelete.includes(c.id))
      .map(c => c.name)
      .join(', ');

    if (
      !confirm(
        `Delete ${categoriesToDelete.length} category/categories: ${categoryNames}?\n\nAll pages in these categories will be moved to "Uncategorized".`
      )
    ) {
      return;
    }

    try {
      // Delete all selected categories
      const deletePromises = categoriesToDelete.map(categoryId =>
        fetchJSON(`/api/wiki/categories/${encodeURIComponent(categoryId)}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);

      // Check for failures
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        alert(
          `Failed to delete ${failures.length} category/categories: ${failures.map(f => f.error).join(', ')}`
        );
      }

      // Remove successfully deleted categories from the list
      const successfulDeletes = categoriesToDelete.filter((id, idx) => results[idx].success);
      setCategories(categories.filter(c => !successfulDeletes.includes(c.id)));
      setSelectedCategories(new Set());
    } catch (err) {
      logger.error('Error deleting categories', { error: err });
      alert('Failed to delete categories');
    }
  };

  // Keyboard event listener for Delete, Escape, Arrow keys, and Enter
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle reordering mode
      if (reorderingCategoryId) {
        if (saving) return; // Disable keyboard input while saving

        if (
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown'
        ) {
          e.preventDefault();
          const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
            ArrowLeft: 'left',
            ArrowRight: 'right',
            ArrowUp: 'up',
            ArrowDown: 'down',
          };
          const direction = directionMap[e.key];
          if (direction) moveCategory(direction);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleReorderSave();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
        return;
      }

      // Handle editing mode (two-phase: name or icon)
      if (editingCategoryId) {
        if (saving) return; // Disable keyboard input while saving

        // Tab to switch between name and icon editing
        if (e.key === 'Tab') {
          e.preventDefault();
          setEditMode(prev => (prev === 'name' ? 'icon' : 'name'));
          return;
        }

        // Enter to save all changes
        if (e.key === 'Enter') {
          e.preventDefault();
          handleEdit();
          return;
        }

        // Escape to cancel and revert
        if (e.key === 'Escape') {
          e.preventDefault();
          // Revert to original values
          setCategoryName(originalName);
          setCategoryIcon(originalIcon);
          setEditingCategoryId(null);
          setEditMode('name');
          setError(null);
          return;
        }

        // Icon mode specific controls
        if (editMode === 'icon') {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            cycleToPreviousIcon();
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            cycleToNextIcon();
          }
          return;
        }

        // Name mode allows normal typing (handled by input element)
        return;
      }

      // Normal mode keyboard shortcuts
      if (e.key === 'Tab' && selectedCategories.size > 0) {
        e.preventDefault();
        // Toggle visibility for all selected categories
        toggleMultipleCategoriesVisibility(selectedCategories);
      } else if (e.key === 'Delete' && selectedCategories.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === 'Escape') {
        // Escape to deselect all
        if (selectedCategories.size > 0) {
          setSelectedCategories(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAdmin,
    selectedCategories,
    editingCategoryId,
    reorderingCategoryId,
    reorderedCategories,
    saving,
    categoryName,
    categoryIcon,
    editMode,
    originalName,
    originalIcon,
    handleEdit,
    handleCancel,
    handleReorderSave,
    handleDeleteSelected,
    moveCategory,
    toggleMultipleCategoriesVisibility,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Wiki Categories</h2>
        {/* Admin hints, refresh button, and category count - hidden on mobile */}
        <div className="hidden items-center gap-3 md:flex">
          {isAdmin && selectedCategories.size > 0 && (
            <div className="text-xs text-blue-400">
              {selectedCategories.size} selected - Tab to change visibility · Delete to remove · Esc
              to cancel
            </div>
          )}
          {isAdmin &&
            selectedCategories.size === 0 &&
            !editingCategoryId &&
            !reorderingCategoryId && (
              <div className="text-xs text-gray-500">
                Ctrl+click to select · Shift+click to edit · Alt+click to reorder · Esc to cancel
              </div>
            )}
          {isAdmin && editingCategoryId && (
            <div className="text-xs text-orange-400">
              {saving
                ? 'Saving...'
                : editMode === 'name'
                  ? 'Type to edit • Tab for icon • Enter to save • Esc to cancel'
                  : '← → to cycle icon • Tab for name • Enter to save • Esc to cancel'}
            </div>
          )}
          {isAdmin && reorderingCategoryId && (
            <div className="text-xs text-purple-400">
              {saving ? 'Saving...' : 'Reordering (use ← ↑ → ↓, Enter to save, Esc to cancel)'}
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-gray-400 transition-colors hover:text-gray-300 disabled:opacity-50"
            title="Refresh categories"
          >
            {refreshing ? 'Refreshing...' : '↻'}
          </button>
          <div className="text-xs text-gray-500">{categories.length} categories</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {/* Existing Categories */}
        {(reorderingCategoryId ? reorderedCategories : categories).map(category => {
          const isSelected = selectedCategories.has(category.id);
          const isEditing = editingCategoryId === category.id;
          const isReordering = reorderingCategoryId === category.id;

          // Category display (normal, selected, reordering, or editing)
          const adjacentIcons = isEditing ? getAdjacentIcons() : null;

          return (
            <div key={category.id} className="group relative aspect-square">
              <Link
                href={`/wiki/category/${category.id}`}
                onClick={e => handleCategoryClick(e, category.id)}
                className={`absolute inset-0 overflow-hidden rounded p-3 transition-colors ${
                  isEditing
                    ? 'border-2 border-orange-500 bg-orange-900/50 shadow-lg shadow-orange-500/50'
                    : isReordering
                      ? 'border-2 border-purple-500 bg-purple-900/50 shadow-lg shadow-purple-500/50'
                      : isSelected
                        ? 'border-2 border-blue-500 bg-blue-900/50'
                        : 'border border-gray-700 bg-gray-900/30 hover:border-gray-600 hover:bg-gray-800/40'
                }`}
              >
                {/* Giant eye-with-slash overlay for admin-only categories */}
                {!category.is_public && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <svg
                      className="h-16 w-16 text-red-500/30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  </div>
                )}

                <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                  <div className="w-full min-w-0">
                    {/* EDITING MODE */}
                    {isEditing ? (
                      <>
                        {editMode === 'name' ? (
                          // Name editing mode
                          <>
                            <input
                              type="text"
                              value={categoryName}
                              onChange={e => setCategoryName(e.target.value)}
                              className="mb-2 w-full border-b border-orange-400 bg-transparent px-1 text-center text-sm font-medium leading-tight text-white focus:shadow-none focus:outline-none focus:ring-0"
                              style={{ outline: 'none' }}
                              autoFocus
                              disabled={saving}
                              placeholder="Category name"
                            />
                            <div className="mb-2 mt-1 text-xs text-gray-600">
                              {category.page_count ?? 0}
                            </div>
                            <div className="flex items-center justify-center text-gray-600/30">
                              <WikiCategoryIcon
                                iconName={categoryIcon}
                                categoryId={category.id}
                                size="w-7 h-7"
                              />
                            </div>
                          </>
                        ) : (
                          // Icon editing mode
                          <>
                            <div className="mb-1 text-sm font-medium leading-tight text-gray-500">
                              {categoryName}
                            </div>
                            <div className="mb-2 mt-1 text-xs text-gray-600">
                              {category.page_count ?? 0}
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              {/* Previous icon preview */}
                              <div className="flex items-center justify-center text-gray-600/20">
                                <WikiCategoryIcon
                                  iconName={adjacentIcons?.previous || ''}
                                  categoryId={category.id}
                                  size="w-5 h-5"
                                />
                              </div>

                              <div className="text-xs text-orange-400/60">←</div>

                              {/* Current icon with glow ring */}
                              <div className="relative">
                                <div
                                  className="absolute inset-0 animate-pulse rounded-lg ring-2 ring-orange-400"
                                  style={{ margin: '-4px' }}
                                />
                                <WikiCategoryIcon
                                  iconName={categoryIcon}
                                  categoryId={category.id}
                                  size="w-8 h-8"
                                />
                              </div>

                              <div className="text-xs text-orange-400/60">→</div>

                              {/* Next icon preview */}
                              <div className="flex items-center justify-center text-gray-600/20">
                                <WikiCategoryIcon
                                  iconName={adjacentIcons?.next || ''}
                                  categoryId={category.id}
                                  size="w-5 h-5"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      /* NORMAL/REORDER/SELECTION MODE */
                      <>
                        {isReordering && (
                          <div className="mb-1 text-xs font-medium text-purple-400">↕ MOVING ↔</div>
                        )}
                        <h3 className="text-sm font-medium leading-tight text-white">
                          {category.name}
                        </h3>
                        <div className="mb-2 mt-1 text-xs text-gray-500">
                          {category.page_count ?? 0}
                        </div>
                        <div className="flex items-center justify-center text-gray-600/40">
                          <WikiCategoryIcon
                            iconName={category.icon}
                            categoryId={category.id}
                            size="w-7 h-7"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          );
        })}

        {/* Create Category Card - Admin Only */}
        {isAdmin && (
          <div className="relative block aspect-square overflow-hidden rounded border border-gray-700 bg-gray-900/30 p-3">
            {!isCreating ? (
              <button
                onClick={() => setIsCreating(true)}
                className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded text-center transition-colors hover:border-gray-600 hover:bg-gray-800/40"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                  <svg
                    className="h-6 w-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <span className="text-xs text-gray-400">New Category</span>
              </button>
            ) : (
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={categoryName}
                    onChange={e => setCategoryName(e.target.value)}
                    className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    autoFocus
                    disabled={saving}
                  />
                  <select
                    value={categoryIcon}
                    onChange={e => setCategoryIcon(e.target.value)}
                    className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                    disabled={saving}
                  >
                    {iconOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
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
