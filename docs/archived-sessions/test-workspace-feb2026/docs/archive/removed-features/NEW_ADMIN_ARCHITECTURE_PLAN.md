# New Admin Tools Architecture Plan

## Vision

Build a lightweight, context-aware admin system that integrates seamlessly into the existing UI without impacting regular user performance. Each section of the site will have purpose-built admin tools that appear only when needed.

## Design Principles

1. **Minimalist UI** - Admin tools should be invisible to regular users and minimal when visible to admins
2. **Performance First** - Admin code should be dynamically loaded only when needed
3. **Context Aware** - Each section gets tailored admin actions relevant to that content type
4. **Progressive Enhancement** - Start with essential features, add advanced features based on usage
5. **Security by Default** - All admin actions require authentication and authorization checks

## Technical Architecture

### 1. Component Structure

```
/components/admin/
  /dropdowns/
    WikiAdminDropdown.tsx      # Wiki-specific admin actions
    LibraryAdminDropdown.tsx   # Library-specific admin actions
    ForumAdminDropdown.tsx     # Forum-specific admin actions
    ProfileAdminDropdown.tsx   # User profile admin actions
  /shared/
    AdminDropdownBase.tsx      # Shared dropdown container
    AdminActionButton.tsx      # Reusable action button
    AdminConfirmDialog.tsx     # Confirmation modal
    AdminToast.tsx            # Success/error notifications
  /hooks/
    useAdminPermissions.ts    # Permission checking
    useAdminAction.ts         # Action execution logic
```

### 2. Dynamic Loading Strategy

```typescript
// Lazy load admin components only for admin users
const AdminDropdown = dynamic(
  () => import('@/components/admin/dropdowns/WikiAdminDropdown'),
  {
    ssr: false,
    loading: () => null
  }
);

// In component
{user?.role === 'admin' && <AdminDropdown {...props} />}
```

### 3. API Structure

```
/api/admin/
  /wiki/
    /[slug]/protect         # Toggle page protection
    /[slug]/feature         # Toggle featured status
    /[slug]/delete          # Delete page
    /[slug]/metadata        # Edit metadata
  /library/
    /[slug]/moderate        # Moderate annotations
    /[slug]/visibility      # Change visibility
    /[slug]/delete          # Delete document
  /forum/
    /[id]/lock              # Lock/unlock topic
    /[id]/pin               # Pin/unpin topic
    /[id]/solve             # Mark as solved
    /[id]/move              # Move to category
  /users/
    /[id]/ban               # Ban/unban user
    /[id]/role              # Change user role
    /[id]/reset             # Reset password
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

**Goal**: Set up the foundational admin system

1. **Authentication & Authorization**
   ```typescript
   // middleware.ts
   export function adminMiddleware(req: NextRequest) {
     const session = await getSession(req);
     if (!session || session.user.role !== 'admin') {
       return new Response('Unauthorized', { status: 401 });
     }
   }
   ```

2. **Base Components**
   - Create AdminDropdownBase component
   - Implement AdminConfirmDialog
   - Add AdminToast notifications
   - Build useAdminPermissions hook

3. **Audit Logging**
   ```sql
   CREATE TABLE admin_actions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     action TEXT NOT NULL,
     resource_type TEXT NOT NULL,
     resource_id TEXT,
     metadata TEXT,
     ip_address TEXT,
     created_at TEXT DEFAULT CURRENT_TIMESTAMP
   );
   ```

### Phase 2: Wiki Admin Tools (Week 2)

**Goal**: Implement wiki-specific admin features

1. **WikiAdminDropdown Component**
   ```typescript
   interface WikiAdminActions {
     canProtect: boolean;
     canFeature: boolean;
     canDelete: boolean;
     canEditMetadata: boolean;
     canViewHistory: boolean;
   }
   ```

2. **API Endpoints**
   - `/api/admin/wiki/[slug]/protect`
   - `/api/admin/wiki/[slug]/feature`
   - `/api/admin/wiki/[slug]/delete`
   - `/api/admin/wiki/[slug]/metadata`

3. **Integration**
   ```typescript
   // In wiki/[slug]/page.tsx
   import dynamic from 'next/dynamic';

   const WikiAdminDropdown = dynamic(
     () => import('@/components/admin/dropdowns/WikiAdminDropdown'),
     { ssr: false }
   );

   // In render
   {user?.role === 'admin' && (
     <WikiAdminDropdown
       page={page}
       onAction={handleAdminAction}
     />
   )}
   ```

### Phase 3: Forum Admin Tools (Week 3)

**Goal**: Implement forum moderation features

1. **ForumAdminDropdown Component**
   ```typescript
   interface ForumAdminActions {
     canLock: boolean;
     canPin: boolean;
     canMarkSolved: boolean;
     canMove: boolean;
     canModerateUser: boolean;
     canDelete: boolean;
   }
   ```

2. **Moderation Queue**
   - Flagged content review
   - Bulk moderation actions
   - User report handling

3. **Auto-moderation Rules**
   ```typescript
   interface ModerationRule {
     id: number;
     trigger: 'keyword' | 'pattern' | 'user';
     action: 'flag' | 'hide' | 'delete';
     value: string;
     enabled: boolean;
   }
   ```

### Phase 4: Library Admin Tools (Week 4)

**Goal**: Implement library management features

1. **LibraryAdminDropdown Component**
   - Annotation moderation
   - Document visibility control
   - Collection management
   - Metadata editing

2. **Bulk Operations**
   - Multi-select documents
   - Batch visibility changes
   - Bulk metadata updates

### Phase 5: User Management (Week 5)

**Goal**: Implement user administration features

1. **User Admin Features**
   - Role management (admin, moderator, member)
   - Account status (active, suspended, banned)
   - Activity monitoring
   - Password reset capabilities

2. **Profile Admin Dropdown**
   - View user activity
   - Change user role
   - Suspend/ban account
   - Reset password

## Security Considerations

### 1. Permission Checks

```typescript
// Every admin action must verify permissions
async function checkAdminPermission(
  userId: string,
  action: string,
  resource?: string
): Promise<boolean> {
  const user = await getUserById(userId);

  // Check role
  if (user.role !== 'admin' && user.role !== 'moderator') {
    return false;
  }

  // Check specific permissions
  const permission = await getPermission(user.role, action, resource);
  return permission.allowed;
}
```

### 2. Rate Limiting

```typescript
// Admin actions have higher limits but still need protection
const adminRateLimits = {
  delete: { window: '1m', max: 5 },
  update: { window: '1m', max: 20 },
  bulk: { window: '5m', max: 10 }
};
```

### 3. Audit Trail

```typescript
// Log every admin action
async function logAdminAction(
  userId: string,
  action: string,
  resource: { type: string; id: string },
  metadata?: any
) {
  await db.adminActions.create({
    user_id: userId,
    action,
    resource_type: resource.type,
    resource_id: resource.id,
    metadata: JSON.stringify(metadata),
    ip_address: getClientIp(),
    created_at: new Date().toISOString()
  });
}
```

## UI/UX Guidelines

### 1. Dropdown Design

```typescript
// Consistent dropdown styling
const adminDropdownStyles = {
  trigger: 'text-red-500 hover:text-red-400', // Red for admin actions
  menu: 'bg-gray-900 border-red-500/20',
  item: 'hover:bg-red-500/10',
  destructive: 'text-red-400 hover:text-red-300'
};
```

### 2. Confirmation Dialogs

```typescript
// Always confirm destructive actions
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  confirmStyle?: 'danger' | 'warning' | 'normal';
  onConfirm: () => void;
  onCancel: () => void;
}
```

### 3. Keyboard Shortcuts

```typescript
// Power user shortcuts (when dropdown is open)
const adminShortcuts = {
  'd': 'delete',
  'p': 'protect',
  'f': 'feature',
  'l': 'lock',
  'escape': 'close'
};
```

## Performance Optimization

### 1. Code Splitting

```typescript
// Admin code in separate chunks
export const adminChunks = {
  wiki: () => import('./wiki-admin'),
  forum: () => import('./forum-admin'),
  library: () => import('./library-admin')
};
```

### 2. Caching Strategy

```typescript
// Cache admin permissions
const permissionCache = new Map();

async function getCachedPermission(userId: string, action: string) {
  const key = `${userId}:${action}`;
  if (!permissionCache.has(key)) {
    const permission = await checkPermission(userId, action);
    permissionCache.set(key, {
      value: permission,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    });
  }
  return permissionCache.get(key).value;
}
```

### 3. Optimistic Updates

```typescript
// Update UI immediately, rollback on error
async function optimisticAdminAction(action: () => Promise<void>) {
  // Update UI
  setOptimisticState(true);

  try {
    await action();
    // Success - keep UI updated
  } catch (error) {
    // Rollback UI
    setOptimisticState(false);
    showError(error.message);
  }
}
```

## Testing Strategy

### 1. Unit Tests

```typescript
// Test permission checks
describe('AdminPermissions', () => {
  it('should allow admin to delete wiki page', async () => {
    const canDelete = await checkPermission('admin', 'wiki.delete');
    expect(canDelete).toBe(true);
  });

  it('should deny regular user admin actions', async () => {
    const canDelete = await checkPermission('user', 'wiki.delete');
    expect(canDelete).toBe(false);
  });
});
```

### 2. Integration Tests

```typescript
// Test complete admin workflows
describe('WikiAdminWorkflow', () => {
  it('should protect and unprotect page', async () => {
    // Login as admin
    await loginAsAdmin();

    // Navigate to wiki page
    await page.goto('/wiki/test-page');

    // Open admin dropdown
    await page.click('[data-testid="admin-dropdown"]');

    // Click protect
    await page.click('[data-testid="protect-page"]');

    // Verify protected
    expect(await page.locator('.protected-badge')).toBeVisible();
  });
});
```

### 3. E2E Tests

```typescript
// Test admin features across the application
describe('AdminE2E', () => {
  it('should moderate content across sections', async () => {
    // Test wiki moderation
    await moderateWikiPage();

    // Test forum moderation
    await moderateForumTopic();

    // Test library moderation
    await moderateLibraryDocument();

    // Verify audit log
    await verifyAuditLog();
  });
});
```

## Monitoring & Analytics

### 1. Admin Action Metrics

```typescript
// Track admin action usage
interface AdminMetrics {
  action: string;
  count: number;
  avgDuration: number;
  errorRate: number;
  lastUsed: Date;
}
```

### 2. Performance Monitoring

```typescript
// Monitor admin feature performance
const adminPerformanceObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.startsWith('admin.')) {
      trackAdminPerformance(entry);
    }
  }
});
```

### 3. Error Tracking

```typescript
// Capture and report admin errors
window.addEventListener('error', (event) => {
  if (event.filename?.includes('/admin/')) {
    reportAdminError({
      message: event.message,
      stack: event.error?.stack,
      user: getCurrentUser(),
      context: getPageContext()
    });
  }
});
```

## Migration Checklist

- [ ] Set up admin database tables
- [ ] Create base admin components
- [ ] Implement permission system
- [ ] Add audit logging
- [ ] Build WikiAdminDropdown
- [ ] Build ForumAdminDropdown
- [ ] Build LibraryAdminDropdown
- [ ] Create admin API endpoints
- [ ] Add rate limiting
- [ ] Implement caching
- [ ] Write tests
- [ ] Add monitoring
- [ ] Document admin features
- [ ] Train moderators
- [ ] Deploy Phase 1

## Success Metrics

1. **Performance**
   - Admin features load in <100ms
   - No impact on regular user performance
   - Admin bundle size <50KB

2. **Usability**
   - Admin actions complete in <2 seconds
   - Clear feedback for all actions
   - Keyboard shortcuts for power users

3. **Security**
   - Zero unauthorized admin actions
   - 100% audit coverage
   - Rate limiting prevents abuse

4. **Adoption**
   - 90% of admins use new tools daily
   - <5% error rate
   - Positive user feedback

## Conclusion

This architecture provides a solid foundation for rebuilding admin tools that are:
- **Lightweight** - Minimal impact on regular users
- **Powerful** - All necessary moderation features
- **Secure** - Proper authentication and authorization
- **Scalable** - Easy to add new features
- **Maintainable** - Clear separation of concerns

The phased approach ensures we can deliver value quickly while building towards a comprehensive admin system.