'use client';

import React, { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ForumCategory, ForumSection } from '@/lib/forums/types';
import { ClientDate } from '@/components/ui/ClientDate';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface ModeState {
  selectedCount: number;
  isEditing: boolean;
  isReordering: boolean;
  isCreating: boolean;
}

interface ForumCategoryListProps {
  initialCategories: ForumCategory[];
  initialSections: ForumSection[];
  isAdmin: boolean;
  onModeChange?: (mode: ModeState) => void;
}

// Icon registry for category icons
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
];

export const ForumCategoryList = memo<ForumCategoryListProps>(
  ({ initialCategories, initialSections, isAdmin, onModeChange }) => {
    // State management
    const [categories, setCategories] = useState(initialCategories);
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [editStep, setEditStep] = useState<'name' | 'description'>('name');
    const [editName, setEditName] = useState('');
    const [editIcon, setEditIcon] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newStep, setNewStep] = useState<'name' | 'description'>('name');
    const [newIcon, setNewIcon] = useState('');
    const [reorderingCategoryId, setReorderingCategoryId] = useState<number | null>(null);
    const [reorderedCategories, setReorderedCategories] = useState<ForumCategory[]>([]);

    // Section management state
    const [sections, setSections] = useState<ForumSection[]>(initialSections);
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
    const [editSectionName, setEditSectionName] = useState('');
    const [creatingSectionId, setCreatingSectionId] = useState<string | null>(null);
    const [isCreatingSection, setIsCreatingSection] = useState(false);
    const [newSectionName, setNewSectionName] = useState('');

    // Refs and position tracking for fixed arrows
    const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const [sectionPositions, setSectionPositions] = useState<Map<string, number>>(new Map());

    // Sync with props
    useEffect(() => {
      setCategories(initialCategories);
    }, [initialCategories]);

    // Sync sections with props
    useEffect(() => {
      setSections(initialSections);
    }, [initialSections]);

    // Track section positions for fixed arrows
    useEffect(() => {
      if (!isAdmin) return;

      const updatePositions = () => {
        const newPositions = new Map<string, number>();
        sectionRefs.current.forEach((element, sectionId) => {
          if (element) {
            const rect = element.getBoundingClientRect();
            // Position arrows at top of section + small offset for visual alignment
            newPositions.set(sectionId, rect.top + 12);
          }
        });
        setSectionPositions(newPositions);
      };

      // Update on mount and scroll
      updatePositions();

      // Find the scrollable container
      const scrollContainer = document.getElementById('forums-scroll-container');
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', updatePositions);
      }

      window.addEventListener('resize', updatePositions);

      return () => {
        if (scrollContainer) {
          scrollContainer.removeEventListener('scroll', updatePositions);
        }
        window.removeEventListener('resize', updatePositions);
      };
    }, [isAdmin, sections]);

    // Notify parent of mode changes
    useEffect(() => {
      if (onModeChange) {
        onModeChange({
          selectedCount: selectedCategories.size,
          isEditing: editingCategoryId !== null,
          isReordering: reorderingCategoryId !== null,
          isCreating: creatingSectionId !== null || isCreatingSection,
        });
      }
    }, [
      selectedCategories,
      editingCategoryId,
      reorderingCategoryId,
      creatingSectionId,
      isCreatingSection,
      onModeChange,
    ]);

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

    // Handle confirm new category name (move to description step)
    const handleConfirmNewName = useCallback(() => {
      if (!newName.trim()) {
        setError('Category name is required');
        return;
      }
      setNewStep('description');
    }, [newName]);

    // Handle create category in a specific section
    const handleCreate = useCallback(
      async (sectionId: string) => {
        if (!newName.trim()) {
          setError('Category name is required');
          return;
        }

        setSaving(true);
        setError(null);

        try {
          const slug = generateSlug(newName);
          const data = await fetchJSON('/api/forums/categories', {
            method: 'POST',
            body: {
              name: newName.trim(),
              slug,
              icon: newIcon || undefined,
              description: newDescription.trim() || undefined,
              section: sectionId,
              is_public: true,
            },
          });

          if (data.success) {
            setCategories([...categories, data.data.category]);
            setNewName('');
            setNewDescription('');
            setNewStep('name');
            setNewIcon('');
            setCreatingSectionId(null);
            setTimeout(() => handleRefresh(), 500);
          }
        } catch (err) {
          logger.error('Error creating category:', err);
          setError(err instanceof Error ? err.message : 'Failed to create category');
          setTimeout(() => handleRefresh(), 1000);
        } finally {
          setSaving(false);
        }
      },
      [newName, newDescription, newIcon, categories, handleRefresh]
    );

    // Handle edit start
    const handleStartEdit = useCallback((category: ForumCategory) => {
      setEditingCategoryId(category.id as number);
      setEditStep('name');
      setEditName(category.name);
      setEditIcon(category.icon || '');
      setEditDescription(category.description || '');
    }, []);

    // Handle cancel edit
    const handleCancelEdit = useCallback(() => {
      setEditingCategoryId(null);
      setEditStep('name');
      setEditName('');
      setEditIcon('');
      setEditDescription('');
    }, []);

    // Handle confirm name (move to description step)
    const handleConfirmName = useCallback(() => {
      if (!editName.trim()) {
        handleCancelEdit();
        return;
      }
      setEditStep('description');
    }, [editName, editStep, handleCancelEdit]);

    // Handle save edit
    const handleSaveEdit = useCallback(async () => {
      if (!editingCategoryId) return;

      const category = categories.find(c => c.id === editingCategoryId);
      if (!category) return;

      if (!editName.trim()) {
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
            description: editDescription.trim() || undefined,
          },
        });

        if (data.success) {
          setCategories(categories.map(c => (c.id === editingCategoryId ? data.data.category : c)));
          setEditingCategoryId(null);
          setEditStep('name');
          setEditName('');
          setEditIcon('');
          setEditDescription('');
          setTimeout(() => handleRefresh(), 500);
        }
      } catch (err) {
        logger.error('Error updating category:', err);
        setError(err instanceof Error ? err.message : 'Failed to update category');
        setTimeout(() => {
          handleCancelEdit();
          handleRefresh();
        }, 1000);
      } finally {
        setSaving(false);
      }
    }, [
      editingCategoryId,
      editName,
      editIcon,
      editDescription,
      categories,
      handleCancelEdit,
      handleRefresh,
    ]);

    // Handle toggle select
    const handleToggleSelect = useCallback((categoryId: number) => {
      setSelectedCategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(categoryId)) {
          newSet.delete(categoryId);
        } else {
          newSet.add(categoryId);
        }
        return newSet;
      });
    }, []);

    // Handle batch visibility toggle
    const handleBatchToggleVisibility = useCallback(async () => {
      if (selectedCategories.size === 0) return;

      setSaving(true);
      setError(null);

      try {
        const categoryIds = Array.from(selectedCategories);

        // Capture current visibility state before optimistic update
        const categoriesToUpdate = categories.filter(c => categoryIds.includes(c.id as number));

        // Optimistic update
        setCategories(prev =>
          prev.map(c =>
            categoryIds.includes(c.id as number) ? { ...c, is_public: !c.is_public } : c
          )
        );

        // Make API calls with captured state
        const promises = categoriesToUpdate.map(category => {
          return fetchJSON(`/api/forums/categories/${category.slug}`, {
            method: 'PATCH',
            body: {
              is_public: !category.is_public,
            },
          });
        });

        const results = await Promise.all(promises);

        // Update with actual API responses (no refresh needed)
        const updatedCategories = results
          .filter(r => r.success && r.data?.category)
          .map(r => r.data.category);

        if (updatedCategories.length > 0) {
          setCategories(prev =>
            prev.map(c => {
              const updated = updatedCategories.find(u => u.id === c.id);
              return updated || c;
            })
          );
        }

        setSelectedCategories(new Set());

        // Refresh to ensure consistency with parent state
        setTimeout(() => handleRefresh(), 500);
      } catch (err) {
        logger.error('Error toggling visibility:', err);
        setError(err instanceof Error ? err.message : 'Failed to toggle visibility');
        // Only refresh on error to revert
        await handleRefresh();
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
        setCategories(prev => prev.filter(c => !categoryIds.includes(c.id as number)));
        setSelectedCategories(new Set());

        const promises = categoryIds.map(async id => {
          const category = categories.find(c => c.id === id);
          if (!category) return;

          if (category.slug === 'forum-rules' || category.slug === 'off-topic') {
            logger.warn(`Skipping system category: ${category.slug}`);
            return;
          }

          return fetchJSON(`/api/forums/categories/${category.slug}`, {
            method: 'DELETE',
          });
        });

        await Promise.all(promises);
        setTimeout(() => handleRefresh(), 500);
      } catch (err) {
        logger.error('Error deleting categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete categories');
        setTimeout(() => handleRefresh(), 1000);
      } finally {
        setSaving(false);
      }
    }, [selectedCategories, categories, handleRefresh]);

    // Section management handlers
    const handleStartEditSection = useCallback((section: ForumSection) => {
      setEditingSectionId(section.id);
      setEditSectionName(section.display_name);
    }, []);

    const handleCancelEditSection = useCallback(() => {
      setEditingSectionId(null);
      setEditSectionName('');
    }, []);

    const handleSaveEditSection = useCallback(async () => {
      if (!editingSectionId || !editSectionName.trim()) {
        handleCancelEditSection();
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const data = await fetchJSON(`/api/forums/sections/${editingSectionId}`, {
          method: 'PATCH',
          body: { display_name: editSectionName.trim() },
        });

        if (data.success) {
          setSections(sections.map(s => (s.id === editingSectionId ? data.data.section : s)));
          setEditingSectionId(null);
          setEditSectionName('');
        }
      } catch (err) {
        logger.error('Error updating section:', err);
        setError(err instanceof Error ? err.message : 'Failed to update section');
        handleCancelEditSection();
      } finally {
        setSaving(false);
      }
    }, [editingSectionId, editSectionName, sections, handleCancelEditSection]);

    const handleMoveSectionUp = useCallback(
      async (sectionId: string) => {
        const currentIndex = sections.findIndex(s => s.id === sectionId);
        if (currentIndex <= 0) return;

        const newSections = [...sections];
        const [movedSection] = newSections.splice(currentIndex, 1);
        if (!movedSection) return;
        newSections.splice(currentIndex - 1, 0, movedSection);

        setSaving(true);
        setError(null);

        try {
          const updates = newSections.map((section, index) => ({
            id: section.id,
            sort_order: index,
          }));

          await fetchJSON('/api/forums/sections/batch-reorder', {
            method: 'POST',
            body: { updates },
          });

          setSections(newSections);
        } catch (err) {
          logger.error('Error reordering sections:', err);
          setError(err instanceof Error ? err.message : 'Failed to reorder sections');
        } finally {
          setSaving(false);
        }
      },
      [sections]
    );

    const handleCreateSection = useCallback(async () => {
      if (!newSectionName.trim()) {
        setError('Section name is required');
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const sectionId = generateSlug(newSectionName);
        const data = await fetchJSON('/api/forums/sections', {
          method: 'POST',
          body: {
            id: sectionId,
            display_name: newSectionName.trim(),
          },
        });

        if (data.success) {
          setSections([...sections, data.data.section]);
          setNewSectionName('');
          setIsCreatingSection(false);
        }
      } catch (err) {
        logger.error('Error creating section:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create section';

        // If section already exists, reload sections to show it
        if (errorMessage.includes('already exists')) {
          setError('Section already exists - reloading...');
          // Reload sections from server
          try {
            const sectionsData = await fetchJSON('/api/forums/sections');
            if (sectionsData.success) {
              setSections(sectionsData.data.sections || []);
              setNewSectionName('');
              setIsCreatingSection(false);
              setError(null);
            }
          } catch (reloadErr) {
            setError('Failed to reload sections');
          }
        } else {
          setError(errorMessage);
        }
      } finally {
        setSaving(false);
      }
    }, [newSectionName, sections, generateSlug]);

    const handleDeleteSection = useCallback(
      async (sectionId: string) => {
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;

        const categoriesInSection = categories.filter(c => c.section === sectionId);
        const categoryCount = categoriesInSection.length;

        let confirmMessage = `Delete section "${section.display_name}"?`;
        if (categoryCount > 0) {
          confirmMessage = `Delete section "${section.display_name}" and all ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'} within it?\n\nThis will permanently delete all categories and their topics.`;
        }

        if (!confirm(confirmMessage)) {
          return;
        }

        setSaving(true);
        setError(null);

        try {
          await fetchJSON(`/api/forums/sections/${sectionId}`, {
            method: 'DELETE',
          });

          // Remove section and its categories from local state
          setSections(sections.filter(s => s.id !== sectionId));
          setCategories(categories.filter(c => c.section !== sectionId));
        } catch (err) {
          logger.error('Error deleting section:', err);
          setError(err instanceof Error ? err.message : 'Failed to delete section');
        } finally {
          setSaving(false);
        }
      },
      [sections, categories]
    );

    const handleMoveSectionDown = useCallback(
      async (sectionId: string) => {
        const currentIndex = sections.findIndex(s => s.id === sectionId);
        if (currentIndex === -1 || currentIndex >= sections.length - 1) return;

        const newSections = [...sections];
        const [movedSection] = newSections.splice(currentIndex, 1);
        if (!movedSection) return;
        newSections.splice(currentIndex + 1, 0, movedSection);

        setSaving(true);
        setError(null);

        try {
          const updates = newSections.map((section, index) => ({
            id: section.id,
            sort_order: index,
          }));

          await fetchJSON('/api/forums/sections/batch-reorder', {
            method: 'POST',
            body: { updates },
          });

          setSections(newSections);
        } catch (err) {
          logger.error('Error reordering sections:', err);
          setError(err instanceof Error ? err.message : 'Failed to reorder sections');
        } finally {
          setSaving(false);
        }
      },
      [sections]
    );

    // Move category in reordered list
    const moveCategory = useCallback(
      (direction: 'up' | 'down') => {
        if (!reorderingCategoryId || reorderedCategories.length === 0) return;

        const currentIndex = reorderedCategories.findIndex(c => c.id === reorderingCategoryId);
        if (currentIndex === -1) return;

        let newIndex = currentIndex;
        if (direction === 'up') {
          newIndex = Math.max(0, currentIndex - 1);
        } else if (direction === 'down') {
          newIndex = Math.min(reorderedCategories.length - 1, currentIndex + 1);
        }

        if (newIndex === currentIndex) return;

        // Swap categories
        const newCategories = [...reorderedCategories];
        const [movedCategory] = newCategories.splice(currentIndex, 1);
        if (!movedCategory) return;
        newCategories.splice(newIndex, 0, movedCategory);

        setReorderedCategories(newCategories);
      },
      [reorderingCategoryId, reorderedCategories]
    );

    // Save reordered categories
    const handleReorderSave = useCallback(async () => {
      if (!reorderingCategoryId || reorderedCategories.length === 0) return;

      setSaving(true);
      setError(null);

      try {
        // Create updates array with new sort_order values
        const updates = reorderedCategories.map((category, index) => ({
          id: category.id,
          sort_order: index,
        }));

        await fetchJSON('/api/forums/categories/batch-update', {
          method: 'POST',
          body: { updates },
        });

        // Update local state with reordered categories (no refresh needed)
        setCategories(reorderedCategories);
        setReorderingCategoryId(null);
        setReorderedCategories([]);
      } catch (err) {
        logger.error('Error reordering categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to reorder categories');
        // Only refresh on error to restore correct state
        setTimeout(() => handleRefresh(), 1000);
      } finally {
        setSaving(false);
      }
    }, [reorderingCategoryId, reorderedCategories, handleRefresh]);

    // Keyboard shortcuts
    useEffect(() => {
      if (!isAdmin) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Handle reordering mode first
        if (reorderingCategoryId) {
          if (saving) return;

          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            moveCategory(e.key === 'ArrowUp' ? 'up' : 'down');
            return;
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            handleReorderSave();
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            setReorderingCategoryId(null);
            setReorderedCategories([]);
            setError(null);
            return;
          }

          return;
        }

        if (e.key === 'Escape') {
          if (editingCategoryId !== null) {
            handleCancelEdit();
          } else if (selectedCategories.size > 0) {
            setSelectedCategories(new Set());
          } else if (creatingSectionId !== null) {
            setCreatingSectionId(null);
            setNewName('');
            setNewIcon('');
          } else if (isCreatingSection) {
            setIsCreatingSection(false);
            setNewSectionName('');
          }
          return;
        }

        if (e.key === 'Tab' && selectedCategories.size > 0) {
          e.preventDefault();
          handleBatchToggleVisibility();
          return;
        }

        if (e.key === 'Enter' && editingCategoryId !== null) {
          // Step 1: Confirm name and move to description
          if (editStep === 'name') {
            handleConfirmName();
          } else if (e.ctrlKey || e.metaKey) {
            // Step 2: Ctrl+Enter to save
            handleSaveEdit();
          }
          return;
        }

        if (e.key === 'Delete' && selectedCategories.size > 0) {
          handleBatchDelete();
          return;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
      isAdmin,
      editingCategoryId,
      editStep,
      selectedCategories,
      creatingSectionId,
      isCreatingSection,
      reorderingCategoryId,
      saving,
      handleCancelEdit,
      handleConfirmName,
      handleSaveEdit,
      handleBatchToggleVisibility,
      handleBatchDelete,
      moveCategory,
      handleReorderSave,
    ]);

    // Handle category click
    const handleCategoryClick = useCallback(
      (category: ForumCategory, event: React.MouseEvent) => {
        if (!isAdmin) return;
        if (saving) return;

        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleToggleSelect(category.id as number);
          return;
        }

        if (event.shiftKey) {
          event.preventDefault();
          if (editingCategoryId !== null) return;
          handleStartEdit(category);
          return;
        }

        if (event.altKey) {
          event.preventDefault();

          // If already reordering this category, exit reorder mode
          if (reorderingCategoryId === category.id) {
            setReorderingCategoryId(null);
            setReorderedCategories([]);
            setError(null);
            return;
          }

          // If reordering a different category, show error
          if (reorderingCategoryId) {
            setError('Exit current reorder first (press Esc or Alt+click the category)');
            return;
          }

          // Block if in edit mode or have selections
          if (editingCategoryId) {
            setError('Exit edit mode first (press Esc)');
            return;
          }

          if (selectedCategories.size > 0) {
            setError('Clear selections first (press Esc)');
            return;
          }

          // Enter reorder mode
          setReorderingCategoryId(category.id as number);
          setReorderedCategories([...categories]);
          setError(null);
          return;
        }
      },
      [
        isAdmin,
        saving,
        editingCategoryId,
        reorderingCategoryId,
        selectedCategories,
        categories,
        handleToggleSelect,
        handleStartEdit,
      ]
    );

    // Memoize visible categories (filter out hidden categories for non-admins)
    const visibleCategories = useMemo(() => {
      if (isAdmin) return categories; // Admins see all categories
      return categories.filter(cat => cat.is_public !== false);
    }, [categories, isAdmin]);

    // Memoize grouped categories calculation
    const groupedCategories = useMemo(() => {
      const grouped = visibleCategories.reduce(
        (acc, category) => {
          const sectionId = category.section || 'misc';
          if (!acc[sectionId]) {
            acc[sectionId] = [];
          }
          acc[sectionId].push(category);
          return acc;
        },
        {} as Record<string, ForumCategory[]>
      );
      return grouped;
    }, [visibleCategories]);

    if (categories.length === 0 && !isAdmin) {
      return (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-6 text-center">
          <div className="mb-2 text-gray-300">No forum categories yet</div>
          <p className="text-sm text-gray-400">
            The forum system is ready but no categories have been created yet.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="rounded border border-red-600 bg-red-900/50 p-3 text-red-200">
            {error}
          </div>
        )}

        {/* Category sections */}
        {sections.map((section, sectionIndex) => {
          const sectionCategories = groupedCategories[section.id] || [];
          // Hide empty sections for non-admins, but show them for admins
          if (!isAdmin && sectionCategories.length === 0) return null;

          const isEditingSection = editingSectionId === section.id;

          return (
            <div
              key={section.id}
              ref={el => {
                if (el && isAdmin) {
                  sectionRefs.current.set(section.id, el);
                }
              }}
              className="relative overflow-hidden rounded border border-gray-700 bg-gray-900/30"
            >
              {/* Section Header */}
              <div className="border-b border-gray-700 bg-gray-800/30 px-4 py-1.5">
                <div className="flex h-7 items-center justify-between">
                  {isEditingSection ? (
                    <div className="flex h-full items-center gap-3">
                      <input
                        type="text"
                        value={editSectionName}
                        onChange={e => setEditSectionName(e.target.value)}
                        className="h-6 rounded border border-blue-500 bg-gray-800 px-2 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Section name"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditSection();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEditSection();
                          }
                        }}
                      />
                      <span className="whitespace-nowrap text-xs text-blue-400">
                        Enter to save • Esc to cancel
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-full items-center gap-2">
                      <h2 className="text-base font-bold text-white">{section.display_name}</h2>
                      {isAdmin && (
                        <div className="ml-1 hidden items-center gap-1.5 md:flex">
                          <button
                            onClick={() => handleStartEditSection(section)}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-white"
                            title="Edit section name"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <div className="h-4 w-px bg-gray-600"></div>
                          <button
                            onClick={() => handleDeleteSection(section.id)}
                            disabled={saving}
                            className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-red-900/20 hover:text-red-400 disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:bg-transparent"
                            title="Delete section"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {sectionCategories.reduce((acc, cat) => acc + Number(cat.topic_count || 0), 0)}{' '}
                    topics •{' '}
                    {sectionCategories.reduce((acc, cat) => acc + Number(cat.post_count || 0), 0)}{' '}
                    posts
                  </div>
                </div>
              </div>

              {/* Table Header - hidden on mobile */}
              <div className="hidden border-b border-gray-700 bg-gray-800/30 px-4 py-1.5 md:block">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <div className="col-span-6">Forum</div>
                  <div className="col-span-2 text-center">Topics</div>
                  <div className="col-span-2 text-center">Posts</div>
                  <div className="col-span-2 text-right">Last Activity</div>
                </div>
              </div>

              {/* Category Rows */}
              <div className="divide-y divide-gray-700">
                {/* Use reorderedCategories when reordering, otherwise use normal categories */}
                {(reorderingCategoryId
                  ? reorderedCategories.filter(c => c.section === section.id)
                  : sectionCategories
                ).map(category => {
                  const isEditing = editingCategoryId === category.id;
                  const isSelected = selectedCategories.has(category.id as number);
                  const isReordering = reorderingCategoryId === category.id;
                  const isHidden = category.is_public === false;

                  return (
                    <div
                      key={category.id}
                      className={`flex min-h-[40px] items-center px-4 py-2.5 transition-all ${isEditing ? 'border-l-4 border-orange-500 bg-orange-900/20' : ''} ${isSelected ? 'border-l-4 border-blue-500 bg-blue-900/20' : ''} ${isReordering ? 'border-l-4 border-purple-500 bg-purple-900/20' : ''} ${!isEditing && !isSelected && !isReordering && isAdmin ? 'cursor-pointer hover:bg-gray-800/30' : ''} `}
                      onClick={e => handleCategoryClick(category, e)}
                    >
                      <div className="grid w-full grid-cols-1 items-center gap-2 md:grid-cols-12 md:gap-4">
                        {/* Forum Info - full width on mobile, col-span-6 on desktop */}
                        <div className="md:col-span-6">
                          {isEditing ? (
                            <div className="space-y-2">
                              {editStep === 'name' ? (
                                <div className="flex items-center gap-3">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="max-w-xs flex-1 rounded border border-orange-500 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="Category name"
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleConfirmName();
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleCancelEdit();
                                      }
                                    }}
                                  />
                                  <span className="whitespace-nowrap text-xs text-orange-400">
                                    Enter to confirm • Esc to cancel
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-start gap-3">
                                  <textarea
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    className="max-w-md flex-1 resize-none rounded border border-orange-500 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="Category description (optional)"
                                    rows={2}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEdit();
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleCancelEdit();
                                      }
                                    }}
                                  />
                                  <span className="mt-1 whitespace-nowrap text-xs text-orange-400">
                                    Enter to save • Esc to cancel
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : isReordering ? (
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-sm font-medium text-purple-300">
                                  {category.name}
                                </h3>
                                <p className="mt-0.5 text-xs text-purple-400">↕ MOVING ↔</p>
                              </div>
                            </div>
                          ) : (
                            <Link
                              href={`/forums/category/${category.slug}`}
                              className="block min-w-0"
                              onClick={e =>
                                isAdmin &&
                                (e.ctrlKey || e.shiftKey || e.altKey) &&
                                e.preventDefault()
                              }
                            >
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="truncate text-sm font-medium text-white">
                                    {category.name}
                                  </h3>
                                  {category.description && (
                                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">
                                      {category.description}
                                    </p>
                                  )}
                                </div>
                                {/* Mobile-only stats on right */}
                                <div className="flex shrink-0 items-center gap-3 text-xs md:hidden">
                                  <span className="font-medium text-blue-400">
                                    {category.topic_count || 0}
                                  </span>
                                  <span className="font-medium text-green-400">
                                    {category.post_count || 0}
                                  </span>
                                </div>
                                {isHidden && (
                                  <svg
                                    className="h-4 w-4 text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-label="Admin Only"
                                  >
                                    <title>Admin Only</title>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                    />
                                  </svg>
                                )}
                              </div>
                            </Link>
                          )}
                        </div>

                        {/* Topics Count - hidden on mobile */}
                        <div className="hidden text-center md:col-span-2 md:block">
                          <div className="text-sm font-medium text-blue-400">
                            {category.topic_count || 0}
                          </div>
                        </div>

                        {/* Posts Count - hidden on mobile */}
                        <div className="hidden text-center md:col-span-2 md:block">
                          <div className="text-sm font-medium text-green-400">
                            {category.post_count || 0}
                          </div>
                        </div>

                        {/* Last Activity - hidden on mobile */}
                        <div className="hidden text-right md:col-span-2 md:block">
                          {category.last_activity_at ? (
                            <div>
                              <div className="text-xs text-gray-300">
                                <ClientDate date={category.last_activity_at} format="date" />
                              </div>
                              <div className="text-xs text-gray-500">
                                <ClientDate date={category.last_activity_at} format="time" />
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">No activity</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Create new category in this section (admin only) */}
                {isAdmin && creatingSectionId === section.id && (
                  <div className="border-t border-gray-700 bg-gray-800/20 px-4 py-3">
                    {newStep === 'name' ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="h-9 w-64 rounded border border-blue-500 bg-gray-800 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Category name"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newName.trim()) {
                              e.preventDefault();
                              handleConfirmNewName();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              setCreatingSectionId(null);
                              setNewName('');
                              setNewDescription('');
                              setNewStep('name');
                              setNewIcon('');
                            }
                          }}
                        />
                        <span className="whitespace-nowrap text-xs text-blue-400">
                          Enter to continue • Esc to cancel
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={newDescription}
                          onChange={e => setNewDescription(e.target.value)}
                          className="h-9 w-64 rounded border border-blue-500 bg-gray-800 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Category description"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCreate(section.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewStep('name');
                            }
                          }}
                        />
                        <span className="whitespace-nowrap text-xs text-blue-400">
                          Enter to create • Esc to go back
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Create category button */}
                {isAdmin && creatingSectionId !== section.id && (
                  <div className="border-t border-gray-700 bg-gray-800/10 px-4 py-2">
                    <button
                      onClick={() => {
                        setCreatingSectionId(section.id);
                        setNewName('');
                        setNewDescription('');
                        setNewStep('name');
                        setNewIcon('');
                      }}
                      className="w-full rounded border border-blue-500/30 py-1.5 text-sm text-blue-400 transition-colors hover:border-blue-400/50 hover:text-blue-300"
                    >
                      + Add Category
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Fixed-position section reorder arrows (admin only) */}
        {isAdmin &&
          sections.map((section, sectionIndex) => {
            const topPosition = sectionPositions.get(section.id);
            if (topPosition === undefined) return null;

            return (
              <div
                key={`arrows-${section.id}`}
                className="fixed z-10 flex flex-col gap-1"
                style={{
                  left: 'calc((100vw - 72rem) / 2 - 2.5rem)',
                  top: `${topPosition}px`,
                }}
              >
                <button
                  onClick={() => handleMoveSectionUp(section.id)}
                  disabled={saving || sectionIndex === 0}
                  className="text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-gray-600"
                  title="Move section up"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveSectionDown(section.id)}
                  disabled={saving || sectionIndex === sections.length - 1}
                  className="text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-gray-600"
                  title="Move section down"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
            );
          })}

        {/* Create new section (admin only) */}
        {isAdmin && (
          <div className="rounded border border-gray-700 bg-gray-900/30 p-4">
            {!isCreatingSection ? (
              <button
                onClick={() => setIsCreatingSection(true)}
                className="w-full rounded border border-blue-500/50 py-2 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:text-blue-300"
              >
                + Create New Section
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  className="h-9 w-96 rounded border border-blue-500 bg-gray-800 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Section name"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSectionName.trim()) {
                      e.preventDefault();
                      handleCreateSection();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsCreatingSection(false);
                      setNewSectionName('');
                    }
                  }}
                />
                <span className="whitespace-nowrap text-xs text-blue-400">
                  Enter to create • Esc to cancel
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ForumCategoryList.displayName = 'ForumCategoryList';
