'use client';

import { Clock } from 'lucide-react';

interface DonationActivity {
  id: number;
  donorName: string;
  amount: number;
  campaignName?: string;
  timestamp: string;
}

interface RecentActivityFeedProps {
  activities: DonationActivity[];
  maxItems?: number;
}

export default function RecentActivityFeed({ activities, maxItems = 10 }: RecentActivityFeedProps) {
  const formatCurrency = (amount: number) => {
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-bold text-white">Recent Support</h3>
      </div>

      {displayActivities.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Be the first to support!</p>
      ) : (
        <div className="space-y-3">
          {displayActivities.map(activity => (
            <div
              key={activity.id}
              className="flex items-start justify-between border-b border-gray-700/50 py-2 last:border-0"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{activity.donorName}</p>
                {activity.campaignName && (
                  <p className="text-xs text-gray-500">→ {activity.campaignName}</p>
                )}
              </div>
              <div className="ml-3 text-right">
                <p className="text-sm font-semibold text-green-400">
                  {formatCurrency(activity.amount)}
                </p>
                <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {displayActivities.length < activities.length && (
        <button className="mt-4 w-full text-sm text-blue-400 transition-colors hover:text-blue-300">
          View More Activity →
        </button>
      )}
    </div>
  );
}
