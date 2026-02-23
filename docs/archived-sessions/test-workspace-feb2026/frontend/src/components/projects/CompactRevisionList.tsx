'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';
import {
  MagnifyingGlassIcon,
  CheckIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';

interface CompactRevisionListProps {
  revisionManager: any;
}

export function CompactRevisionList({ revisionManager }: CompactRevisionListProps) {
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

  const handleRevisionClick = (revisionId: number, e: React.MouseEvent) => {
    if (e.shiftKey && revisionManager.hasSelections) {
      const lastSelected =
        revisionManager.selectedRevisions[revisionManager.selectedRevisions.length - 1];
      revisionManager.selectRevisionRange(lastSelected, revisionId);
    } else if (e.ctrlKey || e.metaKey) {
      revisionManager.toggleRevisionSelection(revisionId, true);
    } else {
      revisionManager.selectRevision(revisionId);
    }
  };

  const getRevisionIcon = (index: number, revision: any) => {
    if (index === 0) {
      return <StarIcon className="h-3 w-3 text-yellow-400" title="Latest revision" />;
    }
    if (revision.size > 10000) {
      return <ArrowTrendingUpIcon className="h-3 w-3 text-green-400" title="Major update" />;
    }
    return <div className="h-2.5 w-2.5 rounded-full bg-gray-500" />;
  };

  const getChangeSizeIndicator = (size: number, prevSize?: number) => {
    if (prevSize === undefined) return null;

    const diff = size - prevSize;
    const absPercent = (Math.abs(diff) / prevSize) * 100;

    if (absPercent < 2) return <MinusIcon className="h-2.5 w-2.5 text-gray-500" />;

    const Icon = diff > 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    const color = diff > 0 ? 'text-green-400' : 'text-red-400';

    return <Icon className={`h-2.5 w-2.5 ${color}`} />;
  };

  if (revisionManager.loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/30">
        <div className="text-center">
          <div className="relative">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
          </div>
          <p className="text-xs font-medium text-gray-400">Loading revisions...</p>
        </div>
      </div>
    );
  }

  if (revisionManager.hasError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/30 p-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-800/30 bg-red-900/20">
            <ClockIcon className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="mb-2 text-sm font-semibold text-white">Failed to Load Revisions</h3>
          <p className="mb-3 max-w-xs text-xs text-gray-400">{revisionManager.error}</p>
          <button
            onClick={revisionManager.retryFetch}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (revisionManager.isEmpty) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/30 p-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-700 bg-gray-800/50">
            <ClockIcon className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="mb-2 text-sm font-semibold text-white">No Revision History</h3>
          <p className="max-w-xs text-xs text-gray-400">
            This project doesn't have any revision history yet.
          </p>
        </div>
      </div>
    );
  }

  const revisions = revisionManager.processedRevisions;

  return (
    <div className="flex h-full flex-col bg-gray-900/20">
      {/* Ultra-compact search header - minimal height */}
      <div className="flex-none border-b border-gray-700/50 bg-gray-800/30 p-2">
        <div className="space-y-2">
          {/* Compact search bar */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
              <MagnifyingGlassIcon className="h-3 w-3 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search revisions..."
              value={revisionManager.ui.searchQuery}
              onChange={e => revisionManager.setSearch(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800/70 py-1.5 pl-7 pr-3 text-xs text-gray-100 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>

          {/* Ultra-compact controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <select
                value={revisionManager.ui.sortBy}
                onChange={e =>
                  revisionManager.setSorting(
                    e.target.value as 'date' | 'size' | 'author',
                    revisionManager.ui.sortOrder
                  )
                }
                className="min-w-0 rounded border border-gray-600 bg-gray-800/70 px-1.5 py-0.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="size">Size</option>
                <option value="author">Author</option>
              </select>

              <button
                onClick={() =>
                  revisionManager.setSorting(
                    revisionManager.ui.sortBy,
                    revisionManager.ui.sortOrder === 'desc' ? 'asc' : 'desc'
                  )
                }
                className="rounded p-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
                title={`Sort ${revisionManager.ui.sortOrder === 'desc' ? 'ascending' : 'descending'}`}
              >
                {revisionManager.ui.sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* Compact stats */}
            <div className="font-mono text-xs text-gray-400">{revisions.length} revisions</div>
          </div>
        </div>
      </div>

      {/* Table-like revision list header */}
      <div className="flex-none border-b border-gray-700/30 bg-gray-800/20 px-2 py-1.5 text-xs font-medium text-gray-400">
        <div className="grid grid-cols-12 items-center gap-1">
          <div className="col-span-1">#</div>
          <div className="col-span-4 truncate">Summary</div>
          <div className="col-span-2 truncate">Author</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-1 text-right">Size</div>
          <div className="col-span-1 text-center">Δ</div>
          <div className="col-span-1 text-center">Actions</div>
        </div>
      </div>

      {/* Ultra-compact revision list with table layout */}
      <div
        ref={listRef}
        className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 flex-1 overflow-y-auto"
        tabIndex={0}
        role="listbox"
        aria-label="Revision history"
      >
        {revisions.map((revision: any, index: number) => {
          const isSelected = revisionManager.isRevisionSelected(revision.id);
          const isFocused = index === focusedIndex;
          const prevRevision = index < revisions.length - 1 ? revisions[index + 1] : null;
          const isLatest = index === 0;
          const sizeDiff = prevRevision ? revision.size - prevRevision.size : 0;

          return (
            <div
              key={revision.id}
              data-index={index}
              className={`group relative cursor-pointer border-b border-gray-700/20 px-2 py-1 transition-all duration-100 hover:bg-gray-800/40 ${
                isSelected
                  ? 'border-l-2 border-l-blue-400 bg-blue-900/30'
                  : 'hover:border-l-2 hover:border-l-gray-600'
              } ${isFocused ? 'ring-1 ring-blue-500/30' : ''} ${isLatest ? 'from-yellow-500/3 bg-gradient-to-r to-transparent' : ''} `}
              onClick={e => handleRevisionClick(revision.id, e)}
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
            >
              <div className="grid grid-cols-12 items-center gap-1 text-xs">
                {/* Revision number and selection indicator */}
                <div className="col-span-1 flex items-center justify-center">
                  {isSelected ? (
                    <CheckIconSolid className="h-3 w-3 text-blue-400" />
                  ) : (
                    <div className="relative flex items-center justify-center">
                      {getRevisionIcon(index, revision)}
                      {isLatest && (
                        <div className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400"></div>
                      )}
                    </div>
                  )}
                </div>

                {/* Summary - truncated for space */}
                <div className="col-span-4 min-w-0">
                  <div
                    className={`truncate font-medium leading-tight text-gray-100 ${
                      revision.summary ? '' : 'italic text-gray-500'
                    }`}
                  >
                    {revision.summary || 'No summary'}
                  </div>
                  <div className="font-mono text-xs text-blue-400 opacity-75">#{revision.id}</div>
                </div>

                {/* Author - truncated */}
                <div className="col-span-2 min-w-0">
                  <div className="truncate font-medium text-gray-300">{revision.author_name}</div>
                </div>

                {/* Date - compact format */}
                <div className="col-span-2">
                  <div className="font-mono text-gray-400">
                    {formatting.formatDate(revision.revision_timestamp, true)}
                  </div>
                </div>

                {/* Size - compact */}
                <div className="col-span-1 text-right">
                  <div className="font-mono text-xs text-gray-400">
                    {formatting.formatSize(revision.size)}
                  </div>
                </div>

                {/* Change indicator */}
                <div className="col-span-1 flex justify-center">
                  <div className="flex items-center">
                    {getChangeSizeIndicator(revision.size, prevRevision?.size)}
                    {prevRevision && (
                      <div
                        className={`ml-1 font-mono text-xs ${
                          sizeDiff > 0
                            ? 'text-green-400'
                            : sizeDiff < 0
                              ? 'text-red-400'
                              : 'text-gray-500'
                        }`}
                      >
                        {sizeDiff > 0 ? '+' : ''}
                        {Math.abs(sizeDiff) > 999 ? `${Math.round(sizeDiff / 1000)}k` : sizeDiff}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick action buttons */}
                <div className="col-span-1 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  {index > 0 && (
                    <div className="flex space-x-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          revisionManager.quickCompareWithPrevious(revision.id);
                        }}
                        className="rounded px-1 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                        title="Compare with previous"
                      >
                        ←
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          revisionManager.quickCompareWithLatest(revision.id);
                        }}
                        className="rounded px-1 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                        title="Compare with latest"
                      >
                        ↑
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Selection order indicator */}
              {isSelected && revisionManager.selectedRevisions.length > 1 && (
                <div className="absolute right-1 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-sm">
                  {revisionManager.selectedRevisions.indexOf(revision.id) + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ultra-compact statistics footer */}
      {revisionManager.getRevisionStats && (
        <div className="flex-none border-t border-gray-700/50 bg-gray-800/40 p-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-gray-700/30 p-1 text-center">
              <div className="font-bold text-blue-400">
                {revisionManager.getRevisionStats.total}
              </div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="rounded bg-gray-700/30 p-1 text-center">
              <div className="font-bold text-green-400">
                {revisionManager.getRevisionStats.uniqueAuthors}
              </div>
              <div className="text-xs text-gray-400">Authors</div>
            </div>
            <div className="rounded bg-gray-700/30 p-1 text-center">
              <div className="text-xs font-bold text-yellow-400">
                {formatting.formatSize(revisionManager.getRevisionStats.totalSize || 0)}
              </div>
              <div className="text-xs text-gray-400">Size</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
