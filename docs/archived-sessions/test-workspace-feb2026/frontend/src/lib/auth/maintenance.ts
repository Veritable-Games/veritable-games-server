/**
 * Maintenance Mode Helper for Server Components
 *
 * Provides a function to check if maintenance mode is enabled,
 * allowing pages to conditionally enforce authentication.
 */

import { settingsService } from '@/lib/settings/service';
import { logger } from '@/lib/utils/logger';

/**
 * Check if maintenance mode (site lockdown) is currently enabled
 *
 * @returns Promise<boolean> - true if maintenance mode is ON (require auth), false if OFF (public access)
 */
export async function isMaintenanceModeEnabled(): Promise<boolean> {
  try {
    // Check environment override (can only force lockdown ON)
    if (process.env.LOCKDOWN_EMERGENCY_OVERRIDE === 'true') {
      return true;
    }
    if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
      return true;
    }

    // Get maintenance mode from database
    const maintenanceMode = await settingsService.getSetting('maintenanceMode');
    return maintenanceMode === true;
  } catch (error) {
    logger.error('[Maintenance Check] Error checking maintenance mode:', error);
    // Fail secure - if we can't check, assume maintenance mode is ON
    return true;
  }
}

/**
 * Check if a user should be required to authenticate
 *
 * @param requireAuth - If true, always require auth regardless of maintenance mode (for admin-only pages)
 * @returns Promise<boolean> - true if authentication is required, false if public access allowed
 */
export async function shouldRequireAuth(requireAuth: boolean = false): Promise<boolean> {
  // If page explicitly requires auth (e.g., admin pages), always require it
  if (requireAuth) {
    return true;
  }

  // Otherwise, base it on maintenance mode
  return await isMaintenanceModeEnabled();
}
