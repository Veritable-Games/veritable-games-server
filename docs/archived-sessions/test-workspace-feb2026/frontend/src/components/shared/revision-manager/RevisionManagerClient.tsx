'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RevisionListPanel } from './RevisionListPanel';
import { ComparisonHeader } from './ComparisonHeader';
import { EditorPanel } from './EditorPanel';
import { DiffViewer } from './DiffViewer';
import { useFullscreenManager } from './useFullscreenManager';
import { useSyncScrolling } from './useSyncScrolling';
import { useRevisionActions } from './hooks/useRevisionActions';
import { logger } from '@/lib/utils/logger';

export interface Revision {
  id: number;
  content: string;
  summary: string;
  revision_timestamp: string;
  author_name: string;
  size: number;
  is_minor?: boolean;
}

interface RevisionManagerClientProps {
  initialRevisions: Revision[];
  apiPath: string; // e.g., '/api/wiki/pages/my-slug/revisions' or '/api/projects/my-slug/revisions'
}

/**
 * RevisionManagerClient - Server-optimized revision comparison interface
 *
 * This component receives initial revision data from the server (no client fetch on mount)
 * and orchestrates the revision comparison interface with:
 * - Side-by-side Monaco editors with synchronized scrolling
 * - Revision list sidebar with delete/restore actions
 * - Fullscreen mode with proper layout management
 * - Font size controls and view options
 * - Word count statistics
 *
 * Works with any content type (wiki, projects, etc.) via apiPath prop
 */
export function RevisionManagerClient({ initialRevisions, apiPath }: RevisionManagerClientProps) {
  // State management with server-provided initial data
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions);
  const [error, setError] = useState<string | null>(null);

  // Refetch function for mutations (delete/restore)
  const refetchRevisions = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(apiPath, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch revisions: ${response.status}`);
      }

      const data = await response.json();
      setRevisions(data.revisions || []);
    } catch (err) {
      logger.error('Error fetching revisions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load revisions');
    }
  }, [apiPath]);

  // Selection state
  const [leftRevision, setLeftRevision] = useState<Revision | null>(null);
  const [rightRevision, setRightRevision] = useState<Revision | null>(null);

  // UI state
  const [showDiff, setShowDiff] = useState(false);
  const [fontSize, setFontSize] = useState(13);

  // Custom hooks for complex functionality
  const { isFullScreen, setIsFullScreen } = useFullscreenManager();
  const { syncScrolling, setSyncScrolling, setupLeftEditor, setupRightEditor, forceLayout } =
    useSyncScrolling();
  const { isProcessing, deleteRevision, restoreRevision } = useRevisionActions({
    apiPath,
    onRevisionsUpdate: newRevisions => {
      // Refetch after delete/restore
      refetchRevisions();
    },
    onRevisionDeleted: revisionId => {
      if (leftRevision?.id === revisionId) setLeftRevision(null);
      if (rightRevision?.id === revisionId) setRightRevision(null);
    },
  });

  // Handle window resize and layout recalculation
  useEffect(() => {
    const handleResize = () => {
      forceLayout();
    };

    window.addEventListener('resize', handleResize);

    // Also handle when fullscreen state changes
    if (isFullScreen) {
      setTimeout(handleResize, 200);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullScreen, forceLayout]);

  // Handle revision selection with layout preservation
  const handleRevisionClick = (revision: Revision) => {
    // If clicking on already selected revision, clear it
    if (leftRevision?.id === revision.id) {
      setLeftRevision(null);
      forceLayout();
      return;
    }
    if (rightRevision?.id === revision.id) {
      setRightRevision(null);
      forceLayout();
      return;
    }

    // If neither panel has this revision, assign to the first available panel
    if (!leftRevision) {
      setLeftRevision(revision);
    } else if (!rightRevision) {
      setRightRevision(revision);
    } else {
      // Both panels are occupied, replace the left one and shift right to left
      setLeftRevision(rightRevision);
      setRightRevision(revision);
    }

    forceLayout();
  };

  // Clear selections with layout preservation
  const clearLeft = () => {
    setLeftRevision(null);
    forceLayout();
  };

  const clearRight = () => {
    setRightRevision(null);
    forceLayout();
  };

  // Handle revision deletion
  const handleDeleteRevision = async (revisionId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent revision selection
    await deleteRevision(revisionId);
  };

  // Handle revision restoration
  const handleRestoreRevision = async (revision: Revision, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent revision selection
    await restoreRevision(revision);
  };

  // Font size adjustment
  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(10, Math.min(20, fontSize + delta));
    setFontSize(newSize);
  };

  // Error state (no loading state - data already provided by server)
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center text-red-400">
          <p className="mb-2 text-lg font-semibold">Error Loading Revisions</p>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={refetchRevisions}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full ${isFullScreen ? 'revision-manager-fullscreen' : ''}`}>
      {/* Revision List - Left Panel */}
      <RevisionListPanel
        revisions={revisions}
        leftRevision={leftRevision}
        rightRevision={rightRevision}
        onRevisionClick={handleRevisionClick}
        onDeleteRevision={handleDeleteRevision}
        onRestoreRevision={handleRestoreRevision}
      />

      {/* Comparison Panel - Right Side */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Comparison Header */}
        <ComparisonHeader
          isFullScreen={isFullScreen}
          setIsFullScreen={setIsFullScreen}
          syncScrolling={syncScrolling}
          setSyncScrolling={setSyncScrolling}
          showDiff={showDiff}
          setShowDiff={setShowDiff}
          fontSize={fontSize}
          onFontSizeChange={adjustFontSize}
        />

        {/* Side-by-Side Editors or DiffViewer */}
        <div className="flex min-h-0 flex-1">
          {showDiff && leftRevision && rightRevision ? (
            /* DiffViewer when both revisions selected and diff mode enabled */
            <DiffViewer
              leftRevision={leftRevision}
              rightRevision={rightRevision}
              onClearLeft={clearLeft}
              onClearRight={clearRight}
              fontSize={fontSize}
            />
          ) : (
            /* Side-by-Side EditorPanels for single selection or non-diff mode */
            <>
              <EditorPanel
                side="left"
                revision={leftRevision}
                onClear={clearLeft}
                onEditorMount={setupLeftEditor}
                fontSize={fontSize}
                showDiff={showDiff}
              />
              <EditorPanel
                side="right"
                revision={rightRevision}
                onClear={clearRight}
                onEditorMount={setupRightEditor}
                fontSize={fontSize}
                showDiff={showDiff}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RevisionManagerClient;
