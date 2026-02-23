# Stripe Payment Testing Guide

Complete guide for testing Stripe payment integration on Veritable Games donation system.

## Table of Contents

- [Test Mode Overview](#test-mode-overview)
- [Test Card Numbers](#test-card-numbers)
- [Testing Payment Flows](#testing-payment-flows)
- [Testing Error Scenarios](#testing-error-scenarios)
- [Webhook Testing](#webhook-testing)
- [Production Checklist](#production-checklist)

---

## Test Mode Overview

Veritable Games uses Stripe in **Test Mode** for development and testing. This means:

- No real money is processed
- You can use special test card numbers
- All transactions are simulated
- Webhooks are sent to test endpoints

**Current Status**: Using Stripe Test API keys
- Publishable Key: `pk_test_51SVgY8JzFK5vZTKE...`
- Secret Key: `sk_test_51SVgY8JzFK5vZTKE...` (server-side only)

---

## Test Card Numbers

Stripe provides special card numbers for testing different scenarios. Use these on the donation checkout page.

### ✅ Successful Payments

**Most Common Test Card** (Use this for basic testing):
```
Card Number: 4242 4242 4242 4242
Expiration:  Any future date (e.g., 12/25)
CVC:         Any 3 digits (e.g., 123)
ZIP:         Any 5 digits (e.g., 12345)
```

**Other Successful Test Cards**:
- **Visa**: `4242 4242 4242 4242`
- **Visa (debit)**: `4000 0566 5566 5556`
- **Mastercard**: `5555 5555 5555 4444`
- **Mastercard (debit)**: `5200 8282 8282 8210`
- **Amex**: `3782 822463 10005`
- **Discover**: `6011 1111 1111 1117`
- **Diners Club**: `3056 9309 0259 04`
- **JCB**: `3566 0020 2036 0505`

### ❌ Declined Payments

**Generic Decline**:
```
Card Number: 4000 0000 0000 0002
Result:      Card declined
```

**Insufficient Funds**:
```
Card Number: 4000 0000 0000 9995
Result:      Insufficient funds
```

**Lost/Stolen Card**:
```
Card Number: 4000 0000 0000 9987
Result:      Card reported lost
```

**Expired Card**:
```
Card Number: 4000 0000 0000 0069
Result:      Expired card
```

**Incorrect CVC**:
```
Card Number: 4000 0000 0000 0127
Result:      Incorrect CVC
```

**Processing Error**:
```
Card Number: 4000 0000 0000 0119
Result:      Processing error
```

---

## Testing Payment Flows

### Test Flow 1: Successful Donation

1. **Navigate to Donation Page**
   - Go to `http://localhost:3000/donate` (or deployed URL)
   - Or click the donation widget in lower-left corner on homepage

2. **Select Stripe Payment Method**
   - Click "Credit/Debit Card" tab (should be selected by default)
   - Verify helper text shows "Minimum $0.50"

3. **Fill Out Donation Form**
   ```
   Amount:        10.00 (or any amount ≥ $0.50)
   Project:       Select any project from dropdown
   Your Name:     Test Donor (optional)
   Your Email:    test@example.com (optional)
   Message:       Testing Stripe integration (optional)
   ```

4. **Submit Payment**
   - Click "Proceed to Stripe Checkout"
   - Wait for redirect to Stripe Checkout page

5. **Complete Checkout**
   - **Email**: test@example.com
   - **Card Number**: 4242 4242 4242 4242
   - **Expiration**: 12/25
   - **CVC**: 123
   - **ZIP**: 12345
   - Click "Pay"

6. **Verify Success**
   - You should be redirected to success page: `/donate/success?session_id=cs_test_...`
   - Check database for donation record:
     ```sql
     SELECT * FROM donations.donations ORDER BY created_at DESC LIMIT 1;
     ```
   - Check Stripe Dashboard (Test Mode): https://dashboard.stripe.com/test/payments

### Test Flow 2: Declined Payment

Follow Test Flow 1, but use a declined card (e.g., `4000 0000 0000 0002`) at step 5.

**Expected Result**:
- Stripe shows error message: "Your card was declined"
- User stays on checkout page
- No donation record created in database

### Test Flow 3: User Cancels Checkout

1. Follow Test Flow 1 steps 1-4
2. On Stripe Checkout page, click the "Back" button or close the tab
3. **Expected Result**:
   - User redirected to `/donate?canceled=true`
   - No donation created

### Test Flow 4: Minimum Amount Validation

1. Navigate to `/donate`
2. Enter amount less than $0.50 (e.g., `0.25`)
3. Click "Proceed to Stripe Checkout"
4. **Expected Result**:
   - Error message: "Amount must be at least $0.50 for Stripe"
   - Stays on donate page

---

## Testing Error Scenarios

### Scenario 1: Network Error During Checkout Creation

**Simulate**: Disconnect internet before clicking "Proceed to Stripe Checkout"

**Expected Result**:
- Error message displayed: "Failed to create donation"
- Button becomes clickable again
- No redirect

### Scenario 2: Missing Environment Variables

**Simulate**: Comment out `STRIPE_SECRET_KEY` in `.env.local`

**Expected Result**:
- Error message: "Stripe not configured"
- Check server logs for: "Stripe configuration missing: STRIPE_SECRET_KEY not set"

### Scenario 3: Invalid Amount

Test these invalid inputs:
- **Negative amount**: `-10`
- **Zero**: `0`
- **Non-numeric**: `abc`
- **Very large**: `999999999`

**Expected Results**:
- HTML5 validation prevents form submission
- Minimum/step validation enforced

---

## Webhook Testing

Stripe webhooks notify your server when payment events occur (e.g., payment succeeded, failed).

### Local Webhook Testing with Stripe CLI

1. **Install Stripe CLI**
   ```bash
   # Download from https://stripe.com/docs/stripe-cli
   # Or on macOS:
   brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe**
   ```bash
   stripe login
   ```

3. **Forward Webhooks to Localhost**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Trigger Test Webhook**
   ```bash
   # In another terminal
   stripe trigger payment_intent.succeeded
   ```

5. **Check Webhook Handler**
   - Monitor server logs for webhook processing
   - Verify donation status updated in database

### Production Webhook Configuration

**Webhook Endpoint**: `https://www.veritablegames.com/api/webhooks/stripe`

**Events to Listen For**:
- `checkout.session.completed` - Payment succeeded
- `checkout.session.async_payment_succeeded` - Async payment succeeded
- `checkout.session.async_payment_failed` - Async payment failed

**Set Up in Stripe Dashboard**:
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "+ Add endpoint"
3. Enter URL: `https://www.veritablegames.com/api/webhooks/stripe`
4. Select events above
5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` env variable

---

## Production Checklist

Before going live with real payments:

### 1. Switch to Live Mode

- [ ] Replace test API keys with live keys in production environment
  ```bash
  # Production .env
  STRIPE_SECRET_KEY=sk_live_...  # NOT sk_test_...
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # NOT pk_test_...
  ```

- [ ] Verify API mode in Stripe Dashboard (top-left corner shows "LIVE")

### 2. Configure Live Webhooks

- [ ] Add production webhook endpoint in Live mode
- [ ] Update `STRIPE_WEBHOOK_SECRET` with live signing secret
- [ ] Test webhook delivery with real checkout

### 3. Legal & Compliance

- [ ] Add Terms of Service link to checkout
- [ ] Add Privacy Policy link
- [ ] Add Refund Policy (if applicable)
- [ ] Verify currency and region settings

### 4. Testing with Live Mode

**⚠️ WARNING**: Testing in Live mode charges real money!

Use Stripe's "Live mode test" feature:
1. Make a real donation with a real card
2. Immediately issue a full refund in Stripe Dashboard
3. Verify end-to-end flow works

### 5. Monitoring & Alerts

- [ ] Set up Stripe Dashboard email alerts for:
  - Failed payments
  - Disputes/chargebacks
  - Webhook failures
- [ ] Monitor server logs for Stripe API errors
- [ ] Set up error tracking (e.g., Sentry) for production

---

## Common Issues & Solutions

### Issue: "No checkout URL returned"

**Cause**: Stripe Checkout Session creation failed
**Solution**:
- Check server logs for Stripe API errors
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check network connectivity

### Issue: "Stripe not configured"

**Cause**: Missing `STRIPE_SECRET_KEY` environment variable
**Solution**:
- Verify `.env.local` (localhost) or Coolify env vars (production) contain key
- Restart server after adding env var

### Issue: Webhook Not Received

**Cause**: Webhook endpoint not reachable or signing secret mismatch
**Solution**:
- For localhost: Use Stripe CLI forwarding
- For production: Verify webhook URL is publicly accessible
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard value
- Check webhook logs in Stripe Dashboard for delivery failures

### Issue: Amount Too Low Error

**Cause**: Stripe requires minimum $0.50 for card payments
**Solution**:
- Client-side validation enforces $0.50 minimum
- Inform users: "Minimum donation amount is $0.50"
- Suggest BTCPay for smaller amounts (minimum $0.01)

---

## Quick Test Checklist

Use this for rapid testing:

```
[ ] Navigate to /donate
[ ] Select Stripe tab
[ ] Enter $10.00 amount
[ ] Select a project
[ ] Click "Proceed to Stripe Checkout"
[ ] Use test card: 4242 4242 4242 4242
[ ] Exp: 12/25, CVC: 123, ZIP: 12345
[ ] Complete payment
[ ] Verify redirect to success page
[ ] Check donation in database
[ ] Check payment in Stripe Dashboard (Test mode)
```

---

## Resources

- **Stripe Testing Docs**: https://stripe.com/docs/testing
- **Stripe Dashboard (Test)**: https://dashboard.stripe.com/test/dashboard
- **Stripe API Reference**: https://stripe.com/docs/api
- **Stripe CLI Docs**: https://stripe.com/docs/stripe-cli
- **Test Card Numbers**: https://stripe.com/docs/testing#cards

---

**Last Updated**: November 20, 2025
**Stripe API Version**: 2025-11-17.clover
**Integration Status**: ✅ Test Mode Active
