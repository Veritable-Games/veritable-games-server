# FUNDAMENTAL ISSUES WITH PROJECT EDITING

## The Problem
You cannot edit project pages because of multiple cascading failures:

## 1. Database Architecture Disaster
- `users` table exists in BOTH `auth.db` AND `main.db`
- `user_sessions` table exists in BOTH `auth.db` AND `main.db`
- Auth service was looking in wrong database (`main.db` instead of `auth.db`)
- FIXED: Changed `getAuthDatabase()` to return `auth` connection instead of `users`

## 2. Authentication Cookie Mismatch
- Auth system expects cookie named `session_id`
- Test instructions were using wrong cookie name `sessionId` or `sessionToken`
- FIXED: Now using correct cookie name

## 3. Save Button Not Connected
- Footer save button only called `setIsEditing(false)` - did NOTHING with content
- No actual save function was triggered
- FIXED: Connected save button to `projectTabsRef.current.save()`

## 4. Missing Ref Support in ProjectTabs
- ProjectTabs component didn't support refs
- FIXED: Added `forwardRef` and `useImperativeHandle` to expose save method

## CURRENT STATUS
✅ Authentication now works (verified with /api/auth/me)
✅ Session validation works with correct cookie
✅ Save button is connected to actual save function
❌ BUT: CSRF protection on PUT endpoint still blocking saves
❌ Middleware returning empty responses/redirects

## TO TEST IN BROWSER

```javascript
// 1. Go to http://localhost:3000/projects/noxii
// 2. Open browser console and run:
document.cookie = "session_id=49757e2707d3dd889b5143cbfde3ed1dc871687eec2a53a3315ecce16b7f1b46; path=/"

// 3. Refresh the page
// 4. You should now see "Edit" button as admin
// 5. Click Edit, make changes, click Save
```

## THE REAL ISSUE
Even with all fixes, the save still won't work because:
1. CSRF middleware is blocking the PUT request
2. The frontend isn't properly sending CSRF tokens with saves
3. The API endpoint returns empty/redirect responses

This is NOT a simple "button not connected" issue - it's a complete authentication/security infrastructure failure.