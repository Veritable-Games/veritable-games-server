'use client';

/**
 * Floating Donate Button
 * Sticky button visible on non-Support tabs
 */

import { DollarSign } from 'lucide-react';

interface FloatingDonateButtonProps {
  onDonateClick: () => void;
  activeCampaignsCount?: number;
}

export function FloatingDonateButton({
  onDonateClick,
  activeCampaignsCount,
}: FloatingDonateButtonProps) {
  return (
    <button
      onClick={onDonateClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 items-center gap-2 rounded-full bg-blue-600 px-6 py-3 font-semibold text-white shadow-2xl transition-all hover:scale-105 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      aria-label="Make a donation"
    >
      <DollarSign className="h-5 w-5" />
      <span>Donate</span>
      {activeCampaignsCount !== undefined && activeCampaignsCount > 0 && (
        <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {activeCampaignsCount}
        </span>
      )}
    </button>
  );
}
