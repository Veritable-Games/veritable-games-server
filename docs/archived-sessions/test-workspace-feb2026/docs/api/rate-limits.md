# Rate Limiting Guide

## Overview

The Veritable Games API implements comprehensive rate limiting to ensure fair usage, prevent abuse, and maintain service availability. This guide covers rate limit tiers, headers, handling strategies, and best practices.

## Rate Limit Tiers

The API uses different rate limit tiers based on endpoint sensitivity and expected usage patterns:

| Tier | Limit | Window | Reset | Use Case |
|------|-------|--------|-------|----------|
| **auth** | 5 requests | 15 minutes | Sliding | Login, registration, password reset |
| **strict** | 10 requests | 1 minute | Fixed | Sensitive operations, bulk actions |
| **api** | 60 requests | 1 minute | Fixed | Standard API endpoints |
| **page** | 100 requests | 1 minute | Fixed | Page loads, static resources |
| **generous** | 300 requests | 1 minute | Fixed | Real-time features, polling |
| **public** | 1000 requests | 1 minute | Fixed | Public resources, health checks |

## Rate Limit Headers

All API responses include rate limit information in headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1726570860
X-RateLimit-Reset-After: 42
X-RateLimit-Bucket: api
X-RateLimit-Retry-After: 42
```

### Header Definitions

| Header | Type | Description |
|--------|------|-------------|
| `X-RateLimit-Limit` | integer | Maximum requests allowed in window |
| `X-RateLimit-Remaining` | integer | Requests remaining in current window |
| `X-RateLimit-Reset` | timestamp | Unix timestamp when limit resets |
| `X-RateLimit-Reset-After` | seconds | Seconds until limit resets |
| `X-RateLimit-Bucket` | string | Rate limit tier applied |
| `X-RateLimit-Retry-After` | seconds | Seconds to wait before retry (429 only) |

## Implementation Details

### Rate Limit Configuration

```typescript
// Rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => req.ip + ':auth'
  },
  strict: {
    windowMs: 60 * 1000, // 1 minute
    limit: 10,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => req.ip + ':strict'
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    limit: 60,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => req.ip + ':api'
  },
  page: {
    windowMs: 60 * 1000, // 1 minute
    limit: 100,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => req.ip + ':page'
  },
  generous: {
    windowMs: 60 * 1000, // 1 minute
    limit: 300,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => req.ip + ':generous'
  },
  public: {
    windowMs: 60 * 1000, // 1 minute
    limit: 1000,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => req.ip + ':public'
  }
};
```

### Applying Rate Limits

```typescript
// Apply rate limiting to endpoints
export const POST = withSecurity(handler, {
  rateLimitEnabled: true,
  rateLimitConfig: 'api' // Use 'api' tier
});

// Custom rate limit for sensitive operations
export const DELETE = withSecurity(deleteHandler, {
  rateLimitEnabled: true,
  rateLimitConfig: 'strict' // More restrictive
});
```

## Client-Side Handling

### Reading Rate Limit Headers

```javascript
class RateLimitManager {
  constructor() {
    this.limits = new Map();
  }

  updateFromResponse(response, endpoint) {
    const limit = parseInt(response.headers.get('X-RateLimit-Limit'));
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
    const reset = parseInt(response.headers.get('X-RateLimit-Reset'));
    const bucket = response.headers.get('X-RateLimit-Bucket');

    if (limit && remaining !== null && reset) {
      this.limits.set(endpoint, {
        limit,
        remaining,
        reset: reset * 1000, // Convert to milliseconds
        bucket,
        lastUpdate: Date.now()
      });
    }
  }

  canMakeRequest(endpoint) {
    const limitInfo = this.limits.get(endpoint);
    if (!limitInfo) return true;

    // Check if window has reset
    if (Date.now() > limitInfo.reset) {
      this.limits.delete(endpoint);
      return true;
    }

    return limitInfo.remaining > 0;
  }

  getWaitTime(endpoint) {
    const limitInfo = this.limits.get(endpoint);
    if (!limitInfo || limitInfo.remaining > 0) return 0;

    return Math.max(0, limitInfo.reset - Date.now());
  }

  getRemainingRequests(endpoint) {
    const limitInfo = this.limits.get(endpoint);
    return limitInfo?.remaining ?? null;
  }
}

// Usage
const rateLimits = new RateLimitManager();

async function apiRequest(url, options = {}) {
  // Check rate limit before request
  if (!rateLimits.canMakeRequest(url)) {
    const waitTime = rateLimits.getWaitTime(url);
    throw new Error(`Rate limited. Wait ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  const response = await fetch(url, options);

  // Update rate limit info
  rateLimits.updateFromResponse(response, url);

  if (response.status === 429) {
    const retryAfter = response.headers.get('X-RateLimit-Retry-After');
    throw new RateLimitError(retryAfter);
  }

  return response;
}
```

### Handling 429 Responses

```javascript
class RateLimitError extends Error {
  constructor(retryAfter) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
    this.retryAfter = parseInt(retryAfter) || 60;
  }
}

async function handleRateLimit(error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retrying in ${error.retryAfter} seconds...`);

    // Show user notification
    showNotification(
      `Too many requests. Please wait ${error.retryAfter} seconds.`,
      'warning',
      { duration: error.retryAfter * 1000 }
    );

    // Wait and retry
    await new Promise(resolve =>
      setTimeout(resolve, error.retryAfter * 1000)
    );

    return true; // Can retry
  }

  return false; // Cannot handle
}
```

### Request Queue with Rate Limiting

```javascript
class RateLimitedQueue {
  constructor(maxConcurrent = 3, minDelay = 100) {
    this.queue = [];
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.minDelay = minDelay;
    this.lastRequest = 0;
  }

  async add(requestFn, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: requestFn,
        resolve,
        reject,
        priority,
        retries: 0
      });

      // Sort by priority
      this.queue.sort((a, b) => b.priority - a.priority);

      this.process();
    });
  }

  async process() {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Enforce minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.minDelay) {
      setTimeout(() => this.process(), this.minDelay - timeSinceLastRequest);
      return;
    }

    const item = this.queue.shift();
    this.active++;
    this.lastRequest = Date.now();

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      if (error instanceof RateLimitError && item.retries < 3) {
        // Re-queue with delay
        item.retries++;
        setTimeout(() => {
          this.queue.unshift(item);
          this.process();
        }, error.retryAfter * 1000);
      } else {
        item.reject(error);
      }
    } finally {
      this.active--;
      // Process next item
      setTimeout(() => this.process(), this.minDelay);
    }
  }
}

// Usage
const queue = new RateLimitedQueue();

// Add requests to queue
const results = await Promise.all([
  queue.add(() => fetch('/api/endpoint1'), 1), // Priority 1
  queue.add(() => fetch('/api/endpoint2'), 0), // Priority 0
  queue.add(() => fetch('/api/endpoint3'), 2), // Priority 2 (highest)
]);
```

## Optimization Strategies

### 1. Request Batching

Combine multiple requests into a single batch request:

```javascript
class BatchRequestManager {
  constructor(batchEndpoint, maxBatchSize = 10, batchDelay = 50) {
    this.batchEndpoint = batchEndpoint;
    this.maxBatchSize = maxBatchSize;
    this.batchDelay = batchDelay;
    this.pending = [];
    this.timer = null;
  }

  async request(operation) {
    return new Promise((resolve, reject) => {
      this.pending.push({ operation, resolve, reject });

      if (this.pending.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pending.length === 0) return;

    const batch = this.pending.splice(0, this.maxBatchSize);
    const operations = batch.map(item => item.operation);

    try {
      const response = await fetch(this.batchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'include',
        body: JSON.stringify({ operations })
      });

      const results = await response.json();

      batch.forEach((item, index) => {
        if (results.data[index].success) {
          item.resolve(results.data[index].data);
        } else {
          item.reject(new Error(results.data[index].error));
        }
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }

    // Process remaining items
    if (this.pending.length > 0) {
      this.flush();
    }
  }
}

// Usage
const batchManager = new BatchRequestManager('/api/batch');

// These will be batched together
const [user1, user2, user3] = await Promise.all([
  batchManager.request({ type: 'getUser', id: '1' }),
  batchManager.request({ type: 'getUser', id: '2' }),
  batchManager.request({ type: 'getUser', id: '3' })
]);
```

### 2. Response Caching

Cache responses to reduce API calls:

```javascript
class CachedAPIClient {
  constructor(cacheTime = 60000) { // 1 minute default
    this.cache = new Map();
    this.cacheTime = cacheTime;
  }

  getCacheKey(url, options = {}) {
    return `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || '')}`;
  }

  async request(url, options = {}) {
    const key = this.getCacheKey(url, options);

    // Check cache for GET requests
    if (!options.method || options.method === 'GET') {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheTime) {
        console.log('Cache hit:', url);
        return cached.data;
      }
    }

    // Make request
    const response = await fetch(url, {
      ...options,
      credentials: 'include'
    });

    const data = await response.json();

    // Cache successful GET responses
    if (response.ok && (!options.method || options.method === 'GET')) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });

      // Clean old entries
      this.cleanCache();
    }

    return data;
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTime) {
        this.cache.delete(key);
      }
    }
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Usage
const api = new CachedAPIClient();

// First call hits API
const topics1 = await api.request('/api/forums/topics');

// Second call within 1 minute uses cache
const topics2 = await api.request('/api/forums/topics');

// Invalidate cache after mutation
await api.request('/api/forums/topics', {
  method: 'POST',
  body: JSON.stringify(newTopic)
});
api.invalidate('/api/forums/topics'); // Clear related cache
```

### 3. Debouncing & Throttling

Reduce request frequency for user-triggered events:

```javascript
// Debounce function
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Throttle function
function throttle(fn, limit) {
  let inThrottle;
  let lastTime = 0;

  return function(...args) {
    const now = Date.now();

    if (!inThrottle) {
      fn.apply(this, args);
      lastTime = now;
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Usage for search
const searchInput = document.querySelector('#search');
const debouncedSearch = debounce(async (query) => {
  const results = await api.request(`/api/search?q=${query}`);
  displayResults(results);
}, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});

// Usage for scroll events
const throttledScroll = throttle(async () => {
  if (nearBottom()) {
    const nextPage = await api.request(`/api/items?page=${currentPage + 1}`);
    appendItems(nextPage);
  }
}, 1000);

window.addEventListener('scroll', throttledScroll);
```

## Monitoring Rate Limits

### Dashboard Component

```javascript
class RateLimitDashboard {
  constructor() {
    this.limits = new Map();
    this.history = [];
  }

  update(endpoint, limitInfo) {
    this.limits.set(endpoint, limitInfo);

    this.history.push({
      endpoint,
      timestamp: Date.now(),
      remaining: limitInfo.remaining,
      limit: limitInfo.limit
    });

    // Keep last 100 entries
    if (this.history.length > 100) {
      this.history.shift();
    }

    this.render();
  }

  render() {
    const container = document.querySelector('#rate-limit-dashboard');
    if (!container) return;

    const html = `
      <div class="rate-limits">
        <h3>Current Rate Limits</h3>
        ${Array.from(this.limits.entries()).map(([endpoint, info]) => `
          <div class="limit-item">
            <div class="endpoint">${endpoint}</div>
            <div class="progress">
              <div class="progress-bar" style="width: ${(info.remaining / info.limit) * 100}%"></div>
            </div>
            <div class="stats">
              ${info.remaining}/${info.limit} remaining
              (resets in ${Math.ceil((info.reset - Date.now()) / 1000)}s)
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.innerHTML = html;
  }

  getUsageStats() {
    const stats = {};

    for (const entry of this.history) {
      if (!stats[entry.endpoint]) {
        stats[entry.endpoint] = {
          requests: 0,
          throttled: 0
        };
      }

      stats[entry.endpoint].requests++;
      if (entry.remaining === 0) {
        stats[entry.endpoint].throttled++;
      }
    }

    return stats;
  }
}

// Usage
const dashboard = new RateLimitDashboard();

// Hook into API client
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);

  const url = args[0];
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  if (limit && remaining && reset) {
    dashboard.update(url, {
      limit: parseInt(limit),
      remaining: parseInt(remaining),
      reset: parseInt(reset) * 1000
    });
  }

  return response;
};
```

## Testing Rate Limits

### Unit Tests

```javascript
describe('Rate Limiting', () => {
  test('respects rate limits', async () => {
    const client = new RateLimitedClient();

    // Make requests up to limit
    for (let i = 0; i < 60; i++) {
      await client.request('/api/endpoint');
    }

    // Next request should fail
    await expect(client.request('/api/endpoint'))
      .rejects.toThrow('Rate limit exceeded');
  });

  test('retries after rate limit reset', async () => {
    const client = new RateLimitedClient();

    // Exhaust rate limit
    for (let i = 0; i < 60; i++) {
      await client.request('/api/endpoint');
    }

    // Wait for reset
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Should work again
    await expect(client.request('/api/endpoint')).resolves.toBeDefined();
  });

  test('handles concurrent requests', async () => {
    const client = new RateLimitedClient();

    // Make 100 concurrent requests
    const promises = Array(100).fill().map(() =>
      client.request('/api/endpoint')
    );

    const results = await Promise.allSettled(promises);

    // Should have 60 fulfilled and 40 rejected
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(60);
    expect(rejected.length).toBe(40);
  });
});
```

### Load Testing

```javascript
// Load test script
async function loadTest(endpoint, requestsPerSecond, duration) {
  const results = {
    successful: 0,
    rateLimited: 0,
    errors: 0,
    latencies: []
  };

  const interval = 1000 / requestsPerSecond;
  const endTime = Date.now() + (duration * 1000);

  while (Date.now() < endTime) {
    const startTime = Date.now();

    try {
      const response = await fetch(endpoint);

      if (response.status === 429) {
        results.rateLimited++;
      } else if (response.ok) {
        results.successful++;
      } else {
        results.errors++;
      }

      results.latencies.push(Date.now() - startTime);
    } catch (error) {
      results.errors++;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Calculate statistics
  const avgLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
  const maxLatency = Math.max(...results.latencies);
  const minLatency = Math.min(...results.latencies);

  console.log(`
    Load Test Results:
    - Successful: ${results.successful}
    - Rate Limited: ${results.rateLimited}
    - Errors: ${results.errors}
    - Avg Latency: ${avgLatency.toFixed(2)}ms
    - Max Latency: ${maxLatency}ms
    - Min Latency: ${minLatency}ms
  `);

  return results;
}

// Run load test
loadTest('http://localhost:3000/api/health', 10, 60); // 10 req/s for 60 seconds
```

## Best Practices

1. **Respect rate limits** - Never try to circumvent rate limiting
2. **Implement backoff** - Use exponential backoff for retries
3. **Cache responses** - Reduce unnecessary API calls
4. **Batch requests** - Combine multiple operations when possible
5. **Monitor usage** - Track your rate limit consumption
6. **Handle 429 gracefully** - Show user-friendly messages
7. **Use appropriate tiers** - Choose the right endpoint for your needs
8. **Optimize request patterns** - Debounce/throttle user actions
9. **Plan for limits** - Design your application with limits in mind
10. **Contact support** - Request limit increases for legitimate needs

## Rate Limit Bypass

For legitimate high-volume use cases, contact support for:

1. **API Key with higher limits** - For approved applications
2. **IP Allowlisting** - For known good actors
3. **Custom rate limits** - For specific use cases
4. **Batch endpoints** - For bulk operations

## Emergency Rate Limiting

During incidents, emergency rate limits may be applied:

```javascript
// Emergency limits (activated during incidents)
const EMERGENCY_LIMITS = {
  global: 10,    // 10 requests per minute globally
  auth: 1,       // 1 auth attempt per 15 minutes
  write: 5,      // 5 write operations per minute
  read: 20       // 20 read operations per minute
};
```

Monitor the status page for emergency rate limit notifications.