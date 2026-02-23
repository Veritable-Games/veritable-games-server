/**
 * Donation Management View
 * Dashboard for users with existing donations
 * Shows stats, subscriptions, and donation history
 */

'use client';

import { StatCard } from './StatCard';
import { SubscriptionsList } from '@/components/donations/SubscriptionsList';
import { DonationTimelineSection } from '@/components/donations/DonationTimelineSection';
import type { SubscriptionWithProject } from '@/lib/donations/types';

interface DonationManagementViewProps {
  donationData: {
    totalDonated: number;
    subscriptions: SubscriptionWithProject[];
    donationCount: number;
  };
  onMakeAnotherDonation: () => void;
}

export function DonationManagementView({
  donationData,
  onMakeAnotherDonation,
}: DonationManagementViewProps) {
  const activeSubscriptions = donationData.subscriptions.filter(
    s => s.status === 'active' || s.status === 'trialing'
  );

  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Donations</h1>
          <p className="text-sm text-neutral-400">
            Manage your contributions and recurring support
          </p>
        </div>
        <button
          onClick={onMakeAnotherDonation}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Make Another Donation
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          label="Total Contributed"
          value={`$${donationData.totalDonated.toFixed(2)}`}
          iconBgColor="bg-blue-900/30"
          iconTextColor="text-blue-400"
        />
        <StatCard
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          }
          label="Active Subscriptions"
          value={activeSubscriptions.length}
          iconBgColor="bg-green-900/30"
          iconTextColor="text-green-400"
        />
        <StatCard
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          }
          label="Lifetime Donations"
          value={donationData.donationCount}
          iconBgColor="bg-purple-900/30"
          iconTextColor="text-purple-400"
        />
      </div>

      {/* Subscriptions Section */}
      {donationData.subscriptions.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-white">Subscriptions</h2>
          <SubscriptionsList subscriptions={donationData.subscriptions} />
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
