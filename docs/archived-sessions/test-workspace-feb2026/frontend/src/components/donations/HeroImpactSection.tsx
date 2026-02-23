/**
 * Hero Impact Section
 * Personalized greeting celebrating user's contribution journey
 *
 * Design:
 * - Large, personalized greeting
 * - Color-coded stats with visual emphasis
 * - Milestone badges
 * - Warm, personal tone (NOT sterile dashboard)
 */

'use client';

import React from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { EditablePageHeader } from '@/components/shared/EditablePageHeader';

interface HeroImpactSectionProps {
  donorName: string | null;
  stats: {
    totalDonated: number;
    activeSubscriptionCount: number;
    donationCount: number;
  };
  isAdmin?: boolean;
}

export function HeroImpactSection({ donorName, stats, isAdmin = false }: HeroImpactSectionProps) {
  const displayName = donorName || 'Supporter';
  const milestone = getMilestone(stats.totalDonated);

  return (
    <section className="border-b border-gray-800/50 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        {/* Editable page header */}
        <EditablePageHeader
          title="Your Support Story"
          description={`Thank you, ${displayName}, for supporting open-source game development`}
          isEditable={isAdmin}
          pageSlug="donate-manage"
          className="mb-8"
        />

        {/* Milestone badge */}
        {milestone && (
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#60a5fa]/20 px-4 py-2 text-sm text-[#60a5fa]">
              <span className="text-lg">{milestone.emoji}</span>
              <span className="font-medium">{milestone.label}</span>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            title="Total Support"
            value={`$${stats.totalDonated.toFixed(2)}`}
            icon="dollar"
            className="border-[#60a5fa]/20 bg-[#60a5fa]/5"
          />
          <StatCard
            title="Active Subscriptions"
            value={stats.activeSubscriptionCount}
            icon="refresh"
            className="border-green-700/20 bg-green-900/10"
          />
          <StatCard
            title="Contributions Made"
            value={stats.donationCount}
            icon="gift"
            className="border-purple-700/20 bg-purple-900/10"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Get milestone badge based on total donated
 */
function getMilestone(totalDonated: number): { emoji: string; label: string } | null {
  if (totalDonated >= 1000) {
    return { emoji: '🏆', label: 'Legendary Supporter' };
  }
  if (totalDonated >= 500) {
    return { emoji: '⭐', label: 'Gold Supporter' };
  }
  if (totalDonated >= 100) {
    return { emoji: '🌟', label: 'Silver Supporter' };
  }
  if (totalDonated >= 25) {
    return { emoji: '✨', label: 'Bronze Supporter' };
  }
  if (totalDonated > 0) {
    return { emoji: '💙', label: 'Community Supporter' };
  }
  return null;
}
