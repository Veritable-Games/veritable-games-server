/**
 * Public Maintenance Status API
 *
 * GET /api/settings/maintenance - Get maintenance mode status (public)
 *
 * This endpoint is public to allow middleware and the maintenance page
 * to check maintenance status without authentication.
 *
 * Returns:
 * - enabled: Effective lockdown state (env override OR database value)
 * - message: Maintenance message from database
 * - envOverrideActive: Whether an env var is forcing lockdown ON
 * - databaseValue: The actual database setting (for admin UI)
 *
 * IMPORTANT: No caching here - the settings service handles caching
 * and is properly invalidated when admin saves settings.
 */

import { NextResponse } from 'next/server';
import { settingsService } from '@/lib/settings/service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/maintenance
 * Get maintenance mode status (public endpoint)
 */
export async function GET() {
  try {
    // Check if environment override is forcing lockdown ON
    const envOverrideActive =
      process.env.LOCKDOWN_EMERGENCY_OVERRIDE === 'true' ||
      process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

    // Get settings from database (service handles caching)
    const settings = await settingsService.getSettings();

    // Effective state: env override OR database setting
    const effectiveEnabled = envOverrideActive || settings.maintenanceMode;

    const response = NextResponse.json({
      success: true,
      data: {
        enabled: effectiveEnabled,
        message: settings.maintenanceMessage,
        envOverrideActive,
        databaseValue: settings.maintenanceMode,
      },
    });

    // Prevent any caching - this data must always be fresh
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    logger.error('Failed to get maintenance status:', error);

    // Fail secure - return locked state (consistent with middleware)
    const errorResponse = NextResponse.json({
      success: true,
      data: {
        enabled: true,
        message: '',
        envOverrideActive: false,
        databaseValue: true,
      },
    });

    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return errorResponse;
  }
}
