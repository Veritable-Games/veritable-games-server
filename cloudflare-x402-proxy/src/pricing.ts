/**
 * Endpoint Pricing Configuration
 * Defines per-endpoint pricing for x402 bot monetization
 */

import type { EndpointPricing } from './types.ts';

/**
 * Pricing configuration for Veritable Games API endpoints
 * Ordered by specificity (most specific patterns first)
 */
const PRICING_CONFIG: EndpointPricing[] = [
  // ==========================================================================
  // HIGH-VALUE BULK ENDPOINTS
  // ==========================================================================

  // Full anarchist library dump (24,643 documents)
  {
    pattern: /^\/api\/documents\/unified.*[?&]all=true/,
    priceUSD: 0.1,
    description: 'Full anarchist document catalog (24,643 docs)',
    rateLimit: 10, // 10 requests per hour
  },

  // ==========================================================================
  // SEARCH ENDPOINTS (Compute-intensive FTS queries)
  // ==========================================================================

  {
    pattern: /^\/api\/forums\/search/,
    priceUSD: 0.005,
    description: 'Forum full-text search',
    rateLimit: 100,
  },
  {
    pattern: /^\/api\/wiki\/search/,
    priceUSD: 0.005,
    description: 'Wiki full-text search',
    rateLimit: 100,
  },
  {
    pattern: /^\/api\/documents\/unified.*[?&]query=/,
    priceUSD: 0.005,
    description: 'Document search query',
    rateLimit: 100,
  },

  // ==========================================================================
  // DOCUMENT/LIBRARY ACCESS
  // ==========================================================================

  // Individual anarchist document
  {
    pattern: /^\/api\/documents\/anarchist\/[^/]+$/,
    priceUSD: 0.001,
    description: 'Individual anarchist document',
    rateLimit: 1000,
  },

  // Paginated document listings
  {
    pattern: /^\/api\/documents\/unified/,
    priceUSD: 0.002,
    description: 'Paginated document listing',
    rateLimit: 500,
  },

  // User library access
  {
    pattern: /^\/api\/library\/documents/,
    priceUSD: 0.002,
    description: 'User library documents',
    rateLimit: 500,
  },

  // Document languages and metadata
  {
    pattern: /^\/api\/documents\/languages/,
    priceUSD: 0.001,
    description: 'Document language list',
    rateLimit: 100,
  },
  {
    pattern: /^\/api\/documents\/count/,
    priceUSD: 0.001,
    description: 'Document count',
    rateLimit: 100,
  },

  // ==========================================================================
  // FORUM ACCESS
  // ==========================================================================

  {
    pattern: /^\/api\/forums\/topics\/\d+$/,
    priceUSD: 0.001,
    description: 'Individual forum topic',
    rateLimit: 500,
  },
  {
    pattern: /^\/api\/forums\/topics/,
    priceUSD: 0.002,
    description: 'Forum topic listing',
    rateLimit: 200,
  },
  {
    pattern: /^\/api\/forums\/categories/,
    priceUSD: 0.001,
    description: 'Forum categories',
    rateLimit: 100,
  },
  {
    pattern: /^\/api\/forums\/stats/,
    priceUSD: 0.001,
    description: 'Forum statistics',
    rateLimit: 60,
  },

  // ==========================================================================
  // WIKI ACCESS
  // ==========================================================================

  {
    pattern: /^\/api\/wiki\/pages\/[^/]+$/,
    priceUSD: 0.001,
    description: 'Individual wiki page',
    rateLimit: 500,
  },
  {
    pattern: /^\/api\/wiki\/pages/,
    priceUSD: 0.002,
    description: 'Wiki page listing',
    rateLimit: 200,
  },
  {
    pattern: /^\/api\/wiki\/categories/,
    priceUSD: 0.001,
    description: 'Wiki categories',
    rateLimit: 100,
  },

  // ==========================================================================
  // USER DATA
  // ==========================================================================

  {
    pattern: /^\/api\/users\/[^/]+\/export/,
    priceUSD: 0.01,
    description: 'User data export',
    rateLimit: 10,
  },
  {
    pattern: /^\/api\/users\/[^/]+$/,
    priceUSD: 0.001,
    description: 'Public user profile',
    rateLimit: 200,
  },

  // ==========================================================================
  // PROJECT/GALLERY ACCESS
  // ==========================================================================

  {
    pattern: /^\/api\/projects\/[^/]+\/galleries/,
    priceUSD: 0.002,
    description: 'Project gallery',
    rateLimit: 200,
  },
  {
    pattern: /^\/api\/projects\/[^/]+$/,
    priceUSD: 0.001,
    description: 'Project details',
    rateLimit: 200,
  },

  // ==========================================================================
  // FREE ENDPOINTS (Infrastructure & Auth & Internal)
  // ==========================================================================

  {
    pattern: /^\/api\/health/,
    priceUSD: 0,
    description: 'Health check (free)',
    rateLimit: 60,
  },
  {
    pattern: /^\/api\/auth\//,
    priceUSD: 0,
    description: 'Authentication (free)',
    rateLimit: 30,
  },
  {
    pattern: /^\/api\/settings\/maintenance/,
    priceUSD: 0,
    description: 'Maintenance status (free)',
    rateLimit: 60,
  },
  // Library page internal endpoints (client-side fetches from same origin)
  {
    pattern: /^\/api\/documents(\?|$)/,
    priceUSD: 0,
    description: 'Library documents listing (free for web UI)',
    rateLimit: 100,
  },
  {
    pattern: /^\/api\/library\/tags/,
    priceUSD: 0,
    description: 'Library tags (free for web UI)',
    rateLimit: 100,
  },
  // User journals (private user content, free for web UI)
  {
    pattern: /^\/api\/journals\//,
    priceUSD: 0,
    description: 'User journals (free for web UI)',
    rateLimit: 200,
  },

  // ==========================================================================
  // DEFAULT (All other API endpoints)
  // ==========================================================================

  {
    pattern: /^\/api\//,
    priceUSD: 0.001,
    description: 'Standard API access',
    rateLimit: 500,
  },
];

/**
 * Get the price for a given endpoint
 * @param pathname - The URL pathname (e.g., '/api/documents/unified')
 * @param queryString - Optional query string for more specific matching
 * @returns Price in USD
 */
export function getEndpointPrice(pathname: string, queryString?: string): number {
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

  for (const config of PRICING_CONFIG) {
    if (config.pattern.test(fullPath)) {
      return config.priceUSD;
    }
  }

  // Default price if no pattern matches
  return 0.001;
}

/**
 * Get the pricing configuration for a given endpoint
 */
export function getEndpointPricing(
  pathname: string,
  queryString?: string
): EndpointPricing | undefined {
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

  for (const config of PRICING_CONFIG) {
    if (config.pattern.test(fullPath)) {
      return config;
    }
  }

  return undefined;
}

/**
 * Check if an endpoint is free (price = 0)
 */
export function isEndpointFree(pathname: string): boolean {
  return getEndpointPrice(pathname) === 0;
}

/**
 * Get the rate limit for an endpoint (requests per hour)
 */
export function getEndpointRateLimit(pathname: string): number {
  const config = getEndpointPricing(pathname);
  return config?.rateLimit ?? 500;
}

/**
 * Convert USD to USDC micro-units (6 decimals)
 * @param usd - Price in USD (e.g., 0.001)
 * @returns Amount in USDC base units (e.g., 1000 for $0.001)
 */
export function usdToUSDCUnits(usd: number): string {
  // USDC has 6 decimal places
  const units = Math.ceil(usd * 1_000_000);
  return units.toString();
}

/**
 * Format price for display
 */
export function formatPrice(usd: number): string {
  if (usd === 0) return 'Free';
  if (usd < 0.01) return `$${(usd * 1000).toFixed(1)} per 1000 requests`;
  return `$${usd.toFixed(3)}`;
}
