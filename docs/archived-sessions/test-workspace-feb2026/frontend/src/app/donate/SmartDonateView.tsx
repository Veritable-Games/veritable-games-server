/**
 * Smart Donate View
 * Intelligent view switcher for /donate page
 * Shows donation form OR management dashboard based on user state
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { DonationForm } from './donation-form';
import { DonationManagementView } from './DonationManagementView';
import { AdminTestPanel } from '@/components/donations/AdminTestPanel';
import type { FundingProjectWithProgress, SubscriptionWithProject } from '@/lib/donations/types';
import type { User } from '@/lib/auth/types';

interface SmartDonateViewProps {
  projects: FundingProjectWithProgress[];
  session: User | null;
  hasExistingDonations: boolean;
  donationData?: {
    totalDonated: number;
    subscriptions: SubscriptionWithProject[];
    donationCount: number;
  };
}

// Loading fallback for DonationForm
function DonationFormLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-12 rounded-lg bg-neutral-700/50" />
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 rounded-lg bg-neutral-700/50" />
        ))}
      </div>
      <div className="h-12 rounded-lg bg-neutral-700/50" />
      <div className="h-14 rounded-lg bg-neutral-700/50" />
    </div>
  );
}

export function SmartDonateView({
  projects,
  session,
  hasExistingDonations,
  donationData,
}: SmartDonateViewProps) {
  const router = useRouter();

  // Initialize view based on whether user has donations
  // 'form' = show donation form
  // 'manage' = show management dashboard
  const [view, setView] = useState<'form' | 'manage'>(hasExistingDonations ? 'manage' : 'form');

  // Refresh page data when test donation is added/removed
  const handleRefresh = () => {
    router.refresh();
  };

  const isAdmin = session?.role === 'admin' || session?.role === 'developer';

  // Unauthenticated or no donations → always show form
  if (!session || !hasExistingDonations) {
    return (
      <>
        <Suspense fallback={<DonationFormLoading />}>
          <DonationForm projects={projects} />
        </Suspense>

        {/* Admin test panel */}
        {isAdmin && <AdminTestPanel onDonationAdded={handleRefresh} />}
      </>
    );
  }

  // Authenticated with donations → smart view
  return (
    <>
      {view === 'manage' ? (
        // Management view - show dashboard with stats, subscriptions, history
        <>
          <DonationManagementView
            donationData={donationData!}
            onMakeAnotherDonation={() => setView('form')}
          />

          {/* Admin test panel */}
          {isAdmin && <AdminTestPanel onDonationAdded={handleRefresh} />}
        </>
      ) : (
        // Form view - show donation form with back button
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={() => setView('manage')}
            className="flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to My Donations
          </button>

          {/* Donation form */}
          <Suspense fallback={<DonationFormLoading />}>
            <DonationForm projects={projects} />
          </Suspense>

          {/* Admin test panel */}
          {isAdmin && <AdminTestPanel onDonationAdded={handleRefresh} />}
        </div>
      )}
    </>
  );
}
