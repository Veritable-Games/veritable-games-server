# NEXT_PUBLIC_BASE_URL Restoration Guide

**Date**: February 15, 2026
**Status**: Reference Guide
**Related Incident**: 2026-02-15 Coolify Encryption Error

---

## Executive Summary

`NEXT_PUBLIC_BASE_URL` is a Next.js environment variable that specifies the base URL for the application. It was lost during the Feb 15, 2026 Coolify encryption incident due to database corruption.

**Good News:** The application continued functioning normally because the code has fallback logic.

**Current Status:** ✅ **RESTORED** (Feb 15, 2026 14:55 UTC)

---

## What is NEXT_PUBLIC_BASE_URL?

### Purpose
A Next.js public environment variable that provides the application's base URL for:
- Payment redirect URLs (Stripe, BTCPay)
- Email verification links
- Password reset URLs
- OAuth callback URLs
- Webhook endpoints

### Naming Convention
- Prefix `NEXT_PUBLIC_` means it's exposed to client-side JavaScript
- Available in both browser and server environments
- Injected at build time into the Next.js bundle

### Typical Value
```
https://www.veritablegames.com
```

---

## Code Usage Analysis

### Where It's Used

Found in 6 files across the codebase:

#### 1. BTCPay Donation Redirect
**File:** `frontend/src/app/api/donations/btcpay/route.ts`

```typescript
redirectURL: `${
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.veritablegames.com'
}/donate/success`,
```

**Fallback Chain:**
1. NEXT_PUBLIC_BASE_URL (preferred)
2. NEXT_PUBLIC_SITE_URL (fallback)
3. Hardcoded URL (last resort)

#### 2. Stripe Payment Portal
**File:** `frontend/src/app/api/donations/portal/route.ts`

```typescript
return_url: `${
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.veritablegames.com'
}/donate`,
```

#### 3. Stripe Checkout Session
**File:** `frontend/src/app/api/donations/stripe/route.ts`

```typescript
const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL;

if (!baseUrl) {
  throw new Error(
    'Base URL not configured (neither NEXT_PUBLIC_BASE_URL nor NEXT_PUBLIC_SITE_URL)'
  );
}
```

**Behavior:**
- Requires either NEXT_PUBLIC_BASE_URL or NEXT_PUBLIC_SITE_URL
- Throws error if both are missing
- Used for `success_url` and `cancel_url` in Stripe checkout

#### 4. Donation Management Link
**File:** `frontend/src/app/api/donations/manage-link/route.ts`

```typescript
const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.veritablegames.com';
```

### Why Application Didn't Break

All code locations use **fallback logic**:

```typescript
// Pattern used everywhere:
const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||      // 1st choice (MISSING)
  process.env.NEXT_PUBLIC_SITE_URL ||      // 2nd choice (EXISTS ✓)
  'https://www.veritablegames.com';        // 3rd choice (hardcoded)
```

**Current Environment:**
- ❌ NEXT_PUBLIC_BASE_URL: Missing (until 14:55 UTC Feb 15)
- ✅ NEXT_PUBLIC_SITE_URL: `https://www.veritablegames.com`
- ✅ Hardcoded fallback: `https://www.veritablegames.com`

**Result:** Application uses NEXT_PUBLIC_SITE_URL, everything works correctly.

---

## How It Was Restored

### Method: Codebase Analysis + Inference

**Step 1:** Search for usage in codebase
```bash
cd frontend
grep -r "NEXT_PUBLIC_BASE_URL" --include="*.ts" --include="*.tsx"
```

**Step 2:** Identify fallback values
```typescript
// Found in code:
process.env.NEXT_PUBLIC_SITE_URL || 'https://www.veritablegames.com'
```

**Step 3:** Verify other public URL variables
```bash
ssh user@10.100.0.1 "docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep NEXT_PUBLIC"

# Results:
# NEXT_PUBLIC_APP_URL=https://www.veritablegames.com
# NEXT_PUBLIC_SITE_URL=https://www.veritablegames.com
```

**Step 4:** Infer correct value
Since all public URL variables use `https://www.veritablegames.com`, NEXT_PUBLIC_BASE_URL should match.

**Step 5:** Restore to Coolify
```bash
docker exec coolify php artisan tinker --execute="
use App\Models\EnvironmentVariable;

\$var = new EnvironmentVariable();
\$var->key = 'NEXT_PUBLIC_BASE_URL';
\$var->value = 'https://www.veritablegames.com';
\$var->is_buildtime = true;
\$var->is_runtime = true;
\$var->resourceable_type = 'App\\Models\\Application';
\$var->resourceable_id = 1;
\$var->save();

echo 'Restored: ID ' . \$var->id;
"

# Output: Restored: ID 172
```

---

## How to Restore (If Lost Again)

### Option 1: Via Coolify UI (Recommended)

1. Navigate to Coolify: http://10.100.0.1:8000
2. Go to: Project → Production → veritable-games → Configuration → Environment Variables
3. Click "+ Add"
4. Fill in:
   - **Key:** `NEXT_PUBLIC_BASE_URL`
   - **Value:** `https://www.veritablegames.com`
   - **Available at Buildtime:** ✓ Checked
   - **Available at Runtime:** ✓ Checked
   - **Is Multiline:** ☐ Unchecked
   - **Is Literal:** ☐ Unchecked
5. Click "Save"
6. Redeploy application to apply changes

### Option 2: Via Artisan Tinker (Advanced)

```bash
ssh user@10.100.0.1
docker exec coolify php artisan tinker --execute="
use App\Models\EnvironmentVariable;

\$var = new EnvironmentVariable();
\$var->key = 'NEXT_PUBLIC_BASE_URL';
\$var->value = 'https://www.veritablegames.com';
\$var->is_preview = false;
\$var->is_buildtime = true;
\$var->is_runtime = true;
\$var->is_multiline = false;
\$var->is_literal = false;
\$var->resourceable_type = 'App\\Models\\Application';
\$var->resourceable_id = 1;  // Get from: SELECT id FROM applications WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4'
\$var->save();

echo 'Created: ID ' . \$var->id . PHP_EOL;
"
```

### Option 3: Check Existing Environment

If the application is running, you can check what value it's currently using:

```bash
# SSH to production server
ssh user@10.100.0.1

# Check container environment
docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep "BASE_URL\|SITE_URL\|APP_URL"

# Use any of these values for NEXT_PUBLIC_BASE_URL:
# - NEXT_PUBLIC_SITE_URL
# - NEXT_PUBLIC_APP_URL
# - API_BASE_URL
# They should all be: https://www.veritablegames.com
```

---

## Verification After Restoration

### 1. Check Coolify UI

1. Navigate to: Environment Variables page
2. Verify `NEXT_PUBLIC_BASE_URL` appears in list
3. Verify value: `https://www.veritablegames.com`
4. Verify checkboxes:
   - ✓ Available at Buildtime
   - ✓ Available at Runtime

### 2. Check Application Environment

```bash
# After redeployment, verify variable is loaded
ssh user@10.100.0.1 "docker exec m4s0kwo4kc4oooocck4sswc4 printenv NEXT_PUBLIC_BASE_URL"

# Expected output:
# https://www.veritablegames.com
```

### 3. Test Payment Flows

**Stripe Checkout:**
1. Navigate to: https://www.veritablegames.com/donate
2. Click "Donate via Stripe"
3. Complete checkout (use test card: 4242 4242 4242 4242)
4. Verify redirect to: `https://www.veritablegames.com/donate/success`

**BTCPay:**
1. Navigate to: https://www.veritablegames.com/donate
2. Click "Donate via Bitcoin"
3. Complete payment
4. Verify redirect to: `https://www.veritablegames.com/donate/success`

### 4. Check Server Logs

```bash
# Monitor for any "Base URL not configured" errors
ssh user@10.100.0.1 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep -i 'base url'"

# Should return no errors
```

---

## When Do You Need This Variable?

### Critical Scenarios

✅ **Required for:**
- Stripe payment redirects (success_url, cancel_url)
- BTCPay invoice redirects
- Donation management portal links
- Email verification links (future feature)
- OAuth callbacks (future feature)

✅ **Fallback works for:**
- All current features (uses NEXT_PUBLIC_SITE_URL)
- Payment processing (hardcoded fallback exists)

### When to Restore

**Restore immediately if:**
- Coolify shows HTTP 500 on configuration page
- Payment redirects fail (users stuck on Stripe after payment)
- Error logs show: "Base URL not configured"

**Can defer restoration if:**
- Application is functioning normally
- Payments processing correctly
- No errors in logs
- Other public URL variables exist (NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_APP_URL)

---

## Related Variables

### Similar Public URL Variables

| Variable | Purpose | Current Value | Status |
|----------|---------|---------------|--------|
| **NEXT_PUBLIC_BASE_URL** | Base URL for redirects | `https://www.veritablegames.com` | ✅ Restored |
| **NEXT_PUBLIC_SITE_URL** | Site canonical URL | `https://www.veritablegames.com` | ✅ Active |
| **NEXT_PUBLIC_APP_URL** | Application URL | `https://www.veritablegames.com` | ✅ Active |
| **API_BASE_URL** | API endpoint base | `https://www.veritablegames.com` | ✅ Active |
| **NEXT_PUBLIC_WS_URL** | WebSocket server URL | (not set) | ⚠️ Missing |

### Recommended Configuration

For consistency, all public URL variables should use the same value:

```env
NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
NEXT_PUBLIC_SITE_URL=https://www.veritablegames.com
NEXT_PUBLIC_APP_URL=https://www.veritablegames.com
API_BASE_URL=https://www.veritablegames.com
```

**Why:** Simplifies code, reduces confusion, ensures consistent behavior across features.

---

## Best Practices

### 1. Always Use Fallback Logic

```typescript
// ✅ GOOD: Multiple fallbacks
const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.veritablegames.com';

// ❌ BAD: No fallback
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
```

### 2. Document Variable Purpose

```typescript
// ✅ GOOD: Comment explains purpose
// Base URL for payment redirects and OAuth callbacks
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ...;

// ❌ BAD: No context
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
```

### 3. Validate in Production

Add startup validation:

```typescript
// config/validation.ts
if (!process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn('Warning: No base URL configured. Using hardcoded fallback.');
}
```

### 4. Store in Password Manager

**Recommendation:** Store all environment variables in password manager

**Entry Format:**
```
Title: Veritable Games - NEXT_PUBLIC_BASE_URL
Username: (leave blank)
Password: https://www.veritablegames.com
Notes: Base URL for Next.js application (buildtime + runtime)
```

---

## Troubleshooting

### Issue: Variable Not Appearing After Restore

**Symptom:** Added via Coolify UI but not showing in environment

**Solution:**
1. Verify variable was saved:
   ```bash
   docker exec coolify php artisan tinker --execute="
   use App\Models\EnvironmentVariable;
   \$var = EnvironmentVariable::where('key', 'NEXT_PUBLIC_BASE_URL')->first();
   echo \$var ? 'Found: ' . \$var->value : 'Not found';
   "
   ```

2. Redeploy application:
   - Go to Coolify → Configuration
   - Click "Redeploy" button
   - Wait for deployment to complete

3. Verify in container:
   ```bash
   docker exec m4s0kwo4kc4oooocck4sswc4 printenv NEXT_PUBLIC_BASE_URL
   ```

### Issue: Payment Redirects Still Failing

**Symptom:** Payments succeed but redirect to wrong URL

**Possible Causes:**
1. Application not redeployed after variable restoration
2. Old build cached
3. Stripe/BTCPay webhook has hardcoded URLs

**Solution:**
1. Force rebuild:
   ```bash
   cd /home/user/Projects/veritable-games-main/frontend
   rm -rf .next
   npm run build
   ```

2. Check Stripe webhook configuration:
   - Login to Stripe Dashboard
   - Developers → Webhooks
   - Verify endpoint URL is correct

3. Check BTCPay configuration:
   - Login to BTCPay Server
   - Store Settings → Webhooks
   - Verify callback URL is correct

### Issue: Error "Base URL not configured"

**Symptom:** Application throws error on payment creation

**Root Cause:** Both NEXT_PUBLIC_BASE_URL and NEXT_PUBLIC_SITE_URL are missing

**Solution:**
1. Restore both variables:
   ```env
   NEXT_PUBLIC_BASE_URL=https://www.veritablegames.com
   NEXT_PUBLIC_SITE_URL=https://www.veritablegames.com
   ```

2. If still failing, check hardcoded fallbacks in code:
   ```bash
   cd frontend
   grep -r "veritablegames.com" --include="*.ts" src/app/api/donations/
   ```

---

## Recovery Checklist

Use this checklist when restoring NEXT_PUBLIC_BASE_URL:

- [ ] Identify correct value (usually `https://www.veritablegames.com`)
- [ ] Add variable via Coolify UI or Artisan Tinker
- [ ] Verify variable saved in database
- [ ] Redeploy application
- [ ] Wait for deployment to complete (check "Running" status)
- [ ] Verify variable in container environment
- [ ] Test Stripe payment redirect
- [ ] Test BTCPay payment redirect
- [ ] Check application logs for errors
- [ ] Update documentation with restoration timestamp
- [ ] Add note to incident report

---

## Change History

| Date | Event | Value | Status |
|------|-------|-------|--------|
| Unknown - Feb 15, 2026 | Variable created in Coolify | `https://www.veritablegames.com` | Active |
| Feb 15, 2026 14:47 UTC | Corrupted during encryption incident | (corrupted) | Deleted |
| Feb 15, 2026 14:55 UTC | Restored via codebase analysis | `https://www.veritablegames.com` | ✅ Active |

---

## References

- **Incident Report**: `docs/incidents/2026-02-15-coolify-encryption-payload-invalid-error.md`
- **Coolify Backup**: `docs/deployment/COOLIFY_ENVIRONMENT_VARIABLES_BACKUP_2026-02-15.md`
- **Code Usage**: Search for `NEXT_PUBLIC_BASE_URL` in `frontend/src/app/api/donations/`

---

**Document Owner**: DevOps Team
**Last Updated**: February 15, 2026 14:58 UTC
**Status**: ✅ **RESTORED AND DOCUMENTED**
