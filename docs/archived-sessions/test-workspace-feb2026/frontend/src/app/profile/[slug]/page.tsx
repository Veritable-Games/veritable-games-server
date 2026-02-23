import { notFound, redirect } from 'next/navigation';
import { profileAggregatorService } from '@/lib/profiles/aggregator-factory';
import { getCurrentUser } from '@/lib/auth/server';
import { Suspense } from 'react';
import { User } from '@/lib/auth/types';
import {
  UserId,
  CoreUserProfile,
  UserStatsSummary,
  UserActivitySummary,
  UserPrivacySettings,
} from '@/types/profile-aggregation';
import { ProfileHeader } from '@/components/profiles/ProfileHeader';
import { ForumContributions } from '@/components/profiles/ForumContributions';
import { WikiContributions } from '@/components/profiles/WikiContributions';
import { SocialLinks } from '@/components/profiles/SocialLinks';
import { UserService } from '@/lib/users/service';
import { parseProfileIdentifier, getProfileUrlFromUsername } from '@/lib/utils/profile-url';
import { badgeService } from '@/lib/badges/service';
import type { BadgeDisplay } from '@/lib/badges/types';
import { logger } from '@/lib/utils/logger';

interface ProfilePageProps {
  params: Promise<{
    slug: string;
  }>;
}

interface AggregatedProfileData {
  core: CoreUserProfile;
  stats: UserStatsSummary;
  activities: UserActivitySummary;
  privacy: UserPrivacySettings;
  badges: BadgeDisplay[];
  aggregatedAt: string;
}

// Type adapters to convert between database format and component format
// Also ensures avatarPosition is properly passed through for avatar display
function adaptUserForComponents(user: CoreUserProfile): CoreUserProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatarPosition: user.avatarPosition, // Critical for avatar positioning in settings
    bio: user.bio,
    location: user.location,
    socialLinks: user.socialLinks,
    role: user.role,
    reputation: user.reputation,
    createdAt: user.createdAt,
    lastActive: user.lastActive,
    lastLogin: user.lastLogin,
    loginCount: user.loginCount,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

async function getAggregatedProfile(
  userId: string,
  viewerId?: number
): Promise<AggregatedProfileData | null> {
  try {
    const userIdBranded = parseInt(userId) as UserId;
    const viewerIdBranded = viewerId ? (viewerId as UserId) : undefined;

    // Get aggregated profile using ProfileAggregatorService
    const aggregatedResult = await profileAggregatorService.getAggregatedProfile(
      userIdBranded,
      viewerIdBranded
    );

    if (!aggregatedResult.isOk()) {
      const error = aggregatedResult.error;
      logger.error('Error getting aggregated profile:', {
        type: error.type,
        message: error.message,
        failedServices:
          error.type === 'partial_aggregation' && error.failedServices
            ? Array.from(error.failedServices.entries())
            : null,
      });
      return null;
    }

    const aggregated = aggregatedResult.value;

    // Fetch user badges (displayed badges only)
    let badges: BadgeDisplay[] = [];
    try {
      badges = await badgeService.getUserBadges(parseInt(userId), true);
    } catch (error) {
      logger.warn('Could not load badges:', error);
      badges = [];
    }

    return {
      core: aggregated.core,
      stats: aggregated.stats,
      activities: aggregated.activities,
      privacy: aggregated.privacy,
      badges,
      aggregatedAt: aggregated.aggregatedAt,
    };
  } catch (error) {
    logger.error('Error loading aggregated profile:', error);
    return null;
  }
}

// Loading component for Suspense boundaries
function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-4">
      {/* Back link skeleton */}
      <div className="mb-6 h-5 w-24 animate-pulse rounded bg-gray-700/30" />

      {/* Main card skeleton */}
      <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-800/90">
        {/* Header section */}
        <div className="p-8">
          <div className="flex items-start gap-6">
            <div className="h-20 w-20 animate-pulse rounded-full bg-gray-700" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-48 animate-pulse rounded bg-gray-700" />
              <div className="h-4 w-full max-w-md animate-pulse rounded bg-gray-700" />
              <div className="flex gap-3">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-700" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-700" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Action bar skeleton */}
        <div className="border-t border-gray-700/50 bg-gray-900/50 px-8 py-4">
          <div className="flex gap-3">
            <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-700" />
            <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-700" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main profile content component
async function ProfileContent({ userId, currentUser }: { userId: string; currentUser: User }) {
  const profileData = await getAggregatedProfile(userId, currentUser?.id);

  if (!profileData) {
    notFound();
  }

  const { core, stats, activities, privacy, badges } = profileData;
  const adaptedUser = adaptUserForComponents(core);
  // Use Number() to handle type mismatches between auth (number) and aggregator (branded UserId)
  const isOwnProfile = Number(currentUser?.id) === Number(core.id);

  // Check if user is banned based on is_active status
  const userService = new UserService();
  const fullUser = await userService.getUserById(core.id);
  const isUserBanned = fullUser && !fullUser.is_active;

  const isSoftBanned = isUserBanned;
  const isHardBanned = false;

  // Check if current user is an admin
  const isAdmin = currentUser?.role === 'admin';

  const joinDate = new Date(core.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lastActiveDate = core.lastActive
    ? new Date(core.lastActive).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Never';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-4">
      {/* Ban Status Banners */}
      {isSoftBanned && (
        <div className="rounded-lg border border-orange-700 bg-orange-900/20 p-4">
          <div className="flex items-center space-x-2">
            <svg
              className="h-5 w-5 text-orange-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-orange-400">User Temporarily Banned</h3>
              <p className="mt-1 text-sm text-orange-300">
                This user has been temporarily banned and cannot create or edit content.
              </p>
            </div>
          </div>
        </div>
      )}

      {isHardBanned && (
        <div className="rounded-lg border border-red-700 bg-red-900/20 p-4">
          <div className="flex items-center space-x-2">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-red-400">User Permanently Banned</h3>
              <p className="mt-1 text-sm text-red-300">
                This user has been permanently banned from the platform.
              </p>
            </div>
          </div>
        </div>
      )}

      <ProfileHeader
        user={adaptedUser}
        originalUser={core}
        isOwnProfile={isOwnProfile}
        joinDate={joinDate}
        lastActiveDate={lastActiveDate}
        badges={badges}
        isAdmin={isAdmin}
      />

      <ForumContributions stats={stats.forum} />

      <WikiContributions stats={stats.wiki} />

      <SocialLinks user={adaptedUser} />
    </div>
  );
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  // Await params as required by Next.js 15
  const resolvedParams = await params;

  // Check authentication and authorization first
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/'); // Redirect to home if not logged in (forums removed)
  }

  // Parse the slug - could be numeric ID (legacy) or username
  const identifier = parseProfileIdentifier(decodeURIComponent(resolvedParams.slug));
  const userService = new UserService();
  let userId: number;

  if (identifier.isNumeric) {
    // Legacy numeric ID URL - redirect to username-based URL for SEO/consistency
    userId = identifier.numericId!;
    const user = await userService.getUserById(userId);
    if (user) {
      // Redirect to username-based URL
      redirect(getProfileUrlFromUsername(user.username));
    }
    // If user not found with numeric ID, fall through to notFound()
    notFound();
  } else {
    // Username-based URL (new format)
    const user = await userService.getUserByUsername(identifier.username!);
    if (!user) {
      notFound();
    }
    userId = user.id;
  }

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent userId={String(userId)} currentUser={currentUser} />
    </Suspense>
  );
}
