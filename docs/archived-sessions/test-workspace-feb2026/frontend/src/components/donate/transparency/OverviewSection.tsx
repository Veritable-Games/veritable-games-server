'use client';

import { useState, useEffect } from 'react';

interface TransparencyStats {
  totalAllTime: number;
  totalThisYear: number;
  totalExpenses: number;
  netIncome: number;
  activeGoals: number;
  avgDonation: number;
}

export function OverviewSection() {
  const [stats, setStats] = useState<TransparencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const response = await fetch('/api/transparency/metrics');
      const result = await response.json();

      if (result.success) {
        // Calculate average donation from total and monthly breakdown
        const totalDonations = result.total_all_time || 0;
        const donationCount =
          result.monthly_breakdown?.reduce(
            (sum: number, month: any) => sum + (month.donation_count || 0),
            0
          ) || 1;

        setStats({
          totalAllTime: result.total_all_time || 0,
          totalThisYear: result.total_this_year || 0,
          totalExpenses: result.total_expenses_this_year || 0,
          netIncome: result.net_this_year || 0,
          activeGoals: result.active_goals?.length || 0,
          avgDonation: donationCount > 0 ? totalDonations / donationCount : 0,
        });
      } else {
        setError(result.error || 'Failed to load stats');
      }
    } catch (err) {
      setError('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-neutral-400">Loading financial stats...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-300">{error}</div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total Raised (All Time)"
        value={`$${stats.totalAllTime.toFixed(2)}`}
        icon="dollar"
      />
      <StatCard
        title="Expenses (This Year)"
        value={`$${stats.totalExpenses.toFixed(2)}`}
        icon="chart"
      />
      <StatCard
        title="Net Income (This Year)"
        value={`$${stats.netIncome.toFixed(2)}`}
        icon="trending"
        valueColor={stats.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}
      />
      <StatCard title="This Year" value={`$${stats.totalThisYear.toFixed(2)}`} icon="calendar" />
      <StatCard title="Active Campaigns" value={stats.activeGoals.toString()} icon="target" />
      <StatCard title="Average Donation" value={`$${stats.avgDonation.toFixed(2)}`} icon="heart" />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  valueColor = 'text-white',
}: {
  title: string;
  value: string;
  icon: 'dollar' | 'target' | 'chart' | 'trending' | 'calendar' | 'heart';
  valueColor?: string;
}) {
  const icons = {
    dollar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    target: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    ),
    chart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    ),
    trending: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    ),
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
    heart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    ),
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-blue-900/30 p-2">
          <svg
            className="h-5 w-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {icons[icon]}
          </svg>
        </div>
        <div>
          <p className="text-sm text-neutral-400">{title}</p>
          <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
