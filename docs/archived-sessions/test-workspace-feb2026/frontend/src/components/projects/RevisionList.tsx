'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';
import {
  ChevronRightIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';

interface RevisionListProps {
  revisionManager: any;
}

export function RevisionList({ revisionManager }: RevisionListProps) {
  const formatting = useRevisionFormatting();
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== listRef.current) return;

      const revisions = revisionManager.processedRevisions;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, revisions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < revisions.length) {
            const revision = revisions[focusedIndex];
            revisionManager.selectRevision(revision.id);
          }
          break;
        case 'c':
          if (revisionManager.canCompare) {
            e.preventDefault();
            revisionManager.compareRevisions();
          }
          break;
      }
    };

    const currentRef = listRef.current;
    if (currentRef) {
      currentRef.addEventListener('keydown', handleKeyDown);
      return () => currentRef.removeEventListener('keydown', handleKeyDown);
    }
  }, [revisionManager, focusedIndex]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.querySelector(`[data-index="${focusedIndex}"]`);
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  const handleRevisionClick = (revisionId: number, e: React.MouseEvent) => {
    if (e.shiftKey && revisionManager.hasSelections) {
      // Range selection
      const lastSelected =
        revisionManager.selectedRevisions[revisionManager.selectedRevisions.length - 1];
      revisionManager.selectRevisionRange(lastSelected, revisionId);
    } else if (e.ctrlKey || e.metaKey) {
      // Multi-selection
      revisionManager.toggleRevisionSelection(revisionId, true);
    } else {
      // Single selection
      revisionManager.selectRevision(revisionId);
    }
  };

  const getRevisionIcon = (index: number) => {
    if (index === 0) {
      return <div className="h-2 w-2 rounded-full bg-green-500" title="Latest revision" />;
    }
    return <div className="h-2 w-2 rounded-full bg-gray-400" />;
  };

  const getChangeSizeIndicator = (size: number, prevSize?: number) => {
    if (prevSize === undefined) return null;

    const diff = size - prevSize;
    const absPercent = (Math.abs(diff) / prevSize) * 100;

    if (absPercent < 5) return null;

    const color = diff > 0 ? 'text-green-600' : 'text-red-600';
    const sign = diff > 0 ? '+' : '';

    return (
      <span className={`text-xs ${color} font-medium`}>
        {sign}
        {diff > 0 ? formatting.formatSize(diff) : formatting.formatSize(Math.abs(diff))}
      </span>
    );
  };

  if (revisionManager.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading revisions...</p>
        </div>
      </div>
    );
  }

  if (revisionManager.hasError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <DocumentTextIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
            Failed to Load Revisions
          </h3>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{revisionManager.error}</p>
          <button
            onClick={revisionManager.retryFetch}
            className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (revisionManager.isEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <DocumentTextIcon className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-600" />
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
            No Revisions Found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This project doesn't have any revision history yet.
          </p>
        </div>
      </div>
    );
  }

  const revisions = revisionManager.processedRevisions;

  return (
    <div className="flex h-full flex-col">
      {/* Search and Filters */}
      <div className="flex-none border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="relative">
          <input
            type="text"
            placeholder="Search revisions..."
            value={revisionManager.ui.searchQuery}
            onChange={e => revisionManager.setSearch(e.target.value)}
            className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm leading-5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Quick filters */}
        <div className="mt-2 flex items-center space-x-2">
          <select
            value={revisionManager.ui.sortBy}
            onChange={e =>
              revisionManager.setSorting(
                e.target.value as 'date' | 'size' | 'author',
                revisionManager.ui.sortOrder
              )
            }
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
          >
            <option value="date">Sort by Date</option>
            <option value="size">Sort by Size</option>
            <option value="author">Sort by Author</option>
          </select>
          <button
            onClick={() =>
              revisionManager.setSorting(
                revisionManager.ui.sortBy,
                revisionManager.ui.sortOrder === 'desc' ? 'asc' : 'desc'
              )
            }
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {revisionManager.ui.sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Revision List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        tabIndex={0}
        role="listbox"
        aria-label="Revision history"
      >
        {revisions.map((revision: any, index: number) => {
          const isSelected = revisionManager.isRevisionSelected(revision.id);
          const isFocused = index === focusedIndex;
          const prevRevision = index < revisions.length - 1 ? revisions[index + 1] : null;

          return (
            <div
              key={revision.id}
              data-index={index}
              className={`relative flex cursor-pointer items-start border-b border-gray-100 p-4 transition-colors dark:border-gray-700 ${
                isSelected
                  ? 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              } ${isFocused ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''} `}
              onClick={e => handleRevisionClick(revision.id, e)}
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
            >
              {/* Selection indicator */}
              <div className="mr-3 mt-0.5 flex h-5 w-5 flex-none items-center justify-center">
                {isSelected ? (
                  <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  getRevisionIcon(index)
                )}
              </div>

              {/* Revision content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Summary */}
                    <p className="text-sm font-medium leading-5 text-gray-900 dark:text-gray-100">
                      {revision.summary || 'No summary provided'}
                    </p>

                    {/* Metadata */}
                    <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <UserIcon className="mr-1 h-3 w-3" />
                        {revision.author_name}
                      </div>
                      <div className="flex items-center">
                        <ClockIcon className="mr-1 h-3 w-3" />
                        {formatting.formatDate(revision.revision_timestamp, true)}
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>{formatting.formatSize(revision.size)}</span>
                        {getChangeSizeIndicator(revision.size, prevRevision?.size)}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="mt-2 flex items-center space-x-2">
                      {index > 0 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            revisionManager.quickCompareWithPrevious(revision.id);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Compare with previous
                        </button>
                      )}
                      {index > 0 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            revisionManager.quickCompareWithLatest(revision.id);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Compare with latest
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Revision ID */}
                  <div className="ml-3 flex-none font-mono text-xs text-gray-400 dark:text-gray-500">
                    #{revision.id}
                  </div>
                </div>
              </div>

              {/* Selection count indicator */}
              {isSelected && revisionManager.selectedRevisions.length > 1 && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white dark:bg-blue-500">
                  {revisionManager.selectedRevisions.indexOf(revision.id) + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Statistics */}
      {revisionManager.getRevisionStats && (
        <div className="flex-none border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Total revisions:</span>
              <span className="font-medium">{revisionManager.getRevisionStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Total size:</span>
              <span className="font-medium">
                {formatting.formatSize(revisionManager.getRevisionStats.totalSize, true)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Contributors:</span>
              <span className="font-medium">{revisionManager.getRevisionStats.uniqueAuthors}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
