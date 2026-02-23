/**
 * StatCard Component
 * Reusable stat card for donation statistics
 * Extracted from DonationHistorySection
 */

import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconBgColor?: string;
  iconTextColor?: string;
}

export function StatCard({
  icon,
  label,
  value,
  iconBgColor = 'bg-blue-900/30',
  iconTextColor = 'text-blue-400',
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-3 ${iconBgColor}`}>
          <div className={iconTextColor}>{icon}</div>
        </div>
        <div>
          <p className="text-sm text-neutral-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
