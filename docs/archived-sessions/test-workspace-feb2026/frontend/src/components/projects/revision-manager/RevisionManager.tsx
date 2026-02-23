'use client';

import React, { useState, useEffect } from 'react';
import { RevisionListPanel } from './RevisionListPanel';
import { ComparisonHeader } from './ComparisonHeader';
import { EditorPanel } from './EditorPanel';
import { useFullscreenManager } from './useFullscreenManager';
import { useRevisionActions } from './useRevisionActions';
import { useSyncScrolling } from './useSyncScrolling';
import { useRevisionData, type Revision } from './hooks/useRevisionData';

interface RevisionManagerProps {
  projectSlug: string;
}

/**
 * RevisionManager - Clean modular architecture for revision comparison
 *
 * This component orchestrates the revision comparison interface with:
 * - Side-by-side Monaco editors with synchronized scrolling
 * - Revision list sidebar with delete/restore actions
 * - Fullscreen mode with proper layout management
 * - Font size controls and view options
 * - Word count statistics
 *
 * Total: ~200 lines (vs 820 lines in original)
 */
export function RevisionManager({ projectSlug }: RevisionManagerProps) {
  // Data fetching
  const { revisions, loading, error, refetch } = useRevisionData(projectSlug);

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
    projectSlug,
    onRevisionsUpdate: newRevisions => {
      // Update revisions after delete/restore
      refetch();
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

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"></div>
          <p className="text-gray-400">Loading revisions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center text-red-400">
          <p className="mb-2 text-lg font-semibold">Error Loading Revisions</p>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={refetch}
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

        {/* Side-by-Side Editors */}
        <div className="flex min-h-0 flex-1">
          {/* Left Editor */}
          <EditorPanel
            side="left"
            revision={leftRevision}
            onClear={clearLeft}
            onEditorMount={setupLeftEditor}
            fontSize={fontSize}
            showDiff={showDiff}
          />

          {/* Right Editor */}
          <EditorPanel
            side="right"
            revision={rightRevision}
            onClear={clearRight}
            onEditorMount={setupRightEditor}
            fontSize={fontSize}
            showDiff={showDiff}
          />
        </div>
      </div>
    </div>
  );
}

export default RevisionManager;
