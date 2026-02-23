'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function FeatureDisabledPageContent() {
  const searchParams = useSearchParams();
  const feature = searchParams.get('feature') || 'This feature';

  const featureNames: Record<string, string> = {
    forums: 'Forums',
    wiki: 'Wiki',
  };

  const displayName = featureNames[feature] || feature;

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-24 w-24 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m0 0v2m0-2h2m-2 0h-2m5.73-3.27A9.95 9.95 0 0012 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10a9.95 9.95 0 00-2.27-6.27l-5.46 5.46"
            />
          </svg>
        </div>

        <h1 className="mb-4 text-3xl font-bold text-white">{displayName} Temporarily Disabled</h1>

        <p className="mb-8 text-gray-400">
          The {displayName} feature is currently disabled for maintenance or updates. Please check
          back later or contact an administrator for more information.
        </p>

        <Link
          href="/"
          className="inline-block rounded bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-500"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

export default function FeatureDisabledPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <FeatureDisabledPageContent />
    </Suspense>
  );
}
