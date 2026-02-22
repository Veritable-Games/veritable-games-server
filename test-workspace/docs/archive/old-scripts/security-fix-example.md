# Security Fix Example - Critical Vulnerability

## Before: Vulnerable Admin Route

**File**: `/src/app/api/admin/library/tags/route.ts`  
**Vulnerability**: No authentication or CSRF protection on admin route  
**Risk**: CRITICAL - Complete tag system compromise

```typescript
import { dbPool } from '@/lib/database/pool';
import { NextRequest, NextResponse } from 'next/server';

// ❌ CRITICAL VULNERABILITY: No security middleware
export async function GET(request: NextRequest) {
  const db = dbPool.getConnection('forums');
  // Anyone can access admin tag data
  const tags = db.prepare(`SELECT * FROM library_tags`).all();
  return NextResponse.json({ success: true, tags });
}

// ❌ CRITICAL VULNERABILITY: No authentication on POST
export async function POST(request: NextRequest) {
  const db = dbPool.getConnection('forums');
  const { name, type, description } = await request.json();
  // Anyone can create tags in the system
  const result = db
    .prepare(
      `
    INSERT INTO library_tags (name, category_id, description, usage_count)
    VALUES (?, ?, ?, 0)
  `
    )
    .run(name, category.id, description || null);

  return NextResponse.json({ success: true, tag: { id: result.lastInsertRowid } });
}

// ❌ CRITICAL VULNERABILITY: No protection on PUT/DELETE
export async function PUT(request: NextRequest) {
  /* ... */
}
export async function DELETE(request: NextRequest) {
  /* ... */
}
```

## After: Secure Admin Route

**Applied Fix**: `withSecurity()` wrapper with admin role requirement

```typescript
import { dbPool } from '@/lib/database/pool';
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware'; // ✅ Added security import

// ✅ SECURE: Converted to handler function
async function getHandler(request: NextRequest) {
  const db = dbPool.getConnection('forums');

  try {
    // Get all tags with their usage counts from wiki pages
    const tags = db
      .prepare(
        `
      SELECT 
        t.id,
        t.name,
        tc.type as category_type,
        tc.name as category_name,
        t.description,
        t.usage_count,
        t.created_at,
        (
          SELECT COUNT(DISTINCT wpt.page_id)
          FROM wiki_page_tags wpt
          JOIN wiki_tags wt ON wpt.tag_id = wt.id
          WHERE wt.name = tc.type || ':' || t.name
        ) as actual_usage_count
      FROM library_tags t
      LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
      ORDER BY tc.type, t.name
    `
      )
      .all();

    const formattedTags = tags.map((tag) => ({
      id: tag.id,
      type: tag.category_type,
      tag: tag.name,
      full: `${tag.category_type}:${tag.name}`,
      count: tag.actual_usage_count || 0,
      description: tag.description,
      created_at: tag.created_at,
    }));

    return NextResponse.json({
      success: true,
      tags: formattedTags,
    });
  } catch (error) {
    console.error('Error fetching library tags:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tags' }, { status: 500 });
  }
}

// ✅ SECURE: Converted to handler function
async function postHandler(request: NextRequest) {
  const db = dbPool.getConnection('forums');

  try {
    const { name, type, description } = await request.json();

    if (!name || !type) {
      return NextResponse.json(
        { success: false, error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Get the category ID for the type
    const category = db
      .prepare(
        `
      SELECT id FROM library_tag_categories WHERE type = ?
    `
      )
      .get(type);

    if (!category) {
      return NextResponse.json({ success: false, error: 'Invalid tag type' }, { status: 400 });
    }

    // Check if tag already exists
    const existing = db
      .prepare(
        `
      SELECT id FROM library_tags 
      WHERE name = ? AND category_id = ?
    `
      )
      .get(name, category.id);

    if (existing) {
      return NextResponse.json({ success: false, error: 'Tag already exists' }, { status: 400 });
    }

    // Insert the new tag
    const result = db
      .prepare(
        `
      INSERT INTO library_tags (name, category_id, description, usage_count)
      VALUES (?, ?, ?, 0)
    `
      )
      .run(name, category.id, description || null);

    return NextResponse.json({
      success: true,
      tag: {
        id: result.lastInsertRowid,
        type: type,
        tag: name,
        full: `${type}:${name}`,
        count: 0,
      },
    });
  } catch (error) {
    console.error('Error creating library tag:', error);
    return NextResponse.json({ success: false, error: 'Failed to create tag' }, { status: 500 });
  }
}

// ✅ SECURE: Converted to handler function
async function putHandler(request: NextRequest) {
  const db = dbPool.getConnection('forums');

  try {
    const { id, name, description } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Tag ID is required' }, { status: 400 });
    }

    const stmt = db.prepare(`
      UPDATE library_tags 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description)
      WHERE id = ?
    `);

    const result = stmt.run(name || null, description || null, id);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating library tag:', error);
    return NextResponse.json({ success: false, error: 'Failed to update tag' }, { status: 500 });
  }
}

// ✅ SECURE: Converted to handler function
async function deleteHandler(request: NextRequest) {
  const db = dbPool.getConnection('forums');

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Tag ID is required' }, { status: 400 });
    }

    // Check if tag is in use
    const tag = db
      .prepare(
        `
      SELECT t.*, tc.type 
      FROM library_tags t
      LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
      WHERE t.id = ?
    `
      )
      .get(id);

    if (!tag) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    // Check usage in wiki pages
    const fullTag = `${tag.type}:${tag.name}`;
    const usage = db
      .prepare(
        `
      SELECT COUNT(DISTINCT wpt.page_id) as count
      FROM wiki_page_tags wpt
      JOIN wiki_tags wt ON wpt.tag_id = wt.id
      WHERE wt.name = ?
    `
      )
      .get(fullTag);

    if (usage.count > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete tag that is in use' },
        { status: 400 }
      );
    }

    // Delete the tag
    const result = db.prepare('DELETE FROM library_tags WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Failed to delete tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting library tag:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete tag' }, { status: 500 });
  }
}

// ✅ SECURE: Apply comprehensive security to all routes
export const GET = withSecurity(getHandler, {
  requireAuth: true,
  requiredRole: 'admin', // Only admins can access
  csrfEnabled: false, // GET requests don't need CSRF
  rateLimitEnabled: true,
  rateLimitConfig: 'strict', // 10 requests per minute
  cspEnabled: true,
});

export const POST = withSecurity(postHandler, {
  requireAuth: true,
  requiredRole: 'admin', // Only admins can create tags
  csrfEnabled: true, // CSRF protection for state changes
  rateLimitEnabled: true,
  rateLimitConfig: 'strict', // 10 requests per minute
  cspEnabled: true,
});

export const PUT = withSecurity(putHandler, {
  requireAuth: true,
  requiredRole: 'admin', // Only admins can modify tags
  csrfEnabled: true, // CSRF protection for state changes
  rateLimitEnabled: true,
  rateLimitConfig: 'strict', // 10 requests per minute
  cspEnabled: true,
});

export const DELETE = withSecurity(deleteHandler, {
  requireAuth: true,
  requiredRole: 'admin', // Only admins can delete tags
  csrfEnabled: true, // CSRF protection for state changes
  rateLimitEnabled: true,
  rateLimitConfig: 'strict', // 10 requests per minute
  cspEnabled: true,
});
```

## Security Improvements Applied

### 1. Authentication & Authorization

- ✅ **Admin Role Requirement**: `requiredRole: 'admin'`
- ✅ **Session Validation**: Automatic via `withSecurity()`
- ✅ **Access Control**: Only authenticated admins can access

### 2. CSRF Protection

- ✅ **Token Validation**: Automatic HMAC-SHA256 verification
- ✅ **State-Changing Protection**: POST/PUT/DELETE methods protected
- ✅ **Header Checking**: Validates `x-csrf-token` header

### 3. Rate Limiting

- ✅ **Strict Limits**: 10 requests per minute for admin routes
- ✅ **IP-based Tracking**: Prevents abuse from single source
- ✅ **Headers Added**: Rate limit info in response headers

### 4. Content Security Policy

- ✅ **Nonce Generation**: Dynamic nonce for each request
- ✅ **Security Headers**: X-Frame-Options, X-Content-Type-Options
- ✅ **CSP Violation Reporting**: Automatic violation detection

## Attack Scenarios Prevented

### Before Fix - Possible Attacks:

1. **Privilege Escalation**: Any user could access admin tag management
2. **CSRF Attack**: Malicious website could create/delete tags via admin session
3. **Data Manipulation**: Unauthorized modification of tag system
4. **DoS Attack**: No rate limiting allowed resource exhaustion

### After Fix - Security Guarantees:

1. **Only Authenticated Admins**: Complete access control
2. **CSRF Protection**: Cross-site attacks prevented by token validation
3. **Rate Limiting**: Prevents abuse and DoS attempts
4. **Audit Trail**: All admin actions logged with IP addresses
5. **Content Security**: CSP headers prevent XSS attacks

## Testing the Fix

### Manual Verification

```bash
# 1. Test without admin role (should fail)
curl -X POST http://localhost:3000/api/admin/library/tags \
  -H "Content-Type: application/json" \
  -d '{"name":"test","type":"character"}'
# Expected: 401 Unauthorized

# 2. Test with admin role but no CSRF token (should fail)
curl -X POST http://localhost:3000/api/admin/library/tags \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=admin_session" \
  -d '{"name":"test","type":"character"}'
# Expected: 403 CSRF token required

# 3. Test with admin role and CSRF token (should succeed)
curl -X POST http://localhost:3000/api/admin/library/tags \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=admin_session" \
  -H "x-csrf-token: valid_csrf_token" \
  -d '{"name":"test","type":"character"}'
# Expected: 200 Success
```

### Automated Testing

```javascript
// Test suite for security verification
describe('Admin Library Tags Security', () => {
  test('requires admin authentication', async () => {
    const response = await request(app)
      .post('/api/admin/library/tags')
      .send({ name: 'test', type: 'character' });
    expect(response.status).toBe(401);
  });

  test('requires CSRF token for POST', async () => {
    const response = await request(app)
      .post('/api/admin/library/tags')
      .set('Cookie', 'session_id=admin_session')
      .send({ name: 'test', type: 'character' });
    expect(response.status).toBe(403);
  });

  test('enforces rate limiting', async () => {
    // Make 11 requests (exceeds 10/minute limit)
    const promises = Array(11)
      .fill()
      .map(() =>
        request(app).get('/api/admin/library/tags').set('Cookie', 'session_id=admin_session')
      );
    const responses = await Promise.all(promises);
    expect(responses[10].status).toBe(429); // Too Many Requests
  });
});
```

This example demonstrates the complete transformation from a critically vulnerable route to a fully secured admin endpoint with comprehensive protection against all major attack vectors.
