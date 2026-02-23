# X402 Payment Wall Integration Guide

**Date**: 2026-02-19
**Status**: Implementation Instructions

## Summary

This guide shows how to integrate the database-backed payment wall toggle with the Cloudflare Worker. After these changes, the worker will respect the `x402PaymentWallEnabled` setting from the admin UI.

---

## Files Created

### 1. `/src/utils/settings.ts` ✅ CREATED

This file provides the `isPaymentWallEnabled()` function that:
- Queries the origin server's `/api/settings/payment-wall` endpoint
- Caches the result for 60 seconds
- Falls back to `BLOCK_MODE` env var if `ORIGIN_URL` is not configured
- Fails open (allows requests) on error to prevent service disruption

### 2. Origin API Endpoint ✅ CREATED

**File**: `frontend/src/app/api/settings/payment-wall/route.ts`

This endpoint returns the current payment wall status from the database. It's called by the Cloudflare Worker to check if the payment wall is enabled.

**URL**: `https://www.veritablegames.com/api/settings/payment-wall`

**Response**:
```json
{
  "success": true,
  "data": {
    "enabled": false
  }
}
```

---

## Required Changes to Worker

### Change 1: Import the settings utility

**File**: `src/index.ts`

**Add to imports** (line 21):
```typescript
import { isPaymentWallEnabled } from './utils/settings.ts';
```

### Change 2: Replace BLOCK_MODE check with database query

**File**: `src/index.ts`

**Replace lines 72-89** (current code):
```typescript
    // Option 2: Check for X-Payment header (instant USDC payment)
    const paymentHeader = request.headers.get('X-Payment');
    if (!paymentHeader) {
      // No payment provided - return 402 with payment instructions
      const response = create402Response(priceUSD, env, url.pathname);

      // In non-blocking mode, just log and allow through
      if (env.BLOCK_MODE === 'false') {
        if (env.DEBUG === 'true') {
          console.log('BLOCK_MODE=false: Would have returned 402, allowing request');
        }
        const proxiedResponse = await proxyToOrigin(request, env);
        logRequest(request, proxiedResponse, startTime, env);
        return proxiedResponse;
      }

      logRequest(request, response, startTime, env);
      return response;
    }
```

**With this new code**:
```typescript
    // Check if payment wall is enabled (database setting)
    const paymentWallEnabled = await isPaymentWallEnabled(env);

    if (!paymentWallEnabled) {
      // Payment wall disabled - allow all bot requests
      if (env.DEBUG === 'true') {
        console.log('Payment wall disabled via admin settings - allowing bot request');
      }
      const response = await proxyToOrigin(request, env);
      logRequest(request, response, startTime, env);
      return response;
    }

    // Payment wall enabled - check for payment/API key
    // Option 2: Check for X-Payment header (instant USDC payment)
    const paymentHeader = request.headers.get('X-Payment');
    if (!paymentHeader) {
      // No payment provided - return 402 with payment instructions
      const response = create402Response(priceUSD, env, url.pathname);
      logRequest(request, response, startTime, env);
      return response;
    }
```

---

## Complete Modified Section

For clarity, here's the complete updated section (lines 54-90):

```typescript
    // Bot detected - check for payment or API key
    const priceUSD = getEndpointPrice(url.pathname, url.search);

    // Check if payment wall is enabled (database setting)
    const paymentWallEnabled = await isPaymentWallEnabled(env);

    if (!paymentWallEnabled) {
      // Payment wall disabled - allow all bot requests
      if (env.DEBUG === 'true') {
        console.log('Payment wall disabled via admin settings - allowing bot request');
      }
      const response = await proxyToOrigin(request, env);
      logRequest(request, response, startTime, env);
      return response;
    }

    // Payment wall enabled - check for payment/API key
    // Option 1: Check for X-API-Key (aggregated billing)
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey) {
      const apiKeyResult = await validateApiKey(apiKey, env);
      if (apiKeyResult.valid) {
        // Valid API key - proxy request and record usage
        const response = await proxyToOrigin(request, env);
        // TODO: Record usage for monthly billing
        logRequest(request, response, startTime, env);
        return response;
      }
      // Invalid API key - return error
      return createErrorResponse(401, 'Unauthorized', apiKeyResult.reason || 'Invalid API key');
    }

    // Option 2: Check for X-Payment header (instant USDC payment)
    const paymentHeader = request.headers.get('X-Payment');
    if (!paymentHeader) {
      // No payment provided - return 402 with payment instructions
      const response = create402Response(priceUSD, env, url.pathname);
      logRequest(request, response, startTime, env);
      return response;
    }
```

**Key Changes**:
1. ✅ Removed BLOCK_MODE check (lines 77-85)
2. ✅ Added payment wall check via `isPaymentWallEnabled(env)`
3. ✅ Allow all bot requests when payment wall is disabled
4. ✅ Only check for payment/API key when payment wall is enabled

---

## Environment Variables

No changes needed! The worker already has these:
- `ORIGIN_URL` - Points to origin server (e.g., "https://www.veritablegames.com")
- `DEBUG` - Enable debug logging
- `BLOCK_MODE` - **DEPRECATED** - Now reads from database instead

**Note**: `BLOCK_MODE` is kept as a fallback if `ORIGIN_URL` is not configured.

---

## Deployment Steps

### 1. Test Locally

```bash
cd mcp-servers/cloudflare-x402-proxy

# Build the worker
npm run build

# Test with wrangler dev
npx wrangler dev
```

### 2. Deploy to Production

```bash
# Deploy to Cloudflare
npx wrangler deploy

# Verify deployment
npx wrangler tail x402-proxy
```

### 3. Test End-to-End

**Test 1: Verify API endpoint works**
```bash
curl https://www.veritablegames.com/api/settings/payment-wall

# Expected response:
# {"success":true,"data":{"enabled":false}}
```

**Test 2: Test bot request with payment wall disabled**
```bash
# Should return forum categories (NOT 402)
curl -i https://www.veritablegames.com/api/forums/categories

# Expected: HTTP 200 with JSON data
```

**Test 3: Enable payment wall in admin UI**
1. Navigate to: https://www.veritablegames.com/admin/settings
2. Toggle ON "Enable X402 Payment Wall"
3. Click "Save Changes"
4. Wait 60 seconds for cache to expire

**Test 4: Test bot request with payment wall enabled**
```bash
# Should return 402 Payment Required
curl -i https://www.veritablegames.com/api/forums/categories

# Expected: HTTP 402 with payment requirements
```

---

## Monitoring

### View Worker Logs

```bash
# Real-time logs
npx wrangler tail x402-proxy

# Look for:
# "Payment wall disabled via admin settings - allowing bot request"
# "Payment wall enabled - checking for payment"
# "Payment wall setting fetched from origin: false"
```

### Check Cache Behavior

The setting is cached for 60 seconds. After changing the setting:
- First request: Queries database (5-10ms latency)
- Next 60 seconds: Uses cached value (<1ms)
- After 60 seconds: Queries again

---

## Rollback Plan

If issues arise after deployment:

### Option 1: Disable via Admin UI
1. Navigate to /admin/settings
2. Toggle OFF "Enable X402 Payment Wall"
3. Changes take effect in < 60 seconds

### Option 2: Database Direct
```bash
ssh user@10.100.0.1
psql "postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" <<EOF
UPDATE system.site_settings
SET value = 'false', updated_at = NOW()
WHERE key = 'x402PaymentWallEnabled';
EOF
```

### Option 3: Revert Worker Deployment
```bash
# Deploy previous version
npx wrangler deployments list
npx wrangler rollback [deployment-id]
```

---

## Performance Impact

**Before**:
- Simple env var check: `env.BLOCK_MODE === 'false'` (~0.1ms)

**After**:
- **Cached**: Setting lookup (~0.1ms) - same as before
- **Uncached** (every 60s): HTTP fetch to origin (~5-10ms)

**Net Impact**: +5-10ms latency once per minute for bot requests. Negligible.

---

## Security Considerations

### Endpoint Security

The `/api/settings/payment-wall` endpoint is **public** (no auth required) because:
1. It's called by Cloudflare Worker before authentication
2. It only reveals a boolean setting (not sensitive data)
3. The setting is already observable via bot request behavior

### Fail-Safe Behavior

The `isPaymentWallEnabled()` function **fails open** (allows requests) if:
- Origin server is unreachable
- API endpoint returns error
- Request times out

**Rationale**: Prefer service availability over strict payment wall enforcement. Temporary outages won't break legitimate bot access.

---

## Success Criteria

✅ **After deployment, all of these should work**:

1. Admin can toggle payment wall ON/OFF via /admin/settings
2. When OFF: Bot requests succeed (no 402 errors)
3. When ON: Bot requests return 402 Payment Required
4. Changes take effect within 60 seconds
5. E2E tests pass (payment wall defaults to OFF)
6. No performance degradation for human users

---

## Testing Checklist

- [ ] Settings utility file created (`src/utils/settings.ts`)
- [ ] Origin API endpoint created (`/api/settings/payment-wall`)
- [ ] Worker index.ts updated with new logic
- [ ] Local testing with `wrangler dev`
- [ ] Deployment to Cloudflare
- [ ] Verify API endpoint responds correctly
- [ ] Test bot request with payment wall OFF
- [ ] Toggle payment wall ON in admin UI
- [ ] Test bot request with payment wall ON
- [ ] Run E2E test suite
- [ ] Check worker logs for errors

---

**Last Updated**: 2026-02-19
**Status**: Ready for deployment
