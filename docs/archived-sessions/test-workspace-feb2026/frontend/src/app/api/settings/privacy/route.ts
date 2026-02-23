import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ProfileService } from '@/lib/profiles/service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';
import type { UserId } from '@/types/profile-aggregation';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const profileService = new ProfileService();

// GET - Retrieve current privacy settings
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const privacySettings = await profileService.getUserPrivacySettings(
      authResult.user.id as UserId
    );

    return NextResponse.json({
      success: true,
      data: privacySettings,
    });
  } catch (error) {
    logger.error('Error retrieving privacy settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve privacy settings' },
      { status: 500 }
    );
  }
}

// PUT - Update privacy settings
export const PUT = withSecurity(
  async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    try {
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
      } = body;

      // Validate visibility options
      const validVisibilityOptions = ['public', 'members', 'private'];
      const validEmailVisibilityOptions = ['public', 'members', 'admin', 'private'];

      if (profile_visibility && !validVisibilityOptions.includes(profile_visibility)) {
        return NextResponse.json(
          { success: false, error: 'Invalid profile visibility option' },
          { status: 400 }
        );
      }

      if (activity_visibility && !validVisibilityOptions.includes(activity_visibility)) {
        return NextResponse.json(
          { success: false, error: 'Invalid activity visibility option' },
          { status: 400 }
        );
      }

      if (email_visibility && !validEmailVisibilityOptions.includes(email_visibility)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email visibility option' },
          { status: 400 }
        );
      }

      // Build update data object
      const updateData: any = {};

      if (profile_visibility !== undefined) updateData.profile_visibility = profile_visibility;
      if (activity_visibility !== undefined) updateData.activity_visibility = activity_visibility;
      if (email_visibility !== undefined) updateData.email_visibility = email_visibility;
      if (show_online_status !== undefined) updateData.show_online_status = show_online_status;
      if (show_last_active !== undefined) updateData.show_last_active = show_last_active;
      if (allow_messages !== undefined) updateData.allow_messages = allow_messages;
      if (show_reputation_details !== undefined)
        updateData.show_reputation_details = show_reputation_details;
      if (show_forum_activity !== undefined) updateData.show_forum_activity = show_forum_activity;
      if (show_wiki_activity !== undefined) updateData.show_wiki_activity = show_wiki_activity;

      // Update privacy settings
      const success = await profileService.updatePrivacySettings(authResult.user.id, updateData);

      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Failed to update privacy settings' },
          { status: 500 }
        );
      }

      // Return updated privacy settings
      const updatedSettings = await profileService.getUserPrivacySettings(
        authResult.user.id as UserId
      );

      return NextResponse.json({
        success: true,
        message: 'Privacy settings updated successfully',
        data: updatedSettings,
      });
    } catch (error) {
      logger.error('Error updating privacy settings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update privacy settings' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
