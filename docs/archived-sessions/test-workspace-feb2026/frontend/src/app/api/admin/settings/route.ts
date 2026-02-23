/**
 * Admin Site Settings API
 *
 * GET /api/admin/settings - Get all site settings
 * PUT /api/admin/settings - Update site settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { settingsService, SiteSettings } from '@/lib/settings/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  PermissionError,
} from '@/lib/utils/api-errors';

/**
 * GET /api/admin/settings
 * Get all site settings (admin only)
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    // Force refresh to get latest settings
    const settings = await settingsService.getSettings(true);

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * PUT /api/admin/settings
 * Update site settings (admin only)
 */
export const PUT = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const body = await request.json();
    logger.info('[Admin Settings API] Received update request from user:', user.id, 'body:', body);

    // Validate and sanitize each setting
    const updates: Partial<SiteSettings> = {};

    if (body.siteName !== undefined) {
      if (typeof body.siteName !== 'string' || body.siteName.trim().length === 0) {
        throw new ValidationError('Site name must be a non-empty string');
      }
      updates.siteName = body.siteName.trim();
    }

    if (body.siteDescription !== undefined) {
      if (typeof body.siteDescription !== 'string') {
        throw new ValidationError('Site description must be a string');
      }
      updates.siteDescription = body.siteDescription.trim();
    }

    if (body.maintenanceMode !== undefined) {
      logger.info(
        '[Admin Settings API] maintenanceMode update:',
        body.maintenanceMode,
        'type:',
        typeof body.maintenanceMode
      );
      if (typeof body.maintenanceMode !== 'boolean') {
        throw new ValidationError('Maintenance mode must be a boolean');
      }
      updates.maintenanceMode = body.maintenanceMode;
      logger.info(
        '[Admin Settings API] maintenanceMode added to updates:',
        updates.maintenanceMode
      );
    }

    if (body.maintenanceMessage !== undefined) {
      if (typeof body.maintenanceMessage !== 'string') {
        throw new ValidationError('Maintenance message must be a string');
      }
      updates.maintenanceMessage = body.maintenanceMessage.trim();
    }

    if (body.registrationEnabled !== undefined) {
      if (typeof body.registrationEnabled !== 'boolean') {
        throw new ValidationError('Registration enabled must be a boolean');
      }
      updates.registrationEnabled = body.registrationEnabled;
    }

    if (body.emailVerification !== undefined) {
      if (typeof body.emailVerification !== 'boolean') {
        throw new ValidationError('Email verification must be a boolean');
      }
      updates.emailVerification = body.emailVerification;
    }

    if (body.wikiEnabled !== undefined) {
      if (typeof body.wikiEnabled !== 'boolean') {
        throw new ValidationError('Wiki enabled must be a boolean');
      }
      updates.wikiEnabled = body.wikiEnabled;
    }

    if (body.maxUploadSize !== undefined) {
      if (typeof body.maxUploadSize !== 'number' || body.maxUploadSize < 1) {
        throw new ValidationError('Max upload size must be a positive number (in MB)');
      }
      updates.maxUploadSize = body.maxUploadSize;
    }

    if (body.allowedFileTypes !== undefined) {
      if (typeof body.allowedFileTypes !== 'string') {
        throw new ValidationError('Allowed file types must be a comma-separated string');
      }
      updates.allowedFileTypes = body.allowedFileTypes.trim();
    }

    // Rate limiter toggles
    const rateLimiterKeys = [
      'rateLimitTopicCreateEnabled',
      'rateLimitReplyCreateEnabled',
      'rateLimitSearchEnabled',
      'rateLimitAuthEnabled',
      'rateLimitFileUploadEnabled',
      'rateLimitMessageSendEnabled',
      'rateLimitWikiCreateEnabled',
    ] as const;

    for (const key of rateLimiterKeys) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') {
          throw new ValidationError(`${key} must be a boolean`);
        }
        updates[key] = body[key];
      }
    }

    // Check if there are any updates to make
    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid settings provided to update');
    }

    logger.info('[Admin Settings API] Applying updates:', updates);

    // Update settings
    await settingsService.updateSettings(updates, user.id);
    logger.info('[Admin Settings API] Database updated successfully');

    // Get updated settings
    const settings = await settingsService.getSettings(true);
    logger.info('[Admin Settings API] Refreshed settings from DB:', settings);

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    logger.error('[Admin Settings API] Error:', error);
    return errorResponse(error);
  }
});
