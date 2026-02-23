import type { Env } from '../types';

/**
 * Check if X402 Payment Wall is enabled in database
 * Caches result for 60 seconds to reduce database load
 */

interface SettingsCache {
  enabled: boolean;
  timestamp: number;
}

let settingsCache: SettingsCache | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Check if the X402 payment wall is enabled
 *
 * @param env - Cloudflare Worker environment variables
 * @returns Promise<boolean> - true if payment wall is enabled, false otherwise
 */
export async function isPaymentWallEnabled(env: Env): Promise<boolean> {
  // Fallback to env var if no origin URL configured
  if (!env.ORIGIN_URL) {
    console.log('No ORIGIN_URL configured, falling back to BLOCK_MODE env var');
    return env.BLOCK_MODE !== 'false';
  }

  // Check cache
  const now = Date.now();
  if (settingsCache && (now - settingsCache.timestamp) < CACHE_TTL_MS) {
    return settingsCache.enabled;
  }

  try {
    // Query origin server for setting
    const response = await fetch(`${env.ORIGIN_URL}/api/settings/payment-wall`, {
      method: 'GET',
      headers: {
        'X-Internal-Request': 'true',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch payment wall setting:', response.status);
      // Fail open (allow requests) on error to prevent service disruption
      return false;
    }

    const data: any = await response.json();
    const enabled = data.success && data.data?.enabled === true;

    // Update cache
    settingsCache = { enabled, timestamp: now };

    if (env.DEBUG === 'true') {
      console.log(`Payment wall setting fetched from origin: ${enabled}`);
    }

    return enabled;
  } catch (error) {
    console.error('Error checking payment wall setting:', error);
    // Fail open (allow requests) on error to prevent service disruption
    return false;
  }
}
