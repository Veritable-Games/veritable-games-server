/**
 * Donation Page
 * Smart context-aware page showing donation form OR management dashboard
 * Based on user authentication and donation history
 */

// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { DonatePageHeader } from './page-header';
import { SmartDonateView } from './SmartDonateView';
import { donationService } from '@/lib/donations/service';
import { subscriptionService } from '@/lib/donations/subscription-service';
import { getServerSession } from '@/lib/auth/session';
import type { SubscriptionWithProject } from '@/lib/donations/types';

export default async function DonatePage() {
  // Fetch active projects and session
  const [projects, session] = await Promise.all([
    donationService.getFundingProjectsWithProgress(),
    getServerSession(),
  ]);

  // Check if user has existing donations/subscriptions
  let hasExistingDonations = false;
  let donationData:
    | {
        totalDonated: number;
        subscriptions: SubscriptionWithProject[];
        donationCount: number;
      }
    | undefined = undefined;

  if (session) {
    const [totalDonated, subscriptions, donationCount] = await Promise.all([
      donationService.getUserTotalDonations(session.id),
      subscriptionService.getSubscriptionsByUserId(session.id),
      donationService.getDonationCountByUserId(session.id),
    ]);

    // User has donations if they have any total > 0 or any subscriptions
    hasExistingDonations = totalDonated > 0 || subscriptions.length > 0;

    if (hasExistingDonations) {
      donationData = {
        totalDonated,
        subscriptions,
        donationCount,
      };
    }
  }

  return (
    <div className="h-full overflow-y-auto [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* Header - only show if not in management view */}
        {!hasExistingDonations && <DonatePageHeader />}

        {/* Smart view switcher - shows form OR management based on context */}
        <SmartDonateView
          projects={projects}
          session={session}
          hasExistingDonations={hasExistingDonations}
          donationData={donationData}
        />
      </div>
    </div>
  );
}
