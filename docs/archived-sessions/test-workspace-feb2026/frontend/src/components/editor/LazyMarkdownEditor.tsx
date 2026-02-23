'use client';

import { Suspense, lazy, ComponentProps } from 'react';
import { MarkdownEditor } from './MarkdownEditor';

// Lazy load the heavy MarkdownEditor component
const LazyLoadedMarkdownEditor = lazy(() =>
  import('./MarkdownEditor').then(module => ({ default: module.MarkdownEditor }))
);

// Loading fallback component
function MarkdownEditorSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-lg border border-gray-600 bg-gray-800">
      <div className="h-10 rounded-t-lg border-b border-gray-600 bg-gray-700" />
      <div className="p-4">
        <div className="mb-3 h-4 rounded bg-gray-700" />
        <div className="mb-3 h-4 w-3/4 rounded bg-gray-700" />
        <div className="mb-3 h-4 w-1/2 rounded bg-gray-700" />
      </div>
    </div>
  );
}

// Props type for the lazy editor
type LazyMarkdownEditorProps = ComponentProps<typeof MarkdownEditor>;

export function LazyMarkdownEditor(props: LazyMarkdownEditorProps) {
  return (
    <Suspense fallback={<MarkdownEditorSkeleton />}>
      <LazyLoadedMarkdownEditor {...props} />
    </Suspense>
  );
}

export default LazyMarkdownEditor;
