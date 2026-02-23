import React, { Suspense } from 'react';
import { ForumSearchServer } from '@/components/forums/ForumSearchServer';
import { ForumSearchClient } from '@/components/forums/ForumSearchClient';

export default function ForumSearchPage() {
  return (
    <ForumSearchServer>
      {categories => (
        <Suspense
          fallback={
            <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
              <div className="rounded border border-gray-700 bg-gray-900/70 p-8 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
                <p className="text-gray-400">Loading search...</p>
              </div>
            </div>
          }
        >
          <ForumSearchClient initialCategories={categories} />
        </Suspense>
      )}
    </ForumSearchServer>
  );
}
