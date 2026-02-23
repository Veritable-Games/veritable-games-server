'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/utils/logger';

interface WikiSearchProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export default function WikiSearch({ value, onChange, onSubmit }: WikiSearchProps = {}) {
  const [internalQuery, setInternalQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const query = value !== undefined ? value : internalQuery;
  const setQuery = onChange !== undefined ? onChange : setInternalQuery;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsSearching(true);

    try {
      // Navigate to search results page with query parameter
      const searchParams = new URLSearchParams({ q: query.trim() });
      router.push(`/wiki/search?${searchParams.toString()}`);
    } catch (error) {
      logger.error('Search error', { error });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search wiki pages..."
          className="h-8 w-full rounded border border-gray-600 bg-gray-800 px-3 pl-9 text-sm text-white placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none"
          disabled={isSearching}
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
        {isSearching && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          </div>
        )}
      </div>
    </form>
  );
}
