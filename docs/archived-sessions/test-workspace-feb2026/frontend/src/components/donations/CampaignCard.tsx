'use client';

import type { FundingGoalWithProgress } from '@/lib/donations/types';
import { Clock, TrendingUp } from 'lucide-react';

interface CampaignCardProps {
  campaign: FundingGoalWithProgress;
  onSupport: (campaignId: number) => void;
}

export default function CampaignCard({ campaign, onSupport }: CampaignCardProps) {
  const formatCurrency = (amount: number) => {
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  const isUrgent = campaign.days_remaining !== null && campaign.days_remaining < 30;
  const progressColor = isUrgent ? 'bg-orange-500' : 'bg-blue-500';

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6 transition-colors hover:border-blue-500/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="flex-1 text-xl font-bold text-white">{campaign.title}</h3>
        {isUrgent && (
          <span className="ml-3 rounded border border-orange-500 bg-orange-900/30 px-2 py-1 text-xs font-semibold text-orange-300">
            Ending Soon
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-4 line-clamp-2 text-sm text-gray-400">{campaign.description}</p>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-400">Progress</span>
          <span className="font-semibold text-white">
            {Number(campaign.progress_percentage || 0).toFixed(0)}%
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-700">
          <div
            className={`${progressColor} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(Number(campaign.progress_percentage || 0), 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-xs text-gray-500">Raised</p>
          <p className="text-lg font-bold text-white">{formatCurrency(campaign.current_amount)}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-gray-500">Goal</p>
          <p className="text-lg font-semibold text-gray-400">
            {formatCurrency(campaign.target_amount)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-700 pt-4">
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {campaign.days_remaining !== null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{campaign.days_remaining} days left</span>
            </div>
          )}
          {campaign.is_recurring && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span>Recurring</span>
            </div>
          )}
        </div>

        <button
          onClick={() => onSupport(campaign.id)}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Support
        </button>
      </div>
    </div>
  );
}
