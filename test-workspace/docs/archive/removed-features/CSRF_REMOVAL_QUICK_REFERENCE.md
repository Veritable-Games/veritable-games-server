# CSRF Removal - Quick Reference Guide

**Critical Issue:** Components are importing a **non-existent hook** `useCSRFToken` which will cause runtime errors!

---

## Quick Stats

- **Total Files Affected:** 180+ files
- **Files to Modify:** 87 files
- **Files to Delete:** 22+ files
- **API Routes with csrfEnabled:** 74 files
- **React Components Broken:** 7 components
- **Estimated Effort:** 16-22 hours

---

## Critical Files to Fix IMMEDIATELY

### 1. Non-Existent Hook (RUNTIME ERRORS)

**Problem:** Components import `/hooks/useCSRFToken` but this file **DOES NOT EXIST**

**Broken Components:**
- `/components/auth/RegisterForm.tsx` - Uses `csrfLoading` variable (line 80)
- `/components/forums/NewTopicModal.tsx` - Uses `csrfError`, `csrfLoading` (lines 44, 142, 151, 231-236)
- `/components/settings/ProfileSettingsForm.tsx` - Uses `csrfError` variable (lines 215, 224)
- `/components/contact/ContactForm.tsx` - Uses `csrfToken` in header (line 74)

**Fix:** Remove all variable declarations and usage

---

## Files to Delete

### Core CSRF Implementation (3 files)
```
src/lib/security/csrf.ts
src/lib/security/csrf-helpers.ts
src/app/api/auth/csrf-token/route.ts
```

### Test Files (DELETE entire directory)
```
scripts/security-tests/csrf/
scripts/test-csrf-comprehensive.js
scripts/phase2-fix-csrf-consistency.js
scripts/phase5-final-csrf-cleanup.js
```

### Documentation (DELETE 6 files)
```
docs/archive/old-security/CSRF_HEALTH_CHECK_REPORT.md
docs/archive/old-security/CSRF_IMPLEMENTATION_STATUS.md
docs/archive/old-security/CSRF_SECURITY_TESTING_PLAN.md
docs/archive/old-security/CSRF-INVESTIGATION-FINDINGS.md
docs/archive/old-security/CSRF-TEST-REPORT.md
docs/archive/old-security/CSRF_SECURITY_MONITORING.md
```

---

## Bulk Modifications Required

### API Routes (74 files)

**Find and Remove:**
```typescript
// REMOVE THIS LINE from all API routes:
csrfEnabled: true,  // or false
```

**Example - Change from:**
```typescript
export const POST = withSecurity(handler, {
  requireAuth: true,
  csrfEnabled: true,  // <- DELETE THIS
});
```

**To:**
```typescript
export const POST = withSecurity(handler, {
  requireAuth: true,
});
```

### Environment Variables

**Remove from `.env.example`:**
```bash
CSRF_SECRET=...
SKIP_CSRF_IN_DEV=false
```

---

## Critical Search Patterns

```bash
# Find broken component imports
grep -r "useCSRFToken" src/

# Find all CSRF variables
grep -r "csrfToken\|csrfError\|csrfLoading" src/ --include="*.tsx"

# Find all csrfEnabled configuration
grep -r "csrfEnabled" src/app/api/

# Find all CSRF headers
grep -r "csrf-token" src/ -i

# Find CSRF in environment
grep "CSRF" .env.example
```

---

## Test Files to Update

**Remove CSRF test sections from:**
- `/lib/security/__tests__/security.test.ts` (lines 50-105)
- `/lib/security/__tests__/integration.test.ts` (lines 57-108)

**Delete imports:**
```typescript
import { csrfManager } from '../csrf';  // <- DELETE THIS
```

---

## Priority Order

### Phase 1: CRITICAL (Do First)
1. Fix broken component imports (RegisterForm, NewTopicModal, ProfileSettingsForm, ContactForm)
2. Delete stub files (csrf.ts, csrf-helpers.ts, csrf-token/route.ts)
3. Test authentication and form submission

### Phase 2: HIGH
1. Remove `csrfEnabled` from all 74 API routes
2. Update withSecurity() middleware
3. Remove CSRF comments from API routes

### Phase 3: MEDIUM
1. Delete CSRF test files
2. Update security tests
3. Update utility scripts

### Phase 4: LOW
1. Delete archived documentation
2. Update active documentation
3. Remove from environment config

---

## Verification Commands

```bash
# After removal, verify nothing remains:
grep -r "csrf" src/ -i --include="*.ts" --include="*.tsx"

# Should return ZERO results for:
grep -r "useCSRFToken" src/
grep -r "csrfEnabled" src/
grep "CSRF_SECRET" .env.example
```

---

## Component Fix Examples

### Before (BROKEN):
```typescript
// NewTopicModal.tsx
import { useCSRFToken } from '@/hooks/useCSRFToken'; // <- DOESN'T EXIST!

const { csrfError, csrfLoading } = useCSRFToken(); // <- ERROR!

{csrfError && <div>{csrfError}</div>}
{csrfLoading && <div>Loading...</div>}
```

### After (FIXED):
```typescript
// NewTopicModal.tsx
// Remove import
// Remove variable declaration
// Remove conditional UI elements
```

### Before (BROKEN):
```typescript
// ContactForm.tsx
const { csrfToken } = useCSRFToken(); // <- DOESN'T EXIST!

headers: {
  'x-csrf-token': csrfToken || '', // <- UNDEFINED!
}
```

### After (FIXED):
```typescript
// ContactForm.tsx
// Remove import
// Remove variable declaration
// Remove header

headers: {
  'Content-Type': 'application/json',
  // No CSRF header needed
}
```

---

## Full Report

See `CSRF_REMOVAL_COMPREHENSIVE_REPORT.md` for:
- Complete file inventory with line numbers
- Detailed dependency tree
- Security implications analysis
- Full removal roadmap
- Verification checklist

---

**IMPORTANT:** Start with Phase 1 to prevent runtime errors in production!