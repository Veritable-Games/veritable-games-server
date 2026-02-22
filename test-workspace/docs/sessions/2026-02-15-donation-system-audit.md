# Donation System Audit - BTCPay/Stripe Configuration Issues

**Date**: February 15, 2026
**Status**: ❌ FAILED - Both payment processors non-functional in production

---

## Executive Summary

The donation system code is fully implemented but **non-functional in production** due to missing environment variables. Both BTCPay and Stripe endpoints return 500 errors.

**Root Cause**: Environment variables documented as "configured" in `BTCPAY_PRODUCTION_SETUP.md` are **not present** in the production Docker container.

---

## Issue Analysis

### Production Environment (Coolify Docker Container)

**Command**: `ssh user@10.100.0.1 "docker exec m4s0kwo4kc4oooocck4sswc4 env | grep -E '(BTCPAY|STRIPE)'"`

**Result**:
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SVgXvFEu0YOwlhjG2tmYa4s6OQjec605R3zUHTn1XC1YLWppSCPLC1i4bGodvChviEOAHViCiHUinyqBC59FbW900N9i9F8Gg
```

**Missing Variables** (Required):
- ❌ `STRIPE_SECRET_KEY` - **CRITICAL** - Server-side Stripe API key
- ❌ `BTCPAY_SERVER_URL` - BTCPay server endpoint
- ❌ `BTCPAY_STORE_ID` - BTCPay store identifier
- ❌ `BTCPAY_API_KEY` - BTCPay API authentication
- ❌ `BTCPAY_WEBHOOK_SECRET` - Webhook signature verification
- ❌ `NEXT_PUBLIC_BASE_URL` or `NEXT_PUBLIC_SITE_URL` - Redirect URLs

**What's Present**:
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (LIVE key) - Client-side only, **insufficient**

---

### Local Development Environment

**File**: `frontend/.env.local`

**Stripe Configuration**:
```bash
STRIPE_SECRET_KEY=sk_test_51SVgY8JzFK5vZTKE...  # ✅ TEST key present
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SVgY8JzFK5vZTKE...  # ✅ TEST key
STRIPE_WEBHOOK_SECRET=whsec_placeholder_will_get_from_stripe_dashboard
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # ✅ Present
```

**BTCPay Configuration**:
```bash
BTCPAY_SERVER_URL=https://your-btcpay-instance.com  # ❌ PLACEHOLDER
BTCPAY_STORE_ID=your_store_id_here  # ❌ PLACEHOLDER
BTCPAY_API_KEY=your_api_key_here  # ❌ PLACEHOLDER
BTCPAY_WEBHOOK_SECRET=your_webhook_secret_here  # ❌ PLACEHOLDER
```

**Status**:
- Stripe: ⚠️ Partially configured (has secret key, but webhook secret is placeholder)
- BTCPay: ❌ Not configured (all placeholder values)

---

## Code Analysis

### 1. Stripe Endpoint (`/api/donations/stripe/route.ts`)

**Lines 82-85**:
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  logger.error('Stripe configuration missing: STRIPE_SECRET_KEY not set');
  return errorResponse(new Error('Stripe not configured'));
}
```

**Behavior**:
- ❌ Production: Missing `STRIPE_SECRET_KEY` → Returns `{"error": "Stripe not configured"}` with 500 status
- ✅ Local: Has `STRIPE_SECRET_KEY` → Creates Stripe checkout session

**Lines 87-94**:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
if (!baseUrl) {
  logger.error(
    'Base URL not configured (neither NEXT_PUBLIC_BASE_URL nor NEXT_PUBLIC_SITE_URL)'
  );
  return errorResponse(new Error('Server misconfigured'));
}
```

**Behavior**:
- ❌ Production: Likely missing both → Would return "Server misconfigured" if `STRIPE_SECRET_KEY` was present
- ✅ Local: Has `NEXT_PUBLIC_BASE_URL=http://localhost:3000`

---

### 2. BTCPay Endpoint (`/api/donations/btcpay/route.ts`)

**Lines 100-111**:
```typescript
const btcpayUrl = process.env.BTCPAY_SERVER_URL;
const btcpayStoreId = process.env.BTCPAY_STORE_ID;
const btcpayApiKey = process.env.BTCPAY_API_KEY;

if (!btcpayUrl || !btcpayStoreId || !btcpayApiKey) {
  logger.error('BTCPay configuration missing:', {
    hasUrl: !!btcpayUrl,
    hasStoreId: !!btcpayStoreId,
    hasApiKey: !!btcpayApiKey,
  });
  return NextResponse.json({ error: 'BTCPay Server not configured' }, { status: 500 });
}
```

**Behavior**:
- ❌ Production: All 3 variables missing → Returns `{"error": "BTCPay Server not configured"}` with 500 status
- ❌ Local: Has placeholder values → Would attempt to connect to `https://your-btcpay-instance.com` (would fail)

---

## Production Error Logs

**Browser Console** (from user's Firefox):
```
POST https://www.veritablegames.com/api/donations/stripe
Status: 500
Response: (likely) {"error": "Stripe not configured"}

POST https://www.veritablegames.com/api/donations/btcpay
Status: 500
Response: {"error": "BTCPay Server not configured"}
```

**Expected Server Logs**:
```
[ERROR] Stripe configuration missing: STRIPE_SECRET_KEY not set
[ERROR] BTCPay configuration missing: { hasUrl: false, hasStoreId: false, hasApiKey: false }
```

---

## Documentation vs Reality Discrepancy

### BTCPAY_PRODUCTION_SETUP.md Claims (Lines 56-68)

**Document States**:
```markdown
The following environment variables were added to the Coolify deployment:

BTCPAY_SERVER_URL=https://btcpay.veritablegames.com
BTCPAY_STORE_ID=HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk
BTCPAY_API_KEY=173b63c2f6a6820d8b0871c43a152935d6bb53fe
BTCPAY_WEBHOOK_SECRET=92f02d7edfdbb33318655378be9cc75ee941e9118456c4b6f05d0edd034f00b0

**Deployment Status**: Application redeployed after adding environment variables.
```

**Reality**:
- ❌ None of these variables are present in the production container
- ❌ No evidence of deployment after adding these variables
- ❌ Documentation is **incorrect** or changes were **reverted**

**Possible Explanations**:
1. Variables were added to Coolify UI but deployment was cancelled
2. Variables were added but later deployment overwrote them
3. Variables were never actually added (documentation was aspirational)
4. Variables were added to wrong environment (e.g., staging vs production)

---

## Missing from .env.example

**Issue**: The `.env.example` file has **NO section** for donation configuration.

**Lines Missing** (should be added):
```bash
# ===== DONATION SYSTEM CONFIGURATION =====

# BTCPay Server Configuration
# Get these from your BTCPay Server instance at: Dashboard → Settings → Stores
BTCPAY_SERVER_URL=https://your-btcpay-instance.com
BTCPAY_STORE_ID=your_store_id_here
BTCPAY_API_KEY=your_api_key_here
BTCPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Stripe Configuration
# Get test keys from: https://dashboard.stripe.com/test/apikeys
# IMPORTANT: Use test keys (sk_test_* and pk_test_*) for development
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here

# Stripe Webhook Secret
# Get this after creating webhook endpoint at: https://dashboard.stripe.com/test/webhooks
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Base URL for donation redirects
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Impact**: Developers following `.env.example` will have **no idea** these variables are required.

---

## Why Local vs Production Differs

### Local Development
- ✅ Has `.env.local` with Stripe test keys
- ⚠️ Stripe endpoint would work (creates checkout session)
- ❌ BTCPay endpoint would fail (placeholder values)
- ✅ Build succeeds (no build-time dependency on these vars)

### Production (Coolify)
- ❌ Missing `STRIPE_SECRET_KEY` → Stripe fails immediately
- ❌ Missing all BTCPay vars → BTCPay fails immediately
- ✅ Build succeeds (same reason - no build-time dependency)
- ❌ Runtime 500 errors when donation form submits

**Key Insight**: The donation system is **not build-time dependent**, so builds succeed everywhere. Only **runtime** failures occur when users try to donate.

---

## Security Concerns

### Exposed Live Stripe Key

**Finding**: Production has `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` (LIVE key)

**Issues**:
1. **Live publishable key** is exposed but missing corresponding **live secret key**
2. Client-side users can see this key in browser (expected for publishable keys)
3. Without `STRIPE_SECRET_KEY`, server can't complete transactions
4. **Mismatch**: Live publishable key + no secret key = broken configuration

**Recommendation**:
- Either remove the live publishable key OR
- Add the corresponding live secret key to match
- Consider using test keys until fully configured

---

## Recommendations

### Immediate Actions (Priority 1)

1. **Add Missing Environment Variables to Coolify**

   Navigate to Coolify dashboard → Application → Environment Variables → Add:

   ```bash
   # Stripe (LIVE keys - must match existing publishable key)
   STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

   # BTCPay (from BTCPAY_PRODUCTION_SETUP.md)
   BTCPAY_SERVER_URL=https://btcpay.veritablegames.com
   BTCPAY_STORE_ID=HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk
   BTCPAY_API_KEY=173b63c2f6a6820d8b0871c43a152935d6bb53fe
   BTCPAY_WEBHOOK_SECRET=92f02d7edfdbb33318655378be9cc75ee941e9118456c4b6f05d0edd034f00b0

   # Base URL (required for redirects)
   NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
   ```

2. **Redeploy Application**

   After adding variables, trigger Coolify redeploy to apply changes.

3. **Verify Environment Variables in Container**

   ```bash
   ssh user@10.100.0.1 "docker exec m4s0kwo4kc4oooocck4sswc4 env | grep -E '(BTCPAY|STRIPE|NEXT_PUBLIC_BASE)' | sort"
   ```

   Should show all 8 variables.

4. **Test Donation Endpoints**

   ```bash
   # Test Stripe endpoint
   curl -X POST https://www.veritablegames.com/api/donations/stripe \
     -H "Content-Type: application/json" \
     -d '{"amount":5.00,"currency":"USD","projectId":1}'

   # Test BTCPay endpoint
   curl -X POST https://www.veritablegames.com/api/donations/btcpay \
     -H "Content-Type: application/json" \
     -d '{"amount":5.00,"currency":"USD","projectId":1}'
   ```

   Should return checkout URLs, not 500 errors.

### Documentation Fixes (Priority 2)

1. **Update .env.example**

   Add donation system section with all required variables.

2. **Update BTCPAY_PRODUCTION_SETUP.md**

   Change status from "Configuration complete" to:
   ```markdown
   **Status**: ⚠️ Configuration documented but NOT applied to production
   **Action Required**: Add environment variables to Coolify (see Recommendations section)
   ```

3. **Update DONATIONS_SETUP_COMPLETE.md**

   Add warning that production deployment requires additional Coolify configuration.

### Testing Checklist (Priority 3)

After fixing environment variables:

- [ ] Verify all 8 env vars present in container
- [ ] Test Stripe donation ($5 test)
- [ ] Test BTCPay donation ($5 test)
- [ ] Verify webhook handlers receive events
- [ ] Check donation records created in database
- [ ] Verify redirect to `/donate/success` page
- [ ] Test with real payment (small amount)
- [ ] Monitor logs for errors

---

## Files to Update

### 1. `.env.example`
**Action**: Add donation system section
**Lines**: After line 354 (end of file)

### 2. `BTCPAY_PRODUCTION_SETUP.md`
**Action**: Update status to reflect reality
**Lines**: 3-4 (status header)

### 3. `DONATIONS_SETUP_COMPLETE.md`
**Action**: Add production deployment warning
**Lines**: After line 166 (Phase 2B section)

### 4. `CLAUDE.md`
**Action**: Already updated with accurate status (✅ DONE)

---

## Verification Commands

### Check Production Environment
```bash
# Via SSH
ssh user@10.100.0.1 "docker exec m4s0kwo4kc4oooocck4sswc4 env | grep -E '(BTCPAY|STRIPE)'"

# Expected output (after fix):
# BTCPAY_SERVER_URL=https://btcpay.veritablegames.com
# BTCPAY_STORE_ID=HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk
# BTCPAY_API_KEY=173b63c2f6a6820d8b0871c43a152935d6bb53fe
# BTCPAY_WEBHOOK_SECRET=92f02d7edfdbb33318655378be9cc75ee941e9118456c4b6f05d0edd034f00b0
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
# NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
```

### Test Donation Endpoints
```bash
# Stripe (should return checkoutUrl)
curl -X POST https://www.veritablegames.com/api/donations/stripe \
  -H "Content-Type: application/json" \
  -d '{"amount":5.00,"currency":"USD","projectId":1,"donorEmail":"test@example.com"}'

# BTCPay (should return checkoutUrl)
curl -X POST https://www.veritablegames.com/api/donations/btcpay \
  -H "Content-Type: application/json" \
  -d '{"amount":5.00,"currency":"USD","projectId":1,"donorEmail":"test@example.com"}'
```

---

## Root Cause Summary

1. **Stripe**: Missing `STRIPE_SECRET_KEY` in production → 500 "Stripe not configured"
2. **BTCPay**: Missing all 4 BTCPay env vars in production → 500 "BTCPay Server not configured"
3. **Documentation**: `BTCPAY_PRODUCTION_SETUP.md` claims configuration complete, but it's not
4. **Template**: `.env.example` doesn't include donation system variables
5. **Deployment**: Variables documented but never actually added to Coolify deployment

**Impact**: Donation system 100% non-functional in production despite code being complete.

---

**Last Updated**: February 15, 2026
**Auditor**: Claude Code
**Status**: ❌ Production deployment failed - Awaiting environment variable configuration
