'use client';

import React, { Suspense } from 'react';
import { LAZY_COMPONENTS } from '@/lib/performance/dynamic-imports';

// Loading component for toolbar
const ToolbarSkeleton = () => (
  <div className="h-12 animate-pulse border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
    <div className="flex h-full items-center gap-2 px-4">
      {/* Skeleton buttons */}
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-600" />
      ))}
      <div className="mx-2 h-6 w-px bg-gray-300 dark:bg-gray-600" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-600" />
      ))}
    </div>
  </div>
);

interface DynamicMarkdownEditorToolbarProps {
  onInsertMarkdown: (before: string, after?: string) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (mode: boolean) => void;
  onSave?: () => void;
  readOnly?: boolean;
  showPreview?: boolean;
  content: string;
}

/**
 * Dynamic wrapper for MarkdownEditorToolbar - splits 908 lines from main bundle
 * Estimated bundle savings: ~200KB
 */
export const DynamicMarkdownEditorToolbar: React.FC<DynamicMarkdownEditorToolbarProps> = props => {
  const { Component: MarkdownEditorToolbar } = LAZY_COMPONENTS.MarkdownEditorToolbar;

  return (
    <Suspense fallback={<ToolbarSkeleton />}>
      <MarkdownEditorToolbar {...props} />
    </Suspense>
  );
};

export default DynamicMarkdownEditorToolbar;
