/**
 * IP Geolocation Service
 *
 * Uses ip-api.com for free geolocation lookups.
 * Rate limit: 45 requests/minute (free tier)
 *
 * Includes caching to reduce API calls and improve performance.
 */

import { logger } from '@/lib/utils/logger';

export interface GeoLocation {
  city: string;
  region: string;
  country: string;
  countryCode: string;
}

// In-memory cache for IP lookups (24 hour TTL)
const locationCache = new Map<string, { location: GeoLocation; expiry: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 10000;

/**
 * Check if an IP address is private/local
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.|169\.254\.)/.test(ip)) {
    return true;
  }

  // IPv6 private/local
  if (
    /^(::1|fe80:|fc00:|fd00:|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/.test(ip.toLowerCase())
  ) {
    return true;
  }

  // Localhost
  if (ip === 'localhost' || ip === '::1' || ip === '127.0.0.1') {
    return true;
  }

  return false;
}

/**
 * Get location from an IP address
 *
 * @param ip - The IP address to look up
 * @returns GeoLocation object or null if lookup fails
 */
export async function getLocationFromIP(ip: string): Promise<GeoLocation | null> {
  // Handle private/local IPs
  if (isPrivateIP(ip)) {
    return {
      city: 'Local Network',
      region: '',
      country: 'Local',
      countryCode: 'LAN',
    };
  }

  // Check cache first
  const cached = locationCache.get(ip);
  if (cached && cached.expiry > Date.now()) {
    return cached.location;
  }

  try {
    // Use ip-api.com (free, no API key required)
    // http (not https) is required for free tier
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,city,regionName,country,countryCode`,
      {
        // Short timeout to prevent blocking
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      logger.warn(`Geolocation API returned status ${response.status} for IP ${ip}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'fail') {
      logger.warn(`Geolocation lookup failed for IP ${ip}: ${data.message}`);
      return null;
    }

    const location: GeoLocation = {
      city: data.city || 'Unknown',
      region: data.regionName || '',
      country: data.country || 'Unknown',
      countryCode: data.countryCode || '',
    };

    // Cache the result
    cacheLocation(ip, location);

    return location;
  } catch (error) {
    // Don't log timeout errors as warnings (common for slow connections)
    if (error instanceof Error && error.name === 'TimeoutError') {
      logger.debug(`Geolocation timeout for IP ${ip}`);
    } else {
      logger.warn(`Geolocation error for IP ${ip}:`, error);
    }
    return null;
  }
}

/**
 * Cache a location lookup result
 */
function cacheLocation(ip: string, location: GeoLocation): void {
  // Evict old entries if cache is full
  if (locationCache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    let evicted = 0;

    for (const [key, value] of locationCache.entries()) {
      if (value.expiry < now || evicted < 100) {
        locationCache.delete(key);
        evicted++;
      }
      if (evicted >= 100) break;
    }
  }

  locationCache.set(ip, {
    location,
    expiry: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Format location for display in UI
 * Example: "San Francisco, US" or "Local Network"
 */
export function formatLocation(location: GeoLocation | null): string {
  if (!location) {
    return 'Unknown Location';
  }

  if (location.countryCode === 'LAN') {
    return 'Local Network';
  }

  if (location.city && location.city !== 'Unknown') {
    if (location.countryCode) {
      return `${location.city}, ${location.countryCode}`;
    }
    return location.city;
  }

  if (location.country && location.country !== 'Unknown') {
    return location.country;
  }

  return 'Unknown Location';
}

/**
 * Get full location string
 * Example: "San Francisco, California, United States"
 */
export function formatLocationFull(location: GeoLocation | null): string {
  if (!location) {
    return 'Unknown Location';
  }

  if (location.countryCode === 'LAN') {
    return 'Local Network';
  }

  const parts: string[] = [];

  if (location.city && location.city !== 'Unknown') {
    parts.push(location.city);
  }

  if (location.region) {
    parts.push(location.region);
  }

  if (location.country && location.country !== 'Unknown') {
    parts.push(location.country);
  }

  if (parts.length === 0) {
    return 'Unknown Location';
  }

  return parts.join(', ');
}

/**
 * Clear the location cache (useful for testing)
 */
export function clearLocationCache(): void {
  locationCache.clear();
}

/**
 * Get cache stats (for monitoring)
 */
export function getLocationCacheStats(): { size: number; maxSize: number } {
  return {
    size: locationCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
