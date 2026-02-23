# Exact Fixes Needed: Yjs Observer Error Handling

**File**: `/frontend/src/stores/workspace.ts`
**Date**: November 27, 2025
**Severity**: HIGH - Silent data loss possible

---

## Overview: Three Observers Need Fixes

All three Yjs observers (nodes, connections, viewport) need error handling added.

---

## FIX #1: Nodes Observer (Lines 231-258)

### Current Code (BROKEN)
```typescript
231      // Subscribe to Yjs nodes changes (incremental updates to avoid race conditions)
232      nodes.observe(event => {
233        console.log('[Yjs Observer] Nodes changed, processing event:', {
234          keysChanged: Array.from(event.changes.keys.keys()),
235          actions: Array.from(event.changes.keys.entries()).map(([key, change]) => ({
236            key,
237            action: change.action,
238          })),
239        });
240
241        set(state => {
242          // Process adds and updates
243          event.changes.keys.forEach((change, key) => {
244            if (change.action === 'add' || change.action === 'update') {
245              const node = nodes.get(key);
246              if (node) {
247                console.log(`[Yjs Observer] ${change.action} node:`, key, node);
248                state.nodes.set(key, node);
249              } else {
250                console.warn(`[Yjs Observer] ${change.action} action but node not found in Yjs:`, key);
251              }
252            } else if (change.action === 'delete') {
253              console.warn('[Yjs Observer] DELETE action detected for node:', key);
254              console.trace('[Yjs Observer] Delete stack trace');
255              state.nodes.delete(key);
256            }
257          });
258        });
259      });
```

### Fixed Code (PASTE THIS)
```typescript
231      // Subscribe to Yjs nodes changes (incremental updates to avoid race conditions)
232      nodes.observe(event => {
233        try {
234          console.log('[Yjs Observer] Nodes changed, processing event:', {
235            keysChanged: Array.from(event.changes.keys.keys()),
236          });
237
238          set(state => {
239            try {
240              event.changes.keys.forEach((change, key) => {
240a             try {
240b               if (change.action === 'add' || change.action === 'update') {
240c                 const node = nodes.get(key);
240d                 if (node) {
240e                   console.log(`[Yjs Observer] ${change.action} node:`, key, node);
240f                   state.nodes.set(key, node);
240g                 } else {
240h                   console.warn(`[Yjs Observer] ${change.action} action but node not found in Yjs:`, key);
240i                 }
240j               } else if (change.action === 'delete') {
240k                 console.warn('[Yjs Observer] DELETE action detected for node:', key);
240l                 console.trace('[Yjs Observer] Delete stack trace');
240m                 state.nodes.delete(key);
240n               }
240o             } catch (err) {
240p               // Skip revoked proxies silently
240q               if (!(err instanceof TypeError && err.message.includes('revoked'))) {
240r                 console.error(`[Yjs Observer] Error on node ${key}:`, err);
240s               }
240t             }
241              });
242            } catch (err) {
243              if (!(err instanceof TypeError && err.message.includes('revoked'))) {
244                console.error('[Yjs Observer] Error in set() callback:', err);
245              }
246            }
247          });
248        } catch (err) {
249          if (!(err instanceof TypeError && err.message.includes('revoked'))) {
250            console.error('[Yjs Observer] Observer error:', err);
251          }
252        }
253      });
```

### What Changed
| Line | Change |
|------|--------|
| 233 | Add: `try {` before logging |
| 238 | Add: `set(state => {` inside try block |
| 239 | Add: inner `try {` for forEach loop |
| 240a-240t | Wrap all forEach body in try-catch |
| 242 | Add: `} catch (err)` for set() errors |
| 248 | Add: `} catch (err)` for observer errors |

---

## FIX #2: Connections Observer (Lines 260-275)

### Current Code (BROKEN)
```typescript
260      // Subscribe to Yjs connections changes (incremental updates to avoid race conditions)
261      connections.observe(event => {
262        set(state => {
263          // Process adds and updates
264          event.changes.keys.forEach((change, key) => {
265            if (change.action === 'add' || change.action === 'update') {
266              const connection = connections.get(key);
267              if (connection) {
268                state.connections.set(key, connection);
269              }
270            } else if (change.action === 'delete') {
271              state.connections.delete(key);
272            }
273          });
274        });
275      });
```

### Fixed Code (PASTE THIS)
```typescript
260      // Subscribe to Yjs connections changes (incremental updates to avoid race conditions)
261      connections.observe(event => {
262        try {
263          set(state => {
264            try {
265              // Process adds and updates
266              event.changes.keys.forEach((change, key) => {
267                try {
268                  if (change.action === 'add' || change.action === 'update') {
269                    const connection = connections.get(key);
270                    if (connection) {
271                      state.connections.set(key, connection);
272                    }
273                  } else if (change.action === 'delete') {
274                    state.connections.delete(key);
275                  }
276                } catch (err) {
277                  if (!(err instanceof TypeError && err.message.includes('revoked'))) {
278                    console.error(`[Yjs Observer] Error on connection ${key}:`, err);
279                  }
280                }
281              });
282            } catch (err) {
283              if (!(err instanceof TypeError && err.message.includes('revoked'))) {
284                console.error('[Yjs Observer] Error in set() callback (connections):', err);
285              }
286            }
287          });
288        } catch (err) {
289          if (!(err instanceof TypeError && err.message.includes('revoked'))) {
290            console.error('[Yjs Observer] Observer error (connections):', err);
291          }
292        }
293      });
```

### What Changed
| Line | Change |
|------|--------|
| 262 | Add: `try {` before set() |
| 264 | Add: inner `try {` for set() body |
| 267 | Add: innermost `try {` for forEach body |
| 276-280 | Add: try-catch for per-connection errors |
| 282-286 | Add: catch for set() errors |
| 288-292 | Add: catch for observer errors |

---

## FIX #3: Viewport Observer (Lines 277-286)

### Current Code (Less Critical - Reads Primitives)
```typescript
277      // Subscribe to Yjs viewport changes
278      viewport.observe(() => {
279        set(state => {
280          state.viewport = {
281            offsetX: viewport.get('offsetX') ?? 0,
282            offsetY: viewport.get('offsetY') ?? 0,
283            scale: viewport.get('scale') ?? 1,
284          };
285        });
286      });
```

### Fixed Code (PASTE THIS)
```typescript
277      // Subscribe to Yjs viewport changes
278      viewport.observe(() => {
279        try {
280          set(state => {
281            try {
282              state.viewport = {
283                offsetX: viewport.get('offsetX') ?? 0,
284                offsetY: viewport.get('offsetY') ?? 0,
285                scale: viewport.get('scale') ?? 1,
286              };
287            } catch (err) {
288              if (!(err instanceof TypeError && err.message.includes('revoked'))) {
289                console.error('[Yjs Observer] Error in set() callback (viewport):', err);
290              }
291            }
292          });
293        } catch (err) {
294          if (!(err instanceof TypeError && err.message.includes('revoked'))) {
295            console.error('[Yjs Observer] Observer error (viewport):', err);
296          }
297        }
298      });
```

### What Changed
| Line | Change |
|------|--------|
| 279 | Add: `try {` before set() |
| 281 | Add: inner `try {` for set() body |
| 287-291 | Add: catch for set() errors |
| 293-297 | Add: catch for observer errors |

---

## Summary of All Changes

### Lines to Modify
1. **Lines 230-259**: Nodes observer - add 3 layers of try-catch
2. **Lines 260-275**: Connections observer - add 3 layers of try-catch
3. **Lines 277-286**: Viewport observer - add 2 layers of try-catch (simpler because reads primitives)

### Total Changes
- Add ~50 lines of error handling
- No logic changes - just wraps existing code
- Follows existing pattern in updateNode/deleteNode (lines 545-551, 579-583)

### Testing After Changes
```bash
cd frontend
npm run type-check     # Should pass with 0 errors
npm run format         # Auto-format if needed
npm run dev            # Start dev server with Strict Mode
# In browser:
# - Add a node (should work)
# - Delete a node (should work)
# - Drag a node (should work)
# - Check console (no "illegal operation" errors)
```

---

## Backup Before Starting

```bash
cp frontend/src/stores/workspace.ts frontend/src/stores/workspace.ts.backup
```

Then if something goes wrong:
```bash
cp frontend/src/stores/workspace.ts.backup frontend/src/stores/workspace.ts
```

---

## Implementation Checklist

- [ ] Open `/frontend/src/stores/workspace.ts`
- [ ] Find line 231 (Nodes observer start)
- [ ] Apply FIX #1 (lines 231-258)
- [ ] Find line 261 (Connections observer start)
- [ ] Apply FIX #2 (lines 260-275)
- [ ] Find line 278 (Viewport observer start)
- [ ] Apply FIX #3 (lines 277-286)
- [ ] Run `npm run type-check` - should pass
- [ ] Run `npm run dev` - should start without errors
- [ ] Test in browser - add/delete/drag nodes
- [ ] Check console - no "illegal operation" errors
- [ ] Commit: `git add . && git commit -m "Fix: Add error handling to Yjs observers for revoked proxy errors"`

---

## Why These Exact Changes

### Three Layers of Error Handling

1. **Observer callback try-catch** (outermost)
   - Catches errors in the observer setup itself
   - Prevents observer from being destroyed

2. **set() callback try-catch** (middle)
   - Catches errors in the state update function
   - Prevents state corruption

3. **forEach loop try-catch** (innermost)
   - Catches errors per-item (per node, per connection)
   - Allows other items to process even if one fails

### Why Filter for "revoked" in Error Message

```typescript
if (!(err instanceof TypeError && err.message.includes('revoked'))) {
  console.error('[...] Error:', err);
}
```

This pattern:
- ✅ Silently ignores "revoked proxy" errors (normal in React Strict Mode)
- ✅ Still logs OTHER errors (real bugs)
- ✅ Matches pattern already used in action creators

---

## What Happens With This Fix

### Before (BROKEN)
```
User adds node
→ Observer fires
→ nodes.get(key) accesses revoked proxy
→ Throws "illegal operation attempted on a revoked proxy"
→ Error crashes observer
→ state.nodes.delete(key) already executed for some nodes
→ Nodes mysteriously disappear
→ Silent data loss
```

### After (FIXED)
```
User adds node
→ Observer fires
→ Try to access nodes.get(key)
→ If revoked: caught by try-catch, silently ignored
→ If not revoked: proceeds normally
→ state.nodes.set(key, node) executes
→ No data loss
→ Yjs syncs correctly
```

---

## Questions?

If something doesn't work:
1. Check line numbers match (file might have changed)
2. Verify you're editing `/frontend/src/stores/workspace.ts` not another file
3. Run `npm run type-check` to find issues
4. Check git diff to see what changed: `git diff frontend/src/stores/workspace.ts`
5. Restore backup if needed: `cp frontend/src/stores/workspace.ts.backup frontend/src/stores/workspace.ts`

**Don't commit if type-check fails.**

---

## Version Info

- **File**: `/frontend/src/stores/workspace.ts`
- **Last Modified**: November 27, 2025 (commit 369b624)
- **Current Issue**: Observers lack error handling like action creators have
- **This Fix**: Adds error handling to match action creators
