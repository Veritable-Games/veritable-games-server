'use client';

import type { FundingGoal } from '@/lib/donations/types';
import { CampaignCardGrid } from './CampaignCardGrid';
import { CampaignsTable } from './CampaignsTable';

interface CampaignsViewProps {
  campaigns: FundingGoal[];
  isAdmin: boolean;
}

export function CampaignsView({ campaigns, isAdmin }: CampaignsViewProps) {
  // Filter for active campaigns in public view
  const activeCampaigns = campaigns.filter(c => c.is_active);

  if (isAdmin) {
    return <CampaignsTable initialCampaigns={campaigns} />;
  }

  return <CampaignCardGrid campaigns={activeCampaigns} />;
}
