'use client';

interface UserIndexFiltersProps {
  isAdmin?: boolean;
  onInviteUser?: () => void;
  adminHints?: React.ReactNode;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'recent' | 'username' | 'active';
  onSortChange: (sort: 'recent' | 'username' | 'active') => void;
  roleFilter: string;
  onRoleChange: (role: string) => void;
  resultCount: number;
  bannedCount?: number;
}

export default function UserIndexFilters({
  isAdmin,
  onInviteUser,
  adminHints,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  roleFilter,
  onRoleChange,
  resultCount,
  bannedCount = 0,
}: UserIndexFiltersProps) {
  const handleClearFilters = () => {
    onSearchChange('');
    onSortChange('recent');
    onRoleChange('');
  };

  return (
    <div className="space-y-3">
      {/* Search Bar - matching Wiki/Library style */}
      <div className="flex items-center gap-2 rounded border border-gray-700/40 bg-gray-900/20 px-1.5 py-1">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search users..."
            className="h-8 w-full rounded border border-gray-600 bg-gray-800 pl-8 pr-3 text-sm text-white placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none"
          />
          <svg
            className="absolute left-2.5 top-2 h-4 w-4 text-gray-500"
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

        {/* Result count - shows banned count for admins/moderators */}
        <div className="px-2 text-xs text-gray-400">
          {resultCount} users
          {isAdmin && bannedCount > 0 && (
            <span className="ml-1 text-orange-400">({bannedCount} banned)</span>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onInviteUser}
            className="flex h-8 items-center whitespace-nowrap rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
          >
            + Invite User
          </button>
        )}
      </div>

      {/* Filter Options with Admin Hints */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as 'recent' | 'username' | 'active')}
            className="h-8 rounded border border-gray-600 bg-gray-800 px-3 text-sm text-white transition-colors focus:border-blue-500"
          >
            <option value="recent">Recently Joined</option>
            <option value="username">Username A-Z</option>
            <option value="active">Most Active</option>
          </select>

          <select
            value={roleFilter}
            onChange={e => onRoleChange(e.target.value)}
            className="h-8 rounded border border-gray-600 bg-gray-800 px-3 text-sm text-white transition-colors focus:border-blue-500"
          >
            <option value="">All Roles</option>
            <option value="user">Users</option>
            <option value="moderator">Moderators</option>
            <option value="admin">Admins</option>
          </select>

          {(searchQuery || sortBy !== 'recent' || roleFilter) && (
            <button
              onClick={handleClearFilters}
              className="flex h-8 items-center px-3 text-sm text-gray-400 transition-colors hover:text-white"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Admin Hints on the right side of filter row - hidden on mobile */}
        <div className="hidden md:block">{adminHints}</div>
      </div>
    </div>
  );
}
