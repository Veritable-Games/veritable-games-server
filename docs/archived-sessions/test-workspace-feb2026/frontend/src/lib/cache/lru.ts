/**
 * LRU Cache implementation wrapper
 * Simple wrapper around lru-cache for consistent interface
 */

import { LRUCache } from 'lru-cache';

export interface LRUOptions<K extends {}, V extends {}> {
  max: number;
  ttl?: number;
  updateAgeOnGet?: boolean;
  updateAgeOnHas?: boolean;
}

export class SimpleLRUCache<K extends {} = string, V extends {} = any> {
  private cache: LRUCache<K, V>;

  constructor(options: LRUOptions<K, V>) {
    this.cache = new LRUCache(options);
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  get max(): number {
    return this.cache.max;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  values(): IterableIterator<V> {
    return this.cache.values();
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }
}

// Export the underlying LRUCache class as well
export { LRUCache };
