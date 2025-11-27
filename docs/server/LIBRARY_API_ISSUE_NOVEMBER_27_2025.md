# Library API Endpoint Issue - November 27, 2025

**Date**: November 27, 2025
**Time**: 04:05 UTC
**Status**: Investigation in progress

---

## Problem Description

**User report**: "library isn't loading any documents"

**Deployment context**: Following deployment system restoration after Nixpacks/standalone configuration fixes.

---

## Investigation Findings

### Database Status: ✅ HEALTHY

**Anarchist schema tables verified**:
```sql
SELECT * FROM information_schema.tables WHERE table_schema = 'anarchist';
```

**Results**:
- `anarchist.documents` - EXISTS
- `anarchist.document_tags` - EXISTS
- `anarchist.tags` - EXISTS

**Document count**:
```sql
SELECT COUNT(*) FROM anarchist.documents;
-- Result: 24,599 documents
```

**Conclusion**: Database contains all expected data.

---

### API Endpoint Status: ❌ NOT WORKING

**Test command**:
```bash
curl -s https://www.veritablegames.com/api/library/anarchist/documents
```

**Expected response**: JSON array of documents

**Actual response**: HTML 404 page
```html
<!DOCTYPE html>
<html lang="en" class="h-full">
  <body>
    <h1 class="text-2xl font-light">404 | Page Not Found</h1>
  </body>
</html>
```

**Analysis**: API route not recognized by Next.js router.

---

## Possible Root Causes

### 1. API Route Not Deployed

**Hypothesis**: API route file missing from deployed container.

**Check required**:
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/.next/server/app/api/library/anarchist/
```

**If missing**: Route not included in build output.

### 2. Routing Configuration Issue

**Hypothesis**: Next.js routing not picking up API routes after deployment changes.

**Potential causes**:
- Base directory configuration affecting route resolution
- Build cache issues
- Missing route exports

### 3. Build Process Not Including API Routes

**Hypothesis**: Nixpacks build process skipping API route compilation.

**Check required**:
```bash
# In container
find /app -name "*anarchist*" -type f
find /app/.next -name "route.js" | grep library
```

### 4. Runtime Environment Issues

**Hypothesis**: Environment variables needed for API routes not present.

**Check required**:
```bash
docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -i "ENABLE_LIBRARY"
```

### 5. Middleware or Security Blocking

**Hypothesis**: Middleware intercepting API requests.

**Check required**:
- Review middleware.ts configuration
- Check security wrapper behavior
- Verify route protection not overly restrictive

---

## Recommended Investigation Steps

### Step 1: Verify Route File Exists in Repository

```bash
cd /home/user/projects/veritable-games/site
find frontend/src/app/api -name "*anarchist*" -type f
```

**Expected**: Route handler file(s) in `frontend/src/app/api/library/anarchist/`

### Step 2: Check Container File System

```bash
# Check if API routes compiled
docker exec m4s0kwo4kc4oooocck4sswc4 find /app -path "*api/library*" -type f

# Check Next.js server compilation
docker exec m4s0kwo4kc4oooocck4sswc4 ls -R /app/.next/server/app/api/
```

### Step 3: Review Build Logs

Check recent deployment logs for API route compilation:
```bash
# Would need to access Coolify deployment logs
# Deployment UUID: ng4oo84w0oogwcs80kg8k4oc
```

### Step 4: Test Other API Endpoints

```bash
# Test if ANY API routes work
curl -s https://www.veritablegames.com/api/health
curl -s https://www.veritablegames.com/api/forums/categories
curl -s https://www.veritablegames.com/api/wiki/pages
```

**Analysis**: Determine if issue is library-specific or affects all API routes.

### Step 5: Check Route File Exports

**Verify route file has proper exports**:
```typescript
// frontend/src/app/api/library/anarchist/documents/route.ts
export async function GET(request: Request) {
  // Implementation
}
```

**Common issues**:
- Missing `export` keyword
- Wrong export name (not GET, POST, etc.)
- TypeScript compilation errors

---

## Quick Diagnostic Commands

```bash
# 1. Check repository for route file
find /home/user/projects/veritable-games/site/frontend/src/app/api -name "route.ts" | grep anarchist

# 2. Check if file was committed
cd /home/user/projects/veritable-games/site
git ls-files frontend/src/app/api/library/

# 3. Check container for compiled routes
docker exec m4s0kwo4kc4oooocck4sswc4 find /app -name "route.js" | head -20

# 4. Test basic API health
curl -s https://www.veritablegames.com/api/health

# 5. Check container logs for route loading
docker logs m4s0kwo4kc4oooocck4sswc4 2>&1 | grep -i "route\|api" | tail -30
```

---

## Related to Recent Changes?

**Deployment changes made**:
1. Removed `output: 'standalone'` from next.config.js
2. Reverted to `next start` command
3. Switched from Dockerfile to Nixpacks

**Potential impact**:
- Standalone output mode may have included different route compilation
- Nixpacks may handle API routes differently than Dockerfile
- Build process differences could affect route discovery

**Comparison needed**:
- Was library working before today's deployment changes?
- Check previous commit (`a05a4a0`) - did API work then?

---

## Architecture Context

### Expected API Structure

```
frontend/src/app/api/
├── library/
│   ├── anarchist/
│   │   ├── documents/
│   │   │   └── route.ts  ← Main endpoint
│   │   ├── tags/
│   │   │   └── route.ts
│   │   └── [id]/
│   │       └── route.ts
│   └── [other collections]/
```

### Database Schema

```
anarchist schema:
- documents (24,599 rows)
- document_tags (tag associations)
- tags (tag definitions)

Relationships:
- documents.id → document_tags.document_id
- document_tags.tag_id → tags.id
```

### Expected API Response Format

```json
{
  "documents": [
    {
      "id": 1,
      "title": "Example Document",
      "author": "Author Name",
      "content": "...",
      "language": "en",
      "tags": ["tag1", "tag2"]
    }
  ],
  "total": 24599,
  "page": 1,
  "limit": 50
}
```

---

## Historical Context

**From CLAUDE.md**:
- Anarchist Library: 24,643 texts across 27 languages (COMPLETED)
- Archive integration documented as operational
- No mention of known API endpoint issues

**Previous working state**:
- November deployment (COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md) marked as successful
- No documentation of library API being tested

**Question**: Was this API endpoint ever verified in production?

---

## Next Actions Required

1. **Immediate**: Verify route file exists in repository
2. **Verify**: Check if route file included in git commit history
3. **Test**: Attempt to access ANY API endpoint (not just library)
4. **Compare**: Test previous commit (`a05a4a0`) if possible
5. **Review**: Check if API routes need special Nixpacks configuration

---

## Temporary Workaround

**If API route missing from build**:

Option 1: Direct database access (server-side only)
```typescript
// Server component or server action
import { dbPool } from '@/lib/database/pool';

async function getAnarchistDocuments() {
  const db = dbPool.getConnection('anarchist');
  return db.prepare('SELECT * FROM documents LIMIT 50').all();
}
```

Option 2: Add explicit route compilation check

Check `next.config.js` for any exclusions:
```javascript
// Verify no API routes excluded
experimental: {
  // Check for route exclusions
}
```

---

## Status

**Database**: ✅ Healthy, 24,599 documents present
**API Endpoint**: ❌ Returns 404
**Root Cause**: Not yet determined
**Impact**: Library feature non-functional
**Priority**: High (core feature unavailable)

---

**Investigation started**: 2025-11-27 04:05 UTC
**Last updated**: 2025-11-27 04:05 UTC
**Status**: Awaiting file system verification
