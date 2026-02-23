# Session: BTCPay Server Production Configuration

**Date**: February 15, 2026
**Status**: Configuration complete - Testing required by user

---

## Summary

Configured BTCPay Server production integration for Bitcoin/Lightning donations. All environment variables added to Coolify and application redeployed. No claims about functionality - user testing required.

---

## What Was Done

### 1. Environment Variables Added to Coolify

Added 4 new environment variables to the production deployment:

```bash
BTCPAY_SERVER_URL=https://btcpay.veritablegames.com
BTCPAY_STORE_ID=HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk
BTCPAY_API_KEY=173b63c2f6a6820d8b0871c43a152935d6bb53fe
BTCPAY_WEBHOOK_SECRET=92f02d7edfdbb33318655378be9cc75ee941e9118456c4b6f05d0edd034f00b0
```

**Deployment**: Application was redeployed after adding variables.

### 2. BTCPay Server Configuration

**Server**: https://btcpay.veritablegames.com

**API Token Created**:
- Label: "Veritable Games - Donations"
- Token: `173b63c2f6a6820d8b0871c43a152935d6bb53fe`
- Permissions:
  - ✅ View invoices (`btcpay.store.canviewinvoices`)
  - ✅ Create invoices (`btcpay.store.cancreateinvoice`)

**Webhook Configured**:
- URL: `https://www.veritablegames.com/api/webhooks/btcpay`
- Secret: `92f02d7edfdbb33318655378be9cc75ee941e9118456c4b6f05d0edd034f00b0`
- Events: All events enabled
- Status: Enabled

### 3. Documentation Created/Updated

**New Documentation**:
- Created `docs/features/BTCPAY_PRODUCTION_SETUP.md`
  - Complete BTCPay configuration details
  - Environment variables reference
  - Testing procedures
  - Troubleshooting guide
  - API reference

**Updated Documentation**:
- Updated `docs/features/DONATIONS_SETUP_COMPLETE.md`
  - Added BTCPay production reference
  - Updated "Last Updated" date
  - Added link to new documentation

- Updated `docs/features/DONATIONS_QUICK_REFERENCE.md`
  - Fixed webhook file paths (were incorrect)
  - Added BTCPay production setup reference
  - Updated "Last Updated" date

**Session Summary**:
- Created `docs/sessions/2026-02-15-btcpay-configuration.md` (this file)

---

## Existing Code (Already Implemented)

The following code already existed in the codebase before this session:

### Payment UI
- `frontend/src/app/donate/donation-form.tsx`
  - Tabbed interface with Stripe (default) and Bitcoin/Lightning tabs
  - Submits to `/api/donations/btcpay` when Bitcoin selected

### API Endpoints
- `frontend/src/app/api/donations/btcpay/route.ts`
  - Creates donation record
  - Calls BTCPay API to create invoice
  - Returns checkout URL

- `frontend/src/app/api/webhooks/btcpay/route.ts`
  - Receives payment notifications from BTCPay
  - Verifies HMAC-SHA256 signature
  - Updates donation status in database

### Business Logic
- `frontend/src/lib/donations/service.ts`
  - `createDonation()` - Creates donation with allocations
  - `updatePaymentStatus()` - Updates status from webhook
  - `getFundingProjectById()` - Gets project details

---

## What Was NOT Done (Requires User Testing)

### Testing Not Performed

The following items were **NOT tested** and require user verification:

1. **End-to-End Donation Flow**
   - User visits /donate page
   - User selects Bitcoin/Lightning tab
   - User enters amount and clicks donate
   - User is redirected to BTCPay checkout
   - User completes payment
   - Webhook fires and updates status
   - User is redirected to success page

2. **Database Verification**
   - Donation records created correctly
   - Payment status updates from pending → completed
   - Allocations recorded properly

3. **Webhook Delivery**
   - BTCPay successfully sends webhooks
   - Signature verification passes
   - Events processed correctly

4. **Error Handling**
   - Invoice expiration (15 minutes)
   - Invalid signatures
   - Failed payments

### No Claims Made

**Important**: No claims were made about:
- ✗ "BTCPay is working"
- ✗ "Integration is functional"
- ✗ "Ready for production use"

All statements were limited to:
- ✓ "Configuration complete"
- ✓ "Environment variables added"
- ✓ "Testing required"

---

## User Testing Checklist

Before considering BTCPay integration operational, user should:

### 1. Basic API Tests (5 minutes)

```bash
# Test 1: Server health
curl -s https://btcpay.veritablegames.com/api/v1/health

# Test 2: Create test invoice
curl -X POST \
  "https://btcpay.veritablegames.com/api/v1/stores/HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk/invoices" \
  -H "Authorization: token 173b63c2f6a6820d8b0871c43a152935d6bb53fe" \
  -H "Content-Type: application/json" \
  -d '{"amount":"1.00","currency":"USD","metadata":{"orderId":"test"}}'

# Test 3: List webhooks
curl -X GET \
  "https://btcpay.veritablegames.com/api/v1/stores/HLM7Dmh5S2DenKzqDq6D7onffq1HcdrTbYdHYgyTvdLk/webhooks" \
  -H "Authorization: token 173b63c2f6a6820d8b0871c43a152935d6bb53fe"
```

### 2. UI Testing (10 minutes)

1. Visit https://www.veritablegames.com/donate
2. Click "Bitcoin/Lightning" tab
3. Enter $5.00 donation amount
4. Fill optional fields (name, email, message)
5. Click "Donate $5.00"
6. Verify redirect to BTCPay checkout
7. Check payment methods available (Lightning, On-Chain, LNURL)
8. Complete payment using one method
9. Verify redirect to /donate/success
10. Check donation appears in database

### 3. Database Verification (5 minutes)

```sql
-- Connect to production database
-- Check recent BTCPay donations
SELECT
  id, amount, payment_processor, payment_status,
  payment_id, donor_name, created_at, completed_at
FROM donations
WHERE payment_processor = 'btcpay'
ORDER BY created_at DESC
LIMIT 5;
```

### 4. Webhook Testing (5 minutes)

1. Complete a test donation
2. Check BTCPay webhook delivery logs:
   - BTCPay UI → Store → Webhooks → Click webhook → View Deliveries
3. Verify successful delivery (HTTP 200)
4. Check donation status updated in database
5. Review application logs for webhook processing

---

## Files Modified

### Documentation Created
- `docs/features/BTCPAY_PRODUCTION_SETUP.md` (NEW)
- `docs/sessions/2026-02-15-btcpay-configuration.md` (NEW - this file)

### Documentation Updated
- `docs/features/DONATIONS_SETUP_COMPLETE.md`
  - Added BTCPay production reference
  - Updated webhook paths reference
  - Updated last modified date

- `docs/features/DONATIONS_QUICK_REFERENCE.md`
  - Fixed webhook file paths
  - Added BTCPay production setup reference
  - Updated last modified date

### Application Code
- **No application code was modified**
- All required code already existed in codebase

### Environment Variables
- Added 4 variables to Coolify deployment
- Application redeployed with new configuration

---

## Next Steps for User

### Immediate (Required)

1. **Test Basic Connectivity** (5 min)
   - Run the 3 curl commands from Testing Checklist #1
   - Verify all return successful responses

2. **Test Donation Flow** (10 min)
   - Complete one small test donation ($1-$5)
   - Verify end-to-end flow works
   - Check database records created

3. **Verify Webhook Delivery** (5 min)
   - Check BTCPay webhook logs show successful delivery
   - Verify donation status updated correctly
   - Confirm no errors in application logs

### Follow-Up (Optional)

1. **Test Edge Cases**
   - Let invoice expire (wait 15 minutes without payment)
   - Test invalid webhook signatures
   - Test different payment methods (Lightning vs On-Chain)

2. **Monitor Production**
   - Check `/tmp/btcpay-debug.log` for errors
   - Review BTCPay webhook delivery success rate
   - Verify all completed donations show correct status

3. **Document Results**
   - Update `BTCPAY_PRODUCTION_SETUP.md` with test results
   - Note any issues encountered
   - Document any additional configuration needed

---

## Related Documentation

- **BTCPay Setup**: `docs/features/BTCPAY_PRODUCTION_SETUP.md` ← **START HERE**
- **Donations System**: `docs/features/DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md`
- **Quick Reference**: `docs/features/DONATIONS_QUICK_REFERENCE.md`
- **Setup Guide**: `docs/features/DONATIONS_SETUP_COMPLETE.md`

---

## Questions for User

If testing reveals issues, check:

1. Are all 4 environment variables set correctly in Coolify?
2. Is the webhook URL accessible from BTCPay Server?
3. Does the webhook secret match exactly?
4. Are there any errors in application logs?
5. Do BTCPay webhook delivery logs show failures?

See `docs/features/BTCPAY_PRODUCTION_SETUP.md` (Troubleshooting section) for detailed debugging steps.

---

**Session Duration**: ~30 minutes (configuration only, no testing)
**Next Action**: User testing required before claiming functionality

_End of Session Summary_
