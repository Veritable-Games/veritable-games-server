/**
 * Admin Cache Invalidation API
 *
 * POST /api/admin/settings/invalidate-cache
 * Forces all settings-related caches to refresh immediately
 *
 * This endpoint is called after admin saves settings to ensure
 * changes propagate instantly instead of waiting for cache expiration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { settingsService } from '@/lib/settings/service';
import { errorResponse, AuthenticationError, PermissionError } from '@/lib/utils/api-errors';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/settings/invalidate-cache
 * Force clear all settings caches (admin only)
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    // Clear the settings service cache
    settingsService.clearCache();

    // Note: The middleware cache (5 seconds) will expire naturally
    // but clearing the service cache ensures the API returns fresh data

    return NextResponse.json({
      success: true,
      message: 'Settings cache invalidated. Changes will propagate within 5 seconds.',
    });
  } catch (error) {
    return errorResponse(error);
  }
});
