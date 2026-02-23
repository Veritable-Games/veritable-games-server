import { NextRequest, NextResponse } from 'next/server';
import { ProfileService } from '@/lib/profiles/service';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';
import type { UserId } from '@/types/profile-aggregation';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const profileService = new ProfileService();

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // Get current user for privacy checks
    const currentUser = await getCurrentUser(request);
    const viewerId = currentUser?.id;

    // Get comprehensive profile data
    const profile = await profileService.getUserProfile(
      userId as UserId,
      viewerId as UserId | undefined
    );
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found or access denied' },
        { status: 404 }
      );
    }

    // Get profile statistics
    // Note: getProfileStats was removed, using basic profile data instead
    const stats = null;

    // Get recent activities (getUserActivities doesn't take viewerId parameter)
    const activities = await profileService.getUserActivities(userId as UserId, 10);

    // Get achievements (method doesn't exist, returning null)
    const achievements = null;

    // Get privacy settings (only for own profile or admins)
    let privacySettings = null;
    if (userId === viewerId || currentUser?.role === 'admin') {
      privacySettings = await profileService.getUserPrivacySettings(userId as UserId);
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        stats,
        activities,
        achievements,
        privacy_settings: privacySettings,
      },
    });
  } catch (error) {
    logger.error('Error fetching enhanced profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile data' },
      { status: 500 }
    );
  }
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
