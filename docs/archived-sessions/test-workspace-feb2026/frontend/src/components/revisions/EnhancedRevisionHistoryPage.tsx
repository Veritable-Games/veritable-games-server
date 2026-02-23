'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DiffEditor } from '@monaco-editor/react';

// Context and Hook Imports
import {
  ProjectVersioningProvider,
  useProjectVersioning,
} from '@/contexts/ProjectVersioningContext';
import { useAnnotationStore } from '@/stores/annotation';
import { logger } from '@/lib/utils/logger';
import {
  useCollaborativeRevisions,
  useRevisionAnnotations,
  useMonacoCollaboration,
} from '@/hooks/useCollaborativeRevisions';
import {
  useRevisionVirtualization,
  useRevisionMemoization,
  useRevisionSearch,
  usePerformanceMonitor,
} from '@/hooks/useRevisionPerformance';

// ==================== MAIN COMPONENT ====================

export default function EnhancedRevisionHistoryPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <ProjectVersioningProvider>
      <EnhancedRevisionHistoryContent projectSlug={slug} />
    </ProjectVersioningProvider>
  );
}

// ==================== MAIN CONTENT COMPONENT ====================

function EnhancedRevisionHistoryContent({ projectSlug }: { projectSlug: string }) {
  const {
    state,
    loadRevisions,
    compareRevisions,
    selectRevision,
    setFilter,
    setSort,
    setViewMode,
    canCompare,
    isRevisionSelected,
  } = useProjectVersioning();

  const { measureRenderTime, measureDiffTime, metrics } = usePerformanceMonitor();

  // Load revisions
  useEffect(() => {
    if (projectSlug) {
      loadRevisions(projectSlug);
    }
  }, [projectSlug, loadRevisions]);

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden px-8 py-6">
      {/* Header with Performance Metrics */}
      <EnhancedHeader projectSlug={projectSlug} metrics={metrics} />

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[1fr_2fr]">
        {/* Enhanced Revision List */}
        <EnhancedRevisionList projectSlug={projectSlug} measureRenderTime={measureRenderTime} />

        {/* Enhanced Comparison View */}
        <EnhancedComparisonView measureDiffTime={measureDiffTime} />
      </div>

      {/* Collaborative Features Panel */}
      <CollaborativeFeaturesPanel projectSlug={projectSlug} />
    </div>
  );
}

// ==================== ENHANCED HEADER ====================

interface EnhancedHeaderProps {
  projectSlug: string;
  metrics: any;
}

function EnhancedHeader({ projectSlug, metrics }: EnhancedHeaderProps) {
  const { state, canCompare, compareRevisions, setSort, setViewMode } = useProjectVersioning();
  const { isConnected, activeUsers } = useCollaborativeRevisions(projectSlug);
  const { searchRevisions, getSearchSuggestions } = useRevisionSearch();

  const [searchQuery, setSearchQuery] = useState('');
  const [showMetrics, setShowMetrics] = useState(false);

  const handleCompare = async () => {
    if (canCompare) {
      try {
        await compareRevisions(state.selected_revisions);
      } catch (error) {
        logger.error('Comparison failed:', error);
      }
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const results = searchRevisions(query);
    // Update filtered revisions would be handled by the search integration
  };

  return (
    <div className="mb-6 flex-shrink-0 space-y-4">
      {/* Primary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
            Revision History
            {isConnected && (
              <span className="flex items-center text-sm text-green-400">
                <div className="mr-1 h-2 w-2 rounded-full bg-green-400"></div>
                Live
              </span>
            )}
          </h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-400">
            <span>{state.revisions.length} revisions</span>
            {activeUsers.length > 0 && (
              <>
                <span>•</span>
                <span>{activeUsers.length} online</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Compare Button */}
          {canCompare && (
            <button
              onClick={handleCompare}
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500"
            >
              Compare Selected
            </button>
          )}

          {/* Performance Toggle */}
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="rounded bg-gray-700 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-600"
          >
            📊 Metrics
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search revisions..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          onChange={e => setSort(e.target.value as 'date' | 'author' | 'size' | 'version')}
          className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
        >
          <option value="date">Sort by Date</option>
          <option value="author">Sort by Author</option>
          <option value="size">Sort by Size</option>
        </select>

        <select
          onChange={e => setViewMode(e.target.value as 'list' | 'timeline' | 'graph')}
          className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
        >
          <option value="list">List View</option>
          <option value="timeline">Timeline</option>
          <option value="graph">Graph View</option>
        </select>
      </div>

      {/* Performance Metrics Panel */}
      {showMetrics && (
        <div className="rounded-lg bg-gray-800 p-4 text-sm">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <span className="text-gray-400">Render Time:</span>
              <div className="font-mono text-white">{metrics.renderTime.toFixed(2)}ms</div>
            </div>
            <div>
              <span className="text-gray-400">Diff Time:</span>
              <div className="font-mono text-white">{metrics.diffCalculationTime.toFixed(2)}ms</div>
            </div>
            <div>
              <span className="text-gray-400">Memory:</span>
              <div className="font-mono text-white">{metrics.memoryUsage.toFixed(1)}MB</div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Status */}
      {state.selected_revisions.length > 0 && (
        <div className="rounded-lg border border-blue-600/50 bg-blue-900/30 p-3">
          <span className="text-sm text-blue-200">
            {state.selected_revisions.length}/2 revisions selected for comparison
          </span>
        </div>
      )}
    </div>
  );
}

// ==================== ENHANCED REVISION LIST ====================

interface EnhancedRevisionListProps {
  projectSlug: string;
  measureRenderTime: (fn: () => void) => void;
}

function EnhancedRevisionList({ projectSlug, measureRenderTime }: EnhancedRevisionListProps) {
  const { state, selectRevision, isRevisionSelected } = useProjectVersioning();

  const { visibleRevisions, visibleRange, containerRef, isVirtualized, scrollToRevision } =
    useRevisionVirtualization(80, 600, 5);

  const { stats, groupings } = useRevisionMemoization();

  const handleRevisionClick = (revisionId: number) => {
    measureRenderTime(() => {
      selectRevision(revisionId);
    });
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Revisions {isVirtualized && '(Virtualized)'}
        </h2>

        {stats && (
          <div className="text-sm text-gray-400">
            {stats.total} total • {formatBytes(stats.totalSize)}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto rounded border border-gray-700 bg-gray-900/50"
        style={{ height: isVirtualized ? '600px' : 'auto' }}
      >
        {isVirtualized && (
          <div style={{ height: `${visibleRange.totalHeight}px`, position: 'relative' }}>
            <div
              style={{
                transform: `translateY(${visibleRange.offsetY}px)`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
              }}
            >
              <RevisionListContent
                revisions={visibleRevisions}
                socialData={{}}
                onRevisionClick={handleRevisionClick}
                isSelected={isRevisionSelected}
              />
            </div>
          </div>
        )}

        {!isVirtualized && (
          <RevisionListContent
            revisions={state.filtered_revisions}
            socialData={{}}
            onRevisionClick={handleRevisionClick}
            isSelected={isRevisionSelected}
          />
        )}
      </div>
    </div>
  );
}

// ==================== REVISION LIST CONTENT ====================

interface RevisionListContentProps {
  revisions: any[];
  socialData: Record<number, any>;
  onRevisionClick: (id: number) => void;
  isSelected: (id: number) => boolean;
}

function RevisionListContent({
  revisions,
  socialData,
  onRevisionClick,
  isSelected,
}: RevisionListContentProps) {
  if (revisions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>No revisions found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-700">
      {revisions.map(revision => {
        const social = socialData[revision.id] || {};
        const selected = isSelected(revision.id);

        return (
          <div
            key={revision.id}
            className={`cursor-pointer p-4 transition-colors hover:bg-gray-800 ${
              selected ? 'border-l-4 border-blue-500 bg-blue-900/30' : ''
            }`}
            onClick={() => onRevisionClick(revision.id)}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">#{revision.id}</span>
                  <span className="text-xs text-gray-500">{formatBytes(revision.size)}</span>
                  {social.social_impact_score > 0 && (
                    <span className="rounded bg-green-900/50 px-2 py-1 text-xs text-green-400">
                      Impact: {social.social_impact_score}
                    </span>
                  )}
                </div>

                <div className="mb-2 text-xs text-gray-400">
                  {formatDate(revision.revision_timestamp)} • {revision.author_name}
                </div>

                <p className="mb-2 truncate text-sm font-medium text-white">
                  {revision.summary || 'No summary provided'}
                </p>

                {/* Social indicators */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {social.is_starred && <span className="text-yellow-500">★</span>}
                  {social.comments_count > 0 && <span>💬 {social.comments_count}</span>}
                  {social.mentions?.length > 0 && <span>@{social.mentions.length}</span>}
                </div>
              </div>

              <div className="ml-4 flex-shrink-0">
                {selected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                    <span className="text-xs font-bold text-white">✓</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== ENHANCED COMPARISON VIEW ====================

interface EnhancedComparisonViewProps {
  measureDiffTime: (fn: () => Promise<any>) => Promise<any>;
}

function EnhancedComparisonView({ measureDiffTime }: EnhancedComparisonViewProps) {
  const { state } = useProjectVersioning();
  const { setEditor } = useMonacoCollaboration(state.comparison?.from_revision.id || 0);

  const handleEditorMount = (editor: any) => {
    setEditor(editor);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <h2 className="mb-4 text-lg font-semibold text-white">Comparison</h2>

      <div className="flex-1 overflow-hidden rounded border border-gray-700 bg-gray-900/50">
        {!state.comparison ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="mb-2">Select two revisions to compare</p>
              <p className="text-sm">Click on revisions in the list to select them</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Comparison Header */}
            <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800 p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-gray-400">From:</span>
                    <span className="ml-2 text-white">#{state.comparison.from_revision.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">To:</span>
                    <span className="ml-2 text-white">#{state.comparison.to_revision.id}</span>
                  </div>
                </div>

                {state.comparison.change_summary && (
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-400">
                      +{state.comparison.change_summary.additions}
                    </span>
                    <span className="text-red-400">
                      -{state.comparison.change_summary.deletions}
                    </span>
                    <span className="text-yellow-400">
                      ~{state.comparison.change_summary.modifications}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Monaco Diff Editor with Collaboration */}
            <div className="flex-1">
              <DiffEditor
                height="100%"
                original={state.comparison.from_revision.content}
                modified={state.comparison.to_revision.content}
                language="markdown"
                theme="vs-dark"
                onMount={handleEditorMount}
                options={{
                  renderSideBySide: true,
                  hideUnchangedRegions: { enabled: true },
                  readOnly: true,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mock hook for collaboration awareness
interface Collaborator {
  id: string | number;
  display_name?: string;
  username: string;
  social_connection?: 'mutual' | 'following' | 'follower' | 'none';
}

function useCollaborationAwareness(_projectSlug: string): {
  collaborators: Collaborator[];
  totalCollaborators: number;
  mutualConnections: number;
} {
  return {
    collaborators: [] as Collaborator[],
    totalCollaborators: 0,
    mutualConnections: 0,
  };
}

// ==================== COLLABORATIVE FEATURES PANEL ====================

function CollaborativeFeaturesPanel({ projectSlug }: { projectSlug: string }) {
  const { isConnected, activeUsers, otherUsers } = useCollaborativeRevisions(projectSlug);
  const { collaborators, totalCollaborators, mutualConnections } =
    useCollaborationAwareness(projectSlug);
  const annotations = useAnnotationStore(s => s.annotations);

  const [showPanel, setShowPanel] = useState(false);

  if (!isConnected && otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <span>👥 Collaboration</span>
        <span className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
          {totalCollaborators}
        </span>
      </button>

      {showPanel && (
        <div className="mt-4 rounded-lg bg-gray-800 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Active Users */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white">Online Now</h3>
              <div className="space-y-2">
                {collaborators.map(user => (
                  <div key={user.id} className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-400"></div>
                    <span className="text-gray-300">{user.display_name || user.username}</span>
                    {user.social_connection === 'mutual' && (
                      <span className="text-xs text-blue-400">↔️</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Annotations */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white">Recent Annotations</h3>
              <div className="text-sm text-gray-400">
                {Object.values(annotations).flat().length} total annotations
              </div>
            </div>

            {/* Social Stats */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-white">Connections</h3>
              <div className="text-sm text-gray-400">{mutualConnections} mutual connections</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== UTILITY FUNCTIONS ====================

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}
