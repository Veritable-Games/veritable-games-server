# Stripe Webhook Setup Guide

**Date**: February 15, 2026
**Status**: ✅ Code implemented - Awaiting webhook configuration in Stripe dashboard

---

## Quick Answer: Which Events to Select?

When you see 50+ event types in Stripe, **only select these 2**:

1. ✅ **`checkout.session.completed`** - REQUIRED
2. ✅ **`checkout.session.expired`** - RECOMMENDED

That's it! Ignore the other 48+ events.

---

## Step-by-Step Webhook Configuration

### 1. Go to Stripe Dashboard

1. Log in to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"** button

### 2. Enter Webhook URL

**Development**:
```
http://localhost:3000/api/donations/stripe/webhook
```

**Production**:
```
https://www.veritablegames.com/api/donations/stripe/webhook
```

### 3. Select Events to Listen To

Click **"Select events"** and find these 2 events:

#### Event 1: `checkout.session.completed` (REQUIRED)
- **Category**: Checkout
- **Event Name**: `checkout.session.completed`
- **When It Fires**: Customer successfully completes payment
- **What It Does**: Updates donation from `pending` → `completed` in database

#### Event 2: `checkout.session.expired` (RECOMMENDED)
- **Category**: Checkout
- **Event Name**: `checkout.session.expired`
- **When It Fires**: Checkout session expires (24 hours) without payment
- **What It Does**: Updates donation from `pending` → `failed` in database

**⚠️ DO NOT select**:
- `customer.*` events (not needed for one-time donations)
- `invoice.*` events (only for subscriptions)
- `payment_intent.*` events (handled automatically via checkout.session)
- `charge.*` events (handled automatically via checkout.session)
- `subscription.*` events (only if you add recurring donations later)

### 4. Add Endpoint

1. Click **"Add endpoint"**
2. Stripe will create the webhook and show you the signing secret

### 5. Copy Signing Secret

1. On the webhook details page, find **"Signing secret"**
2. Click **"Reveal"** to show the secret
3. Copy the value (starts with `whsec_`)
4. Add to environment variables:

**Development** (`frontend/.env.local`):
```bash
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

**Production** (Coolify):
```bash
# Add via Coolify dashboard at http://10.100.0.1:8000
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

---

## How the Webhook Works

### Flow Diagram

```
User clicks "Donate" with Stripe
        ↓
POST /api/donations/stripe
        ↓
Creates donation record (status: pending)
Creates Stripe Checkout Session
        ↓
User redirected to Stripe Checkout
        ↓
User completes payment
        ↓
Stripe sends webhook → POST /api/donations/stripe/webhook
        ↓
Webhook handler verifies signature
Updates donation (status: completed)
        ↓
User redirected to /donate/success
```

### Webhook Handler Implementation

**File**: `frontend/src/app/api/donations/stripe/webhook/route.ts`

**Security Features**:
- ✅ Signature verification using `STRIPE_WEBHOOK_SECRET`
- ✅ Raw body parsing for signature validation
- ✅ Constant-time comparison (via Stripe SDK)
- ✅ No CSRF protection (external webhook)

**Events Handled**:
```typescript
switch (event.type) {
  case 'checkout.session.completed':
    // Update donation status to "completed"
    await donationService.updatePaymentStatus(
      session.id,
      'completed',
      metadata
    );
    break;

  case 'checkout.session.expired':
    // Update donation status to "failed"
    await donationService.updatePaymentStatus(
      session.id,
      'failed',
      { reason: 'Session expired' }
    );
    break;

  default:
    // Log unhandled events (no action)
    logger.info('Unhandled event type:', event.type);
}
```

---

## Testing the Webhook

### Option 1: Stripe CLI (Recommended for Development)

**Install Stripe CLI**:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz
tar -xvf stripe_1.19.4_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/

# Verify installation
stripe --version
```

**Login to Stripe**:
```bash
stripe login
```

**Forward Webhooks to Localhost**:
```bash
# Start local dev server first
cd frontend
npm run dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/donations/stripe/webhook
```

**Output**:
```
> Ready! Your webhook signing secret is whsec_XXX (^C to quit)
```

**Copy the signing secret** to `frontend/.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_XXX
```

**Trigger Test Event**:
```bash
stripe trigger checkout.session.completed
```

**Expected Output**:
```
✔ Webhook received: checkout.session.completed
✔ Successfully sent to http://localhost:3000/api/donations/stripe/webhook
```

**Check Logs**:
```bash
# In your Next.js terminal
[Stripe Webhook] Event received: checkout.session.completed
[Stripe Webhook] Donation marked as completed: {...}
```

### Option 2: Manual Testing with cURL

**⚠️ This will fail signature verification** - only for structure testing:

```bash
curl -X POST http://localhost:3000/api/donations/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: whsec_test" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_123",
        "payment_status": "paid",
        "amount_total": 500,
        "currency": "usd"
      }
    }
  }'
```

**Expected**: `401 Unauthorized` (signature verification fails - this is correct!)

### Option 3: End-to-End Test (Production)

1. Visit: https://www.veritablegames.com/donate
2. Select Stripe payment method
3. Enter test amount (e.g., $5.00)
4. Click "Donate"
5. Complete checkout with test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
6. Webhook should fire automatically
7. Check donation status in database:

```sql
SELECT
  id,
  amount,
  payment_status,
  payment_id,
  created_at,
  completed_at
FROM donations
WHERE payment_processor = 'stripe'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**: `payment_status = 'completed'` and `completed_at` is set

---

## Troubleshooting

### Issue: Webhook Returns 401 "Invalid signature"

**Cause**: `STRIPE_WEBHOOK_SECRET` doesn't match webhook configuration

**Fix**:
1. Go to Stripe Dashboard → Webhooks
2. Click on your webhook endpoint
3. Click "Reveal" next to Signing secret
4. Copy the value
5. Update `STRIPE_WEBHOOK_SECRET` in `.env.local` or Coolify
6. Restart server

### Issue: Webhook Returns 500 "STRIPE_WEBHOOK_SECRET not configured"

**Cause**: Environment variable not set

**Fix (Development)**:
```bash
# Add to frontend/.env.local
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE

# Restart dev server
npm run dev
```

**Fix (Production)**:
```bash
# Add via Coolify UI or SSH
ssh user@10.100.0.1
docker exec m4s0kwo4kc4oooocck4sswc4 env | grep STRIPE

# If missing, add via Coolify dashboard and redeploy
```

### Issue: Webhook Never Fires

**Check**:
1. Webhook is enabled in Stripe dashboard
2. Webhook URL is correct (check for typos)
3. Endpoint is listening (try accessing it in browser - should return 405 Method Not Allowed for GET)
4. Stripe is sending webhooks (check Stripe Dashboard → Webhooks → View logs)

**Test Webhook Endpoint**:
```bash
curl -X GET https://www.veritablegames.com/api/donations/stripe/webhook
```

**Expected**: `405 Method Not Allowed` (endpoint exists but only accepts POST)

### Issue: Donation Status Not Updating

**Check**:
1. Webhook signature verified (check logs)
2. Donation exists with matching `payment_intent_id = session.id`
3. `donationService.updatePaymentStatus()` is being called (check logs)
4. Database connection is working

**Debug Query**:
```sql
-- Find donation by Stripe session ID
SELECT * FROM donations
WHERE payment_intent_id = 'cs_test_YOUR_SESSION_ID';
```

---

## Webhook Signature Verification Details

### How It Works

Stripe signs each webhook with your webhook secret using HMAC-SHA256:

```typescript
// Stripe sends header:
stripe-signature: t=1614556800,v1=abc123...,v0=def456...

// Server verifies:
const event = stripe.webhooks.constructEvent(
  rawBody,      // Raw request body (must be string, not parsed JSON)
  signature,    // stripe-signature header value
  webhookSecret // Your STRIPE_WEBHOOK_SECRET
);
```

### Why Signature Verification Matters

**Without verification**: Anyone could send fake webhooks to update donation statuses
**With verification**: Only Stripe can send valid webhooks (secret is not public)

---

## Environment Variables Checklist

### Development (`frontend/.env.local`)

```bash
# Stripe API Keys (test mode)
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_PUBLISHABLE_KEY

# Stripe Webhook Secret (from dashboard or Stripe CLI)
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Base URL for redirects
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Production (Coolify Environment Variables)

```bash
# Stripe API Keys (live mode - DO NOT USE TEST KEYS)
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY

# Stripe Webhook Secret (from production webhook)
STRIPE_WEBHOOK_SECRET=whsec_YOUR_PRODUCTION_WEBHOOK_SECRET

# Base URL
NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
```

---

## Files Modified/Created

### New Files
- ✅ `frontend/src/app/api/donations/stripe/webhook/route.ts` - Webhook handler

### Documentation
- ✅ `docs/features/STRIPE_WEBHOOK_SETUP_GUIDE.md` - This file

---

## Next Steps

1. **Configure Webhook in Stripe Dashboard** (5 minutes)
   - Go to https://dashboard.stripe.com/test/webhooks
   - Add endpoint with URL: `http://localhost:3000/api/donations/stripe/webhook`
   - Select events: `checkout.session.completed`, `checkout.session.expired`
   - Copy signing secret

2. **Add Webhook Secret to Environment** (1 minute)
   - Add `STRIPE_WEBHOOK_SECRET` to `frontend/.env.local`
   - Restart dev server

3. **Test Locally with Stripe CLI** (10 minutes)
   - Install Stripe CLI
   - Run `stripe listen --forward-to localhost:3000/api/donations/stripe/webhook`
   - Trigger test event: `stripe trigger checkout.session.completed`
   - Verify donation updates in database

4. **Deploy to Production** (5 minutes)
   - Add production webhook in Stripe dashboard
   - Add `STRIPE_WEBHOOK_SECRET` to Coolify
   - Redeploy application
   - Test with real payment

---

## References

- **Stripe Webhooks Documentation**: https://docs.stripe.com/webhooks
- **Stripe CLI**: https://docs.stripe.com/stripe-cli
- **Event Types**: https://docs.stripe.com/api/events/types
- **Testing Webhooks**: https://docs.stripe.com/webhooks/test

---

**Last Updated**: February 15, 2026
**Status**: ✅ Webhook handler implemented - Ready for configuration and testing
