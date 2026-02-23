'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';
import {
  ClockIcon,
  UserIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';

interface EnhancedRevisionListProps {
  revisionManager: any;
}

export function EnhancedRevisionList({ revisionManager }: EnhancedRevisionListProps) {
  const formatting = useRevisionFormatting();
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [viewDensity, setViewDensity] = useState<'compact' | 'comfortable' | 'spacious'>(
    'comfortable'
  );

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
    return <div className="h-3 w-3 rounded-full bg-gray-500" />;
  };

  const getChangeSizeIndicator = (size: number, prevSize?: number) => {
    if (prevSize === undefined) return null;

    const diff = size - prevSize;
    const absPercent = (Math.abs(diff) / prevSize) * 100;

    if (absPercent < 2) return <MinusIcon className="h-3 w-3 text-gray-500" />;

    const Icon = diff > 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    const color = diff > 0 ? 'text-green-400' : 'text-red-400';

    return <Icon className={`h-3 w-3 ${color}`} />;
  };

  const getDensityClasses = () => {
    switch (viewDensity) {
      case 'compact':
        return 'py-2 px-3';
      case 'spacious':
        return 'py-4 px-4';
      default:
        return 'py-3 px-3';
    }
  };

  if (revisionManager.loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/30">
        <div className="text-center">
          <div className="relative">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
            <div className="absolute inset-0 mx-auto h-10 w-10 rounded-full border-2 border-gray-700/20"></div>
          </div>
          <p className="text-sm font-medium text-gray-400">Loading revision history...</p>
          <p className="mt-1 text-xs text-gray-500">Fetching project changes</p>
        </div>
      </div>
    );
  }

  if (revisionManager.hasError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/30 p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-800/30 bg-red-900/20">
            <ClockIcon className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Failed to Load Revisions</h3>
          <p className="mb-4 max-w-xs text-sm text-gray-400">{revisionManager.error}</p>
          <button
            onClick={revisionManager.retryFetch}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (revisionManager.isEmpty) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900/30 p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-700 bg-gray-800/50">
            <ClockIcon className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">No Revision History</h3>
          <p className="max-w-xs text-sm text-gray-400">
            This project doesn't have any revision history yet. Start editing to create your first
            revision.
          </p>
        </div>
      </div>
    );
  }

  const revisions = revisionManager.processedRevisions;

  return (
    <div className="flex h-full flex-col bg-gray-900/20">
      {/* Enhanced Search and Controls Header */}
      <div className="flex-none border-b border-gray-700/50 bg-gray-800/30 p-4">
        <div className="space-y-3">
          {/* Search bar with enhanced styling */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search revisions, summaries, or authors..."
              value={revisionManager.ui.searchQuery}
              onChange={e => revisionManager.setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-800/70 py-2.5 pl-10 pr-4 text-sm text-gray-100 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Enhanced filters and controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <select
                value={revisionManager.ui.sortBy}
                onChange={e =>
                  revisionManager.setSorting(
                    e.target.value as 'date' | 'size' | 'author',
                    revisionManager.ui.sortOrder
                  )
                }
                className="min-w-0 rounded-md border border-gray-600 bg-gray-800/70 px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="date">By Date</option>
                <option value="size">By Size</option>
                <option value="author">By Author</option>
              </select>

              <button
                onClick={() =>
                  revisionManager.setSorting(
                    revisionManager.ui.sortBy,
                    revisionManager.ui.sortOrder === 'desc' ? 'asc' : 'desc'
                  )
                }
                className="rounded p-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
                title={`Sort ${revisionManager.ui.sortOrder === 'desc' ? 'ascending' : 'descending'}`}
              >
                {revisionManager.ui.sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* View density control */}
            <div className="flex items-center space-x-1">
              {(['compact', 'comfortable', 'spacious'] as const).map(density => (
                <button
                  key={density}
                  onClick={() => setViewDensity(density)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    viewDensity === density
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                  title={`${density} view`}
                >
                  {density[0]?.toUpperCase() ?? 'D'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Revision List with Virtual Scrolling Feel */}
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

          return (
            <div
              key={revision.id}
              data-index={index}
              className={`group relative cursor-pointer border-b border-gray-700/30 transition-all duration-150 hover:bg-gray-800/50 ${getDensityClasses()} ${
                isSelected
                  ? 'border-l-4 border-l-blue-400 bg-blue-900/30 shadow-lg'
                  : 'hover:border-l-4 hover:border-l-gray-600'
              } ${isFocused ? 'ring-2 ring-blue-500/30' : ''} ${isLatest ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''} `}
              onClick={e => handleRevisionClick(revision.id, e)}
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
            >
              {/* Enhanced content layout */}
              <div className="flex items-start space-x-3">
                {/* Selection and status indicators */}
                <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center">
                  {isSelected ? (
                    <CheckIconSolid className="h-4 w-4 text-blue-400" />
                  ) : (
                    <div className="relative">
                      {getRevisionIcon(index, revision)}
                      {isLatest && (
                        <div className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-yellow-400"></div>
                      )}
                    </div>
                  )}
                </div>

                {/* Enhanced revision content */}
                <div className="min-w-0 flex-1">
                  {/* Summary and metadata */}
                  <div className="mb-2 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium leading-tight text-gray-100 ${
                          viewDensity === 'compact' ? 'truncate text-sm' : 'text-sm'
                        } mb-1`}
                      >
                        {revision.summary || (
                          <span className="italic text-gray-500">No summary provided</span>
                        )}
                      </p>

                      {/* Compact metadata row */}
                      <div className="flex items-center space-x-3 text-xs text-gray-400">
                        <div className="flex items-center">
                          <UserIcon className="mr-1.5 h-3 w-3" />
                          <span className="max-w-24 truncate font-medium">
                            {revision.author_name}
                          </span>
                        </div>
                        <span className="text-gray-600">•</span>
                        <div className="flex items-center">
                          <ClockIcon className="mr-1.5 h-3 w-3" />
                          <span>{formatting.formatDate(revision.revision_timestamp, true)}</span>
                        </div>
                        <span className="text-gray-600">•</span>
                        <div className="flex items-center font-mono text-blue-400">
                          #{revision.id}
                        </div>
                      </div>
                    </div>

                    {/* Change indicator */}
                    <div className="ml-3 flex-none opacity-0 transition-opacity group-hover:opacity-100">
                      {getChangeSizeIndicator(revision.size, prevRevision?.size)}
                    </div>
                  </div>

                  {/* Size and actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="font-mono">{formatting.formatSize(revision.size)}</span>
                      {prevRevision && (
                        <>
                          <span>•</span>
                          <span
                            className={`font-medium ${
                              revision.size > prevRevision.size ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {revision.size > prevRevision.size ? '+' : ''}
                            {revision.size - prevRevision.size} chars
                          </span>
                        </>
                      )}
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {index > 0 && (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              revisionManager.quickCompareWithPrevious(revision.id);
                            }}
                            className="rounded px-1.5 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                            title="Compare with previous"
                          >
                            ←
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              revisionManager.quickCompareWithLatest(revision.id);
                            }}
                            className="rounded px-1.5 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                            title="Compare with latest"
                          >
                            ↑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Selection order indicator */}
              {isSelected && revisionManager.selectedRevisions.length > 1 && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-lg">
                  {revisionManager.selectedRevisions.indexOf(revision.id) + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Enhanced statistics footer */}
      {revisionManager.getRevisionStats && (
        <div className="flex-none border-t border-gray-700/50 bg-gray-800/40 p-3">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-gray-600/30 bg-gray-700/30 p-2 text-center">
              <div className="text-sm font-bold text-blue-400">
                {revisionManager.getRevisionStats.total}
              </div>
              <div className="font-medium text-gray-400">Total</div>
            </div>
            <div className="rounded border border-gray-600/30 bg-gray-700/30 p-2 text-center">
              <div className="text-sm font-bold text-green-400">
                {revisionManager.getRevisionStats.uniqueAuthors}
              </div>
              <div className="font-medium text-gray-400">Authors</div>
            </div>
            <div className="rounded border border-gray-600/30 bg-gray-700/30 p-2 text-center">
              <div className="text-sm font-bold text-yellow-400">
                {formatting.formatSize(revisionManager.getRevisionStats.totalSize || 0)}
              </div>
              <div className="font-medium text-gray-400">Size</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
