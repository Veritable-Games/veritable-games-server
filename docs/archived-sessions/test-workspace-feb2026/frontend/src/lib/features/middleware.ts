/**
 * Feature Flag Middleware
 *
 * Middleware wrappers that check if features are enabled before allowing access.
 * Returns 503 Service Unavailable if feature is disabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from './flags';

/**
 * Middleware wrapper that requires a feature to be enabled
 *
 * @param handler - The route handler to protect
 * @param featureName - Name of the environment variable (e.g., 'ENABLE_WORKSPACE')
 * @param featureLabel - Human-readable feature name for error messages
 * @returns Wrapped handler that checks feature flag
 *
 * @example
 * export const GET = requireFeature(
 *   async (request) => { ... },
 *   'ENABLE_WORKSPACE',
 *   'Workspace'
 * );
 */
export function requireFeature<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  featureName: string,
  featureLabel: string
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    if (!isFeatureEnabled(featureName, false)) {
      return NextResponse.json(
        {
          error: `${featureLabel} feature is currently disabled`,
          code: 'FEATURE_DISABLED',
          feature: featureLabel.toLowerCase(),
        },
        { status: 503 } // Service Unavailable
      );
    }

    return handler(request, ...args);
  };
}

/**
 * Workspace feature requirement wrapper
 *
 * @example
 * export const GET = requireWorkspace(async (request) => {
 *   // Handler code
 * });
 */
export function requireWorkspace<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return requireFeature(handler, 'ENABLE_WORKSPACE', 'Workspace');
}

/**
 * Forums feature requirement wrapper
 */
export function requireForums<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return requireFeature(handler, 'ENABLE_FORUMS', 'Forums');
}

/**
 * Wiki feature requirement wrapper
 */
export function requireWiki<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return requireFeature(handler, 'ENABLE_WIKI', 'Wiki');
}

/**
 * Library feature requirement wrapper
 */
export function requireLibrary<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return requireFeature(handler, 'ENABLE_LIBRARY', 'Library');
}

/**
 * Admin feature requirement wrapper
 */
export function requireAdmin<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return requireFeature(handler, 'ADMIN_ENABLED', 'Admin');
}
