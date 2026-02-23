/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for enabling/disabling features
 * based on environment variables.
 */

/**
 * Check if a feature is enabled via environment variable
 *
 * @param flagName - Name of the environment variable (e.g., 'ENABLE_WORKSPACE')
 * @param defaultValue - Default value if environment variable is not set
 * @returns true if feature is enabled, false otherwise
 */
export function isFeatureEnabled(flagName: string, defaultValue: boolean = false): boolean {
  const value = process.env[flagName];

  if (value === undefined || value === '') {
    return defaultValue;
  }

  // Parse boolean strings
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Workspace feature flag
 */
export const isWorkspaceEnabled = (): boolean => {
  return isFeatureEnabled('ENABLE_WORKSPACE', true);
};

/**
 * Forums feature flag
 */
export const isForumsEnabled = (): boolean => {
  return isFeatureEnabled('ENABLE_FORUMS', true);
};

/**
 * Wiki feature flag
 */
export const isWikiEnabled = (): boolean => {
  return isFeatureEnabled('ENABLE_WIKI', true);
};

/**
 * Library feature flag
 */
export const isLibraryEnabled = (): boolean => {
  return isFeatureEnabled('ENABLE_LIBRARY', true);
};

/**
 * 3D Viewer feature flag
 */
export const is3DViewerEnabled = (): boolean => {
  return isFeatureEnabled('ENABLE_3D_VIEWER', true);
};

/**
 * Admin panel feature flag
 */
export const isAdminEnabled = (): boolean => {
  return isFeatureEnabled('ADMIN_ENABLED', false);
};

/**
 * Maintenance mode flag
 */
export const isMaintenanceMode = (): boolean => {
  return isFeatureEnabled('MAINTENANCE_MODE', false);
};

/**
 * Get all feature flags as an object
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  return {
    workspace: isWorkspaceEnabled(),
    forums: isForumsEnabled(),
    wiki: isWikiEnabled(),
    library: isLibraryEnabled(),
    '3d_viewer': is3DViewerEnabled(),
    admin: isAdminEnabled(),
    maintenance: isMaintenanceMode(),
  };
}
