'use client';

import { SubscriptionsList } from './SubscriptionsList';
import { DonationTimelineSection } from './DonationTimelineSection';
import type { SubscriptionWithProject } from '@/lib/donations/types';

interface DonationHistorySectionProps {
  totalDonated: number;
  subscriptions: SubscriptionWithProject[];
  donationCount: number;
}

export function DonationHistorySection({
  totalDonated,
  subscriptions,
  donationCount,
}: DonationHistorySectionProps) {
  const activeSubscriptions = subscriptions.filter(
    s => s.status === 'active' || s.status === 'trialing'
  );

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-900/30 p-3">
              <svg
                className="h-6 w-6 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Total Contributed</p>
              <p className="text-2xl font-bold text-white">${totalDonated.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-900/30 p-3">
              <svg
                className="h-6 w-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Active Subscriptions</p>
              <p className="text-2xl font-bold text-white">{activeSubscriptions.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-900/30 p-3">
              <svg
                className="h-6 w-6 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Lifetime Donations</p>
              <p className="text-2xl font-bold text-white">{donationCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscriptions Section */}
      {subscriptions.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-white">Subscriptions</h2>
          <SubscriptionsList subscriptions={subscriptions} />
        </div>
      )}

      {/* Donation History Timeline */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-white">Donation History</h2>
        <DonationTimelineSection initialDonations={[]} hasMore={false} />
      </div>
    </div>
  );
}
