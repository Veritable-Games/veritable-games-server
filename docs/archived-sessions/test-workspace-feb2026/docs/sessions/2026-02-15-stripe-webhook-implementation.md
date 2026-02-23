# Stripe Webhook Implementation - Session Summary

**Date**: February 15, 2026
**Duration**: ~30 minutes
**Status**: ✅ Complete - Ready for configuration

---

## What Was Done

### 1. User Question Answered ✅

**User's Question**: "There's like 50+ event types in Stripe. Which ones do I need?"

**Answer**: Only 2 events needed:
- ✅ `checkout.session.completed` - REQUIRED (payment successful)
- ✅ `checkout.session.expired` - RECOMMENDED (payment abandoned)

### 2. Webhook Handler Implemented ✅

**File Created**: `frontend/src/app/api/donations/stripe/webhook/route.ts`

**Features**:
- Signature verification using `STRIPE_WEBHOOK_SECRET`
- Handles `checkout.session.completed` → updates donation to `completed`
- Handles `checkout.session.expired` → updates donation to `failed`
- Proper error handling and logging
- Security: No CSRF protection (external webhook)

**Type Check**: ✅ Passes with 0 errors

### 3. Documentation Created ✅

**New File**: `docs/features/STRIPE_WEBHOOK_SETUP_GUIDE.md`

**Contents**:
- Step-by-step webhook configuration
- Which events to select (and which to ignore)
- Testing guide with Stripe CLI
- Troubleshooting common issues
- Security details (signature verification)

**Updated File**: `docs/features/DONATIONS_SETUP_COMPLETE.md`
- Added webhook status (implemented)
- Linked to detailed guide
- Clarified event selection

---

## What User Needs to Do Next

### Step 1: Configure Webhook in Stripe Dashboard (5 minutes)

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter URL: `http://localhost:3000/api/donations/stripe/webhook` (dev)
4. Select ONLY these 2 events:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Click "Add endpoint"
6. Copy the signing secret (starts with `whsec_`)

### Step 2: Add Secret to Environment (1 minute)

Add to `frontend/.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

Restart dev server:
```bash
npm run dev
```

### Step 3: Test Locally (Optional - 10 minutes)

Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe  # macOS
```

Forward webhooks:
```bash
stripe listen --forward-to localhost:3000/api/donations/stripe/webhook
```

Trigger test event:
```bash
stripe trigger checkout.session.completed
```

---

## Technical Details

### Webhook Flow

```
User completes Stripe Checkout
        ↓
Stripe sends POST to /api/donations/stripe/webhook
        ↓
Webhook verifies signature
        ↓
Updates donation: pending → completed
        ↓
Returns 200 OK to Stripe
```

### Security

**Signature Verification**:
```typescript
const event = stripe.webhooks.constructEvent(
  rawBody,      // Raw request body (string)
  signature,    // stripe-signature header
  webhookSecret // STRIPE_WEBHOOK_SECRET env var
);
```

**Why**: Prevents unauthorized webhook calls from updating donation statuses

### Event Handling

```typescript
switch (event.type) {
  case 'checkout.session.completed':
    // Update donation to "completed"
    await donationService.updatePaymentStatus(
      session.id,
      'completed',
      metadata
    );
    break;

  case 'checkout.session.expired':
    // Update donation to "failed"
    await donationService.updatePaymentStatus(
      session.id,
      'failed',
      { reason: 'Session expired' }
    );
    break;

  default:
    // Log unhandled events (no action)
    logger.info('Unhandled event:', event.type);
}
```

---

## Files Modified/Created

### New Files
1. ✅ `frontend/src/app/api/donations/stripe/webhook/route.ts` - Webhook handler
2. ✅ `docs/features/STRIPE_WEBHOOK_SETUP_GUIDE.md` - Setup guide
3. ✅ `docs/sessions/2026-02-15-stripe-webhook-implementation.md` - This file

### Updated Files
1. ✅ `docs/features/DONATIONS_SETUP_COMPLETE.md` - Added webhook status and links

---

## Why Only 2 Events?

**Stripe has 50+ webhook event types** covering:
- Customer management
- Subscriptions
- Invoices
- Refunds
- Disputes
- Payouts
- Connected accounts
- etc.

**For a simple one-time donation system, you only need**:
- `checkout.session.completed` - Payment succeeded
- `checkout.session.expired` - Payment abandoned

**Other events are for**:
- Recurring subscriptions (`customer.subscription.*`)
- Invoicing (`invoice.*`)
- Refunds (`charge.refunded`)
- Disputes (`charge.dispute.*`)
- etc.

Since Veritable Games currently only accepts one-time donations, these 2 events are sufficient.

---

## Next Steps (In Order)

1. ✅ **Webhook handler implemented** - Done
2. ✅ **Documentation created** - Done
3. ⏳ **Configure webhook in Stripe dashboard** - User action required (5 min)
4. ⏳ **Add webhook secret to .env.local** - User action required (1 min)
5. ⏳ **Test locally with Stripe CLI** - Optional but recommended (10 min)
6. ⏳ **Test end-to-end donation flow** - Verify it works (5 min)
7. ⏳ **Deploy to production** - Add webhook for production URL (10 min)

---

## Production Deployment Checklist

When ready for production:

1. Create separate webhook in Stripe dashboard
   - URL: `https://www.veritablegames.com/api/donations/stripe/webhook`
   - Events: Same 2 events
   - Copy production signing secret

2. Add to Coolify environment variables:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_PRODUCTION_SECRET_HERE
   ```

3. Redeploy application

4. Test with real payment using test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits

5. Verify donation updates to `completed` in database

---

## Troubleshooting Reference

See `docs/features/STRIPE_WEBHOOK_SETUP_GUIDE.md` for:
- Common errors and solutions
- Signature verification debugging
- Webhook delivery testing
- Database status verification

---

**Status**: ✅ Implementation complete
**Awaiting**: User webhook configuration in Stripe dashboard
**Estimated Time to Production**: 15-20 minutes (configuration + testing)

---

**Session End**: February 15, 2026
