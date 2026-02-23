/**
 * Shared StatusBadge Component
 *
 * Reusable status badge for displaying status indicators across the application.
 * Used for payment status, subscription status, campaign status, etc.
 *
 * Design:
 * - Dark theme with site colors (#0a0a0a, #ededed, #60a5fa)
 * - Kalinga font (inherited)
 * - Color-coded by status type
 * - Small, compact design
 */

import React from 'react';

type StatusVariant =
  | 'payment' // Payment statuses: completed, pending, failed, refunded
  | 'subscription' // Subscription statuses: active, past_due, canceled, paused
  | 'campaign' // Campaign statuses: active, completed, upcoming
  | 'generic'; // Generic: success, warning, error, info

type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';
type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused';
type CampaignStatus = 'active' | 'completed' | 'upcoming';
type GenericStatus = 'success' | 'warning' | 'error' | 'info';

type StatusValue = PaymentStatus | SubscriptionStatus | CampaignStatus | GenericStatus | string;

export interface StatusBadgeProps {
  /** Status value to display */
  status: StatusValue;
  /** Status variant determines color mapping */
  variant?: StatusVariant;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * StatusBadge Component
 *
 * @example
 * ```tsx
 * <StatusBadge status="completed" variant="payment" />
 * <StatusBadge status="active" variant="subscription" />
 * <StatusBadge status="upcoming" variant="campaign" />
 * ```
 */
export function StatusBadge({ status, variant = 'generic', className = '' }: StatusBadgeProps) {
  // Payment status colors
  const paymentColors: Record<PaymentStatus, string> = {
    completed: 'bg-green-900/30 text-green-400',
    pending: 'bg-yellow-900/30 text-yellow-400',
    failed: 'bg-red-900/30 text-red-400',
    refunded: 'bg-gray-700 text-gray-300',
  };

  // Subscription status colors (with borders for emphasis)
  const subscriptionColors: Record<SubscriptionStatus, string> = {
    active: 'bg-green-900/30 text-green-400 border-green-700',
    past_due: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
    canceled: 'bg-red-900/30 text-red-400 border-red-700',
    paused: 'bg-gray-700 text-gray-300 border-gray-600',
  };

  // Campaign status colors
  const campaignColors: Record<CampaignStatus, string> = {
    active: 'bg-blue-900/30 text-blue-400',
    completed: 'bg-green-900/30 text-green-400',
    upcoming: 'bg-purple-900/30 text-purple-400',
  };

  // Generic status colors
  const genericColors: Record<GenericStatus, string> = {
    success: 'bg-green-900/30 text-green-400',
    warning: 'bg-yellow-900/30 text-yellow-400',
    error: 'bg-red-900/30 text-red-400',
    info: 'bg-blue-900/30 text-blue-400',
  };

  // Select color map based on variant
  let colorClass = '';
  const statusLower = status.toLowerCase();

  switch (variant) {
    case 'payment':
      colorClass = paymentColors[statusLower as PaymentStatus] || paymentColors.pending;
      break;
    case 'subscription':
      colorClass =
        subscriptionColors[statusLower as SubscriptionStatus] ||
        'bg-gray-700 text-gray-300 border-gray-600';
      break;
    case 'campaign':
      colorClass = campaignColors[statusLower as CampaignStatus] || campaignColors.active;
      break;
    case 'generic':
    default:
      colorClass = genericColors[statusLower as GenericStatus] || 'bg-gray-700 text-gray-300';
  }

  // Add border for subscription variant
  const borderClass = variant === 'subscription' ? 'border' : '';

  return (
    <span
      className={`inline-block rounded-full ${borderClass} px-2 py-0.5 text-xs ${colorClass} ${className}`}
    >
      {status}
    </span>
  );
}
