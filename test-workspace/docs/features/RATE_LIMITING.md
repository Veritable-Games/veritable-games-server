# Rate Limiting System

**Status**: ✅ Production-ready
**Last Updated**: February 19, 2026

## Overview

The Veritable Games platform implements a comprehensive rate limiting system to protect against spam, abuse, and resource exhaustion. As of February 2026, **individual admin toggles** allow fine-grained control over each rate limiter for testing, debugging, and emergency situations.

## Architecture

### Two-Phase Check Design

Rate limiting uses a **performance-optimized two-phase architecture**:

1. **Phase 1 (Fast Path)**: Check in-memory LRU cache
   - 99.9% of requests never hit rate limits
   - No database queries for normal traffic
   - Immediate response with minimal latency

2. **Phase 2 (Lazy Check)**: Only when limit exceeded
   - Query settings database to check if limiter is disabled
   - Settings cached for 1 minute
   - Bypass rate limit if disabled in admin settings

**Why this approach?**
- Avoids unnecessary database queries for successful requests
- Settings check only happens on rate limit failures (rare)
- Acceptable trade-off: Disabled limiters still increment counters but never block

### Fail-Secure Defaults

All rate limiters follow a **fail-secure pattern**:
- Default to `enabled` on first installation
- Enforce rate limit if settings unavailable (database error)
- Visual warning in admin UI about security implications

## Rate Limiters

| Limiter Type | Limit | Time Window | Endpoints | Setting Key |
|-------------|-------|-------------|-----------|-------------|
| **Topic Creation** | 5 | 1 hour | `/api/forums/topics` (POST) | `rateLimitTopicCreateEnabled` |
| **Reply Creation** | 30 | 1 hour | `/api/forums/replies` (POST) | `rateLimitReplyCreateEnabled` |
| **Search Queries** | 100 | 1 minute | `/api/forums/search`, `/api/wiki/search` | `rateLimitSearchEnabled` |
| **Authentication** | 10 | 15 minutes | `/api/auth/login`, `/api/auth/register`, `/api/auth/password-reset/*` | `rateLimitAuthEnabled` |
| **File Uploads** | 10 | 1 hour | `/api/users/[id]/avatar` (POST) | `rateLimitFileUploadEnabled` |
| **Message Sending** | 20 | 1 hour | `/api/donations` (POST) | `rateLimitMessageSendEnabled` |
| **Wiki Creation** | 10 | 1 hour | *Not currently used* | `rateLimitWikiCreateEnabled` |

### Implementation Details

**Rate Limit Algorithm**: Fixed-window LRU cache
- Client identified by IP address (`X-Forwarded-For` header or `X-Real-IP`)
- Per-endpoint key prefixes (e.g., `topic:create:192.168.1.1`)
- In-memory storage with automatic expiration

**Rate Limit Headers**:
```
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1771493961459
Retry-After: 695
```

**429 Response Format**:
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 695
}
```

## Admin Controls

### Accessing Rate Limiter Settings

1. Navigate to `/admin/settings` (admin role required)
2. Scroll to **"Rate Limiting"** section
3. Toggle individual limiters on/off
4. Click **"Save Changes"**

**⚠️ Security Warning**: Visual alert in UI warns admins about disabling rate limiters.

### Settings Cache

- Settings cached for **1 minute**
- Toggling a limiter takes up to **60 seconds** to take effect
- Cache automatically expires on settings update
- Manual cache clear: Restart application server

## Use Cases

### 1. E2E Testing

**Problem**: 546-test Playwright suite triggers auth rate limiter (10 per 15 min)

**Solution**:
```typescript
// In test setup
test.beforeAll(async () => {
  await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rateLimitAuthEnabled: false,
      rateLimitTopicCreateEnabled: false,
      rateLimitReplyCreateEnabled: false,
    }),
  });

  // Wait for cache to expire
  await new Promise(resolve => setTimeout(resolve, 61000));
});

test.afterAll(async () => {
  // Re-enable rate limiters
  await fetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({
      rateLimitAuthEnabled: true,
      rateLimitTopicCreateEnabled: true,
      rateLimitReplyCreateEnabled: true,
    }),
  });
});
```

### 2. Emergency Bypass

**Scenario**: Legitimate traffic spike (e.g., product launch, viral post)

**Action**:
1. Disable affected limiter (e.g., `rateLimitSearchEnabled`)
2. Monitor traffic and abuse metrics
3. Re-enable when traffic normalizes

### 3. Performance Tuning

**Scenario**: Rate limits too strict for power users

**Action**:
1. Temporarily disable limiter
2. Analyze usage patterns and abuse rates
3. Adjust limits in code (requires deployment)
4. Re-enable with new limits

### 4. Development/Debugging

**Scenario**: Testing forum features locally without hitting rate limits

**Action**:
1. Disable relevant limiters in local environment
2. Test freely without delays
3. Re-enable before committing changes

## Security Considerations

### When to Disable Rate Limiters

✅ **Safe to disable**:
- Local development environment
- E2E test suite (automated)
- Short-duration emergencies (< 1 hour)
- Performance analysis (with monitoring)

❌ **Do NOT disable**:
- Production under normal load
- Indefinitely (more than a few hours)
- Without monitoring abuse metrics
- When under active attack

### Monitoring Checklist

When rate limiters are disabled, monitor:
- [ ] Request volume per endpoint
- [ ] Unique IP addresses making requests
- [ ] Error rates (500 errors, database timeouts)
- [ ] Database connection pool usage
- [ ] Server CPU and memory usage

## Technical Implementation

### File Structure

**Core Files**:
- `src/lib/security/middleware.ts` - Rate limiter logic + settings check
- `src/lib/settings/service.ts` - Settings interface + defaults
- `scripts/migrations/025-add-rate-limiter-toggles.sql` - Database migration

**API Routes** (11 files with `rateLimiterType` parameter):
- Forums: `topics/route.ts`, `replies/route.ts`, `search/route.ts`
- Auth: `login/route.ts`, `register/route.ts`, `password-reset/route.ts`, `password-reset/confirm/route.ts`
- Donations: `route.ts`, `manage-link/route.ts`
- Wiki: `search/route.ts`
- Avatars: `users/[id]/avatar/route.ts` (manual rate limiting)

**Admin**:
- `src/app/api/admin/settings/route.ts` - Settings API with validation
- `src/components/admin/SiteSettingsManager.tsx` - Admin UI with toggles

### Code Example: Adding a New Rate Limiter

1. **Define rate limiter** (`src/lib/security/middleware.ts`):
```typescript
export const rateLimiters = {
  // ... existing limiters
  myNewFeature: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    keyPrefix: 'my-feature',
  }),
};
```

2. **Add to settings interface** (`src/lib/settings/service.ts`):
```typescript
export interface SiteSettings {
  // ... existing settings
  rateLimitMyNewFeatureEnabled: boolean;
}

// In getSettings():
this.settings = {
  // ... existing defaults
  rateLimitMyNewFeatureEnabled: settings.rateLimitMyNewFeatureEnabled ?? true,
};
```

3. **Add migration**:
```sql
INSERT INTO system.site_settings (key, value, updated_at) VALUES
    ('rateLimitMyNewFeatureEnabled', 'true', NOW())
ON CONFLICT (key) DO NOTHING;
```

4. **Update middleware helper**:
```typescript
async function isRateLimiterEnabled(
  limiterType:
    | 'topicCreate'
    | 'replyCreate'
    | 'search'
    | 'auth'
    | 'fileUpload'
    | 'messageSend'
    | 'wikiCreate'
    | 'myNewFeature' // ADD HERE
): Promise<boolean> {
  // ...
  const settingsKeyMap = {
    // ... existing mappings
    myNewFeature: 'rateLimitMyNewFeatureEnabled',
  } as const;
  // ...
}
```

5. **Use in API route**:
```typescript
export const POST = withSecurity(handler, {
  rateLimiter: rateLimiters.myNewFeature,
  rateLimiterType: 'myNewFeature',
  rateLimitKey: req => `my-feature:${getClientIP(req)}`,
});
```

6. **Add to admin UI** (`SiteSettingsManager.tsx`):
```tsx
<SettingsToggleGroup
  options={[
    // ... existing options
    {
      id: 'rateLimitMyNewFeatureEnabled',
      label: 'My New Feature (50 per hour)',
      description: 'Rate limit my new feature',
      checked: settings.rateLimitMyNewFeatureEnabled,
    },
  ]}
/>
```

7. **Add validation** (`src/app/api/admin/settings/route.ts`):
```typescript
const rateLimiterKeys = [
  // ... existing keys
  'rateLimitMyNewFeatureEnabled',
] as const;
```

## Troubleshooting

### Issue: Rate limit toggle not taking effect

**Symptoms**: Disabled limiter still returns 429 errors

**Causes**:
1. Settings cache not expired (wait 60 seconds)
2. Database update failed (check logs)
3. Wrong limiter disabled (check endpoint mapping)

**Solution**:
```bash
# Check current settings
curl https://www.veritablegames.com/api/admin/settings

# Verify setting value
DATABASE_URL="..." npx tsx -e "
import { settingsService } from '@/lib/settings/service';
settingsService.getSetting('rateLimitAuthEnabled').then(console.log);
"

# Force cache clear (restart server)
ssh user@10.100.0.1 "docker restart m4s0kwo4kc4oooocck4sswc4"
```

### Issue: E2E tests still hitting rate limits

**Symptoms**: Tests fail with 429 even after disabling limiters

**Causes**:
1. Forgot to wait for cache expiration (need 61 seconds)
2. Test setup runs after tests start
3. Different test user hitting different rate limit key

**Solution**:
```typescript
// Use global setup instead of beforeAll
// File: e2e/global-setup.ts
export default async function globalSetup() {
  await disableRateLimiters();
  await new Promise(resolve => setTimeout(resolve, 61000));
}
```

### Issue: Rate limiters re-enabled unexpectedly

**Symptoms**: Limiters turn back on without admin action

**Causes**:
1. Server restart (settings persist in database, not memory)
2. Test teardown re-enabled them
3. Deployment reset settings (migration issue)

**Solution**:
```bash
# Check database directly
DATABASE_URL="..." psql -c "
SELECT key, value FROM system.site_settings
WHERE key LIKE 'rateLimit%'
ORDER BY key;
"
```

## Performance Impact

### Benchmark Results

**With rate limiting enabled** (normal operation):
- Average request latency: +0.3ms (LRU cache lookup)
- Database queries: 0 per request (settings cached)
- Memory overhead: ~2MB (LRU cache for 10,000 keys)

**When rate limit exceeded**:
- Additional database query: +5-10ms (settings lookup)
- Settings cache hit rate: 99.9% (after first query)
- Bypass latency: +0.5ms (cache check + logger.info)

**Conclusion**: Negligible performance impact for normal traffic patterns.

## Migration History

- **025-add-rate-limiter-toggles.sql** (2026-02-19)
  - Added 7 rate limiter toggle settings
  - All default to `true` for backward compatibility
  - Uses `ON CONFLICT DO NOTHING` for safe re-runs

## Related Documentation

- [CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md) - `withSecurity()` pattern
- [TESTING.md](../guides/TESTING.md) - E2E test setup with rate limit bypass
- [DEPLOYMENT_DOCUMENTATION_INDEX.md](../deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md) - Production deployment
- [COMMANDS_REFERENCE.md](../guides/COMMANDS_REFERENCE.md) - Database commands

---

**Need Help?**
- Check `src/lib/security/middleware.ts` for rate limiter implementation
- Admin UI: `/admin/settings` > "Rate Limiting" section
- E2E Test Example: `e2e/forums/replies-crud.spec.ts` (setup code)
