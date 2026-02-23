/**
 * Custom Next.js Cache Handler
 *
 * Improves build performance by using our unified cache system
 * for Next.js incremental static regeneration and build caching.
 */

const { cache } = require('./unified-cache');

class CustomCacheHandler {
  constructor(options) {
    this.options = options;
    this.debug = process.env.NODE_ENV === 'development';
  }

  async get(key) {
    try {
      const result = await cache.get(key, 'static');
      if (this.debug && result) {
        logger.info(`Cache HIT: ${key}`);
      }
      return result;
    } catch (error) {
      if (this.debug) {
        logger.warn(`Cache GET error for key ${key}:`, error);
      }
      return null;
    }
  }

  async set(key, data, context) {
    try {
      // Use appropriate cache policy based on context
      let policy = 'static';

      if (context?.revalidate && context.revalidate < 3600) {
        policy = 'api'; // Shorter TTL for frequently changing content
      }

      const success = await cache.set(key, data, policy);

      if (this.debug && success) {
        logger.info(`Cache SET: ${key}`);
      }

      return success;
    } catch (error) {
      if (this.debug) {
        logger.warn(`Cache SET error for key ${key}:`, error);
      }
      return false;
    }
  }

  async delete(key) {
    try {
      const success = await cache.delete(key);
      if (this.debug && success) {
        logger.info(`Cache DELETE: ${key}`);
      }
      return success;
    } catch (error) {
      if (this.debug) {
        logger.warn(`Cache DELETE error for key ${key}:`, error);
      }
      return false;
    }
  }
}

module.exports = CustomCacheHandler;
