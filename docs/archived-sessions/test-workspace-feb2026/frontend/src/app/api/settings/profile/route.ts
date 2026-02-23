import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { authService } from '@/lib/auth/service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET - Retrieve current user profile
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    // User data is already available from auth
    const user = authResult.user;

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Error retrieving profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve profile' },
      { status: 500 }
    );
  }
}

// PUT - Update user profile
export const PUT = withSecurity(
  async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    try {
      const body = await request.json();
      const {
        display_name,
        bio,
        avatar_url,
        avatar_position_x,
        avatar_position_y,
        avatar_scale,
        location,
        website_url,
        github_url,
        linkedin_url,
        discord_username,
        steam_url,
        xbox_gamertag,
        psn_id,
        bluesky_url,
        mastodon_url,
      } = body;

      // Validate input
      if (display_name && display_name.length > 50) {
        return NextResponse.json(
          { success: false, error: 'Display name must be 50 characters or less' },
          { status: 400 }
        );
      }

      if (bio && bio.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Bio must be 500 characters or less' },
          { status: 400 }
        );
      }

      // Build update data object
      const updateData: any = {};

      if (display_name !== undefined) updateData.display_name = display_name;
      if (bio !== undefined) updateData.bio = bio;
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      if (avatar_position_x !== undefined) updateData.avatar_position_x = avatar_position_x;
      if (avatar_position_y !== undefined) updateData.avatar_position_y = avatar_position_y;
      if (avatar_scale !== undefined) updateData.avatar_scale = avatar_scale;

      // Extended profile fields
      if (location !== undefined) updateData.location = location;
      if (website_url !== undefined) updateData.website_url = website_url;
      if (github_url !== undefined) updateData.github_url = github_url;
      if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url;
      if (discord_username !== undefined) updateData.discord_username = discord_username;
      if (steam_url !== undefined) updateData.steam_url = steam_url;
      if (xbox_gamertag !== undefined) updateData.xbox_gamertag = xbox_gamertag;
      if (psn_id !== undefined) updateData.psn_id = psn_id;
      if (bluesky_url !== undefined) updateData.bluesky_url = bluesky_url;
      if (mastodon_url !== undefined) updateData.mastodon_url = mastodon_url;

      // Update profile using AuthService
      const updatedUser = await authService.updateProfile(authResult.user.id, updateData);

      if (!updatedUser) {
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      logger.error('Error updating profile:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
