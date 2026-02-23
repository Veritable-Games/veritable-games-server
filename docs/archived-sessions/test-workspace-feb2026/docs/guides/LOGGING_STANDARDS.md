# Logging Standards

**Date**: February 16, 2026
**Status**: Active Standard
**Applies To**: All API routes

---

## Overview

This document defines standardized logging practices for API routes to maintain readability while preserving essential debugging information.

## Core Principles

1. **Strategic, Not Verbose** - Log key events, not every step
2. **Structured Data** - Use objects for context, not string concatenation
3. **Appropriate Levels** - ERROR for failures, WARN for security/business logic issues, INFO for operations
4. **Consistent Prefixes** - Use `[Feature Action]` format (e.g., `[Journals Delete]`)

---

## Logging Levels

### ERROR - System Failures

Use for technical errors that prevent operation completion.

```typescript
catch (error) {
  logger.error('[Journals Delete] Operation failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  return errorResponse(error);
}
```

**When to use:**
- Database connection failures
- Unhandled exceptions
- Unexpected system errors

### WARN - Security & Business Logic Issues

Use for authorization failures, validation errors, or suspicious behavior.

```typescript
if (!ownershipCheck.authorized) {
  logger.warn('[Journals Delete] Authorization failed', {
    userId: user.id,
    unauthorizedCount: ownershipCheck.unauthorized.length,
  });
  throw new PermissionError('You can only delete your own journals');
}
```

**When to use:**
- Authorization failures (security concern)
- Missing required resources
- Invalid state transitions
- Attempted privilege escalation

### INFO - Operation Start & Success

Use for tracking successful operations and their outcomes.

```typescript
logger.info('[Journals Delete] Operation started', {
  userId: user.id,
  count: journalIds.length,
  permanent,
});

// ... operation logic ...

logger.info('[Journals Delete] Soft delete successful', {
  count: journalIds.length,
});
```

**When to use:**
- Operation start (with key parameters)
- Successful completion (with result summary)

---

## Standard Patterns by Route Type

### Create Operations (POST)

**Minimum Logging:**
1. Operation start (INFO) - with user and key parameters
2. Validation failures (implicit via error handling)
3. Success (INFO) - with created resource ID

```typescript
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError('Not authenticated');

    const body = await request.json();
    logger.info('[Feature Create] Operation started', {
      userId: user.id,
      data: { /* relevant fields */ },
    });

    // ... creation logic ...

    logger.info('[Feature Create] Success', {
      id: result.id,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('[Feature Create] Operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
});
```

### Read Operations (GET)

**Minimum Logging:**
1. Errors only (ERROR)

```typescript
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError('Not authenticated');

    // ... fetch logic ...

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    logger.error('[Feature Read] Operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
});
```

**Rationale**: Read operations are high-frequency and typically succeed. Only log failures.

### Update Operations (PATCH/PUT)

**Minimum Logging:**
1. Operation start (INFO) - with user and resource ID
2. Authorization failures (WARN) - if applicable
3. Success (INFO) - with updated resource ID

```typescript
export const PATCH = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError('Not authenticated');

    logger.info('[Feature Update] Operation started', {
      userId: user.id,
      resourceId: params.id,
    });

    // ... update logic ...

    logger.info('[Feature Update] Success', {
      resourceId: params.id,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('[Feature Update] Operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
});
```

### Delete Operations (DELETE)

**Minimum Logging:**
1. Operation start (INFO) - with user and count/IDs
2. Authorization failures (WARN) - security concern
3. Privilege escalation attempts (WARN) - e.g., non-admin permanent delete
4. Success (INFO) - with count

```typescript
export const DELETE = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError('Not authenticated');

    logger.info('[Feature Delete] Operation started', {
      userId: user.id,
      count: ids.length,
      permanent,
    });

    // Authorization check
    if (!ownershipCheck.authorized) {
      logger.warn('[Feature Delete] Authorization failed', {
        userId: user.id,
        unauthorizedCount: ownershipCheck.unauthorized.length,
      });
      throw new PermissionError('Not authorized');
    }

    // Privilege check (if applicable)
    if (permanent && !isAdmin) {
      logger.warn('[Feature Delete] Non-admin attempted permanent delete', {
        userId: user.id,
      });
      throw new PermissionError('Only admins can permanently delete');
    }

    // ... deletion logic ...

    logger.info('[Feature Delete] Success', {
      count: ids.length,
    });

    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    logger.error('[Feature Delete] Operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
});
```

---

## What NOT to Log

### ❌ Step-by-Step Progress

```typescript
// ❌ DON'T - Too verbose
logger.info('[Feature] Validating input...');
logger.info('[Feature] Input validation passed');
logger.info('[Feature] Generating query...');
logger.info('[Feature] Query generated successfully');
logger.info('[Feature] Executing query...');
logger.info('[Feature] Query completed');
```

```typescript
// ✅ DO - Strategic logging
logger.info('[Feature] Operation started', { userId, params });
// ... all logic here ...
logger.info('[Feature] Operation successful', { resultCount });
```

### ❌ Database Query Details

```typescript
// ❌ DON'T - Exposes implementation details
logger.info('[Feature] Executing query:', {
  query: 'SELECT * FROM users WHERE id = ?',
  params: [userId],
});
```

```typescript
// ✅ DO - Log outcome only
// Query executes silently
// Only log if it fails (caught by error handler)
```

### ❌ Internal Variable State

```typescript
// ❌ DON'T - Clutters logs
logger.info('[Feature] Placeholder count:', placeholders.length);
logger.info('[Feature] Generated SQL:', sql);
logger.info('[Feature] Parsed body:', body);
```

```typescript
// ✅ DO - Log parameters at operation start
logger.info('[Feature] Operation started', {
  userId,
  resourceCount: items.length,
});
```

### ❌ Success After Every Step

```typescript
// ❌ DON'T
logger.info('[Feature] Authorization passed');
logger.info('[Feature] Validation passed');
logger.info('[Feature] Query successful');
logger.info('[Feature] Update successful');
```

```typescript
// ✅ DO - Single success log at end
logger.info('[Feature] Operation successful', {
  resultCount: items.length,
});
```

---

## Structured Logging Format

Always use objects for context data:

```typescript
// ✅ GOOD - Structured
logger.info('[Feature Action] Message', {
  userId: user.id,
  count: items.length,
  parameter: value,
});

// ❌ BAD - String concatenation
logger.info('[Feature Action] Message for user ' + user.id + ' with ' + items.length + ' items');
```

**Benefits:**
- Parseable by log aggregators (e.g., Elasticsearch, Datadog)
- Consistent formatting
- Easier to search and filter
- Better readability

---

## Prefix Naming Convention

Use format: `[Feature Action]`

### Examples

- `[Journals Create]`
- `[Journals Delete]`
- `[Journals Update]`
- `[Forums Create Topic]`
- `[Wiki Update Page]`
- `[Auth Login]`
- `[Library Import]`

**Rules:**
1. Feature name matches the domain (Journals, Forums, Wiki, etc.)
2. Action describes the operation (Create, Delete, Update, etc.)
3. Use title case
4. Keep concise (2-3 words max)

---

## Error Logging

Always include minimal context in error logs:

```typescript
catch (error) {
  logger.error('[Feature Action] Operation failed', {
    error: error instanceof Error ? error.message : String(error),
    // Optional: Add critical context
    userId: user?.id,
    resourceId: params?.id,
  });
  return errorResponse(error);
}
```

**Don't include:**
- Stack traces (error object itself is logged, tools can expand it)
- Sensitive data (passwords, tokens, API keys)
- Redundant information already in error message

---

## Performance Considerations

### Log Volumes by Route Type

| Route Type | Expected Logs/Request | Example |
| ---------- | --------------------- | ------- |
| GET (read) | 0-1                   | Only errors |
| POST (create) | 2-3                | Start + Success + (maybe validation warning) |
| PATCH (update) | 2-3              | Start + Success + (maybe auth warning) |
| DELETE | 3-5                      | Start + Auth warnings + Success |

### High-Traffic Routes

For routes with >1000 requests/day, minimize logging:

```typescript
// High-traffic route: Only log errors
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // ... logic ...
    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('[Feature Read] Operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
});
```

---

## Debug Mode (Future Enhancement)

For complex operations that need detailed logging during development:

```typescript
const DEBUG = process.env.LOG_LEVEL === 'debug';

if (DEBUG) {
  logger.debug('[Feature] Step 1 completed', { data });
}
```

**Status**: Not yet implemented. Use sparingly when added.

---

## Migration Strategy

When updating existing routes:

1. **Identify excessive logging** - Routes with >10 logger calls
2. **Keep critical logs:**
   - Operation start (INFO)
   - Authorization failures (WARN)
   - Operation success (INFO)
   - Errors (ERROR)
3. **Remove verbose logs:**
   - Step-by-step progress
   - Query details
   - Internal variable state
   - Redundant success messages

### Before/After Example

**Before** (21 logger calls in journals bulk-delete):
```typescript
logger.info('[Journals Delete] ===== START =====');
logger.info('[Journals Delete] getCurrentUser result:', { userId, userName });
logger.info('[Journals Delete] Request body:', { journalIds, permanent, ... });
logger.info('[Journals Delete] Input validation passed...');
logger.info('[Journals Delete] Generated placeholders:', { placeholders });
logger.info('[Journals Delete] Fetching journals with query:', { query, ids });
logger.info('[Journals Delete] Query completed, found journals:', { count });
logger.info('[Journals Delete] Authorization check passed');
// ... 13 more logs ...
```

**After** (8 logger calls):
```typescript
logger.info('[Journals Delete] Operation started', { userId, count, permanent });
logger.warn('[Journals Delete] Authorization failed', { userId, unauthorizedCount });
logger.warn('[Journals Delete] Not all journals found', { requested, found });
logger.warn('[Journals Delete] Non-admin attempted permanent delete', { userId });
logger.info('[Journals Delete] Soft delete successful', { count });
logger.error('[Journals Delete] Operation failed', { error });
```

---

## Compliance & Security

### DO NOT Log:

- Passwords (plaintext or hashed)
- API keys or tokens
- Full credit card numbers
- Social security numbers
- Personal health information
- Session IDs
- CSRF tokens

### Safe to Log:

- User IDs (numeric)
- Usernames/emails (if not sensitive in your context)
- Resource counts
- Operation types
- Timestamps
- Request metadata (method, path)

---

## Reference Implementation

See `frontend/src/app/api/journals/bulk-delete/route.ts` for reference implementation following these standards (reduced from 21 to 8 logger calls while maintaining observability).

---

**Last Updated**: February 16, 2026
**Author**: Claude Code
**Status**: ✅ Active Standard
