'use client';

import { memo } from 'react';
import { OverallUserStats } from '@/types/profile-aggregation';

interface ActivityStatsProps {
  stats: OverallUserStats;
  totalForumPosts: number;
  totalWikiContributions: number;
  totalMessages: number;
}

export const ActivityStats = memo<ActivityStatsProps>(
  ({ stats, totalForumPosts, totalWikiContributions, totalMessages }) => {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Activity Summary</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Forum Activity - Hidden (forums disabled) */}

          {/* Wiki Activity */}
          <div className="rounded-lg bg-gray-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{totalWikiContributions}</div>
            <div className="mt-1 text-sm text-gray-400">Wiki Edits</div>
          </div>

          {/* Total Contributions */}
          <div className="rounded-lg bg-gray-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.totalContributions}</div>
            <div className="mt-1 text-sm text-gray-400">Total Contributions</div>
          </div>
        </div>
      </div>
    );
  }
);

ActivityStats.displayName = 'ActivityStats';
