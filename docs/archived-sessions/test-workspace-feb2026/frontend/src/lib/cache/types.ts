export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize?: number; // Maximum cache size
  staleWhileRevalidate?: boolean; // Allow stale data while updating
  tags?: string[]; // Cache invalidation tags
}

export interface CacheOptions extends CacheConfig {
  key: string;
  namespace?: string;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
  version: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memory?: number;
}

export type CacheLevel = 'memory' | 'redis' | 'hybrid';

export interface CacheStrategy {
  level: CacheLevel;
  config: CacheConfig;
}

// Predefined cache configurations for different data types
export const CACHE_CONFIGS = {
  // Short-term data (user sessions)
  session: {
    ttl: 300, // 5 minutes
    maxSize: 1000,
    staleWhileRevalidate: false,
  },

  // API responses (forum topics, wiki pages)
  api: {
    ttl: 900, // 15 minutes
    maxSize: 5000,
    staleWhileRevalidate: true,
    tags: ['api'],
  },

  // Database query results
  query: {
    ttl: 600, // 10 minutes
    maxSize: 2000,
    staleWhileRevalidate: true,
    tags: ['database'],
  },

  // Static content (processed markdown, search indexes)
  content: {
    ttl: 3600, // 1 hour
    maxSize: 1000,
    staleWhileRevalidate: true,
    tags: ['content'],
  },

  // User-specific data (preferences, dashboard data)
  user: {
    ttl: 1800, // 30 minutes
    maxSize: 10000,
    staleWhileRevalidate: true,
    tags: ['user'],
  },

  // System configuration and metadata
  system: {
    ttl: 7200, // 2 hours
    maxSize: 500,
    staleWhileRevalidate: false,
    tags: ['system'],
  },
} as const;

export type CacheConfigKey = keyof typeof CACHE_CONFIGS;
