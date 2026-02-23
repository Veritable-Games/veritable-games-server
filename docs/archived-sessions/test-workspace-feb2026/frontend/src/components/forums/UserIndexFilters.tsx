'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { debounce } from 'lodash';

export default function UserIndexFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recent');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      updateFilters({ q: value });
    }, 300),
    []
  );

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      // Reset to page 1 when filters change
      params.delete('page');

      router.push(`/users?${params.toString()}`);
    },
    [searchParams, router]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSortBy(value);
    updateFilters({ sort: value });
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setRoleFilter(value);
    updateFilters({ role: value });
  };

  return (
    <div className="rounded border border-gray-700 bg-gray-900/30 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Search */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Search Users</label>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Username or display name..."
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Sort */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Sort By</label>
          <select
            value={sortBy}
            onChange={handleSortChange}
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="recent">Recently Active</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="newest">Newest Users</option>
            <option value="posts">Most Active</option>
          </select>
        </div>

        {/* Role Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Role</label>
          <select
            value={roleFilter}
            onChange={handleRoleChange}
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Users</option>
            <option value="admin">Administrators</option>
            <option value="moderator">Moderators</option>
            <option value="user">Regular Users</option>
          </select>
        </div>
      </div>
    </div>
  );
}
