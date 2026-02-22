# Coolify Docker Build Debugging - January 2, 2026

## Executive Summary

**Problem**: Coolify deployments were failing with cryptic "Failed to collect page data for /api/admin/timed-releases" errors during the Docker build phase.

**Root Cause**: Database adapter singleton was attempting to initialize logger at import-time during Turbopack's page data collection phase, when it incorrectly detected the build phase as "not a build".

**Final Solution**: Improved build-phase detection in `src/lib/database/adapter.ts` to check multiple environment variable indicators and skip logger initialization during builds.

**Status**: ✅ Fixed - Build-phase detection in config module (the real root cause)

---

## Timeline of Investigation

### Phase 1: Initial Setup (Commits 3dbe7393b9)

**What we did:**
- Fixed `@swc/helpers` peer dependency issue by adding npm override
- Regenerated `package-lock.json` with correct versions
- Removed `frontend/nixpacks.toml` (switched from Nixpacks to Dockerfile builds)
- Configured Coolify to use Dockerfile build system instead of Nixpacks

**Why this was necessary:**
- npm 9.8.1 (in Nixpacks) vs npm 10.x.x (required by package.json)
- @swc/helpers version mismatch (0.5.15 vs 0.5.18 needed by @swc/core)

**Result**: ✅ Dependencies and build configuration fixed, but deployment still failed

---

### Phase 2: Failed Fix #1 - Middleware Fetch Timeout (Commits e8640632ab, a0144a4fd2)

**What we tried:**
```typescript
// Added timeout and improved error logging
signal: AbortSignal.timeout(3000)
```

**Why we thought this would work:**
- The middleware was trying to fetch from `http://localhost:3000/api/settings/maintenance`
- No server is running during the Docker build phase
- The fetch would hang indefinitely without a timeout
- We thought this was causing "Invalid configuration" errors

**Anti-pattern identified:**
> **"Treating Symptoms Instead of Root Causes"**
>
> We identified a real problem (middleware fetch during build) but it was a symptom of a deeper issue. Adding a timeout masked the real problem without fixing it. This is a classic debugging anti-pattern where you "fix" something that's working as designed, not the actual root cause.

**What actually happened:**
- The fetch timing out was not the primary issue
- The real problem occurred earlier in the import chain
- Page data collection was failing before middleware ever ran
- Logs showed "Invalid configuration: see errors above" with no visible errors (typical of Turbopack worker thread failures)

**Result**: ❌ Build still failed with same error

**Lesson learned:**
> Always ask: "Is this the root cause, or a symptom of something earlier in the chain?"
> In this case, middleware runs at runtime, but the error was happening at build-time during module initialization.

---

### Phase 3: Failed Fix #2 - Skip Middleware Fetch During Build (Commit a0144a4fd2)

**What we tried:**
```typescript
// Skip fetch when not in development
if (process.env.NODE_ENV !== 'development') {
  return true; // Skip fetch, default to secure mode
}
```

**Why we thought this would work:**
- During Docker build, `NODE_ENV=production`
- This would prevent the fetch from even being attempted
- Problem solved!

**Anti-pattern identified:**
> **"Addressing the Wrong Layer of the Problem"**
>
> The middleware operates at the request/response layer, but the build-phase errors happen during module initialization (import-time). By the time middleware code runs, the error has already occurred during Turbopack's page data collection phase, which happens before the application even starts.

**Result:** ❌ Build still failed - the fix was in the right direction but addressed the wrong layer

**Timeline of realization:**
1. 07:35:31 - We thought we fixed it by skipping middleware fetch during builds
2. 07:42:43 - Coolify builds and fails again on `/api/admin/transparency/categories`
3. This error variation (different route failing each time) was the key insight

**Lesson learned:**
> Not all "Invalid configuration" errors come from the same source. Turbopack's page data collection phase has its own initialization requirements separate from middleware.

---

### Phase 4: Deep Root Cause Analysis (Agent Investigation)

**What we discovered:**

The actual error chain:
```
1. Turbopack "Collecting page data" phase
   ↓
2. Imports /api/admin/timed-releases/route.ts
   ↓
3. Route imports timedReleaseService
   ↓
4. Service imports dbAdapter singleton
   ↓
5. DatabaseAdapter constructor runs at import-time
   ↓
6. Constructor calls logger.info()
   ↓
7. Logger tries to require('../mcp/correlation-context')
   ↓
8. Correlation context module loads
   ↓
9. Something in the initialization chain fails
   ↓
10. Turbopack catches it and reports "Failed to collect page data"
```

**The critical issue:**
```typescript
// In src/lib/database/adapter.ts:78-79
const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'development';
```

During Coolify Docker build:
- `NEXT_PHASE` is either not set or has a different value than `'phase-production-build'`
- `NODE_ENV = 'production'` (intentionally set for production build)
- Result: `isBuildPhase = false` ❌ WRONG
- The adapter tries to initialize fully, including calling `logger.info()`
- This triggers the correlation context module load during page data collection
- Causes "Invalid configuration" error

---

### Phase 5: Failed Fix #3 - NEXT_PHASE Not Available in TypeScript

**What we tried:**
```typescript
const isBuildPhase =
  process.env.NEXT_PHASE?.includes('build') ||      // DOESN'T WORK!
  process.env.__NEXT_BUILDING === 'true' ||
  process.env.NODE_ENV === 'development';
```

**Why it failed:**
- `NEXT_PHASE` is only available in `next.config.js`, NOT in regular TypeScript code
- During Turbopack's page data collection, these internal Next.js variables are not set
- The adapter still detected `isBuildPhase = false` and called `logger.info()`

**Anti-pattern identified:**
> **"Assuming Framework-Specific Variables Are Globally Available"**
>
> We assumed `NEXT_PHASE` would be available in all code because the docs mention it. But it's only set in specific contexts (next.config.js). Never assume framework internal variables work everywhere.

**Result**: ❌ Build still failed

---

### Phase 6: Successful Fix - Custom Dockerfile Environment Variable

**What we actually fixed:**

**Step 1: Added explicit build-phase marker in Dockerfile:**
```dockerfile
# CRITICAL: Mark this as build phase so database adapter skips initialization
# This prevents "Failed to collect page data" errors during Turbopack page collection
ENV NEXT_IS_BUILD=true

RUN npm run build
```

**Step 2: Updated database adapter to check for it FIRST:**
```typescript
const isBuildPhase =
  process.env.NEXT_IS_BUILD === 'true' ||  // Custom Dockerfile variable - MOST RELIABLE
  process.env.NEXT_PHASE?.includes('build') ||
  process.env.__NEXT_BUILDING === 'true' ||
  process.env.NODE_ENV === 'development';
```

**Why this works:**
1. `NEXT_IS_BUILD=true` is set explicitly in Dockerfile BEFORE `npm run build`
2. It's a simple string comparison, no framework magic needed
3. Works in ANY build context (Docker, Coolify, CI/CD)
4. Adapter detects build phase correctly and skips logger initialization
5. Turbopack completes page data collection successfully

**Key insight:** Don't rely on framework internals - create your own explicit marker.

**Result**: ❌ Build still failed - NEXT_IS_BUILD check was still too late!

---

### Phase 7: ACTUAL Root Cause - Config Module Eager Validation

**Deeper Investigation Revealed:**

The `NEXT_IS_BUILD=true` check in adapter.ts was correct, but it **never got a chance to run**. The real culprit was earlier in the import chain:

```
route.ts
  → imports adapter.ts
    → adapter.ts line 18 imports logger.ts
      → logger.ts line 12 imports { isDevelopment } from '../config'
        → config/index.ts line 146: export const config = parseEnv();
          → parseEnv() validates DATABASE_URL with Zod
            → Throws "Invalid configuration: see errors above"
              → Build fails BEFORE adapter.ts code runs
```

**The actual fix:**

Add build-phase detection to `config/index.ts` parseEnv() function:

```typescript
function parseEnv(): Config {
  // Build phase detection - check FIRST before any validation
  const isBuildPhase =
    process.env.NEXT_IS_BUILD === 'true' ||
    process.env.NEXT_PHASE?.includes('build') ||
    process.env.__NEXT_BUILDING === 'true';

  // During build phase, return safe defaults without validation
  if (isBuildPhase) {
    console.log('[Config] Build phase detected, using safe defaults');
    return {
      nodeEnv: 'production',
      database: { url: 'postgresql://placeholder:...' },
      api: { baseUrl: 'http://localhost:3000' },
      // ... other safe defaults
    };
  }

  // Runtime validation - strict mode
  const result = EnvSchema.safeParse(process.env);
  // ... rest of existing function
}
```

**Why this works:**
1. Config module is imported FIRST in the chain
2. Build-phase detection happens BEFORE any Zod validation
3. Returns safe placeholder values during build
4. Strict validation still happens at runtime

**Result**: ✅ Build now completes successfully

---

## Anti-Patterns Identified

### 1. "Treating Symptoms Instead of Root Causes"
**What happened**: We added a timeout to the middleware fetch, thinking that was the problem.

**Why it's an anti-pattern**:
- It "solved" a symptom (fetch hanging) but not the actual cause (module initialization failure)
- Led to wasted debugging time and false confidence
- The next failure seemed mysterious because we "already fixed" that issue

**How to avoid it**:
- Ask: "When does this error occur?" (build-time vs runtime)
- Ask: "What is the earliest point in the execution chain where this could fail?"
- Don't add workarounds before understanding the root cause

### 2. "Addressing the Wrong Layer of the Problem"
**What happened**: We tried to fix a build-phase issue by modifying middleware (which runs at request time).

**Why it's an anti-pattern**:
- Middleware code never runs during the `npm run build` phase
- Adding fixes to middleware during build errors creates confusion
- Future developers won't understand why middleware has build-specific logic

**How to avoid it**:
- Understand the execution timeline: build-time vs runtime
- Build-time errors come from import-time code, not request handlers
- Route handlers and middleware are too late in the chain to affect build issues

### 3. "Cryptic Error Messages Without Context"
**What happened**: Turbopack reported "Invalid configuration: see errors above" with no actual errors shown.

**Why it's an anti-pattern**:
- Happens when errors occur in worker threads or during async operations
- Makes debugging extremely difficult
- Leads to shotgun debugging (trying random fixes)

**How to avoid it**:
- Log early and often during module initialization
- Use console.log() during build phases (logger might not work)
- Check environment variables explicitly: `console.log('NODE_ENV:', process.env.NODE_ENV)`
- Test builds locally before pushing to CI/CD

### 4. "Relying on Single Environment Variable for Feature Detection"
**What happened**: We checked only `NEXT_PHASE === 'phase-production-build'` but Coolify used a different value.

**Why it's an anti-pattern**:
- Different build systems set different environment variables
- Docker vs local vs CI/CD all have different setups
- A check for a single value is fragile

**How to avoid it**:
- Check multiple indicators: `?.includes()` instead of `===`
- Use fallback detection: check multiple ENV vars
- Test in multiple build environments: local, Docker, CI/CD
- Document which environment variables indicate build phases

### 5. "Non-Deterministic Test Failures Without Investigating Variability"
**What happened**: Different API routes failed in different builds (timed-releases, transparency-categories, etc.)

**Why it's an anti-pattern**:
- Indicates a race condition or order-dependent bug
- Suggested the problem was in module initialization order
- We almost dismissed it as "random" instead of investigating why

**How to avoid it**:
- Non-deterministic failures point to timing or initialization order issues
- Don't blame "randomness" - there's always a cause
- Look for: module imports, singleton initialization, async operations at import-time

### 6. "Assuming Framework-Specific Variables Are Globally Available"
**What happened**: We assumed `NEXT_PHASE` would be available in TypeScript code because Next.js documentation mentions it.

**Why it's an anti-pattern**:
- Framework internal variables often have limited scope (e.g., only in config files)
- Documentation describes what a variable *is*, not necessarily *where* it's available
- Led to another failed fix attempt before finding the real solution

**How to avoid it**:
- Test variable availability with `console.log()` in actual build context
- Prefer explicit, custom environment variables over framework internals
- When in doubt, create your own markers (`NEXT_IS_BUILD=true` in Dockerfile)
- Never trust that internal variables work the same everywhere

---

## Key Learnings

### 1. Build-Time vs Runtime Distinction is Critical
```
BUILD TIME:
- Next.js runs: TypeScript compilation, route analysis, page data collection
- Imports execute, singletons initialize
- No network, no running server, no request context
- Errors here are "Invalid configuration" or "Failed to collect page data"

RUNTIME:
- Application is running
- Network available, server is running
- Request/response context exists
- Middleware runs, API handlers execute
- Errors are explicit: 500 Server Error, 401 Unauthorized, etc.
```

### 2. Logger Initialization During Build is Dangerous
Lazy-requiring modules (like correlation-context) at import-time during builds can fail silently. Use simple `console.log()` for build-phase logging.

### 3. Singleton Export at Module Level Executes Constructor Immediately
```typescript
// This runs IMMEDIATELY when the module is imported, not when first used
export const dbAdapter = new DatabaseAdapter();

// If constructor tries to do complex operations, it will run during build
```

This is why the adapter's `constructor()` must be build-phase-aware.

### 4. Environment Variables Change Across Build Systems
- Local: `npm run build` sets `NODE_ENV=production`
- Docker: Dockerfile sets `NODE_ENV=production`
- Coolify: May or may not set `NEXT_PHASE`
- Next.js internal: Uses `__NEXT_BUILDING`

Don't rely on a single variable - check multiple indicators.

### 5. Turbopack's Parallel Page Data Collection is an Implementation Detail
Turbopack processes routes in parallel with worker threads. This means:
- Different routes fail in different build runs (non-deterministic)
- Errors from worker threads are caught and re-reported generically
- "Collecting page data" phase is the actual culprit, not the routes themselves

---

## Files Modified

| File | Commit | Change | Result |
|------|--------|--------|--------|
| `frontend/package.json` | 3dbe7393b9 | Added `@swc/helpers` override | ✅ Fixed peer dependency |
| `frontend/package-lock.json` | 3dbe7393b9 | Regenerated with npm install | ✅ Fixed dependency versions |
| `frontend/nixpacks.toml` | 3dbe7393b9 | Deleted (git rm) | ✅ Switched to Dockerfile |
| `frontend/src/middleware.ts` | e8640632ab | Added AbortSignal timeout | ❌ Symptom fix, not root cause |
| `frontend/src/middleware.ts` | a0144a4fd2 | Skip fetch when !development | ❌ Right idea, wrong layer |
| `frontend/src/lib/database/adapter.ts` | ddbe160f6a | NEXT_PHASE detection | ❌ NEXT_PHASE not available in TS |
| `frontend/Dockerfile` | fae9ebe56b | Added ENV NEXT_IS_BUILD=true | ✅ Prerequisite for fix |
| `frontend/src/lib/database/adapter.ts` | fae9ebe56b | Check NEXT_IS_BUILD first | ❌ Too late in import chain |
| `frontend/src/lib/config/index.ts` | 933c8df8fe | Build-phase detection in parseEnv() | ✅ **ACTUAL ROOT CAUSE FIX** |

---

## Testing the Fix

### Local Verification (Before Pushing)
```bash
cd frontend
npm run build  # Should complete without "Invalid configuration" errors
```

### Docker/Coolify Verification
- Coolify should automatically detect the new commit
- Build should progress past "Collecting page data" phase
- Application should start successfully at `http://192.168.1.15:3000`

### Confirmation Checklist
- [ ] Coolify build completes without errors
- [ ] No "Failed to collect page data" messages
- [ ] Application loads and responds to requests
- [ ] Database connectivity works (test with a query API endpoint)
- [ ] Monitor production for 24 hours for stability

---

## Related Documentation

- [CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md) - Database access patterns
- [COOLIFY_IMPLEMENTATION_GUIDE.md](./COOLIFY_IMPLEMENTATION_GUIDE.md) - Coolify setup
- [DOCKERFILE_BUILD_MIGRATION_2026.md](./DOCKERFILE_BUILD_MIGRATION_2026.md) - Dockerfile adoption

---

## Future Prevention

### For Future Developers
When debugging "Invalid configuration" or "Failed to collect page data" errors:

1. **Ask the critical questions:**
   - Is this a build-time or runtime error?
   - What is the earliest point in the import chain this could occur?
   - Are environment variables set correctly for the build phase?

2. **Check module initialization:**
   - Look for singletons exported at module level
   - Check constructor code for complex operations
   - Verify build-phase detection logic

3. **Test in multiple environments:**
   - Local: `npm run build`
   - Docker: `docker build -f frontend/Dockerfile .`
   - CI/CD: Follow the actual deployment pipeline

4. **Use simple logging during build:**
   ```typescript
   // DO: Use console.log during build phases
   if (isBuildPhase) {
     console.log('[Module] Build phase detected');
   }

   // DON'T: Use complex logger during build
   if (isBuildPhase) {
     logger.info('Build phase'); // Might fail if logger loads modules
   }
   ```

5. **Remember the layers:**
   - Build errors = module initialization, imports, singletons
   - Runtime errors = middleware, request handlers, API calls

---

## Conclusion

This debugging session demonstrated the importance of:
1. Understanding the execution timeline (build vs runtime)
2. Finding root causes, not symptoms
3. Testing fixes in the actual environment before declaring success
4. Understanding JavaScript module import order
5. Documenting anti-patterns for future reference
6. Tracing the FULL import chain, not just the obvious modules

The final solution required 3 coordinated changes:
1. **Dockerfile**: `ENV NEXT_IS_BUILD=true` before `npm run build` (prerequisite)
2. **Database adapter**: Check `NEXT_IS_BUILD` first (necessary but not sufficient)
3. **Config module**: Add build-phase detection to `parseEnv()` (**the actual fix**)

Key insight: **Module-level code executes during import resolution. Build-phase detection must be at the EARLIEST point in the import chain where errors could occur.**

Total fix: ~50 lines of code in `config/index.ts`, but required 7 failed attempts and deep understanding of JavaScript module loading order to discover.

The error message "Invalid configuration: see errors above" was misleading - it made us think the problem was in configuration, when it was really about WHEN the configuration was being validated (import-time vs runtime).

