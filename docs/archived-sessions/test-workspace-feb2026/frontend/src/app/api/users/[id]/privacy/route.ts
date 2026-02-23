import { NextRequest, NextResponse } from 'next/server';
import { ProfileService, UserPrivacySettings } from '@/lib/profiles/service';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';
import type { UserId } from '@/types/profile-aggregation';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const profileService = new ProfileService();

async function getHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Users can only view their own privacy settings, admins can view all
    if (currentUser.id !== userId && currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to view privacy settings' },
        { status: 403 }
      );
    }

    const settings = await profileService.getUserPrivacySettings(userId as UserId);

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.error('Error fetching privacy settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch privacy settings' },
      { status: 500 }
    );
  }
}

async function putHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Users can only update their own privacy settings
    if (currentUser.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to update privacy settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      profile_visibility,
      activity_visibility,
      email_visibility,
      show_online_status,
      show_last_active,
      allow_messages,
      show_reputation_details,
      show_forum_activity,
      show_wiki_activity,
      show_messaging_activity,
    } = body;

    // Validate visibility levels
    const validVisibility = ['public', 'members', 'private'];
    const validEmailVisibility = ['public', 'members', 'admin', 'private'];

    if (profile_visibility && !validVisibility.includes(profile_visibility)) {
      return NextResponse.json(
        { success: false, error: 'Invalid profile visibility level' },
        { status: 400 }
      );
    }

    if (activity_visibility && !validVisibility.includes(activity_visibility)) {
      return NextResponse.json(
        { success: false, error: 'Invalid activity visibility level' },
        { status: 400 }
      );
    }

    if (email_visibility && !validEmailVisibility.includes(email_visibility)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email visibility level' },
        { status: 400 }
      );
    }

    const updateData = {
      ...(profile_visibility && { profile_visibility }),
      ...(activity_visibility && { activity_visibility }),
      ...(email_visibility && { email_visibility }),
      ...(typeof show_online_status === 'boolean' && { show_online_status }),
      ...(typeof show_last_active === 'boolean' && { show_last_active }),
      ...(typeof allow_messages === 'boolean' && { allow_messages }),
      ...(typeof show_reputation_details === 'boolean' && { show_reputation_details }),
      ...(typeof show_forum_activity === 'boolean' && { show_forum_activity }),
      ...(typeof show_wiki_activity === 'boolean' && { show_wiki_activity }),
      ...(typeof show_messaging_activity === 'boolean' && { show_messaging_activity }),
    };

    const success = await profileService.updatePrivacySettings(
      userId,
      updateData as Partial<UserPrivacySettings>
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update privacy settings' },
        { status: 500 }
      );
    }

    const updatedSettings = await profileService.getUserPrivacySettings(userId as UserId);

    return NextResponse.json({
      success: true,
      data: updatedSettings,
    });
  } catch (error) {
    logger.error('Error updating privacy settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update privacy settings' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, {});

export const PUT = withSecurity(putHandler, {
  enableCSRF: true,
});
