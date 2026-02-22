# Role & Permissions Matrix

## Role Hierarchy

| Level | Role | Description |
|-------|------|-------------|
| 0 | `user` | Regular community member |
| 1 | `moderator` | Community moderator with forum/wiki powers |
| 2 | `developer` | Team member with workspace access |
| 3 | `admin` | Full system administrator |

Each role **inherits all permissions** from lower levels.

---

## Permissions by Category

### Forum Permissions

| Permission | User | Moderator | Developer | Admin |
|------------|:----:|:---------:|:---------:|:-----:|
| View Categories | ✅ | ✅ | ✅ | ✅ |
| View Private Categories | ❌ | ✅ | ✅ | ✅ |
| Create Topics | ✅ | ✅ | ✅ | ✅ |
| Edit Own Topics | ✅ | ✅ | ✅ | ✅ |
| Edit Any Topic | ❌ | ✅ | ✅ | ✅ |
| Delete Own Topics | ✅ | ✅ | ✅ | ✅ |
| Delete Any Topic | ❌ | ✅ | ✅ | ✅ |
| Reply to Topics | ✅ | ✅ | ✅ | ✅ |
| Edit Own Replies | ✅ | ✅ | ✅ | ✅ |
| Edit Any Reply | ❌ | ✅ | ✅ | ✅ |
| Delete Own Replies | ✅ | ✅ | ✅ | ✅ |
| Delete Any Reply | ❌ | ✅ | ✅ | ✅ |
| Pin Topics | ❌ | ✅ | ✅ | ✅ |
| Lock Topics | ❌ | ✅ | ✅ | ✅ |
| Moderate (General) | ❌ | ✅ | ✅ | ✅ |
| Ban Forum Users | ❌ | ✅ | ✅ | ✅ |
| Manage Categories | ❌ | ❌ | ❌ | ✅ |
| Manage Tags | ❌ | ❌ | ❌ | ✅ |
| View Deleted Content | ❌ | ✅ | ✅ | ✅ |
| Bypass Rate Limits | ❌ | ✅ | ✅ | ✅ |
| Mark Solutions | ✅ | ✅ | ✅ | ✅ |

### Wiki Permissions

| Permission | User | Moderator | Developer | Admin |
|------------|:----:|:---------:|:---------:|:-----:|
| View Pages | ✅ | ✅ | ✅ | ✅ |
| Edit Any Page | ❌ | ✅ | ✅ | ✅ |
| Create Pages | ❌ | ❌ | ✅ | ✅ |
| Delete Pages | ❌ | ❌ | ✅ | ✅ |
| Set Page Protection | ❌ | ❌ | ❌ | ✅ |

### Workspace Permissions

| Permission | User | Moderator | Developer | Admin |
|------------|:----:|:---------:|:---------:|:-----:|
| View Workspace | ✅ | ✅ | ✅ | ✅ |
| Edit Nodes | ❌ | ❌ | ✅ | ✅ |
| Create Nodes | ❌ | ❌ | ✅ | ✅ |
| Delete Nodes | ❌ | ❌ | ✅ | ✅ |
| Manage Connections | ❌ | ❌ | ✅ | ✅ |
| Full Access | ❌ | ❌ | ✅ | ✅ |

### User Management Permissions

| Permission | User | Moderator | Developer | Admin |
|------------|:----:|:---------:|:---------:|:-----:|
| View Profiles | ✅ | ✅ | ✅ | ✅ |
| Ban Users | ❌ | ✅ | ✅ | ✅ |
| Delete Users | ❌ | ❌ | ❌ | ✅ |

---

## Badge-Based Access (Supporters Lounge)

Forum categories can have additional access rules based on:

| Access Type | Example Value | Description |
|-------------|---------------|-------------|
| `role` | `moderator` | Requires minimum role level |
| `badge` | `admiral` | Requires specific badge |
| `badge_type` | `supporter` | Requires any badge of type |

### Supporter Tiers (Space Theme)

| Tier | Min Donation | Badge Color | Icon |
|------|-------------|-------------|------|
| Pioneer | $5 | Bronze (#cd7f32) | 🚀 rocket |
| Navigator | $25 | Silver (#c0c0c0) | 🧭 compass |
| Voyager | $100 | Gold (#ffd700) | 🌍 globe |
| Commander | $500 | Platinum (#e5e4e2) | ⭐ star |
| Admiral | $1000 | Diamond (#b9f2ff) | 👑 crown |

---

## Permission Levels for Category Access

| Level | Can View | Can Post | Can Moderate |
|-------|:--------:|:--------:|:------------:|
| `view` | ✅ | ❌ | ❌ |
| `post` | ✅ | ✅ | ❌ |
| `moderate` | ✅ | ✅ | ✅ |

---

## CSV Export

```csv
Permission,User,Moderator,Developer,Admin,Category
FORUM_VIEW_CATEGORY,YES,YES,YES,YES,Forum
FORUM_VIEW_PRIVATE_CATEGORY,NO,YES,YES,YES,Forum
FORUM_CREATE_TOPIC,YES,YES,YES,YES,Forum
FORUM_EDIT_OWN_TOPIC,YES,YES,YES,YES,Forum
FORUM_EDIT_ANY_TOPIC,NO,YES,YES,YES,Forum
FORUM_DELETE_OWN_TOPIC,YES,YES,YES,YES,Forum
FORUM_DELETE_ANY_TOPIC,NO,YES,YES,YES,Forum
FORUM_REPLY_TO_TOPIC,YES,YES,YES,YES,Forum
FORUM_EDIT_OWN_REPLY,YES,YES,YES,YES,Forum
FORUM_EDIT_ANY_REPLY,NO,YES,YES,YES,Forum
FORUM_DELETE_OWN_REPLY,YES,YES,YES,YES,Forum
FORUM_DELETE_ANY_REPLY,NO,YES,YES,YES,Forum
FORUM_PIN_TOPIC,NO,YES,YES,YES,Forum
FORUM_LOCK_TOPIC,NO,YES,YES,YES,Forum
FORUM_MODERATE,NO,YES,YES,YES,Forum
FORUM_BAN_USER,NO,YES,YES,YES,Forum
FORUM_MANAGE_CATEGORIES,NO,NO,NO,YES,Forum
FORUM_MANAGE_TAGS,NO,NO,NO,YES,Forum
FORUM_VIEW_DELETED,NO,YES,YES,YES,Forum
FORUM_BYPASS_RATE_LIMIT,NO,YES,YES,YES,Forum
FORUM_MARK_SOLUTION,YES,YES,YES,YES,Forum
WIKI_VIEW,YES,YES,YES,YES,Wiki
WIKI_EDIT_ANY,NO,YES,YES,YES,Wiki
WIKI_CREATE,NO,NO,YES,YES,Wiki
WIKI_DELETE,NO,NO,YES,YES,Wiki
WIKI_SET_PROTECTION,NO,NO,NO,YES,Wiki
WORKSPACE_VIEW,YES,YES,YES,YES,Workspace
WORKSPACE_EDIT_NODE,NO,NO,YES,YES,Workspace
WORKSPACE_CREATE_NODE,NO,NO,YES,YES,Workspace
WORKSPACE_DELETE_NODE,NO,NO,YES,YES,Workspace
WORKSPACE_MANAGE_CONNECTIONS,NO,NO,YES,YES,Workspace
WORKSPACE_FULL_ACCESS,NO,NO,YES,YES,Workspace
USERS_VIEW_PROFILES,YES,YES,YES,YES,Users
USERS_BAN,NO,YES,YES,YES,Users
USERS_DELETE,NO,NO,NO,YES,Users
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/users/types.ts` | User type with role union |
| `frontend/src/lib/permissions/types.ts` | Permission enum and role mappings |
| `frontend/src/lib/auth/server.ts` | Auth helpers (requireAdmin, requireModerator, requireDeveloper) |
| `frontend/src/lib/badges/types.ts` | Badge types and supporter tiers |
| `frontend/src/lib/forums/services/CategoryAccessService.ts` | Badge-based category access |
| `frontend/src/lib/timed-releases/service.ts` | Supporter early access system |

---

*Last Updated: November 30, 2025*
