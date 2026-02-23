'use client';

import { useState, useEffect } from 'react';
import { Check, X, Award, Loader2 } from 'lucide-react';
import { fetchWithCSRF } from '@/lib/utils/csrf';

interface SupporterBadge {
  id: number;
  name: string;
  slug: string;
  tier: number;
  description: string;
  color: string;
  isGranted: boolean;
  userBadgeId?: number;
}

// Supporter badge definitions with colors
const SUPPORTER_BADGES: Omit<SupporterBadge, 'isGranted' | 'userBadgeId'>[] = [
  {
    id: 1,
    name: 'Pioneer',
    slug: 'pioneer',
    tier: 1,
    description: '$5 supporter - Early adopter',
    color: 'text-amber-400',
  },
  {
    id: 2,
    name: 'Navigator',
    slug: 'navigator',
    tier: 2,
    description: '$25 supporter - Active supporter',
    color: 'text-amber-500',
  },
  {
    id: 3,
    name: 'Voyager',
    slug: 'voyager',
    tier: 3,
    description: '$100 supporter - Dedicated supporter',
    color: 'text-orange-400',
  },
  {
    id: 4,
    name: 'Commander',
    slug: 'commander',
    tier: 4,
    description: '$500 supporter - Elite supporter',
    color: 'text-orange-500',
  },
  {
    id: 5,
    name: 'Admiral',
    slug: 'admiral',
    tier: 5,
    description: '$1000 supporter - Ultimate supporter',
    color: 'text-red-400',
  },
];

interface BadgeGrantManagerProps {
  userId: number;
  onBadgeChange?: () => void;
}

export default function BadgeGrantManager({ userId, onBadgeChange }: BadgeGrantManagerProps) {
  const [badges, setBadges] = useState<SupporterBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current badges for the user
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        setLoading(true);
        const response = await fetchWithCSRF(`/api/users/${userId}/badges`);
        if (!response.ok) {
          throw new Error('Failed to fetch badges');
        }
        const data = await response.json();

        // Map supporter badges with granted status
        const userBadgeSlugs = new Set(data.badges?.map((b: any) => b.slug) || []);
        const userBadgeMap = new Map<string, number>(
          data.badges?.map((b: any) => [b.slug, b.user_badge_id] as [string, number]) || []
        );

        const mappedBadges: SupporterBadge[] = SUPPORTER_BADGES.map(badge => ({
          ...badge,
          isGranted: userBadgeSlugs.has(badge.slug),
          userBadgeId: userBadgeMap.get(badge.slug),
        }));

        setBadges(mappedBadges);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load badges');
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, [userId]);

  const handleGrant = async (badge: SupporterBadge) => {
    setProcessing(badge.slug);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithCSRF(`/api/users/${userId}/badges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_slug: badge.slug }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to grant badge');
      }

      // Update local state
      setBadges(prev => prev.map(b => (b.slug === badge.slug ? { ...b, isGranted: true } : b)));
      setSuccess(`Granted ${badge.name} badge`);
      onBadgeChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant badge');
    } finally {
      setProcessing(null);
    }
  };

  const handleRevoke = async (badge: SupporterBadge) => {
    if (!badge.userBadgeId) {
      setError('Badge not found');
      return;
    }

    setProcessing(badge.slug);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithCSRF(`/api/users/${userId}/badges/${badge.userBadgeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke badge');
      }

      // Update local state
      setBadges(prev =>
        prev.map(b =>
          b.slug === badge.slug ? { ...b, isGranted: false, userBadgeId: undefined } : b
        )
      );
      setSuccess(`Revoked ${badge.name} badge`);
      onBadgeChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke badge');
    } finally {
      setProcessing(null);
    }
  };

  // Clear success message after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">Loading badges...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <Award className="h-4 w-4 text-amber-400" />
        Supporter Badges
      </h4>

      {/* Feedback messages */}
      {error && <div className="rounded bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</div>}
      {success && (
        <div className="rounded bg-green-900/30 px-3 py-2 text-sm text-green-400">{success}</div>
      )}

      {/* Badge list */}
      <div className="space-y-2">
        {badges.map(badge => (
          <div
            key={badge.slug}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
              badge.isGranted
                ? 'border-amber-600/40 bg-amber-900/20'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  badge.isGranted ? 'bg-amber-600/30' : 'bg-gray-700'
                }`}
              >
                {badge.isGranted ? (
                  <Check className="h-4 w-4 text-amber-400" />
                ) : (
                  <X className="h-4 w-4 text-gray-500" />
                )}
              </div>

              {/* Badge info */}
              <div>
                <div className={`font-medium ${badge.color}`}>{badge.name}</div>
                <div className="text-xs text-gray-500">{badge.description}</div>
              </div>
            </div>

            {/* Grant/Revoke button */}
            <button
              onClick={() => (badge.isGranted ? handleRevoke(badge) : handleGrant(badge))}
              disabled={processing === badge.slug}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                badge.isGranted
                  ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                  : 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {processing === badge.slug ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : badge.isGranted ? (
                'Revoke'
              ) : (
                'Grant'
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Granting supporter badges gives access to the Supporters Lounge forum category.
      </p>
    </div>
  );
}
