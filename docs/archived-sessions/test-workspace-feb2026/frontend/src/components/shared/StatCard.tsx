/**
 * Shared StatCard Component
 *
 * Reusable stat card for displaying metrics across the application.
 * Used in transparency page, donation management, and other dashboards.
 *
 * Design:
 * - Dark theme with site colors (#0a0a0a, #ededed, #60a5fa)
 * - Kalinga font (inherited)
 * - Flexible icon support
 * - Optional trend indicator
 */

import React from 'react';

export interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional icon identifier */
  icon?: 'dollar' | 'refresh' | 'gift' | 'users' | 'chart' | 'check';
  /** Optional trend information */
  trend?: {
    value: number;
    label?: string;
  };
  /** Optional className for custom styling */
  className?: string;
}

/**
 * StatCard Component
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="Total Raised"
 *   value="$12,345.67"
 *   icon="dollar"
 *   trend={{ value: 12.5, label: "vs last month" }}
 * />
 * ```
 */
export function StatCard({ title, value, icon, trend, className = '' }: StatCardProps) {
  const icons = {
    dollar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    refresh: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
    gift: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
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
    check: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  };

  return (
    <div
      className={`rounded-lg border border-gray-700/40 bg-gray-800/50 p-4 transition-colors hover:bg-gray-800/70 ${className}`}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="rounded-full bg-blue-900/30 p-2">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {icons[icon]}
            </svg>
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {trend && (
            <p className={`mt-1 text-xs ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
