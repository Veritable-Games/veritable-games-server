'use client';

import { useState } from 'react';
import {
  Rocket,
  Compass,
  Globe,
  Star,
  Crown,
  Shield,
  Clock,
  Code,
  Trophy,
  Heart,
  Zap,
  Award,
  type LucideIcon,
} from 'lucide-react';
import type { BadgeDisplay as BadgeDisplayType } from '@/lib/badges/types';
import { MAX_INLINE_BADGES } from '@/lib/badges/types';

/**
 * Icon mapping for badge icons
 */
const ICON_MAP: Record<string, LucideIcon> = {
  rocket: Rocket,
  compass: Compass,
  globe: Globe,
  star: Star,
  crown: Crown,
  shield: Shield,
  clock: Clock,
  code: Code,
  trophy: Trophy,
  heart: Heart,
  zap: Zap,
  award: Award,
};

interface BadgeIconProps {
  icon: string | null;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Single badge icon component
 */
function BadgeIcon({ icon, color, size = 'md', className = '' }: BadgeIconProps) {
  const IconComponent = icon ? ICON_MAP[icon] || Award : Award;
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      <IconComponent className={sizeClasses[size]} />
    </span>
  );
}

interface SingleBadgeProps {
  badge: BadgeDisplayType;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

/**
 * Single badge with optional tooltip
 */
function SingleBadge({ badge, size = 'md', showTooltip = true }: SingleBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  const sizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full ${sizeClasses[size]} transition-transform hover:scale-110`}
        style={{ backgroundColor: `${badge.color}20` }}
        title={!showTooltip ? badge.name : undefined}
      >
        <BadgeIcon icon={badge.icon} color={badge.color} size={size} />
      </span>

      {/* Tooltip */}
      {showTooltip && showDetails && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 transform">
          <div className="whitespace-nowrap rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm shadow-lg">
            <div className="flex items-center gap-2">
              <BadgeIcon icon={badge.icon} color={badge.color} size="sm" />
              <span className="font-medium" style={{ color: badge.color }}>
                {badge.name}
              </span>
            </div>
            {badge.description && <p className="mt-1 text-xs text-gray-400">{badge.description}</p>}
            <div
              className="absolute left-1/2 top-full -translate-x-1/2 transform border-4 border-transparent border-t-gray-800"
              style={{ marginTop: '-1px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface BadgeDisplayProps {
  badges: BadgeDisplayType[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltips?: boolean;
  className?: string;
}

/**
 * Display multiple badges with overflow handling
 */
export default function BadgeDisplay({
  badges,
  maxDisplay = MAX_INLINE_BADGES,
  size = 'md',
  showTooltips = true,
  className = '',
}: BadgeDisplayProps) {
  const [showAll, setShowAll] = useState(false);

  if (!badges || badges.length === 0) {
    return null;
  }

  // Sort by display priority and tier level
  const sortedBadges = [...badges].sort((a, b) => {
    if (a.badge_type === 'supporter' && b.badge_type !== 'supporter') return -1;
    if (b.badge_type === 'supporter' && a.badge_type !== 'supporter') return 1;
    return b.tier_level - a.tier_level;
  });

  const displayBadges = showAll ? sortedBadges : sortedBadges.slice(0, maxDisplay);
  const hiddenCount = sortedBadges.length - maxDisplay;

  const gapClasses = {
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1.5',
  };

  return (
    <div className={`inline-flex items-center ${gapClasses[size]} ${className}`}>
      {displayBadges.map(badge => (
        <SingleBadge key={badge.id} badge={badge} size={size} showTooltip={showTooltips} />
      ))}

      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="inline-flex items-center justify-center rounded-full bg-gray-700 px-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-600"
          title={`Show ${hiddenCount} more badges`}
        >
          +{hiddenCount}
        </button>
      )}

      {showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="inline-flex items-center justify-center rounded-full bg-gray-700 px-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-600"
          title="Show less"
        >
          Less
        </button>
      )}
    </div>
  );
}

/**
 * Compact badge display for lists (shows only icons)
 */
export function BadgeDisplayCompact({
  badges,
  maxDisplay = 3,
}: {
  badges: BadgeDisplayType[];
  maxDisplay?: number;
}) {
  if (!badges || badges.length === 0) {
    return null;
  }

  const sortedBadges = [...badges].sort((a, b) => b.tier_level - a.tier_level);
  const displayBadges = sortedBadges.slice(0, maxDisplay);
  const hiddenCount = sortedBadges.length - maxDisplay;

  return (
    <div className="inline-flex items-center gap-0.5">
      {displayBadges.map(badge => (
        <span
          key={badge.id}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: `${badge.color}30` }}
          title={badge.name}
        >
          <BadgeIcon icon={badge.icon} color={badge.color} size="sm" />
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="text-xs text-gray-500" title={`${hiddenCount} more badges`}>
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

/**
 * Badge with label (for profile pages)
 */
export function BadgeWithLabel({ badge }: { badge: BadgeDisplayType }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800/50 px-3 py-1.5">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: `${badge.color}20` }}
      >
        <BadgeIcon icon={badge.icon} color={badge.color} size="sm" />
      </span>
      <span className="text-sm font-medium" style={{ color: badge.color }}>
        {badge.name}
      </span>
    </div>
  );
}

/**
 * Full badge card (for badge selection/management)
 */
export function BadgeCard({
  badge,
  selected = false,
  onClick,
}: {
  badge: BadgeDisplayType;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
    >
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${badge.color}20` }}
      >
        <BadgeIcon icon={badge.icon} color={badge.color} size="lg" />
      </span>
      <div className="flex-1">
        <div className="font-medium" style={{ color: badge.color }}>
          {badge.name}
        </div>
        {badge.description && <p className="text-sm text-gray-400">{badge.description}</p>}
      </div>
      {selected && (
        <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
          Selected
        </span>
      )}
    </button>
  );
}
