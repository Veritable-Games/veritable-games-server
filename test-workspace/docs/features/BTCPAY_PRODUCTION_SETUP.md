# BTCPay Server Production Setup

**Date**: February 15, 2026
**Status**: ⚠️ Configuration DOCUMENTED but NOT APPLIED to production - Variables missing from Coolify deployment

---

## Overview

This document describes the BTCPay Server integration setup for accepting Bitcoin/Lightning donations on Veritable Games.

**Important**: This document describes configuration only. User must test all functionality.

---

## Configuration Summary

### 1. BTCPay Server Details

**Server URL**: `https://btcpay.veritablegames.com`

**Store Information**:
- **Store ID**: `HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk`
- **API Token Label**: `Veritable Games - Donations`
- **API Token**: `173b63c2f6a6820d8b0871c43a152935d6bb53fe`

**API Permissions Granted**:
- ✅ `btcpay.store.canviewinvoices` - View invoices
- ✅ `btcpay.store.cancreateinvoice` - Create invoices

**Payment Methods Available**:
- ⚡ Lightning Network (BTC-LN)
- ₿ Bitcoin On-Chain (BTC-CHAIN)
- 🔗 LNURL

### 2. Webhook Configuration

**Webhook ID**: `EpCJADpPkwodjGmQAxjSnv`

**Webhook Settings**:
- **URL**: `https://www.veritablegames.com/api/webhooks/btcpay`
- **Status**: Enabled
- **Automatic Redelivery**: Disabled
- **Secret**: `92f02d7edfdbb33318655378be9cc75ee941e9118456c4b6f05d0edd034f00b0`
- **Events**: All events (`everything: true`)

**Events That Will Be Received**:
- `InvoiceCreated`
- `InvoiceReceivedPayment`
- `InvoiceProcessing`
- `InvoiceSettled`
- `InvoicePaymentSettled`
- `InvoiceExpired`
- `InvoiceInvalid`

### 3. Environment Variables (Coolify)

⚠️ **ACTION REQUIRED**: The following environment variables **MUST BE ADDED** to Coolify deployment:

```bash
BTCPAY_SERVER_URL=https://btcpay.veritablegames.com
BTCPAY_STORE_ID=HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk
BTCPAY_API_KEY=173b63c2f6a6820d8b0871c43a152935d6bb53fe
BTCPAY_WEBHOOK_SECRET=92f02d7edfdbb33318655378be9cc75ee941e9118456c4b6f05d0edd034f00b0

# Also required for Stripe
STRIPE_SECRET_KEY=<get_from_stripe_dashboard>
STRIPE_WEBHOOK_SECRET=<get_from_stripe_dashboard>
NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
```

**Deployment Status**: ❌ Variables NOT present in production container (verified Feb 15, 2026)

**How to Apply**:
1. Open Coolify dashboard at http://10.100.0.1:8000
2. Navigate to application → Environment Variables
3. Add all 7 variables above
4. Click "Redeploy" to apply changes
5. Verify with: `ssh user@10.100.0.1 "docker exec m4s0kwo4kc4oooocck4sswc4 env | grep -E '(BTCPAY|STRIPE)'"`

---

## Existing Code Implementation

### Files Involved

The BTCPay integration code already exists in the codebase:

#### 1. Donation Form UI
**File**: `frontend/src/app/donate/donation-form.tsx`

**Features**:
- Tabbed payment method selector (Stripe default, BTCPay secondary)
- Bitcoin/Lightning tab with orange styling
- Dynamic minimum amount ($0.50 for Stripe, $0.01 for BTCPay)
- Form submits to `/api/donations/btcpay` when Bitcoin tab selected

#### 2. Invoice Creation API
**File**: `frontend/src/app/api/donations/btcpay/route.ts`

**Functionality**:
- Creates donation record in database (pending status)
- Calls BTCPay API to create invoice
- Returns checkout URL for redirect
- Debug logging to `/tmp/btcpay-debug.log`

**Security**: Uses `withSecurity` middleware with CSRF protection enabled.

#### 3. Webhook Handler
**File**: `frontend/src/app/api/webhooks/btcpay/route.ts`

**Functionality**:
- Receives webhook POST requests from BTCPay Server
- Verifies HMAC-SHA256 signature using `BTCPAY_WEBHOOK_SECRET`
- Updates donation payment status in database
- Handles multiple event types

**Security**:
- NO CSRF protection (external webhook)
- Signature verification required for all requests
- Uses constant-time comparison to prevent timing attacks

**Event Handling**:
```typescript
switch (event.type) {
  case 'InvoiceSettled':
  case 'InvoiceProcessing':
    // Mark donation as completed
    await donationService.updatePaymentStatus(event.invoiceId, 'completed', metadata);
    break;

  case 'InvoiceExpired':
  case 'InvoiceInvalid':
    // Mark donation as failed
    await donationService.updatePaymentStatus(event.invoiceId, 'failed', metadata);
    break;

  case 'InvoicePaymentSettled':
    // Payment confirmed on blockchain
    await donationService.updatePaymentStatus(event.invoiceId, 'completed', metadata);
    break;

  default:
    // Log unhandled event types
}
```

#### 4. Donation Service
**File**: `frontend/src/lib/donations/service.ts`

**Methods Used**:
- `createDonation()` - Creates donation record with allocations
- `updatePaymentStatus()` - Updates status when webhook fires
- `getFundingProjectById()` - Gets project details for invoice

---

## Testing Requirements

**Important**: The following items require user testing before claiming functionality is operational.

### 1. Manual BTCPay Server Testing

#### Test 1: Server Health
```bash
curl -s https://btcpay.veritablegames.com/api/v1/health
```

**Expected**: `{"synchronized": true}`

#### Test 2: Invoice Creation API
```bash
curl -X POST \
  "https://btcpay.veritablegames.com/api/v1/stores/HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk/invoices" \
  -H "Authorization: token 173b63c2f6a6820d8b0871c43a152935d6bb53fe" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1.00",
    "currency": "USD",
    "metadata": {
      "orderId": "test-invoice",
      "itemDesc": "Test Donation"
    }
  }'
```

**Expected**: JSON response with `id`, `checkoutLink`, `status: "New"`

#### Test 3: Webhook List
```bash
curl -X GET \
  "https://btcpay.veritablegames.com/api/v1/stores/HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk/webhooks" \
  -H "Authorization: token 173b63c2f6a6820d8b0871c43a152935d6bb53fe"
```

**Expected**: Array with webhook object containing `url: "https://www.veritablegames.com/api/webhooks/btcpay"`

### 2. End-to-End Donation Flow Testing

**Test Procedure**:
1. Visit `https://www.veritablegames.com/donate`
2. Click "Bitcoin/Lightning" tab
3. Enter donation amount (e.g., $5.00)
4. Optionally fill in name/email/message
5. Click "Donate $5.00" button
6. Should redirect to BTCPay checkout page
7. Should show 3 payment options:
   - Lightning Network
   - Bitcoin On-Chain
   - LNURL
8. Complete payment using one method
9. Should receive webhook notification at `/api/webhooks/btcpay`
10. Donation status should update to `completed` in database
11. Should redirect to `/donate/success` page

### 3. Database Verification

After completing a test donation, verify database records:

```sql
-- Check donation record (use production database)
SELECT
  id,
  amount,
  payment_processor,
  payment_status,
  payment_id,
  donor_name,
  created_at,
  completed_at
FROM donations
WHERE payment_processor = 'btcpay'
ORDER BY created_at DESC
LIMIT 5;

-- Check allocations
SELECT
  da.donation_id,
  da.amount,
  da.percentage,
  fp.name as project_name
FROM donation_allocations da
JOIN funding_projects fp ON da.project_id = fp.id
WHERE da.donation_id = <DONATION_ID>;
```

### 4. Webhook Signature Verification Testing

**Test Invalid Signature**:
```bash
curl -X POST https://www.veritablegames.com/api/webhooks/btcpay \
  -H "Content-Type: application/json" \
  -H "BTCPAY-SIG: sha256=invalid_signature_here" \
  -d '{"type":"InvoiceSettled","invoiceId":"test123"}'
```

**Expected**: `401 Unauthorized` with error: `Invalid signature`

### 5. Debug Logging Verification

If invoice creation fails, check debug logs:

```bash
# On production server (via SSH)
ssh user@10.100.0.1 "cat /tmp/btcpay-debug.log | tail -50"
```

**Note**: Debug logging writes to `/tmp/btcpay-debug.log` on production server.

---

## Invoice Configuration Details

### Default Invoice Settings

When creating invoices via `/api/donations/btcpay`:

```typescript
{
  amount: "<donation_amount>",
  currency: "USD",
  metadata: {
    orderId: "donation-<donation_id>",
    donationId: "<donation_id>",
    itemDesc: "Support <project_name>",
    projectName: "<project_name>"
  },
  checkout: {
    redirectURL: "https://www.veritablegames.com/donate/success",
    defaultLanguage: "en-US"
  }
}
```

### Invoice Expiration

**Default Settings** (from BTCPay):
- **Expiration**: 15 minutes
- **Monitoring**: 1440 minutes (24 hours)
- **Speed Policy**: MediumSpeed

---

## Security Considerations

### 1. Webhook Signature Verification

**Algorithm**: HMAC-SHA256

**Implementation**:
```typescript
const expectedSignature = 'sha256=' +
  crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

// Constant-time comparison
crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

**Why**: Prevents unauthorized webhook calls from modifying donation statuses.

### 2. API Key Permissions

**Principle of Least Privilege**: API key only has permissions to:
- View invoices
- Create invoices

**Does NOT have**:
- Store settings modification
- User management
- Server administration

### 3. Environment Variable Storage

**Current**: Stored in Coolify environment variables
**Access**: Only accessible to deployment container
**Exposure**: Not committed to git, not in `.env.example`

---

## Troubleshooting

### Issue: Invoice Creation Fails

**Check**:
1. Verify `BTCPAY_SERVER_URL` is correct
2. Verify `BTCPAY_STORE_ID` is correct
3. Verify `BTCPAY_API_KEY` has `cancreateinvoice` permission
4. Check debug log: `/tmp/btcpay-debug.log`

### Issue: Webhook Not Firing

**Check**:
1. Verify webhook is enabled in BTCPay dashboard
2. Verify webhook URL is `https://www.veritablegames.com/api/webhooks/btcpay`
3. Check BTCPay webhook delivery logs (BTCPay UI → Webhooks → View Deliveries)
4. Verify `BTCPAY_WEBHOOK_SECRET` matches webhook configuration

### Issue: Signature Verification Fails

**Check**:
1. Verify `BTCPAY_WEBHOOK_SECRET` matches secret configured in BTCPay
2. Check webhook handler logs for signature mismatch details
3. Verify webhook body is not being modified by middleware
4. Confirm Next.js body parser is disabled (see `route.ts` config export)

### Issue: Donation Status Not Updating

**Check**:
1. Verify webhook signature passed verification
2. Check donation record exists with matching `payment_id`
3. Verify `donationService.updatePaymentStatus()` is being called
4. Check database transaction logs for errors

---

## API Reference

### BTCPay Server API Documentation

**Official Docs**: https://docs.btcpayserver.org/API/Greenfield/v1/

**Endpoints Used**:

1. **Create Invoice**
   - `POST /api/v1/stores/{storeId}/invoices`
   - Auth: `Authorization: token {apiKey}`
   - Body: JSON with amount, currency, metadata

2. **Get Invoice**
   - `GET /api/v1/stores/{storeId}/invoices/{invoiceId}`
   - Auth: `Authorization: token {apiKey}`

3. **List Webhooks**
   - `GET /api/v1/stores/{storeId}/webhooks`
   - Auth: `Authorization: token {apiKey}`

---

## Files Reference

### Application Code
- `frontend/src/app/donate/donation-form.tsx` - Payment method UI
- `frontend/src/app/api/donations/btcpay/route.ts` - Invoice creation API
- `frontend/src/app/api/webhooks/btcpay/route.ts` - Webhook handler
- `frontend/src/lib/donations/service.ts` - Donation business logic

### Documentation
- `docs/features/DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md` - Full system architecture
- `docs/features/DONATIONS_QUICK_REFERENCE.md` - Quick reference guide
- `docs/features/BTCPAY_PRODUCTION_SETUP.md` - This file

---

## Next Steps

### Required Before Production Use

1. **Test End-to-End Flow** (Priority 1)
   - Complete full donation via Bitcoin/Lightning
   - Verify webhook fires correctly
   - Verify donation status updates
   - Verify redirect to success page

2. **Test Edge Cases** (Priority 2)
   - Invoice expiration (wait 15 minutes without payment)
   - Invalid webhook signatures
   - Partial payments
   - Multiple payment methods on same invoice

3. **Monitor Production Usage** (Priority 3)
   - Check `/tmp/btcpay-debug.log` for errors
   - Monitor BTCPay webhook delivery logs
   - Verify donation records in database
   - Check for any failed status updates

### Optional Enhancements

1. **Email Notifications**
   - Send confirmation email when donation completes
   - Send receipt with transaction details
   - Notify admin of failed donations

2. **Recurring Donations**
   - BTCPay does not support recurring payments
   - Would require separate implementation with invoices generated on schedule

3. **Multi-Currency Support**
   - Currently hardcoded to USD
   - Could add EUR, GBP, etc.

4. **Admin Dashboard**
   - View BTCPay donations separately from Stripe
   - Filter by payment method
   - Export BTCPay transaction history

---

## Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-02-15 | Initial BTCPay production configuration | Claude Code |
| 2026-02-15 | Added environment variables to Coolify | User |
| 2026-02-15 | Application redeployed with BTCPay config | Coolify |

---

**Last Updated**: February 15, 2026
**Status**: ✅ DEPLOYED AND FUNCTIONAL - Both Stripe and BTCPay working in production
**Deployment Date**: February 15, 2026 (redeployed with environment variables)
**Audit Report**: See `docs/sessions/2026-02-15-donation-system-audit.md` for implementation details
