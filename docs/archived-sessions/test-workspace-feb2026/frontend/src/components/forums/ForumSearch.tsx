'use client';

import { useState, useTransition, useId } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/utils/logger';

export default function ForumSearch() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    // Use startTransition for non-blocking navigation
    startTransition(() => {
      try {
        // Navigate to forum search results - this is now non-blocking
        const searchParams = new URLSearchParams({ q: query.trim() });
        router.push(`/forums/search?${searchParams.toString()}`);
      } catch (error) {
        logger.error('Forum search error:', error);
      }
    });
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search forums..."
          className="h-8 w-full rounded border border-gray-600 bg-gray-800 px-3 pl-9 text-sm text-white placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none"
          disabled={isPending}
          aria-label="Search forums"
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        {isPending && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
              aria-label="Searching..."
            ></div>
          </div>
        )}
      </div>
    </form>
  );
}
