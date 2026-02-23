'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function LibraryHistoryPage() {
  const params = useParams();
  const slugArray = params.slug as string[];
  const slugPath = slugArray.join('/');

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-400" aria-label="Breadcrumb navigation">
          <ol className="flex items-center">
            <li>
              <Link href="/library" className="transition-colors hover:text-blue-400">
                Library
              </Link>
            </li>
            <li>
              <span className="mx-2 text-gray-500">›</span>
              <Link href={`/library/${slugPath}`} className="transition-colors hover:text-blue-400">
                Document
              </Link>
            </li>
            <li>
              <span className="mx-2 text-gray-500">›</span>
              <span className="text-gray-200">History</span>
            </li>
          </ol>
        </nav>

        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-8">
          <h1 className="mb-4 text-2xl font-bold text-white">Document History</h1>
          <div className="text-center">
            <div className="mb-6 text-gray-400">Document revision history is coming soon.</div>
            <Link
              href={`/library/${slugPath}`}
              className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
            >
              ← Back to Document
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
