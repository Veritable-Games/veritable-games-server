/**
 * Subscription Story Card
 * Narrative-driven subscription display (NOT generic lists)
 *
 * Design:
 * - Project color bleeding into card border
 * - Temporal context ("Started 6 months ago")
 * - Total contribution calculation
 * - Hover effect revealing more details
 * - Warm, personal tone
 */

'use client';

import React, { useState } from 'react';
import type { SubscriptionWithProject } from '@/lib/donations/types';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface SubscriptionStoryCardProps {
  subscription: SubscriptionWithProject;
  onManage: (stripeCustomerId: string) => void;
  isLoading: boolean;
}

export function SubscriptionStoryCard({
  subscription,
  onManage,
  isLoading,
}: SubscriptionStoryCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate temporal context
  const createdDate = new Date(subscription.created_at);
  const now = new Date();
  const monthsActive = Math.floor(
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  const timeContext =
    monthsActive === 0
      ? 'Started this month'
      : monthsActive === 1
        ? 'Started 1 month ago'
        : `Started ${monthsActive} months ago`;

  // Calculate total contributed (approximate)
  const totalContributed =
    subscription.amount *
    (subscription.interval === 'month' ? monthsActive : Math.floor(monthsActive / 12));

  const projectColor = subscription.project?.color || '#60a5fa';
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const isCanceled = subscription.status === 'canceled';

  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-gray-700/40 bg-gray-800/50 p-6 transition-all duration-300 hover:border-gray-600/60 hover:bg-gray-800/70"
      style={{
        borderLeftColor: isActive ? projectColor : undefined,
        borderLeftWidth: isActive ? '4px' : undefined,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Project color accent bleeding into border */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${projectColor}05 0%, transparent 50%)`,
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white">
              Supporting: {subscription.project?.name || 'General Fund'}
            </h3>
            <p className="mt-1 text-lg text-gray-400">
              ${subscription.amount.toFixed(2)}/{subscription.interval}
            </p>
          </div>
          <StatusBadge status={subscription.status} variant="subscription" />
        </div>

        {/* Temporal context */}
        <div className="mb-4 space-y-2 text-sm">
          <p className="text-gray-400">
            <span className="text-[#60a5fa]">{timeContext}</span>
            {!isCanceled && totalContributed > 0 && (
              <span className="ml-2">
                • <span className="font-semibold text-white">${totalContributed.toFixed(2)}</span>{' '}
                contributed so far
              </span>
            )}
          </p>

          {subscription.current_period_end && (
            <p className="text-gray-500">
              {isCanceled ? 'Ended' : 'Next billing'}:{' '}
              {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Manage button */}
        {subscription.stripe_customer_id && !isCanceled && (
          <button
            onClick={() => onManage(subscription.stripe_customer_id!)}
            disabled={isLoading}
            className="group/btn flex items-center gap-2 rounded-md border border-[#60a5fa]/40 bg-[#60a5fa]/10 px-4 py-2 text-sm font-medium text-[#60a5fa] transition-all hover:border-[#60a5fa]/60 hover:bg-[#60a5fa]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{isLoading ? 'Loading...' : 'Manage Subscription'}</span>
            <svg
              className="h-4 w-4 transition-transform group-hover/btn:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        )}

        {/* Expanded details on hover */}
        {isHovered && subscription.project && (
          <div className="mt-4 border-t border-gray-700/40 pt-4 text-sm text-gray-400">
            <p>{subscription.project.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
