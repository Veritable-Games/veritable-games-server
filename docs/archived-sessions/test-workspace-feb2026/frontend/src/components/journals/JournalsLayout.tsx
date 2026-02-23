'use client';

import React, { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useJournalsData } from '@/stores/journals/useJournalsData';
import { useJournalsUI } from '@/stores/journals/useJournalsUI';
import type { JournalCategory, JournalNode } from '@/stores/journals/types';
import { JournalsSidebar } from './JournalsSidebar';
import { JournalsEditor } from './JournalsEditor';

interface JournalsLayoutProps {
  journals: JournalNode[];
  categories: JournalCategory[];
  currentPage?: {
    slug: string;
    title: string;
    content: string;
    isDeleted?: boolean;
  };
  isLoading?: boolean;
}

/**
 * JournalsLayout - Main container with resizable split panes
 * Left: Sidebar with tree navigation and search
 * Right: Editor with toolbar and auto-save
 */
export function JournalsLayout({
  journals,
  categories,
  currentPage,
  isLoading,
}: JournalsLayoutProps) {
  // Use split stores
  const { setJournals, setCategories, updateJournal, reset: resetData } = useJournalsData();
  const { setSidebarWidth, sidebarWidth, reset: resetUI, expandAllCategories } = useJournalsUI();
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
    return () => {
      // Reset all stores on unmount
      resetData();
      resetUI();
    };
  }, [resetData, resetUI]);

  // Initialize journals ONCE on mount (journals come from server props)
  useEffect(() => {
    console.log('[JournalsLayout] Setting journals in store:', {
      journalsCount: journals.length,
      sampleJournal: journals[0] ? {
        id: journals[0].id,
        title: journals[0].title,
        journal_category_id: journals[0].journal_category_id,
      } : null,
    });
    setJournals(journals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Update categories when they load (categories are fetched client-side)
  // But only update if we're transitioning from empty to populated
  // Also expand all categories by default so journals are visible
  useEffect(() => {
    if (categories.length > 0) {
      setCategories(categories);
      // Expand all categories by default so journals are visible on page load
      const categoryIds = categories.map(c => c.id);
      expandAllCategories(categoryIds);
    }
  }, [categories, setCategories, expandAllCategories]);

  // Handle journal deletion - update journal in store
  const handleDelete = (slug: string) => {
    const journal = journals.find(j => j.slug === slug);
    if (journal) {
      updateJournal(journal.id, { is_deleted: true });
    }
  };

  // Handle journal restoration - update journal in store
  const handleRestore = (slug: string) => {
    const journal = journals.find(j => j.slug === slug);
    if (journal) {
      updateJournal(journal.id, { is_deleted: false });
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">
        Loading journals...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Split Panes Container */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="flex h-full">
          {/* Left Pane: Sidebar */}
          <Panel
            defaultSize={25}
            minSize={15}
            maxSize={40}
            className="h-full overflow-hidden"
            onResize={size => {
              // size is percentage, convert to pixels
              if (typeof window !== 'undefined') {
                const viewportWidth = window.innerWidth;
                const sidebarPixels = (size / 100) * viewportWidth;
                setSidebarWidth(sidebarPixels);
              }
            }}
          >
            <JournalsSidebar
              journals={journals}
              categories={categories}
              currentSlug={currentPage?.slug}
            />
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="group relative w-2 bg-gray-800 transition-colors hover:bg-blue-500/30">
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-gray-700 group-hover:bg-blue-500/50" />
          </PanelResizeHandle>

          {/* Right Pane: Editor */}
          <Panel defaultSize={75} minSize={30} className="h-full overflow-hidden">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-500">
                <svg
                  className="mb-4 h-12 w-12 animate-spin text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-lg">Loading journal...</p>
              </div>
            ) : currentPage ? (
              <JournalsEditor
                slug={currentPage.slug}
                title={currentPage.title}
                initialContent={currentPage.content}
                isDeleted={currentPage.isDeleted}
                onDelete={() => handleDelete(currentPage.slug)}
                onRestore={() => handleRestore(currentPage.slug)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-gray-500">
                <svg className="mb-4 h-16 w-16" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="mb-2 text-lg">No journal selected</p>
                <p className="text-sm">Select a journal from the sidebar or create a new one</p>
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
