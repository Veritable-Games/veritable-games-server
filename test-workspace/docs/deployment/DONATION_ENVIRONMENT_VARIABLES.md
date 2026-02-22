# Donation System Environment Variables

**Status**: ⚠️ **REQUIRED FOR DONATIONS TO WORK**
**Last Updated**: November 22, 2025

---

## Overview

The donation system requires environment variables for BTCPay Server and Stripe integration. Without these, the API routes will return **500 errors**.

---

## Required Environment Variables

### BTCPay Server (Bitcoin/Lightning Payments)

```bash
BTCPAY_SERVER_URL="https://your-btcpay-server.com"
BTCPAY_STORE_ID="your-store-id-here"
BTCPAY_API_KEY="your-api-key-here"
```

**How to get these values**:
1. Log into your BTCPay Server instance
2. Go to **Store Settings** → **Access Tokens**
3. Create a new API key with permissions: `btcpay.store.cancreateinvoice`
4. Copy the Store ID from the URL or store settings
5. Copy the API key

### Stripe (Credit/Debit Card Payments)

```bash
STRIPE_SECRET_KEY="sk_live_..." # or sk_test_... for testing
```

**How to get this value**:
1. Log into [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to **Developers** → **API keys**
3. Copy the **Secret key** (starts with `sk_`)
4. ⚠️ **NEVER expose this publicly - server-side only**

### Base URL

```bash
NEXT_PUBLIC_BASE_URL="https://www.veritablegames.com"
```

**Used for**:
- Donation success/cancel redirect URLs
- Invoice metadata

---

## Setting Environment Variables in Coolify

### Option 1: Coolify CLI (Recommended)

```bash
# SSH into server
ssh user@192.168.1.15

# Set BTCPay variables
coolify app env set m4s0kwo4kc4oooocck4sswc4 BTCPAY_SERVER_URL="https://your-btcpay.com"
coolify app env set m4s0kwo4kc4oooocck4sswc4 BTCPAY_STORE_ID="your-store-id"
coolify app env set m4s0kwo4kc4oooocck4sswc4 BTCPAY_API_KEY="your-api-key"

# Set Stripe variable
coolify app env set m4s0kwo4kc4oooocck4sswc4 STRIPE_SECRET_KEY="sk_live_..."

# Set base URL
coolify app env set m4s0kwo4kc4oooocck4sswc4 NEXT_PUBLIC_BASE_URL="https://www.veritablegames.com"

# Redeploy to apply changes
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

### Option 2: Coolify Web UI

1. Go to Coolify dashboard
2. Navigate to your application (m4s0kwo4kc4oooocck4sswc4)
3. Click **Environment Variables**
4. Add each variable:
   - Key: `BTCPAY_SERVER_URL`
   - Value: `https://your-btcpay.com`
   - Click **Save**
5. Repeat for all variables
6. Click **Deploy** to restart with new env vars

---

## Testing Environment Variables

### Check if Variables are Set

```bash
# SSH into server
ssh user@192.168.1.15

# List all env vars for the app
coolify app env list m4s0kwo4kc4oooocck4sswc4

# Check specific variables
coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep -E '(BTCPAY|STRIPE|BASE_URL)'
```

### Test BTCPay Integration

1. Go to `/donate` on the site
2. Select Bitcoin/Lightning payment method
3. Click "Proceed to Bitcoin Payment"
4. You should be redirected to BTCPay invoice page
5. **If you get a 500 error**: Check server logs

### Test Stripe Integration

1. Go to `/donate` on the site
2. Select Credit/Debit Card payment method
3. Click "Proceed to Stripe Checkout"
4. You should be redirected to Stripe checkout page
5. **If you get a 500 error**: Check server logs

---

## Error Messages

### "BTCPay Server not configured"

**Cause**: Missing one or more BTCPay environment variables

**Fix**:
```bash
coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep BTCPAY
```
If empty, set all three BTCPay variables and redeploy.

### "Stripe not configured"

**Cause**: Missing `STRIPE_SECRET_KEY`

**Fix**:
```bash
coolify app env set m4s0kwo4kc4oooocck4sswc4 STRIPE_SECRET_KEY="sk_..."
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

### "Server misconfigured"

**Cause**: Missing `NEXT_PUBLIC_BASE_URL`

**Fix**:
```bash
coolify app env set m4s0kwo4kc4oooocck4sswc4 NEXT_PUBLIC_BASE_URL="https://www.veritablegames.com"
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

---

## Server Logs

### View Real-Time Logs

```bash
# Via Docker
docker logs -f m4s0kwo4kc4oooocck4sswc4

# Via Coolify CLI
coolify app logs m4s0kwo4kc4oooocck4sswc4 --follow

# Search for donation errors
docker logs m4s0kwo4kc4oooocck4sswc4 2>&1 | grep -i "btcpay\|stripe\|donation"
```

### BTCPay Debug Logs

BTCPay API writes debug logs to `/tmp/btcpay-debug.log` inside the container:

```bash
docker exec m4s0kwo4kc4oooocck4sswc4 cat /tmp/btcpay-debug.log
```

---

## Security Notes

⚠️ **IMPORTANT**:
- **NEVER commit** API keys or secrets to git
- **NEVER expose** `STRIPE_SECRET_KEY` in client-side code
- **NEVER expose** `BTCPAY_API_KEY` in client-side code
- Only `NEXT_PUBLIC_*` variables are safe to expose to the browser

**Safe for browser**:
- ✅ `NEXT_PUBLIC_BASE_URL`

**MUST remain server-side**:
- ❌ `STRIPE_SECRET_KEY`
- ❌ `BTCPAY_API_KEY`
- ❌ `BTCPAY_SERVER_URL` (can be exposed but best to keep private)
- ❌ `BTCPAY_STORE_ID` (can be exposed but best to keep private)

---

## Related Documentation

- [Coolify Environment Variables Guide](./COOLIFY_ENVIRONMENT_VARIABLES.md)
- [BTCPay Server Integration](../features/donations/BTCPAY_INTEGRATION.md)
- [Stripe Integration](../features/donations/STRIPE_INTEGRATION.md)
- [Donation System Architecture](../features/donations/ARCHITECTURE.md)

---

## Quick Checklist

Before donations can work in production:

- [ ] BTCPay Server is configured and accessible
- [ ] BTCPay API key created with `btcpay.store.cancreateinvoice` permission
- [ ] Stripe account is set up and verified
- [ ] All environment variables set in Coolify
- [ ] Application redeployed after setting env vars
- [ ] Test both payment methods on production
- [ ] Webhooks configured (see webhook documentation)

---

**Last Updated**: November 22, 2025
**Updated By**: Claude Code
