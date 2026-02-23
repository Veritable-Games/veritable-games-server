'use client';

/**
 * Mini Transparency Stats
 * Displays key metrics in a compact banner format
 */

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Target } from 'lucide-react';
import { logger } from '@/lib/utils/logger';

interface MiniStats {
  totalRaised: number;
  thisYearRaised: number;
  activeCampaigns: number;
  avgProgress: number;
}

export function MiniTransparencyStats() {
  const [stats, setStats] = useState<MiniStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/donations/transparency');
        if (!response.ok) throw new Error('Failed to fetch stats');

        const data = await response.json();

        // Extract key stats from transparency metrics
        setStats({
          totalRaised: data.total_all_time || 0,
          thisYearRaised: data.total_this_year || 0,
          activeCampaigns: data.active_goals?.length || 0,
          avgProgress:
            data.active_goals?.length > 0
              ? data.active_goals.reduce(
                  (sum: number, goal: any) => sum + goal.progress_percentage,
                  0
                ) / data.active_goals.length
              : 0,
        });
      } catch (err) {
        logger.error('Error fetching mini stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded bg-gray-700/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
      <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
        <div>
          <div className="mb-1 flex items-center justify-center gap-1 text-xs text-gray-400">
            <DollarSign className="h-3 w-3" />
            <span>Total Raised</span>
          </div>
          <div className="text-lg font-bold text-white">${stats.totalRaised.toLocaleString()}</div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-center gap-1 text-xs text-gray-400">
            <TrendingUp className="h-3 w-3" />
            <span>This Year</span>
          </div>
          <div className="text-lg font-bold text-white">
            ${stats.thisYearRaised.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-center gap-1 text-xs text-gray-400">
            <Target className="h-3 w-3" />
            <span>Active Campaigns</span>
          </div>
          <div className="text-lg font-bold text-white">{stats.activeCampaigns}</div>
        </div>

        <div>
          <div className="mb-1 text-xs text-gray-400">Avg Progress</div>
          <div className="text-lg font-bold text-white">
            {Number(stats.avgProgress || 0).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
