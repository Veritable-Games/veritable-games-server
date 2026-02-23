'use client';

import React, {
  useRef,
  useEffect,
  useState,
  memo,
  useTransition,
  startTransition,
  useMemo,
  useCallback,
  Suspense,
} from 'react';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';
import {
  ChevronRightIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';

type ViewMode = 'default' | 'enhanced' | 'compact';
type ViewDensity = 'compact' | 'comfortable' | 'spacious';

interface UnifiedRevisionListProps {
  revisionManager: any;
  mode?: ViewMode;
  initialDensity?: ViewDensity;
  showSearch?: boolean;
  showStats?: boolean;
  className?: string;
}

// Loading component for Suspense boundary
const RevisionListLoading = memo(() => (
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
));
RevisionListLoading.displayName = 'RevisionListLoading';

// Error component for error boundaries
const RevisionListError = memo<{ error: string; onRetry: () => void }>(({ error, onRetry }) => (
  <div className="flex h-full items-center justify-center bg-gray-900/30 p-6">
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-800/30 bg-red-900/20">
        <ClockIcon className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">Failed to Load Revisions</h3>
      <p className="mb-4 max-w-xs text-sm text-gray-400">{error}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500"
      >
        Try Again
      </button>
    </div>
  </div>
));
RevisionListError.displayName = 'RevisionListError';

// Empty state component
const RevisionListEmpty = memo(() => (
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
));
RevisionListEmpty.displayName = 'RevisionListEmpty';

// Memoized revision icon component
const RevisionIcon = memo<{ index: number; revision: any; mode: ViewMode }>(
  ({ index, revision, mode }) => {
    if (index === 0) {
      return (
        <StarIcon
          className={`${mode === 'compact' ? 'h-3 w-3' : 'h-4 w-4'} text-yellow-400`}
          title="Latest revision"
        />
      );
    }
    if (revision.size > 10000) {
      return (
        <ArrowTrendingUpIcon
          className={`${mode === 'compact' ? 'h-3 w-3' : 'h-4 w-4'} text-green-400`}
          title="Major update"
        />
      );
    }
    return (
      <div
        className={`${mode === 'compact' ? 'h-2.5 w-2.5' : 'h-3 w-3'} rounded-full bg-gray-500`}
      />
    );
  }
);
RevisionIcon.displayName = 'RevisionIcon';

// Memoized change size indicator
const ChangeSizeIndicator = memo<{ size: number; prevSize?: number; mode: ViewMode }>(
  ({ size, prevSize, mode }) => {
    if (prevSize === undefined) return null;

    const diff = size - prevSize;
    const absPercent = (Math.abs(diff) / prevSize) * 100;

    if (absPercent < 2) {
      return (
        <MinusIcon className={`${mode === 'compact' ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-gray-500`} />
      );
    }

    const Icon = diff > 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    const color = diff > 0 ? 'text-green-400' : 'text-red-400';

    return <Icon className={`${mode === 'compact' ? 'h-2.5 w-2.5' : 'h-3 w-3'} ${color}`} />;
  }
);
ChangeSizeIndicator.displayName = 'ChangeSizeIndicator';

// Memoized revision item component
const RevisionItem = memo<{
  revision: any;
  index: number;
  prevRevision: any;
  isSelected: boolean;
  isFocused: boolean;
  isLatest: boolean;
  mode: ViewMode;
  density: ViewDensity;
  formatting: any;
  onRevisionClick: (revisionId: number, e: React.MouseEvent) => void;
  onQuickCompare: (revisionId: number, type: 'previous' | 'latest') => void;
}>(
  ({
    revision,
    index,
    prevRevision,
    isSelected,
    isFocused,
    isLatest,
    mode,
    density,
    formatting,
    onRevisionClick,
    onQuickCompare,
  }) => {
    const getDensityClasses = useCallback(() => {
      switch (density) {
        case 'compact':
          return mode === 'compact' ? 'py-1 px-2' : 'py-2 px-3';
        case 'spacious':
          return 'py-4 px-4';
        default:
          return 'py-3 px-3';
      }
    }, [density, mode]);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        onRevisionClick(revision.id, e);
      },
      [revision.id, onRevisionClick]
    );

    const handleCompareWithPrevious = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onQuickCompare(revision.id, 'previous');
      },
      [revision.id, onQuickCompare]
    );

    const handleCompareWithLatest = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onQuickCompare(revision.id, 'latest');
      },
      [revision.id, onQuickCompare]
    );

    // Compact table layout for compact mode
    if (mode === 'compact') {
      const sizeDiff = prevRevision ? revision.size - prevRevision.size : 0;

      return (
        <div
          key={revision.id}
          data-index={index}
          className={`group relative cursor-pointer border-b border-gray-700/20 px-2 py-1 transition-all duration-100 hover:bg-gray-800/40 ${isSelected ? 'border-l-2 border-l-blue-400 bg-blue-900/30' : 'hover:border-l-2 hover:border-l-gray-600'} ${isFocused ? 'ring-1 ring-blue-500/30' : ''} ${isLatest ? 'from-yellow-500/3 bg-gradient-to-r to-transparent' : ''} `}
          onClick={handleClick}
          role="option"
          aria-selected={isSelected}
          tabIndex={-1}
        >
          <div className="grid grid-cols-12 items-center gap-1 text-xs">
            <div className="col-span-1 flex items-center justify-center">
              {isSelected ? (
                <CheckIconSolid className="h-3 w-3 text-blue-400" />
              ) : (
                <div className="relative flex items-center justify-center">
                  <RevisionIcon index={index} revision={revision} mode={mode} />
                  {isLatest && (
                    <div className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400"></div>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-4 min-w-0">
              <div
                className={`truncate font-medium leading-tight text-gray-100 ${revision.summary ? '' : 'italic text-gray-500'}`}
              >
                {revision.summary || 'No summary'}
              </div>
              <div className="font-mono text-xs text-blue-400 opacity-75">#{revision.id}</div>
            </div>
            <div className="col-span-2 min-w-0">
              <div className="truncate font-medium text-gray-300">{revision.author_name}</div>
            </div>
            <div className="col-span-2">
              <div className="font-mono text-gray-400">
                {formatting.formatDate(revision.revision_timestamp, true)}
              </div>
            </div>
            <div className="col-span-1 text-right">
              <div className="font-mono text-xs text-gray-400">
                {formatting.formatSize(revision.size)}
              </div>
            </div>
            <div className="col-span-1 flex justify-center">
              <div className="flex items-center">
                <ChangeSizeIndicator
                  size={revision.size}
                  prevSize={prevRevision?.size}
                  mode={mode}
                />
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
            <div className="col-span-1 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              {index > 0 && (
                <div className="flex space-x-1">
                  <button
                    onClick={handleCompareWithPrevious}
                    className="rounded px-1 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                    title="Compare with previous"
                  >
                    ←
                  </button>
                  <button
                    onClick={handleCompareWithLatest}
                    className="rounded px-1 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                    title="Compare with latest"
                  >
                    ↑
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Enhanced or default layout
    return (
      <div
        key={revision.id}
        data-index={index}
        className={`group relative cursor-pointer border-b transition-all duration-150 hover:bg-gray-800/50 ${getDensityClasses()} ${mode === 'enhanced' ? 'border-gray-700/30' : 'border-gray-100 dark:border-gray-700'} ${
          isSelected
            ? `${mode === 'enhanced' ? 'border-l-4 border-l-blue-400 bg-blue-900/30 shadow-lg' : 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'}`
            : `${mode === 'enhanced' ? 'hover:border-l-4 hover:border-l-gray-600' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`
        } ${isFocused ? `ring-2 ${mode === 'enhanced' ? 'ring-blue-500/30' : 'ring-blue-300 dark:ring-blue-700'}` : ''} ${isLatest && mode === 'enhanced' ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''} `}
        onClick={handleClick}
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
      >
        <div className="flex items-start space-x-3">
          <div
            className={`flex-none ${mode === 'enhanced' ? 'h-6 w-6' : 'h-5 w-5'} mt-0.5 flex items-center justify-center`}
          >
            {isSelected ? (
              <CheckIconSolid
                className={`${mode === 'enhanced' ? 'h-4 w-4' : 'h-4 w-4'} text-blue-400`}
              />
            ) : (
              <div className="relative">
                <RevisionIcon index={index} revision={revision} mode={mode} />
                {isLatest && mode === 'enhanced' && (
                  <div className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-yellow-400"></div>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p
                  className={`mb-1 font-medium leading-tight ${
                    mode === 'enhanced'
                      ? 'text-sm text-gray-100'
                      : 'text-sm text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {revision.summary || (
                    <span
                      className={
                        mode === 'enhanced'
                          ? 'italic text-gray-500'
                          : 'italic text-gray-500 dark:text-gray-400'
                      }
                    >
                      No summary provided
                    </span>
                  )}
                </p>

                <div
                  className={`flex items-center space-x-3 text-xs ${
                    mode === 'enhanced' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <div className="flex items-center">
                    <UserIcon className="mr-1.5 h-3 w-3" />
                    <span className="max-w-24 truncate font-medium">{revision.author_name}</span>
                  </div>
                  <span className={mode === 'enhanced' ? 'text-gray-600' : 'text-gray-400'}>•</span>
                  <div className="flex items-center">
                    <ClockIcon className="mr-1.5 h-3 w-3" />
                    <span>{formatting.formatDate(revision.revision_timestamp, true)}</span>
                  </div>
                  <span className={mode === 'enhanced' ? 'text-gray-600' : 'text-gray-400'}>•</span>
                  <div
                    className={`flex items-center font-mono ${mode === 'enhanced' ? 'text-blue-400' : 'text-gray-400'}`}
                  >
                    #{revision.id}
                  </div>
                </div>
              </div>

              {mode === 'enhanced' && (
                <div className="ml-3 flex-none opacity-0 transition-opacity group-hover:opacity-100">
                  <ChangeSizeIndicator
                    size={revision.size}
                    prevSize={prevRevision?.size}
                    mode={mode}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div
                className={`flex items-center space-x-2 text-xs ${
                  mode === 'enhanced' ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <span className="font-mono">{formatting.formatSize(revision.size)}</span>
                {prevRevision && (
                  <>
                    <span>•</span>
                    <span
                      className={`font-medium ${
                        revision.size > prevRevision.size
                          ? 'text-green-400'
                          : revision.size < prevRevision.size
                            ? 'text-red-400'
                            : mode === 'enhanced'
                              ? 'text-gray-500'
                              : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {revision.size > prevRevision.size ? '+' : ''}
                      {revision.size - prevRevision.size} chars
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100">
                {index > 0 && (
                  <>
                    <button
                      onClick={handleCompareWithPrevious}
                      className={`rounded px-1.5 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300 ${
                        mode === 'enhanced' ? '' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title="Compare with previous"
                    >
                      {mode === 'enhanced' ? '←' : 'Compare with previous'}
                    </button>
                    <button
                      onClick={handleCompareWithLatest}
                      className={`rounded px-1.5 py-0.5 text-xs text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300 ${
                        mode === 'enhanced' ? '' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title="Compare with latest"
                    >
                      {mode === 'enhanced' ? '↑' : 'Compare with latest'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.revision.id === nextProps.revision.id &&
      prevProps.revision.updated_at === nextProps.revision.updated_at &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isFocused === nextProps.isFocused &&
      prevProps.mode === nextProps.mode &&
      prevProps.density === nextProps.density
    );
  }
);

RevisionItem.displayName = 'RevisionItem';

// Main unified component
export const UnifiedRevisionList = memo<UnifiedRevisionListProps>(
  ({
    revisionManager,
    mode = 'default',
    initialDensity = 'comfortable',
    showSearch = true,
    showStats = true,
    className = '',
  }) => {
    const formatting = useRevisionFormatting();
    const listRef = useRef<HTMLDivElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [viewDensity, setViewDensity] = useState<ViewDensity>(initialDensity);
    const [isPending, startTransition] = useTransition();

    // Memoized processed revisions
    const revisions = useMemo(() => {
      return revisionManager.processedRevisions || [];
    }, [revisionManager.processedRevisions]);

    // Handle keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target !== listRef.current || isPending) return;

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            startTransition(() => {
              setFocusedIndex(prev => Math.min(prev + 1, revisions.length - 1));
            });
            break;
          case 'ArrowUp':
            e.preventDefault();
            startTransition(() => {
              setFocusedIndex(prev => Math.max(prev - 1, 0));
            });
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
    }, [revisionManager, focusedIndex, revisions.length, isPending]);

    // Scroll focused item into view
    useEffect(() => {
      if (focusedIndex >= 0 && listRef.current) {
        const focusedElement = listRef.current.querySelector(`[data-index="${focusedIndex}"]`);
        if (focusedElement) {
          focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, [focusedIndex]);

    const handleRevisionClick = useCallback(
      (revisionId: number, e: React.MouseEvent) => {
        if (e.shiftKey && revisionManager.hasSelections) {
          const lastSelected =
            revisionManager.selectedRevisions[revisionManager.selectedRevisions.length - 1];
          revisionManager.selectRevisionRange(lastSelected, revisionId);
        } else if (e.ctrlKey || e.metaKey) {
          revisionManager.toggleRevisionSelection(revisionId, true);
        } else {
          revisionManager.selectRevision(revisionId);
        }
      },
      [revisionManager]
    );

    const handleQuickCompare = useCallback(
      (revisionId: number, type: 'previous' | 'latest') => {
        if (type === 'previous') {
          revisionManager.quickCompareWithPrevious(revisionId);
        } else {
          revisionManager.quickCompareWithLatest(revisionId);
        }
      },
      [revisionManager]
    );

    if (revisionManager.loading) {
      return (
        <Suspense fallback={<RevisionListLoading />}>
          <RevisionListLoading />
        </Suspense>
      );
    }

    if (revisionManager.hasError) {
      return (
        <RevisionListError error={revisionManager.error} onRetry={revisionManager.retryFetch} />
      );
    }

    if (revisionManager.isEmpty) {
      return <RevisionListEmpty />;
    }

    return (
      <div
        className={`flex h-full flex-col ${mode === 'enhanced' ? 'bg-gray-900/20' : ''} ${className}`}
      >
        {/* Search and Controls Header */}
        {showSearch && (
          <div
            className={`flex-none border-b ${
              mode === 'enhanced'
                ? 'border-gray-700/50 bg-gray-800/30 p-4'
                : mode === 'compact'
                  ? 'border-gray-700/50 bg-gray-800/30 p-2'
                  : 'border-gray-200 p-4 dark:border-gray-700'
            }`}
          >
            <div className={mode === 'enhanced' ? 'space-y-3' : 'space-y-2'}>
              {/* Search bar */}
              <div className="relative">
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 flex items-center ${
                    mode === 'compact' ? 'pl-2' : 'pl-3'
                  }`}
                >
                  <MagnifyingGlassIcon
                    className={`text-gray-400 ${mode === 'compact' ? 'h-3 w-3' : 'h-4 w-4'}`}
                  />
                </div>
                <input
                  type="text"
                  placeholder={
                    mode === 'enhanced'
                      ? 'Search revisions, summaries, or authors...'
                      : 'Search revisions...'
                  }
                  value={revisionManager.ui?.searchQuery || ''}
                  onChange={e => revisionManager.setSearch?.(e.target.value)}
                  className={`w-full rounded border transition-colors ${
                    mode === 'enhanced'
                      ? 'border-gray-600 bg-gray-800/70 py-2.5 pl-10 pr-4 text-sm text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                      : mode === 'compact'
                        ? 'border-gray-600 bg-gray-800/70 py-1.5 pl-7 pr-3 text-xs text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50'
                        : 'border-gray-300 bg-white py-2 pl-10 pr-3 text-sm leading-5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400'
                  }`}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <select
                    value={revisionManager.ui?.sortBy || 'date'}
                    onChange={e =>
                      revisionManager.setSorting?.(
                        e.target.value as 'date' | 'size' | 'author',
                        revisionManager.ui?.sortOrder
                      )
                    }
                    className={`rounded border focus:outline-none ${
                      mode === 'enhanced'
                        ? 'border-gray-600 bg-gray-800/70 px-2 py-1.5 text-xs text-gray-300 focus:ring-1 focus:ring-blue-500'
                        : mode === 'compact'
                          ? 'border-gray-600 bg-gray-800/70 px-1.5 py-0.5 text-xs text-gray-300 focus:ring-1 focus:ring-blue-500'
                          : 'border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <option value="date">{mode === 'compact' ? 'Date' : 'Sort by Date'}</option>
                    <option value="size">{mode === 'compact' ? 'Size' : 'Sort by Size'}</option>
                    <option value="author">
                      {mode === 'compact' ? 'Author' : 'Sort by Author'}
                    </option>
                  </select>

                  <button
                    onClick={() =>
                      revisionManager.setSorting?.(
                        revisionManager.ui?.sortBy,
                        revisionManager.ui?.sortOrder === 'desc' ? 'asc' : 'desc'
                      )
                    }
                    className={`text-xs transition-colors ${
                      mode === 'enhanced'
                        ? 'rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                        : mode === 'compact'
                          ? 'rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                          : 'px-2 py-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                    }`}
                  >
                    {revisionManager.ui?.sortOrder === 'desc' ? '↓' : '↑'}
                  </button>
                </div>

                {/* View controls for enhanced mode */}
                {mode === 'enhanced' && (
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
                      >
                        {density?.[0]?.toUpperCase() || ''}
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'compact' && (
                  <div className="font-mono text-xs text-gray-400">
                    {revisions.length} revisions
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Table header for compact mode */}
        {mode === 'compact' && (
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
        )}

        {/* Revision List */}
        <Suspense fallback={<RevisionListLoading />}>
          <div
            ref={listRef}
            className={`flex-1 overflow-y-auto ${
              mode === 'enhanced'
                ? 'scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800'
                : ''
            }`}
            tabIndex={0}
            role="listbox"
            aria-label="Revision history"
          >
            {revisions.map((revision: any, index: number) => {
              const isSelected = revisionManager.isRevisionSelected?.(revision.id) || false;
              const isFocused = index === focusedIndex;
              const prevRevision = index < revisions.length - 1 ? revisions[index + 1] : null;
              const isLatest = index === 0;

              return (
                <RevisionItem
                  key={revision.id}
                  revision={revision}
                  index={index}
                  prevRevision={prevRevision}
                  isSelected={isSelected}
                  isFocused={isFocused}
                  isLatest={isLatest}
                  mode={mode}
                  density={viewDensity}
                  formatting={formatting}
                  onRevisionClick={handleRevisionClick}
                  onQuickCompare={handleQuickCompare}
                />
              );
            })}
          </div>
        </Suspense>

        {/* Statistics Footer */}
        {showStats && revisionManager.getRevisionStats && (
          <div
            className={`flex-none border-t ${
              mode === 'enhanced'
                ? 'border-gray-700/50 bg-gray-800/40 p-3'
                : mode === 'compact'
                  ? 'border-gray-700/50 bg-gray-800/40 p-2'
                  : 'border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <div className={`grid grid-cols-3 gap-3 text-xs ${mode === 'compact' ? 'gap-2' : ''}`}>
              <div
                className={`rounded text-center ${
                  mode === 'enhanced' || mode === 'compact'
                    ? 'border border-gray-600/30 bg-gray-700/30 p-2'
                    : 'p-1'
                }`}
              >
                <div
                  className={`font-bold ${
                    mode === 'enhanced' || mode === 'compact'
                      ? 'text-sm text-blue-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {revisionManager.getRevisionStats.total}
                </div>
                <div
                  className={
                    mode === 'enhanced' || mode === 'compact'
                      ? 'font-medium text-gray-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }
                >
                  Total{mode === 'compact' ? '' : ' revisions'}
                </div>
              </div>
              <div
                className={`rounded text-center ${
                  mode === 'enhanced' || mode === 'compact'
                    ? 'border border-gray-600/30 bg-gray-700/30 p-2'
                    : 'p-1'
                }`}
              >
                <div
                  className={`font-bold ${
                    mode === 'enhanced' || mode === 'compact'
                      ? 'text-sm text-green-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {revisionManager.getRevisionStats.uniqueAuthors}
                </div>
                <div
                  className={
                    mode === 'enhanced' || mode === 'compact'
                      ? 'font-medium text-gray-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }
                >
                  {mode === 'compact' ? 'Authors' : 'Contributors'}
                </div>
              </div>
              <div
                className={`rounded text-center ${
                  mode === 'enhanced' || mode === 'compact'
                    ? 'border border-gray-600/30 bg-gray-700/30 p-2'
                    : 'p-1'
                }`}
              >
                <div
                  className={`font-bold ${
                    mode === 'enhanced' || mode === 'compact'
                      ? 'text-yellow-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                  } ${mode === 'compact' ? 'text-xs' : 'text-sm'}`}
                >
                  {formatting.formatSize(
                    revisionManager.getRevisionStats.totalSize || 0,
                    mode !== 'compact'
                  )}
                </div>
                <div
                  className={
                    mode === 'enhanced' || mode === 'compact'
                      ? 'font-medium text-gray-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }
                >
                  {mode === 'compact' ? 'Size' : 'Total size'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

UnifiedRevisionList.displayName = 'UnifiedRevisionList';

// Legacy exports for backward compatibility
export const RevisionList = (props: UnifiedRevisionListProps) => (
  <UnifiedRevisionList {...props} mode="default" />
);
export const EnhancedRevisionList = (props: UnifiedRevisionListProps) => (
  <UnifiedRevisionList {...props} mode="enhanced" />
);
export const CompactRevisionList = (props: UnifiedRevisionListProps) => (
  <UnifiedRevisionList {...props} mode="compact" />
);

export default UnifiedRevisionList;
