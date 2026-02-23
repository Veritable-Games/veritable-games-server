# API Security Audit Results - February 9, 2026

## Audit Scope

- **Total API Routes**: 231
- **Routes Missing withSecurity**: 30 (13%)
- **Routes Analyzed**: All 30

## Classification Results

### ✅ Category 1: Intentionally Public (14 routes - NO ACTION REQUIRED)

**Reason**: These routes are correctly public and should NOT use withSecurity

1. **Webhooks** (2 routes) - External service callbacks with signature
   verification:
   - `/api/webhooks/btcpay` - BTCPay Server payments
   - `/api/webhooks/stripe` - Stripe subscriptions

2. **Health Checks** (3 routes) - Kubernetes monitoring:
   - `/api/health/readiness` - K8s readiness probe
   - `/api/health/liveness` - K8s liveness probe
   - `/api/health/mcp` - MCP health check

3. **Metrics** (2 routes) - Monitoring systems:
   - `/api/metrics` - JSON metrics
   - `/api/metrics/prometheus` - Prometheus format

4. **Public Data** (9 routes) - Legitimately public information:
   - `/api/donations/projects` - Public funding projects
   - `/api/donations/transparency` - Public transparency data
   - `/api/documents/route` - Public document listing
   - `/api/documents/languages` - Public language metadata
   - `/api/documents/count` - Public document counts
   - `/api/documents/[slug]` - Public document viewing
   - `/api/documents/[slug]/translations` - Public translation list
   - `/api/documents/unified` - Public document list with pagination
   - `/api/landing/subscribe` - Newsletter signup

5. **Maintenance** (1 route) - Required for middleware:
   - `/api/settings/maintenance` - Maintenance mode status (public by design)

**Subtotal: 17 routes** - Intentionally public, no action needed

---

### ⚠️ Category 2: Missing withSecurity (15 routes - ACTION REQUIRED)

**Security Risk**: These routes have authentication but lack security middleware
providing:

- CSP headers with nonce
- X-Frame-Options, HSTS
- Rate limiting
- Content sanitization

#### ✅ **FIXED** - Settings Routes (2/3)

1. ✅ `/api/settings/security-status` - Added withSecurity (uses requireAuth)
2. ✅ `/api/settings/login-history` - Added withSecurity (uses requireAuth)
3. ✅ `/api/settings/maintenance` - Confirmed intentionally public (no action)

#### ✅ **FIXED** - Library Admin Routes (5/5)

1. ✅ `/api/library/documents/batch-update-visibility` - Added withSecurity
2. ✅ `/api/library/admin/anarchist/extract-author-date` - Added withSecurity
3. ✅ `/api/library/admin/anarchist/populate-descriptions` - Added withSecurity
4. ✅ `/api/library/admin/tags/auto-tag` - Added withSecurity
5. ✅ `/api/library/admin/tags/import` - Added withSecurity

#### ✅ **FIXED** - Donation Routes (2/2)

1. ✅ `/api/donations/subscriptions` - Added withSecurity (uses
   getServerSession)
2. ✅ `/api/donations/manage` - Added withSecurity (token-based auth)

#### ✅ **FIXED** - Email Confirmation (1/1)

1. ✅ `/api/email/confirm` - Added withSecurity (token-based auth, performs DB
   update)

#### 🔍 **REQUIRES INVESTIGATION** - Streaming Endpoints (2)

These endpoints have NO authentication and appear intentionally public:

1. ⚠️ `/api/forums/events` - SSE endpoint, no auth, CORS `*` (public forum
   events?)
2. ⚠️ `/api/godot/versions/[id]/stream` - WebSocket endpoint, no auth (public
   demo?)

**Decision needed**: Are these intentionally public, or should they require
authentication?

---

### ✅ Category 3: Debug Routes (1 route - REMOVED)

1. ✅ `/api/debug/anarchist-query-test` - **REMOVED** (security vulnerability)

**Action Taken**: Deleted entirely. Debug endpoints should not exist in
production code.

---

## Progress Summary

| Status                     | Count | Percentage |
| -------------------------- | ----- | ---------- |
| **Intentionally Public**   | 17    | 57%        |
| **Fixed**                  | 10    | 33%        |
| **Removed**                | 1     | 3%         |
| **Requires Investigation** | 2     | 7%         |
| **Remaining**              | 0     | 0%         |

**Security Compliance**:

- Before: 197/231 routes with withSecurity (85%)
- After fixes: 207/230 routes (90%) - 1 route removed
- Target: ~212/230 routes (92% - excluding 19 intentionally public)

---

## Next Steps

### High Priority

1. ✅ Complete library admin routes (5) - COMPLETED
2. ✅ Add withSecurity to donation management routes (2) - COMPLETED
3. 🔍 Investigate streaming endpoints (2) - Are they intentionally public?

### Medium Priority

4. Investigate document routes - determine if public or needs auth (3)
5. Add withSecurity to email confirmation endpoint (1)

### Low Priority

6. ✅ Remove debug route (1) - COMPLETED
7. Document all intentionally public routes in SECURITY.md
8. Investigate streaming endpoints (2) - Determine if authentication needed

---

## Files Modified

### Completed (10)

**Settings Routes (2)**:

- `src/app/api/settings/security-status/route.ts` - Added withSecurity wrapper
- `src/app/api/settings/login-history/route.ts` - Added withSecurity wrapper

**Library Admin Routes (5)**:

- `src/app/api/library/documents/batch-update-visibility/route.ts` - Added
  withSecurity
- `src/app/api/library/admin/anarchist/extract-author-date/route.ts` - Added
  withSecurity
- `src/app/api/library/admin/anarchist/populate-descriptions/route.ts` - Added
  withSecurity
- `src/app/api/library/admin/tags/auto-tag/route.ts` - Added withSecurity
- `src/app/api/library/admin/tags/import/route.ts` - Added withSecurity

**Donation Routes (2)**:

- `src/app/api/donations/subscriptions/route.ts` - Added withSecurity
- `src/app/api/donations/manage/route.ts` - Added withSecurity

**Email Confirmation (1)**:

- `src/app/api/email/confirm/route.ts` - Added withSecurity

### Pattern Applied

```typescript
// Before
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  // ...
}

// After
import { withSecurity } from '@/lib/security/middleware';

async function GETHandler(request: NextRequest) {
  const authResult = await requireAuth(request);
  // ...
}

export const GET = withSecurity(GETHandler);
```

---

**Audit Completed**: February 9, 2026  
**Next Review**: After completing all fixes (est. 1-2 hours)
