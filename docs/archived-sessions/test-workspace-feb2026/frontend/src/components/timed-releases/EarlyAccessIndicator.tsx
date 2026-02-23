'use client';

import React from 'react';
import { Clock, Lock, Rocket, Crown, Star } from 'lucide-react';
import type { ReleaseAccessStatus, AccessCheckResult } from '@/lib/timed-releases/types';
import type { SupporterTier } from '@/lib/badges/types';

interface EarlyAccessIndicatorProps {
  accessResult: AccessCheckResult;
  className?: string;
  variant?: 'badge' | 'banner' | 'inline';
}

/**
 * Tier icon mapping
 */
const TIER_ICONS: Record<SupporterTier, React.FC<{ className?: string }>> = {
  pioneer: Rocket,
  navigator: Clock,
  voyager: Star,
  commander: Star,
  admiral: Crown,
};

/**
 * Tier color mapping
 */
const TIER_COLORS: Record<SupporterTier, string> = {
  pioneer: '#cd7f32',
  navigator: '#c0c0c0',
  voyager: '#ffd700',
  commander: '#e5e4e2',
  admiral: '#b9f2ff',
};

/**
 * Status color mapping
 */
const STATUS_COLORS: Record<ReleaseAccessStatus, { bg: string; text: string; border: string }> = {
  unreleased: {
    bg: 'bg-gray-800',
    text: 'text-gray-400',
    border: 'border-gray-700',
  },
  early_access: {
    bg: 'bg-amber-900/30',
    text: 'text-amber-400',
    border: 'border-amber-700',
  },
  public: {
    bg: 'bg-green-900/30',
    text: 'text-green-400',
    border: 'border-green-700',
  },
};

/**
 * Badge variant - small inline indicator
 */
function BadgeVariant({ accessResult, className = '' }: EarlyAccessIndicatorProps) {
  const { status, releaseInfo } = accessResult;

  if (status === 'public') {
    return null; // Don't show anything for public content
  }

  const colors = STATUS_COLORS[status];
  const TierIcon = releaseInfo?.minTier ? TIER_ICONS[releaseInfo.minTier] : Rocket;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      <TierIcon className="h-3 w-3" />
      {status === 'early_access' ? <>Early Access</> : <>Coming Soon</>}
    </span>
  );
}

/**
 * Banner variant - prominent header banner
 */
function BannerVariant({ accessResult, className = '' }: EarlyAccessIndicatorProps) {
  const { canAccess, status, releaseInfo, reason } = accessResult;
  const colors = STATUS_COLORS[status];

  if (status === 'public') {
    return null;
  }

  const TierIcon = releaseInfo?.minTier ? TIER_ICONS[releaseInfo.minTier] : Rocket;
  const tierColor = releaseInfo?.minTier ? TIER_COLORS[releaseInfo.minTier] : '#cd7f32';

  return (
    <div className={`rounded-lg border p-4 ${colors.bg} ${colors.border} ${className}`}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${tierColor}20` }}
        >
          {canAccess ? (
            <TierIcon className="h-5 w-5" style={{ color: tierColor }} />
          ) : (
            <Lock className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold ${colors.text}`}>
            {canAccess
              ? 'Early Access Content'
              : status === 'early_access'
                ? 'Supporter Exclusive'
                : 'Coming Soon'}
          </h4>
          <p className="mt-1 text-sm text-gray-300">
            {canAccess ? (
              <>
                You have early access to this content.{' '}
                {releaseInfo && releaseInfo.daysUntilPublic > 0 && (
                  <>
                    Public release in {releaseInfo.daysUntilPublic} day
                    {releaseInfo.daysUntilPublic === 1 ? '' : 's'}.
                  </>
                )}
              </>
            ) : status === 'early_access' ? (
              <>
                This content is available to{' '}
                <span style={{ color: tierColor }} className="font-medium capitalize">
                  {releaseInfo?.minTier}
                </span>{' '}
                tier supporters and above.{' '}
                {releaseInfo && releaseInfo.daysUntilPublic > 0 && (
                  <>
                    Public release in {releaseInfo.daysUntilPublic} day
                    {releaseInfo.daysUntilPublic === 1 ? '' : 's'}.
                  </>
                )}
              </>
            ) : (
              <>
                This content will be available to supporters on{' '}
                {releaseInfo && new Date(releaseInfo.supporterReleaseAt).toLocaleDateString()}.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline variant - subtle text indicator
 */
function InlineVariant({ accessResult, className = '' }: EarlyAccessIndicatorProps) {
  const { status, releaseInfo } = accessResult;

  if (status === 'public') {
    return null;
  }

  const colors = STATUS_COLORS[status];
  const tierColor = releaseInfo?.minTier ? TIER_COLORS[releaseInfo.minTier] : '#cd7f32';

  return (
    <span className={`inline-flex items-center gap-1 text-sm ${colors.text} ${className}`}>
      <Clock className="h-4 w-4" />
      {status === 'early_access' ? (
        <>
          <span style={{ color: tierColor }} className="font-medium capitalize">
            {releaseInfo?.minTier}
          </span>{' '}
          Early Access
          {releaseInfo && releaseInfo.daysUntilPublic > 0 && (
            <span className="text-gray-500"> ({releaseInfo.daysUntilPublic}d until public)</span>
          )}
        </>
      ) : (
        <>Coming Soon</>
      )}
    </span>
  );
}

/**
 * Early Access Indicator Component
 *
 * Displays early access/timed release status for content.
 * Supports multiple display variants.
 */
export function EarlyAccessIndicator(props: EarlyAccessIndicatorProps) {
  const { variant = 'badge' } = props;

  switch (variant) {
    case 'banner':
      return <BannerVariant {...props} />;
    case 'inline':
      return <InlineVariant {...props} />;
    case 'badge':
    default:
      return <BadgeVariant {...props} />;
  }
}

/**
 * Early Access Lock Screen
 *
 * Shown when user doesn't have access to early access content.
 */
interface EarlyAccessLockProps {
  accessResult: AccessCheckResult;
  className?: string;
}

export function EarlyAccessLock({ accessResult, className = '' }: EarlyAccessLockProps) {
  const { status, releaseInfo } = accessResult;
  const tierColor = releaseInfo?.minTier ? TIER_COLORS[releaseInfo.minTier] : '#cd7f32';
  const TierIcon = releaseInfo?.minTier ? TIER_ICONS[releaseInfo.minTier] : Rocket;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center ${className}`}
    >
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `${tierColor}20` }}
      >
        {status === 'unreleased' ? (
          <Clock className="h-8 w-8 text-gray-400" />
        ) : (
          <Lock className="h-8 w-8" style={{ color: tierColor }} />
        )}
      </div>

      <h3 className="mb-2 text-xl font-bold text-white">
        {status === 'unreleased' ? 'Coming Soon' : 'Supporter Exclusive'}
      </h3>

      <p className="mb-4 max-w-md text-gray-400">
        {status === 'unreleased' ? (
          <>
            This content will be available to supporters on{' '}
            <span className="text-white">
              {releaseInfo && new Date(releaseInfo.supporterReleaseAt).toLocaleDateString()}
            </span>
            , and to everyone on{' '}
            <span className="text-white">
              {releaseInfo && new Date(releaseInfo.publicReleaseAt).toLocaleDateString()}
            </span>
            .
          </>
        ) : (
          <>
            This content is currently available to{' '}
            <span style={{ color: tierColor }} className="font-medium capitalize">
              {releaseInfo?.minTier}
            </span>{' '}
            tier supporters and above.
          </>
        )}
      </p>

      {status === 'early_access' && releaseInfo && releaseInfo.daysUntilPublic > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-gray-700/50 px-4 py-2 text-sm text-gray-300">
          <Clock className="h-4 w-4" />
          Public release in {releaseInfo.daysUntilPublic} day
          {releaseInfo.daysUntilPublic === 1 ? '' : 's'}
        </div>
      )}

      {status === 'early_access' && (
        <a
          href="/support"
          className="mt-4 inline-flex items-center gap-2 rounded-lg px-6 py-2 font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: tierColor }}
        >
          <TierIcon className="h-5 w-5" />
          Become a Supporter
        </a>
      )}
    </div>
  );
}

export default EarlyAccessIndicator;
