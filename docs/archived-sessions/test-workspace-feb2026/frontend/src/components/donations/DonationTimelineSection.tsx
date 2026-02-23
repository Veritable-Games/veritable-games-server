/**
 * Donation Timeline Section
 * Vertical timeline grouped by month (NOT a table)
 *
 * Design:
 * - Monthly grouping with visual dividers
 * - Project allocation badges
 * - Optional messages displayed as quotes
 * - "Load More" pagination (not page numbers)
 * - Temporal narrative flow
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { DonationWithAllocations } from '@/lib/donations/types';
import { logger } from '@/lib/utils/logger';

interface DonationTimelineSectionProps {
  initialDonations: DonationWithAllocations[];
  hasMore: boolean;
}

export function DonationTimelineSection({
  initialDonations,
  hasMore: initialHasMore,
}: DonationTimelineSectionProps) {
  const [donations, setDonations] = useState<DonationWithAllocations[]>(initialDonations);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Load donations from API on mount if not provided
  useEffect(() => {
    if (initialDonations.length === 0 && initialLoad) {
      loadInitialDonations();
    }
  }, [initialDonations, initialLoad]);

  async function loadInitialDonations() {
    try {
      setLoading(true);
      const response = await fetch('/api/donations/history?limit=20&offset=0');
      const result = await response.json();

      if (result.success) {
        setDonations(result.donations || []);
        setHasMore(result.pagination?.hasMore || false);
      }
    } catch (error) {
      logger.error('Failed to load donations', { error });
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }

  // Group donations by month
  const donationsByMonth = groupByMonth(donations);

  async function loadMore() {
    setLoading(true);
    try {
      const response = await fetch(`/api/donations/history?limit=20&offset=${donations.length}`);
      const result = await response.json();

      if (result.success) {
        setDonations([...donations, ...result.donations]);
        setHasMore(result.pagination.hasMore);
      }
    } catch (error) {
      logger.error('Failed to load more donations', { error });
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (loading && donations.length === 0) {
    return (
      <section className="border-t border-neutral-800 px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-2xl font-bold text-white">Your Donation History</h2>
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-neutral-400">Loading your donation history...</div>
          </div>
        </div>
      </section>
    );
  }

  // Empty state
  if (donations.length === 0) {
    return (
      <section className="border-t border-neutral-800 px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-2xl font-bold text-white">Your Donation History</h2>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/50">
              <svg
                className="h-8 w-8 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-lg text-neutral-300">No donations yet</p>
            <p className="mt-2 text-sm text-neutral-400">
              Your contribution history will appear here once you make your first donation
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-neutral-800 px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-6 text-2xl font-bold text-white">Your Donation History</h2>

        {/* Timeline */}
        <div className="space-y-6">
          {Object.entries(donationsByMonth).map(([monthKey, monthDonations]) => (
            <TimelineMonthGroup key={monthKey} monthKey={monthKey} donations={monthDonations} />
          ))}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="rounded-md border border-[#60a5fa]/40 bg-[#60a5fa]/10 px-6 py-3 font-medium text-[#60a5fa] transition-colors hover:border-[#60a5fa]/60 hover:bg-[#60a5fa]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineMonthGroup({
  monthKey,
  donations,
}: {
  monthKey: string;
  donations: DonationWithAllocations[];
}) {
  const monthDate = new Date(monthKey + '-01');
  const monthName = monthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      {/* Month header */}
      <div className="mb-4 flex items-center gap-4">
        <h3 className="text-lg font-bold text-white">{monthName}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-neutral-800 to-transparent" />
      </div>

      {/* Donations in this month */}
      <div className="space-y-4">
        {donations.map(donation => (
          <DonationTimelineItem key={donation.id} donation={donation} />
        ))}
      </div>
    </div>
  );
}

function DonationTimelineItem({ donation }: { donation: DonationWithAllocations }) {
  const hasMessage = donation.message && donation.message.trim().length > 0;
  const hasAllocations = donation.allocations && donation.allocations.length > 0;

  return (
    <div className="relative rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 transition-all hover:border-neutral-700 hover:bg-neutral-900/70">
      {/* Date badge */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#60a5fa]/20 text-[#60a5fa]">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm text-neutral-400">
            {new Date(donation.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-neutral-500">{donation.payment_status}</p>
        </div>
      </div>

      {/* Amount */}
      <p className="mb-4 text-3xl font-bold text-[#60a5fa]">
        ${donation.amount.toFixed(2)}{' '}
        <span className="text-sm font-normal text-neutral-400">{donation.currency}</span>
      </p>

      {/* Project allocations */}
      {hasAllocations && (
        <div className="mb-4 flex flex-wrap gap-2">
          {donation.allocations.map((allocation: any, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800/50 px-3 py-1 text-sm text-neutral-300"
            >
              <span className="font-medium">${allocation.amount.toFixed(2)}</span>
              <span className="text-neutral-500">•</span>
              <span>{allocation.project_name || 'Unknown Project'}</span>
            </span>
          ))}
        </div>
      )}

      {/* Message (as quote) */}
      {hasMessage && (
        <blockquote className="relative border-l-2 border-[#60a5fa]/30 pl-4 italic text-neutral-300">
          <p className="text-sm leading-relaxed">"{donation.message}"</p>
        </blockquote>
      )}
    </div>
  );
}

/**
 * Group donations by month (YYYY-MM format)
 */
function groupByMonth(
  donations: DonationWithAllocations[]
): Record<string, DonationWithAllocations[]> {
  const grouped: Record<string, DonationWithAllocations[]> = {};

  for (const donation of donations) {
    const date = new Date(donation.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(donation);
  }

  return grouped;
}
