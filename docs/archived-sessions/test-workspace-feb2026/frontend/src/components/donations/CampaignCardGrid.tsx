'use client';

import Link from 'next/link';
import type { FundingGoal } from '@/lib/donations/types';

interface CampaignCardGridProps {
  campaigns: FundingGoal[];
}

export function CampaignCardGrid({ campaigns }: CampaignCardGridProps) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-12 text-center">
        <p className="text-neutral-400">No active campaigns at this time</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {campaigns.map(campaign => {
        const progress = campaign.target_amount
          ? (campaign.current_amount / campaign.target_amount) * 100
          : 0;

        return (
          <div
            key={campaign.id}
            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 transition-all hover:border-neutral-700"
          >
            <h3 className="mb-2 text-xl font-bold text-white">{campaign.title}</h3>

            {campaign.description && (
              <p className="mb-4 text-sm text-neutral-400">{campaign.description}</p>
            )}

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-white">${campaign.current_amount.toFixed(0)}</span>
                <span className="text-neutral-400">of ${campaign.target_amount.toFixed(0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500">{progress.toFixed(1)}% funded</p>
            </div>

            {/* Dates */}
            <div className="mb-4 text-xs text-neutral-500">
              {campaign.end_date && <p>Ends {new Date(campaign.end_date).toLocaleDateString()}</p>}
            </div>

            {/* Support Button */}
            <Link
              href={`/donate?campaign=${campaign.id}`}
              className="block rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              Support This Campaign
            </Link>
          </div>
        );
      })}
    </div>
  );
}
