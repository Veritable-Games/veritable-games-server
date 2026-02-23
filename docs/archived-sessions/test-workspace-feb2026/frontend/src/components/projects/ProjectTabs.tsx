'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { RevisionManager } from '@/components/projects/revision-manager';
import type { TracedContent } from '@/lib/tracing/types';
import { logger } from '@/lib/utils/logger';

// Dynamically import TracingContentViewer with ssr: false to prevent hydration mismatches
// This component uses DOM APIs for character mapping that aren't available during SSR
const TracingContentViewer = dynamic(
  () => import('@/components/tracing/TracingContentViewer').then(mod => mod.TracingContentViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-gray-400">
        Loading tracing view...
      </div>
    ),
  }
);

interface ProjectTab {
  id: string;
  title: string;
  icon?: string;
  content: React.ReactNode;
  editable?: boolean;
}

interface ProjectTabsProps {
  projectSlug: string;
  projectTitle: string;
  isAdmin?: boolean;
  defaultContent: string;
  onContentSave?: (content: string) => Promise<void>;
  saving?: boolean;
  isEditing?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  onSave?: () => void;
  onCancel?: () => void;
  lastUpdated?: string;
  onEditClick?: () => void;
  /** Whether content tracing is enabled for this project */
  tracingEnabled?: boolean;
  /** AI-generated background content (when tracing is enabled) */
  backgroundContent?: string;
  /** Human-written traced content pieces */
  tracedContents?: TracedContent[];
  /** Callback when traces are updated */
  onTracesChange?: (traces: TracedContent[]) => void;
}

export const ProjectTabs = forwardRef<{ save: () => Promise<void> }, ProjectTabsProps>(
  (
    {
      projectSlug,
      projectTitle,
      isAdmin = false,
      defaultContent,
      onContentSave,
      saving = false,
      isEditing: externalIsEditing,
      onEditingChange,
      onSave,
      onCancel,
      lastUpdated,
      onEditClick,
      tracingEnabled = false,
      backgroundContent,
      tracedContents = [],
      onTracesChange,
    },
    ref
  ) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [isTracingMode, setIsTracingMode] = useState(false);

    // Set TOC state - start with true (open by default)
    // Will be updated based on screen size after mount
    const [isTocOpen, setIsTocOpen] = useState(true);
    const [hasHydrated, setHasHydrated] = useState(false);

    // Use external editing state if provided
    const actualIsEditing = externalIsEditing !== undefined ? externalIsEditing : isEditing;
    const setActualIsEditing = (editing: boolean) => {
      if (onEditingChange) {
        onEditingChange(editing);
      } else {
        setIsEditing(editing);
      }
    };
    const [editContent, setEditContent] = useState(defaultContent);
    const [editSummary, setEditSummary] = useState('');

    // Update edit content when defaultContent changes (e.g., after save)
    useEffect(() => {
      setEditContent(defaultContent);
    }, [defaultContent]);

    // Adjust TOC state based on screen size after hydration
    useEffect(() => {
      // Close on small screens, keep open on large screens
      const isLargeScreen = window.innerWidth >= 1024;
      if (!isLargeScreen) {
        setIsTocOpen(false);
      }
      setHasHydrated(true);
    }, []);

    // Handle window resize to adjust TOC state responsively
    useEffect(() => {
      if (!hasHydrated) return; // Don't set up listener until after initial hydration

      const handleResize = () => {
        const isLargeScreen = window.innerWidth >= 1024;
        setIsTocOpen(isLargeScreen);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [hasHydrated]);

    const handleSave = async () => {
      if (!onContentSave) {
        return;
      }

      try {
        await onContentSave(editContent);
        setActualIsEditing(false);
        setEditSummary('');
      } catch (error) {
        logger.error('Error saving content:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save changes';

        // Check if it's a "not available" error vs a real error
        if (errorMessage.includes('Content editing not available')) {
          alert(
            'Content editing is not yet available for this project. Wiki integration needs to be set up first.'
          );
        } else {
          alert('Failed to save changes: ' + errorMessage);
        }
      }
    };

    // Expose the save function to parent component
    useImperativeHandle(
      ref,
      () => ({
        save: handleSave,
      }),
      [editContent, onContentSave]
    );

    const handleCancelEdit = () => {
      if (saving) return; // Prevent cancel during save
      setActualIsEditing(false);
      setEditContent(defaultContent);
      setEditSummary('');
    };

    const tabs: ProjectTab[] = [
      {
        id: 'overview',
        title: 'Overview',
        icon: '📋',
        editable: true,
        content: (
          <div className="flex h-full flex-col lg:flex-row">
            {/* Mobile TOC - Collapsible Panel */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsTocOpen(!isTocOpen)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-gray-300 transition-colors hover:text-white"
              >
                <span className="font-medium">Contents</span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${isTocOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div className="border-t border-gray-700" />
              <div
                className={`overflow-hidden transition-all duration-300 ${isTocOpen ? 'max-h-96' : 'max-h-0'}`}
              >
                <div className="max-h-96 overflow-y-auto px-4 py-3">
                  <TableOfContents content={defaultContent} />
                </div>
              </div>
            </div>

            {/* Desktop Table of Contents - Collapsible */}
            <div
              className={`${
                isTocOpen ? 'w-64 lg:w-72' : 'w-12'
              } hidden flex-shrink-0 overflow-hidden border-r border-gray-700 transition-all duration-300 lg:block`}
            >
              <div className="flex h-full flex-col">
                {isTocOpen ? (
                  <div className="flex h-full flex-col p-3">
                    <div className="mb-2 flex flex-shrink-0 items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                        Contents
                      </h3>
                      <button
                        onClick={() => setIsTocOpen(false)}
                        className="p-1 text-gray-400 transition-colors hover:text-gray-200"
                        title="Collapse sidebar"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <TableOfContents content={defaultContent} />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <button
                      onClick={() => setIsTocOpen(true)}
                      className="p-2 text-gray-400 transition-colors hover:text-gray-200"
                      title="Expand sidebar"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* Content Area */}
              <div
                className={`flex-1 overflow-hidden ${
                  actualIsEditing ? 'border-2 border-blue-500/30' : ''
                }`}
              >
                {actualIsEditing ? (
                  <MarkdownEditor
                    initialContent={editContent}
                    onChange={setEditContent}
                    height="100%"
                    showPreview={true}
                    showToolbar={true}
                  />
                ) : tracingEnabled && backgroundContent ? (
                  <TracingContentViewer
                    backgroundContent={backgroundContent}
                    tracedContent={tracedContents[0]?.tracedContent}
                    isAdmin={isAdmin}
                    projectSlug={projectSlug}
                    onTracedContentChange={
                      onTracesChange && tracedContents[0]
                        ? (content: string) => {
                            const firstTrace = tracedContents[0]!;
                            onTracesChange([
                              { ...firstTrace, tracedContent: content },
                              ...tracedContents.slice(1),
                            ]);
                          }
                        : undefined
                    }
                    isTracingMode={isTracingMode}
                    onTracingModeChange={setIsTracingMode}
                    className="h-full"
                  />
                ) : (
                  <div className="h-full overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
                    <HybridMarkdownRenderer
                      content={defaultContent}
                      className="prose prose-sm prose-invert max-w-none sm:prose-base"
                    />
                  </div>
                )}
              </div>

              {/* Footer - Only under main content, not under TOC */}
              <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800/30 px-6 py-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="text-gray-500">
                    Last Updated{' '}
                    {lastUpdated
                      ? new Date(lastUpdated).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })
                      : 'Never'}
                  </span>
                  <div className="flex items-center gap-6">
                    {isAdmin && (
                      <Link
                        href={`/projects/${encodeURIComponent(projectSlug)}/revisions`}
                        className="transition-colors hover:text-blue-400"
                      >
                        Versions
                      </Link>
                    )}
                    {tracingEnabled && backgroundContent && isAdmin && (
                      <>
                        <span className="text-gray-600">|</span>
                        <button
                          onClick={() => setIsTracingMode(!isTracingMode)}
                          className={`transition-colors ${
                            isTracingMode ? 'font-medium text-purple-400' : 'hover:text-purple-400'
                          }`}
                        >
                          {isTracingMode ? 'Exit Trace' : 'Trace'}
                        </button>
                      </>
                    )}
                    {actualIsEditing ? (
                      <>
                        <span className="text-gray-600">|</span>
                        <button
                          onClick={onCancel}
                          disabled={saving}
                          className="text-red-400 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:text-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="font-medium text-blue-400 transition-colors hover:text-blue-400 disabled:cursor-not-allowed disabled:text-gray-600"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </>
                    ) : isAdmin ? (
                      <>
                        <span className="text-gray-600">|</span>
                        <button
                          onClick={onEditClick}
                          className="transition-colors hover:text-blue-400"
                        >
                          Edit
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ];

    const activeTabData = tabs.find(tab => tab.id === activeTab);

    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Content fills available height */}
        <div className="min-h-0 flex-1 overflow-hidden">{activeTabData?.content}</div>
      </div>
    );
  }
);

ProjectTabs.displayName = 'ProjectTabs';

// Project History Tab Component
function ProjectHistoryTab({ projectSlug }: { projectSlug: string }) {
  return (
    <div className="h-full overflow-hidden">
      <RevisionManager projectSlug={projectSlug} />
    </div>
  );
}

// Project References Tab Component
function ProjectReferencesTab({ projectSlug }: { projectSlug: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Cross-References</h3>
      <div className="text-gray-400">
        This tab will show all pages that link to this project and all pages this project links to.
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded border border-gray-700 bg-gray-800/50 p-4">
          <h4 className="mb-3 font-medium text-white">Links to this project</h4>
          <div className="text-sm text-gray-400">
            Wiki pages, forum topics, and other projects that reference this project.
          </div>
        </div>
        <div className="rounded border border-gray-700 bg-gray-800/50 p-4">
          <h4 className="mb-3 font-medium text-white">Links from this project</h4>
          <div className="text-sm text-gray-400">
            Pages and resources referenced by this project's content.
          </div>
        </div>
      </div>
    </div>
  );
}

// Project Discussion Tab Component
function ProjectDiscussionTab({ projectSlug }: { projectSlug: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Discussion</h3>
      <div className="text-gray-400">Project-specific discussions and comments.</div>
      <div className="rounded border border-gray-700 bg-gray-800/50 p-4">
        <div className="mb-2 text-sm text-gray-300">Integration with forums:</div>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-400">
          <li>Embedded forum topics related to this project</li>
          <li>Comments and feedback from the community</li>
          <li>Development updates and announcements</li>
          <li>Link to create new forum topic about this project</li>
        </ul>
      </div>
    </div>
  );
}

// Table of Contents Component
function TableOfContents({ content }: { content: string }) {
  const headers = extractHeaders(content);

  const scrollToHeader = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="space-y-0">
      {headers.map((header, index) => (
        <button
          key={index}
          onClick={() => scrollToHeader(header.id)}
          className={`block w-full rounded px-2 py-1 text-left text-sm leading-tight transition-colors hover:bg-gray-800 ${
            header.level === 1
              ? 'font-semibold text-white'
              : header.level === 2
                ? 'pl-4 font-medium text-gray-300'
                : 'pl-6 text-gray-400'
          } `}
        >
          {header.text}
        </button>
      ))}
    </nav>
  );
}

// Extract headers from markdown content
function extractHeaders(content: string): Array<{ text: string; level: number; id: string }> {
  const headers: Array<{ text: string; level: number; id: string }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1]?.length ?? 1;
      const text = match[2] ?? '';
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      headers.push({ text, level, id });
    }
  }

  return headers;
}
