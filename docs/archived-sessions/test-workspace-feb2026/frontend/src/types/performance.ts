/**
 * Performance Type Optimizations
 *
 * TypeScript utilities for performance optimization, lazy loading,
 * and efficient type computation patterns.
 */

import React from 'react';

// Lazy type evaluation utilities
export type LazyEval<T> = () => T;

export type Lazy<T> = {
  readonly __lazy: true;
  readonly value: LazyEval<T>;
};

export const lazy = <T>(computation: LazyEval<T>): Lazy<T> => ({
  __lazy: true,
  value: computation,
});

export const force = <T>(lazy: Lazy<T>): T => lazy.value();

// Memoized type computations
export type MemoizedComputation<Args extends readonly unknown[], Result> = {
  (...args: Args): Result;
  cache: Map<string, Result>;
  clear: () => void;
};

export const memoize = <Args extends readonly unknown[], Result>(
  fn: (...args: Args) => Result,
  keyFn?: (...args: Args) => string
): MemoizedComputation<Args, Result> => {
  const cache = new Map<string, Result>();
  const defaultKeyFn = (...args: Args) => JSON.stringify(args);
  const getKey = keyFn || defaultKeyFn;

  const memoized = (...args: Args): Result => {
    const key = getKey(...args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  memoized.cache = cache;
  memoized.clear = () => cache.clear();

  return memoized;
};

// Type-level performance optimizations
export type OptimizedUnion<T> = T extends infer U ? U : never;

export type DistributiveOmit<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

export type DistributivePick<T, K extends keyof T> = T extends any ? Pick<T, K> : never;

// Efficient array operations
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]]
  ? H
  : never;

export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Tail]
  ? Tail
  : never;

export type Length<T extends readonly unknown[]> = T['length'];

export type IsEmpty<T extends readonly unknown[]> = Length<T> extends 0 ? true : false;

export type Reverse<T extends readonly unknown[]> = T extends readonly [...infer Rest, infer Last]
  ? [Last, ...Reverse<Rest>]
  : [];

// Efficient object operations
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type ValuesOfType<T, U> = T[KeysOfType<T, U>];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

// Lazy component loading utilities
export type LazyComponent<P = {}> = React.LazyExoticComponent<React.ComponentType<P>>;

export const createLazyComponent = <P = {}>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>
): LazyComponent<P> => React.lazy(importFn);

// Efficient state management types
export type StateSelector<State, Selected> = (state: State) => Selected;

export type OptimizedSelector<State, Selected> = StateSelector<State, Selected> & {
  memoized: boolean;
  dependencies: (keyof State)[];
};

export const createSelector = <State, Selected>(
  selector: StateSelector<State, Selected>,
  dependencies: (keyof State)[] = []
): OptimizedSelector<State, Selected> => {
  const memoizedSelector = memoize(selector);

  return Object.assign(memoizedSelector, {
    memoized: true,
    dependencies,
  });
};

// Batch processing utilities
export type BatchProcessor<T, R> = {
  add: (item: T) => void;
  process: () => Promise<R[]>;
  clear: () => void;
  size: number;
};

export const createBatchProcessor = <T, R>(
  processFn: (batch: T[]) => Promise<R[]>,
  batchSize: number = 10,
  flushInterval: number = 100
): BatchProcessor<T, R> => {
  let batch: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  const flush = async (): Promise<R[]> => {
    if (batch.length === 0) return [];

    const currentBatch = [...batch];
    batch = [];

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    return processFn(currentBatch);
  };

  const scheduleFlush = () => {
    if (timeoutId) return;

    timeoutId = setTimeout(() => {
      flush();
      timeoutId = null;
    }, flushInterval);
  };

  return {
    add: (item: T) => {
      batch.push(item);

      if (batch.length >= batchSize) {
        flush();
      } else {
        scheduleFlush();
      }
    },
    process: flush,
    clear: () => {
      batch = [];
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    get size() {
      return batch.length;
    },
  };
};

// Efficient data structures
export interface IndexedCollection<T, K extends keyof T> {
  items: T[];
  index: Map<T[K], T>;
  byKey: (key: T[K]) => T | undefined;
  add: (item: T) => void;
  remove: (key: T[K]) => boolean;
  update: (key: T[K], updater: (item: T) => T) => boolean;
  clear: () => void;
  size: number;
}

export const createIndexedCollection = <T, K extends keyof T>(
  keyField: K,
  initialItems: T[] = []
): IndexedCollection<T, K> => {
  const items: T[] = [...initialItems];
  const index = new Map<T[K], T>();

  // Build initial index
  for (const item of initialItems) {
    index.set(item[keyField], item);
  }

  return {
    items,
    index,
    byKey: (key: T[K]) => index.get(key),
    add: (item: T) => {
      items.push(item);
      index.set(item[keyField], item);
    },
    remove: (key: T[K]) => {
      const item = index.get(key);
      if (!item) return false;

      const itemIndex = items.indexOf(item);
      if (itemIndex >= 0) {
        items.splice(itemIndex, 1);
      }

      return index.delete(key);
    },
    update: (key: T[K], updater: (item: T) => T) => {
      const item = index.get(key);
      if (!item) return false;

      const updated = updater(item);
      const itemIndex = items.indexOf(item);

      if (itemIndex >= 0) {
        items[itemIndex] = updated;
      }

      index.set(key, updated);
      return true;
    },
    clear: () => {
      items.length = 0;
      index.clear();
    },
    get size() {
      return items.length;
    },
  };
};

// Performance monitoring utilities
export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export const createPerformanceTracker = () => {
  const metrics = new Map<string, PerformanceMetrics>();

  return {
    start: (name: string) => {
      metrics.set(name, {
        startTime: performance.now(),
        memoryUsage: process.memoryUsage?.(),
      });
    },
    end: (name: string) => {
      const metric = metrics.get(name);
      if (!metric) return;

      const endTime = performance.now();
      metrics.set(name, {
        ...metric,
        endTime,
        duration: endTime - metric.startTime,
      });
    },
    get: (name: string) => metrics.get(name),
    getAll: () => Object.fromEntries(metrics),
    clear: (name?: string) => {
      if (name) {
        metrics.delete(name);
      } else {
        metrics.clear();
      }
    },
  };
};

// Type-safe caching utilities
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export interface TypeSafeCache<K, V> {
  get: (key: K) => V | undefined;
  set: (key: K, value: V, ttl?: number) => void;
  has: (key: K) => boolean;
  delete: (key: K) => boolean;
  clear: () => void;
  size: number;
  cleanup: () => void;
}

export const createTypeSafeCache = <K, V>(
  defaultTtl: number = 5 * 60 * 1000, // 5 minutes
  maxSize: number = 1000
): TypeSafeCache<K, V> => {
  const cache = new Map<K, CacheEntry<V>>();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.timestamp > entry.ttl) {
        cache.delete(key);
      }
    }
  };

  const evictIfNeeded = () => {
    if (cache.size >= maxSize) {
      // Evict oldest entries
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toEvict = entries.slice(0, Math.floor(maxSize * 0.1));
      for (const [key] of toEvict) {
        cache.delete(key);
      }
    }
  };

  return {
    get: (key: K) => {
      cleanup();
      const entry = cache.get(key);

      if (!entry) return undefined;

      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return undefined;
      }

      return entry.value;
    },
    set: (key: K, value: V, ttl: number = defaultTtl) => {
      evictIfNeeded();
      cache.set(key, {
        value,
        timestamp: Date.now(),
        ttl,
      });
    },
    has: (key: K) => {
      cleanup();
      return cache.has(key);
    },
    delete: (key: K) => cache.delete(key),
    clear: () => cache.clear(),
    get size() {
      cleanup();
      return cache.size;
    },
    cleanup,
  };
};

// Debounce and throttle utilities with types
export type DebouncedFunction<Args extends unknown[]> = {
  (...args: Args): void;
  cancel: () => void;
  flush: () => void;
};

export const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): DebouncedFunction<Args> => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Args | null = null;

  const debouncedFn = (...args: Args) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
      lastArgs = null;
    }, delay);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debouncedFn.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      fn(...lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return debouncedFn;
};

export type ThrottledFunction<Args extends unknown[]> = {
  (...args: Args): void;
  cancel: () => void;
};

export const throttle = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): ThrottledFunction<Args> => {
  let lastExecution = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  const throttledFn = (...args: Args) => {
    const now = Date.now();

    if (now - lastExecution >= delay) {
      fn(...args);
      lastExecution = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          fn(...args);
          lastExecution = Date.now();
          timeoutId = null;
        },
        delay - (now - lastExecution)
      );
    }
  };

  throttledFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttledFn;
};
