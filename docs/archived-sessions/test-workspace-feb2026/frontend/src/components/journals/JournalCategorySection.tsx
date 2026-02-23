'use client';

import React, { useState, useCallback } from 'react';
import { useJournalsData } from '@/stores/journals/useJournalsData';
import { useJournalsUI } from '@/stores/journals/useJournalsUI';
import { useJournalsSelection } from '@/stores/journals/useJournalsSelection';
import type { JournalCategory, JournalNode } from '@/stores/journals/types';
import { TreeNode } from './TreeNode';
import { logger } from '@/lib/utils/logger';

interface JournalCategorySectionProps {
  category: JournalCategory;
  journals: JournalNode[];
  currentSlug?: string;
  onSelectJournal: (journal: JournalNode) => void;
  onRenameJournal: (journal: JournalNode, newTitle: string) => void;
  onRenameCategory?: (category: JournalCategory, newName: string) => void;
  onDeleteCategory?: (category: JournalCategory) => void;
  onMoveJournal?: (journal: JournalNode, categoryId: string) => void;
  userRole?: string;
}

/**
 * JournalCategorySection - Collapsible category with its journals
 */
export function JournalCategorySection({
  category,
  journals,
  currentSlug,
  onSelectJournal,
  onRenameJournal,
  onRenameCategory,
  onDeleteCategory,
  onMoveJournal,
  userRole = 'user',
}: JournalCategorySectionProps) {
  const { categories } = useJournalsData();
  const { expandedCategories, toggleCategoryExpansion } = useJournalsUI();
  const { selectedCategoriesForDeletion, toggleCategorySelection } = useJournalsSelection();
  const isExpanded = expandedCategories.has(category.id);
  const isSelected = selectedCategoriesForDeletion.has(category.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const isUncategorized = category.name === 'Uncategorized';
  const journalCount = journals.length;

  const handleToggle = useCallback(() => {
    toggleCategoryExpansion(category.id);
  }, [category.id, toggleCategoryExpansion]);

  const handleRenameSubmit = useCallback(() => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== category.name && onRenameCategory) {
      onRenameCategory(category, trimmedName);
    }
    setIsEditing(false);
  }, [editName, category, onRenameCategory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameSubmit();
      } else if (e.key === 'Escape') {
        setEditName(category.name);
        setIsEditing(false);
      }
    },
    [handleRenameSubmit, category.name]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  }, []);

  const handleDelete = useCallback(() => {
    setShowContextMenu(false);
    if (onDeleteCategory) {
      onDeleteCategory(category);
    }
  }, [category, onDeleteCategory]);

  const handleStartRename = useCallback(() => {
    setShowContextMenu(false);
    setEditName(category.name);
    setIsEditing(true);
  }, [category.name]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const journalData = e.dataTransfer.getData('application/json');
      if (journalData && onMoveJournal) {
        try {
          const journal = JSON.parse(journalData) as JournalNode;
          if (journal.journal_category_id !== category.id) {
            onMoveJournal(journal, category.id);
          }
        } catch {
          logger.error('Failed to parse dropped journal data');
        }
      }
    },
    [category.id, onMoveJournal]
  );

  // Close context menu when clicking outside
  React.useEffect(() => {
    if (showContextMenu) {
      const handleClick = () => setShowContextMenu(false);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showContextMenu]);

  return (
    <div
      className={`mb-1 ${isDragOver ? 'rounded ring-2 ring-inset ring-blue-500' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Category Header */}
      <div
        className="group relative flex items-center gap-1 rounded px-2 py-1.5 hover:bg-gray-800/50"
        onContextMenu={!isUncategorized ? handleContextMenu : undefined}
      >
        {/* Category Name */}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-0.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={e => {
              if (e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                if (!isUncategorized) {
                  handleStartRename();
                }
              } else {
                handleToggle();
              }
            }}
            className={`flex flex-1 items-center gap-2 rounded px-1 text-left text-sm font-medium transition-colors ${
              isSelected ? 'bg-blue-900/30 text-blue-300' : 'text-gray-300 hover:bg-gray-700/30'
            }`}
          >
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="truncate">{category.name}</span>
            <span className="ml-auto text-xs text-gray-500">({journalCount})</span>
          </button>
        )}

        {/* Context Menu */}
        {showContextMenu && !isUncategorized && (
          <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-md border border-gray-700 bg-gray-800 py-1 shadow-lg">
            <button
              onClick={handleStartRename}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Rename
            </button>
            <button
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-gray-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Journal List (when expanded) */}
      {isExpanded && (
        <div className="ml-4 space-y-0.5 border-l border-gray-800 pl-2">
          {journals.length === 0 ? (
            <div className="py-2 text-xs italic text-gray-500">No journals in this category</div>
          ) : (
            journals.map(journal => (
              <TreeNode
                key={journal.id}
                node={journal}
                onSelect={onSelectJournal}
                onRename={onRenameJournal}
                userRole={userRole}
                draggable
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
