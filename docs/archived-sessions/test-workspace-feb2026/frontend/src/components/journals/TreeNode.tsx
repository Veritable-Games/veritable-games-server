'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useJournalsUI } from '@/stores/journals/useJournalsUI';
import { useJournalsSelection } from '@/stores/journals/useJournalsSelection';
import type { JournalNode } from '@/stores/journals/types';

interface TreeNodeProps {
  node: JournalNode;
  level?: number;
  onSelect: (node: JournalNode) => void;
  onRename: (node: JournalNode, newTitle: string) => void;
  draggable?: boolean;
  userRole?: string;
}

/**
 * TreeNode - Recursive component for hierarchical journal navigation
 * Displays journals in a collapsible tree structure
 * - Ctrl+Click title to rename
 * - Delete/Restore actions are in the editor header
 */
export function TreeNode({
  node,
  level = 0,
  onSelect,
  onRename,
  draggable = false,
  userRole = 'user',
}: TreeNodeProps) {
  const { expandedNodes, selectedJournalId, toggleNodeExpansion } = useJournalsUI();
  const { selectedJournalsForDeletion, toggleJournalSelection } = useJournalsSelection();

  const [isRenaming, setIsRenaming] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedJournalsForDeletion.has(node.id);
  const isCurrentlyViewing = selectedJournalId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isDeleted = node.is_deleted === true;

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleNodeExpansion(node.id);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    if (isRenaming) return;

    // Ctrl+Click for rename
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      if (!isDeleted) {
        // Only allow renaming non-deleted journals
        setIsRenaming(true);
        setEditTitle(node.title);
      }
    } else {
      // Normal click - select journal for viewing (clears other selections)
      onSelect(node);
    }
  };

  const handleRenameSubmit = () => {
    if (editTitle.trim() && editTitle !== node.title) {
      onRename(node, editTitle.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setEditTitle(node.title);
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  // Visual treatment for deleted journals
  const getNodeClasses = () => {
    const base = 'flex cursor-pointer items-center rounded px-2 py-1.5 transition-colors';

    if (isDeleted) {
      // Deleted journals: grayed out
      return `${base} text-gray-500 hover:bg-gray-800/30`;
    }

    if (isSelected) {
      return `${base} bg-blue-500/20 text-blue-300`;
    }

    if (isCurrentlyViewing) {
      return `${base} bg-blue-600/30 text-blue-200`;
    }

    return `${base} text-gray-300 hover:bg-gray-800/50`;
  };

  // Drag handlers for moving journals between categories
  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable) return;
    e.dataTransfer.setData('application/json', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="select-none">
      <div
        className={getNodeClasses()}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
        draggable={draggable}
        onDragStart={handleDragStart}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="mr-1 flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-gray-700/50"
          >
            <svg
              className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : (
          <span className="mr-1 w-4" />
        )}

        {/* Document Icon */}
        <svg className="mr-2 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
            clipRule="evenodd"
          />
        </svg>

        {/* Title - Editable on Ctrl+click */}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRenameSubmit}
            onClick={e => e.stopPropagation()}
            className="flex-1 rounded border border-blue-500 bg-gray-800 px-1 py-0.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <span className="flex-1 truncate text-sm">{node.title}</span>
        )}
      </div>

      {/* Render children recursively if expanded */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              onRename={onRename}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}
