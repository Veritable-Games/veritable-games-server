# API Compression Migration Guide

## Overview
This guide helps migrate existing API routes to use the enhanced compression middleware
for significant bandwidth reduction and improved performance.

## Quick Migration Steps

### 1. Basic Migration (Replace withSecurity)
```typescript
// Before
import { withSecurity } from '@/lib/security/middleware';
export const GET = withSecurity(handler, options);

// After
import { withSecurityAndCompression } from '@/lib/api/enhanced-compression-middleware';
export const GET = withSecurityAndCompression(handler, securityOptions, compressionOptions);
```

### 2. JSON-Heavy Routes
For routes returning large JSON responses:
```typescript
export const GET = withSecurityAndCompression(handler, {
  requireAuth: true,
  rateLimitConfig: 'api'
}, {
  threshold: 256,     // Compress responses > 256 bytes
  level: 7,          // High compression for JSON
  collectMetrics: true
});
```

### 3. Search/Query Routes
For search results and large datasets:
```typescript
export const GET = withSecurityAndCompression(handler, securityOptions, {
  threshold: 128,     // Aggressive compression threshold
  level: 8,          // Maximum compression
  qualityLevels: {
    json: 9          // Highest quality for search results
  }
});
```

## Compression Performance by Route Type

| Route Type | Expected Compression | Bandwidth Savings |
|------------|---------------------|-------------------|
| User Lists | 65-70% | High |
| Search Results | 70-75% | Very High |
| Metrics/Analytics | 75-80% | Extreme |
| Wiki Content | 60-65% | High |
| Admin Dashboards | 60-70% | High |

## Monitoring Compression

Enable metrics collection to monitor compression performance:
```typescript
import { getCompressionMetrics } from '@/lib/api/enhanced-compression-middleware';

// In your monitoring dashboard
const metrics = getCompressionMetrics();
console.log(`Average compression: ${(metrics.averageCompressionRatio * 100).toFixed(1)}%`);
console.log(`Total bandwidth saved: ${(metrics.totalBytesSaved / 1024 / 1024).toFixed(1)} MB`);
```

## Best Practices

1. **Enable compression for all JSON APIs** - They compress extremely well
2. **Use higher compression levels for search/analytics** - More CPU for better compression
3. **Monitor compression ratios** - Ensure you're getting expected savings
4. **Test with real data** - Compression ratios vary by content
5. **Consider caching** - Pre-compress static responses when possible

## Implementation Priority

1. **High Priority**: Admin APIs, search results, user lists
2. **Medium Priority**: Wiki content, project data, library documents
3. **Low Priority**: Simple CRUD operations, small responses

The enhanced compression middleware is production-ready and will provide
immediate bandwidth savings with minimal implementation effort.
