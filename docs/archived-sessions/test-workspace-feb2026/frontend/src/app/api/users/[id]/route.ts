import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { getUsersService } from '@/lib/services/registry';
import { logger } from '@/lib/utils/logger';

/**
 * User profile response interface with optional sensitive fields
 */
interface UserProfileResponse {
  id: number;
  username: string;
  display_name: string | null;
  bio?: string | null;
  location?: string | null;
  website_url?: string | null;
  avatar_url: string | null;
  avatar_position_x?: number | null;
  avatar_position_y?: number | null;
  avatar_scale?: number | null;
  created_at?: string;
  role?: string;
  last_active?: string;
  reputation_score?: number;
  post_count?: number;
  forum_topic_count?: number;
  forum_reply_count?: number;
  wiki_page_count?: number;
  wiki_edit_count?: number;
  total_activity_count?: number;
  recent_activity?: unknown[];
  // Sensitive fields (only for owner or admin)
  email?: string | null;
  github_url?: string | null;
  mastodon_url?: string | null;
  linkedin_url?: string | null;
  discord_username?: string | null;
  steam_url?: string | null;
  xbox_gamertag?: string | null;
  psn_id?: string | null;
  bluesky_url?: string | null;
}

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function getUserHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const userService = getUsersService();
    const userProfile = await userService.getUserProfile(userId);

    if (!userProfile) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Check if the request is authenticated
    const currentUser = await getCurrentUser(request);

    // For unauthenticated users, return only basic public info
    if (!currentUser) {
      const basicProfile = {
        id: userProfile.id,
        username: userProfile.username,
        display_name: userProfile.display_name,
        avatar_url: userProfile.avatar_url,
        avatar_position_x: userProfile.avatar_position_x,
        avatar_position_y: userProfile.avatar_position_y,
        avatar_scale: userProfile.avatar_scale,
      };

      return NextResponse.json({
        success: true,
        data: basicProfile,
      });
    }

    // For authenticated users, filter sensitive data based on permissions
    const isOwnerOrAdmin = currentUser.id === userId || currentUser.role === 'admin';

    const publicProfile: UserProfileResponse = {
      id: userProfile.id,
      username: userProfile.username,
      display_name: userProfile.display_name ?? null,
      bio: userProfile.bio ?? null,
      location: userProfile.location ?? null,
      website_url: userProfile.website_url ?? null,
      avatar_url: userProfile.avatar_url ?? null,
      avatar_position_x: userProfile.avatar_position_x ?? null,
      avatar_position_y: userProfile.avatar_position_y ?? null,
      avatar_scale: userProfile.avatar_scale ?? null,
      created_at: userProfile.created_at,
      role: userProfile.role,
      last_active: userProfile.last_active,
      reputation_score: userProfile.forum_reputation || 0,
      // Forum activity stats
      post_count: (userProfile.forum_topic_count || 0) + (userProfile.forum_reply_count || 0),
      forum_topic_count: userProfile.forum_topic_count || 0,
      forum_reply_count: userProfile.forum_reply_count || 0,
      // Wiki activity stats
      wiki_page_count: userProfile.wiki_page_count || 0,
      wiki_edit_count: userProfile.wiki_edit_count || 0,
      // Total activity
      total_activity_count: userProfile.total_activity_count || 0,
      // Recent activity (last 3 items for hover card)
      recent_activity: userProfile.recent_activity?.slice(0, 3) || [],
    };

    // Add sensitive data only for owner or admin
    if (isOwnerOrAdmin) {
      publicProfile.email = userProfile.email ?? null;
      publicProfile.github_url = userProfile.github_url ?? null;
      publicProfile.mastodon_url = userProfile.mastodon_url ?? null;
      publicProfile.linkedin_url = userProfile.linkedin_url ?? null;
      publicProfile.discord_username = userProfile.discord_username ?? null;
      publicProfile.steam_url = userProfile.steam_url ?? null;
      publicProfile.xbox_gamertag = userProfile.xbox_gamertag ?? null;
      publicProfile.psn_id = userProfile.psn_id ?? null;
      publicProfile.bluesky_url = userProfile.bluesky_url ?? null;
    }

    return NextResponse.json({
      success: true,
      data: publicProfile,
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}

async function updateUserHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // Debug: Log cookies and headers
    const USE_SECURE_PREFIX =
      process.env.COOKIE_USE_SECURE_PREFIX !== undefined
        ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
        : false;

    const SESSION_COOKIE_NAME = USE_SECURE_PREFIX ? '__Secure-session_id' : 'session_id';
    logger.info('=== API DEBUG ===');
    logger.info('Cookies:', request.cookies.getAll());
    logger.info('Session cookie:', request.cookies.get(SESSION_COOKIE_NAME));
    logger.info('User-Agent:', request.headers.get('user-agent'));
    logger.info('Content-Type:', request.headers.get('content-type'));

    const currentUser = await getCurrentUser(request);
    logger.info('getCurrentUser result:', currentUser);

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          debug: {
            hasCookies: request.cookies.getAll().length > 0,
            sessionCookie: request.cookies.get(SESSION_COOKIE_NAME)?.value?.substring(0, 8) + '...',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Users can only edit their own profile (unless admin)
    if (currentUser.id !== userId && currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to edit this profile' },
        { status: 403 }
      );
    }

    const updateData = await request.json();

    // Validate email if provided
    if (updateData.email && !updateData.email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    // Validate avatar URL (internal paths or absolute URLs)
    if (updateData.avatar_url && updateData.avatar_url.trim()) {
      const avatarUrl = updateData.avatar_url.trim();
      // Accept relative paths starting with / or absolute URLs
      if (!avatarUrl.startsWith('/') && !avatarUrl.startsWith('http')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Avatar URL must be a relative path starting with / or absolute URL',
          },
          { status: 400 }
        );
      }
      // If it's an absolute URL, validate it properly
      if (avatarUrl.startsWith('http')) {
        try {
          new URL(avatarUrl);
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid avatar URL format' },
            { status: 400 }
          );
        }
      }
    }

    // Validate external social URLs (must be absolute URLs)
    const externalUrlFields = [
      'website_url',
      'github_url',
      'mastodon_url',
      'linkedin_url',
      'bluesky_url',
      'steam_url',
    ];
    for (const field of externalUrlFields) {
      if (updateData[field] && updateData[field].trim()) {
        try {
          new URL(updateData[field]); // Requires absolute URL
        } catch {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid ${field.replace('_', ' ')} - must be absolute URL (e.g., https://example.com)`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Clean up empty strings to null
    Object.keys(updateData).forEach(key => {
      if (typeof updateData[key] === 'string' && updateData[key].trim() === '') {
        updateData[key] = null;
      }
    });

    const userService = getUsersService();
    const updatedUser = await userService.updateUser(userId, updateData, currentUser.id);

    return NextResponse.json({
      success: true,
      data: { user: updatedUser },
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    logger.error('Update user error:', error);

    let errorMessage = 'Failed to update profile';
    let statusCode = 500;

    if (error.message.includes('already taken') || error.message.includes('already exists')) {
      errorMessage = error.message;
      statusCode = 409;
    } else if (error.message.includes('Invalid') || error.message.includes('required')) {
      errorMessage = error.message;
      statusCode = 400;
    }

    return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode });
  }
}

// Apply security middleware
export const GET = withSecurity(getUserHandler, {});

export const PUT = withSecurity(updateUserHandler, {}); // CSRF removed from application (Oct 2025)
