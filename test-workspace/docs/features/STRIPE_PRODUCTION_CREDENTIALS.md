# Stripe Production Credentials

**Date**: February 15, 2026
**Status**: ✅ Test credentials configured for development

---

## Test/Development Credentials

**API Keys** (from Stripe Test Dashboard):
```bash
STRIPE_SECRET_KEY=sk_test_51SVgY8JzFK5vZTKEjdoL5eUeZQgZnS8udgpzZEID1HJF0fAqFqHthXZblbbHFe5z1HPRaTSwCpgvgUpQSMrTJzng002ZCAkmSw
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SVgY8JzFK5vZTKEUsX4vogmY0Jehi4vtMDbheSUmsQLs1hZl5nFekZyZQxfnboQKuGPejE7n7MYzfDDaS7swItW00AygZPvzH
```

**Webhook Configuration**:
- **Endpoint URL**: `https://www.veritablegames.com/api/donations/stripe/webhook`
- **Events Subscribed**:
  - `checkout.session.completed`
  - `checkout.session.expired`
- **Webhook Signing Secret**: `whsec_NmJFHxYFkVXJ4oFWKUVGZmzlGEcgwSI3`
- **Configured**: February 15, 2026

---

## Environment Variables (Development)

**Location**: `frontend/.env.local`

```bash
# Stripe Configuration (Test Mode)
STRIPE_SECRET_KEY=sk_test_51SVgY8JzFK5vZTKEjdoL5eUeZQgZnS8udgpzZEID1HJF0fAqFqHthXZblbbHFe5z1HPRaTSwCpgvgUpQSMrTJzng002ZCAkmSw
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SVgY8JzFK5vZTKEUsX4vogmY0Jehi4vtMDbheSUmsQLs1hZl5nFekZyZQxfnboQKuGPejE7n7MYzfDDaS7swItW00AygZPvzH
STRIPE_WEBHOOK_SECRET=whsec_NmJFHxYFkVXJ4oFWKUVGZmzlGEcgwSI3
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## Environment Variables (Production - Coolify)

**⚠️ ACTION REQUIRED**: Add these to Coolify when ready for production:

```bash
# Stripe Configuration (Live Mode - REPLACE WITH LIVE KEYS)
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_PRODUCTION_WEBHOOK_SECRET_HERE
NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
```

**How to Apply**:
1. Open Coolify dashboard at http://10.100.0.1:8000
2. Navigate to application → Environment Variables
3. Add/update the 4 variables above with **live mode** credentials
4. Click "Redeploy" to apply changes
5. Verify with: `ssh user@10.100.0.1 "docker exec m4s0kwo4kc4oooocck4sswc4 env | grep STRIPE"`

---

## Test vs Live Mode

### Test Mode (Current - Development)
- **Keys start with**: `sk_test_...` and `pk_test_...`
- **Webhook secret**: `whsec_...` (from test dashboard)
- **Test credit card**: 4242 4242 4242 4242
- **No real money processed**
- **Dashboard**: https://dashboard.stripe.com/test/

### Live Mode (Future - Production)
- **Keys start with**: `sk_live_...` and `pk_live_...`
- **Webhook secret**: Different secret from live dashboard
- **Real credit cards**: Actual customer cards
- **Real money processed**: Charges go through
- **Dashboard**: https://dashboard.stripe.com/

⚠️ **IMPORTANT**: Never use test keys in production or live keys in development!

---

## Webhook Details

### Development Webhook
- **URL**: `http://localhost:3000/api/donations/stripe/webhook`
- **Secret**: `whsec_NmJFHxYFkVXJ4oFWKUVGZmzlGEcgwSI3`
- **Events**: `checkout.session.completed`, `checkout.session.expired`
- **Testing**: Use Stripe CLI or trigger test events

### Production Webhook (To Be Created)
- **URL**: `https://www.veritablegames.com/api/donations/stripe/webhook`
- **Secret**: ⏳ To be obtained when creating production webhook
- **Events**: Same 2 events
- **Testing**: Use Stripe test mode first, then switch to live

---

## Security Notes

### ✅ Safe to Commit
- `.env.example` - Template with placeholder values
- Documentation files - No real secrets

### ❌ Never Commit
- `.env.local` - Contains real API keys and secrets
- Production environment variables - Only in Coolify

### 🔒 Secret Storage
- **Development**: `frontend/.env.local` (gitignored)
- **Production**: Coolify environment variables (encrypted)
- **Backup**: This documentation file (gitignored or private repo only)

---

## Quick Reference

| Environment | Dashboard | Webhook URL | Status |
|-------------|-----------|-------------|--------|
| **Development** | [Test Dashboard](https://dashboard.stripe.com/test/) | `http://localhost:3000/api/donations/stripe/webhook` | ✅ Configured |
| **Production** | [Live Dashboard](https://dashboard.stripe.com/) | `https://www.veritablegames.com/api/donations/stripe/webhook` | ⏳ Not yet configured |

---

## Testing Checklist

### Development Testing ✅
- [x] Webhook created in Stripe test dashboard
- [x] Webhook secret added to `.env.local`
- [x] Events selected: `checkout.session.completed`, `checkout.session.expired`
- [ ] Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/donations/stripe/webhook`
- [ ] Trigger test event: `stripe trigger checkout.session.completed`
- [ ] Verify donation updates in database

### Production Testing ⏳
- [ ] Switch to live mode in Stripe dashboard
- [ ] Create production webhook endpoint
- [ ] Add production webhook secret to Coolify
- [ ] Test with real payment (small amount first)
- [ ] Verify webhook fires and donation completes
- [ ] Monitor for 24 hours for any issues

---

## Troubleshooting

See `docs/features/STRIPE_WEBHOOK_SETUP_GUIDE.md` for detailed troubleshooting.

**Quick Checks**:
```bash
# Verify webhook secret is set
echo $STRIPE_WEBHOOK_SECRET

# Test webhook endpoint (should return 405 for GET)
curl https://www.veritablegames.com/api/donations/stripe/webhook

# Check Stripe webhook delivery logs
# Go to: https://dashboard.stripe.com/test/webhooks → Select your webhook → View logs
```

---

## Related Documentation

- **Setup Guide**: `docs/features/STRIPE_WEBHOOK_SETUP_GUIDE.md`
- **Donations Architecture**: `docs/features/DONATIONS_SYSTEM_COMPLETE_ARCHITECTURE.md`
- **BTCPay Credentials**: `docs/features/BTCPAY_PRODUCTION_SETUP.md`

---

**Last Updated**: February 15, 2026
**Status**: ✅ Development configured - Production pending
