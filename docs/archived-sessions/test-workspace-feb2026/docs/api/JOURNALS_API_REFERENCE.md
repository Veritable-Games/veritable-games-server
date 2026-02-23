# Journals API Reference

**Version**: 3.0
**Base URL**: `/api/journals`
**Authentication**: Required for all endpoints
**Updated**: February 16, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Core Operations](#core-operations)
5. [Search](#search)
6. [Delete & Restore](#delete--restore)
7. [Categories](#categories)
8. [Journal Movement](#journal-movement)
9. [Rate Limits](#rate-limits)
10. [Changelog](#changelog)

---

## Overview

The Journals API provides RESTful endpoints for managing personal journal entries. All endpoints require authentication and operate on the authenticated user's journals unless the user is an admin/developer.

### Base URLs

- **Production**: `https://www.veritablegames.com/api/journals`
- **Development**: `http://localhost:3000/api/journals`

### Common Headers

```
Content-Type: application/json
Cookie: session_id=<session-token>
```

**Note**: CSRF protection is disabled for journal endpoints (using session-based auth instead).

---

## Authentication

All endpoints require a valid session cookie. Obtain a session by logging in via `/api/auth/login`.

### Example Login

```bash
curl -X POST https://www.veritablegames.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}' \
  -c cookies.txt

# Use cookies for subsequent requests
curl -X GET https://www.veritablegames.com/api/journals \
  -b cookies.txt
```

### Authorization Levels

| Role                | Permissions                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| **User**            | Create, read, update, delete own journals                                         |
| **Admin/Developer** | All user permissions + manage all journals + permanent delete + manage categories |

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code                   | Status | Description                      |
| ---------------------- | ------ | -------------------------------- |
| `AUTHENTICATION_ERROR` | 401    | User not authenticated           |
| `PERMISSION_ERROR`     | 403    | User lacks permission for action |
| `NOT_FOUND_ERROR`      | 404    | Resource not found               |
| `VALIDATION_ERROR`     | 400    | Invalid request data             |
| `INTERNAL_ERROR`       | 500    | Server error                     |

### Example Error Response

```json
{
  "success": false,
  "error": "You do not have permission to access this resource",
  "code": "PERMISSION_ERROR"
}
```

---

## Core Operations

### List Journals

**GET** `/api/journals`

Get all journals for the authenticated user.

#### Request

```bash
curl -X GET https://www.veritablegames.com/api/journals \
  -b cookies.txt
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "slug": "my-first-journal",
      "title": "My First Journal",
      "namespace": "journals",
      "created_at": "2026-02-15T10:30:00Z",
      "updated_at": "2026-02-16T14:20:00Z",
      "journal_category_id": "jcat-1-uncategorized",
      "is_deleted": false
    },
    {
      "id": 124,
      "slug": "productivity-notes",
      "title": "Productivity Notes",
      "namespace": "journals",
      "created_at": "2026-02-16T08:00:00Z",
      "updated_at": "2026-02-16T09:15:00Z",
      "journal_category_id": "jcat-1-work",
      "is_deleted": false
    }
  ]
}
```

#### Error Responses

- **401 Unauthorized**: User not authenticated

---

### Get Single Journal

**GET** `/api/journals/[slug]`

Fetch a single journal with its content.

#### Request

```bash
curl -X GET https://www.veritablegames.com/api/journals/my-first-journal \
  -b cookies.txt
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "my-first-journal",
    "title": "My First Journal",
    "created_at": "2026-02-15T10:30:00Z",
    "updated_at": "2026-02-16T14:20:00Z",
    "content": "# Today's Thoughts\n\nThis is my journal entry...",
    "revision_timestamp": "2026-02-16T14:20:00Z"
  }
}
```

#### Error Responses

- **401 Unauthorized**: User not authenticated
- **404 Not Found**: Journal not found or user doesn't own it

---

### Create Journal

**POST** `/api/journals`

Create a new journal entry.

#### Request Body

```json
{
  "title": "My New Journal" // Optional, auto-generates if omitted
}
```

#### Request

```bash
curl -X POST https://www.veritablegames.com/api/journals \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title": "My New Journal"}'
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": 125,
    "slug": "my-new-journal",
    "title": "My New Journal",
    "namespace": "journals",
    "created_at": "2026-02-16T15:00:00Z",
    "updated_at": "2026-02-16T15:00:00Z",
    "journal_category_id": "jcat-1-uncategorized",
    "is_deleted": false
  }
}
```

#### Auto-generated Title

If no title provided, generates: `"Journal - {current date/time}"`

```bash
curl -X POST https://www.veritablegames.com/api/journals \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'
```

Response:

```json
{
  "success": true,
  "data": {
    "title": "Journal - 2/16/2026, 3:15:30 PM",
    ...
  }
}
```

#### Error Responses

- **401 Unauthorized**: User not authenticated

---

### Update Journal

**PATCH** `/api/journals/[slug]`

Update journal content or title.

#### Request Body

```json
{
  "content": "# Updated Content\n\nNew journal entry...", // Optional
  "title": "Updated Title" // Optional
}
```

**Note**: Must provide either `content` or `title` (or both).

#### Update Content

```bash
curl -X PATCH https://www.veritablegames.com/api/journals/my-journal \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"content": "# Updated\n\nNew content here"}'
```

Response (200 OK):

```json
{
  "success": true,
  "message": "Saved successfully"
}
```

#### Rename Journal

```bash
curl -X PATCH https://www.veritablegames.com/api/journals/my-journal \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title": "New Journal Title"}'
```

Response (200 OK):

```json
{
  "success": true,
  "message": "Title updated successfully"
}
```

#### Error Responses

- **400 Bad Request**: Neither content nor title provided
- **400 Bad Request**: Empty title provided
- **401 Unauthorized**: User not authenticated
- **404 Not Found**: Journal not found or user doesn't own it

---

## Search

### Search Journals

**GET** `/api/journals/search`

Full-text search across user's journals using PostgreSQL FTS.

#### Query Parameters

| Parameter      | Type    | Required | Default | Description                                |
| -------------- | ------- | -------- | ------- | ------------------------------------------ |
| `q` or `query` | string  | Yes      | -       | Search query (min 2 characters)            |
| `limit`        | integer | No       | 20      | Results per page (max 100)                 |
| `offset`       | integer | No       | 0       | Pagination offset                          |
| `tags`         | string  | No       | -       | Comma-separated tags (not implemented yet) |

#### Request

```bash
curl -X GET "https://www.veritablegames.com/api/journals/search?q=productivity&limit=10&offset=0" \
  -b cookies.txt
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "pages": [
      {
        "id": 124,
        "title": "Productivity Notes",
        "slug": "productivity-notes",
        "content": "Tips for staying productive...",
        "created_at": "2026-02-16T08:00:00Z",
        "updated_at": "2026-02-16T09:15:00Z",
        "category_id": "jcat-1-work",
        "rank": 0.85 // Relevance score (0-1)
      },
      {
        "id": 127,
        "title": "Daily Goals",
        "slug": "daily-goals",
        "content": "Productivity goals for today...",
        "created_at": "2026-02-14T07:00:00Z",
        "updated_at": "2026-02-15T18:30:00Z",
        "category_id": "jcat-1-work",
        "rank": 0.425
      }
    ],
    "total": 2,
    "has_more": false,
    "query": "productivity",
    "limit": 10,
    "offset": 0
  }
}
```

#### Search Features

- **Relevance Ranking**: Results sorted by `ts_rank()` (title matches rank higher)
- **Multi-word**: Handles "foo bar" efficiently (matches both words)
- **Stemming**: Searches for word roots (e.g., "running" matches "run")
- **Fast**: 50-80% faster than LIKE queries (<100ms typical)

#### Error Responses

- **400 Bad Request**: Query too short (< 2 characters)
- **401 Unauthorized**: User not authenticated

---

## Delete & Restore

### Soft Delete Journals

**DELETE** `/api/journals/bulk-delete`

Soft delete journals (moves to trash).

#### Request Body

```json
{
  "journalIds": [123, 124, 125],
  "permanent": false // Optional, defaults to false
}
```

#### Request

```bash
curl -X DELETE https://www.veritablegames.com/api/journals/bulk-delete \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"journalIds": [123, 124]}'
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Successfully deleted 2 journal(s)",
  "deletedCount": 2
}
```

#### Error Responses

- **400 Bad Request**: Invalid or empty journalIds array
- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: User doesn't own some journals
- **404 Not Found**: Some journals not found

---

### Permanent Delete (Admin Only)

**DELETE** `/api/journals/bulk-delete`

Permanently delete already soft-deleted journals.

#### Request Body

```json
{
  "journalIds": [123, 124],
  "permanent": true
}
```

#### Request

```bash
curl -X DELETE https://www.veritablegames.com/api/journals/bulk-delete \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"journalIds": [123, 124], "permanent": true}'
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Permanently deleted 2 journal(s)",
  "deletedCount": 2
}
```

#### Requirements

1. User must be admin/developer
2. Journals must already be soft-deleted (`is_deleted = true`)

#### Error Responses

- **403 Forbidden**: User is not admin/developer
- **400 Bad Request**: Journals not already soft-deleted

---

### Restore Journals

**POST** `/api/journals/restore`

Restore soft-deleted journals from trash.

#### Request Body

```json
{
  "journalIds": [123, 124]
}
```

#### Request

```bash
curl -X POST https://www.veritablegames.com/api/journals/restore \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"journalIds": [123, 124]}'
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Successfully restored 2 journal(s)",
  "restoredCount": 2,
  "journals": [
    {
      "id": 123,
      "slug": "my-journal",
      "title": "My Journal"
    },
    {
      "id": 124,
      "slug": "another-journal",
      "title": "Another Journal"
    }
  ]
}
```

#### Error Responses

- **400 Bad Request**: Invalid or empty journalIds array
- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: User doesn't own some journals (non-admin)
- **404 Not Found**: No deleted journals found with provided IDs

---

### List Deleted Journals

**GET** `/api/journals/deleted`

List soft-deleted journals (trash view).

#### Request

```bash
curl -X GET https://www.veritablegames.com/api/journals/deleted \
  -b cookies.txt
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "slug": "my-journal",
      "title": "My Journal",
      "deleted_at": "2026-02-16T10:00:00Z",
      "deleted_by": 1,
      "created_at": "2026-02-15T10:30:00Z",
      "updated_at": "2026-02-16T14:20:00Z"
    }
  ]
}
```

#### Authorization

- **Regular users**: See only their own deleted journals
- **Admins/developers**: See all deleted journals

---

## Categories

### List Categories

**GET** `/api/journals/categories`

Get all journal categories for the authenticated user.

#### Request

```bash
curl -X GET https://www.veritablegames.com/api/journals/categories \
  -b cookies.txt
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "jcat-1-uncategorized",
      "user_id": 1,
      "name": "Uncategorized",
      "sort_order": 0,
      "created_at": "2026-02-15T10:00:00Z"
    },
    {
      "id": "jcat-1-1708088400-a3f5d2",
      "user_id": 1,
      "name": "Work",
      "sort_order": 1,
      "created_at": "2026-02-16T08:00:00Z"
    },
    {
      "id": "jcat-1-1708088500-b7c8e1",
      "user_id": 1,
      "name": "Personal",
      "sort_order": 2,
      "created_at": "2026-02-16T09:00:00Z"
    }
  ]
}
```

**Note**: Every user has an "Uncategorized" category that is auto-created.

---

### Create Category (Admin Only)

**POST** `/api/journals/categories`

Create a new journal category.

#### Request Body

```json
{
  "name": "Work"
}
```

#### Request

```bash
curl -X POST https://www.veritablegames.com/api/journals/categories \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Work"}'
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "jcat-1-1708088400-a3f5d2",
    "user_id": 1,
    "name": "Work",
    "sort_order": 1,
    "created_at": "2026-02-16T08:00:00Z"
  }
}
```

#### Error Responses

- **400 Bad Request**: Missing or invalid name
- **403 Forbidden**: User is not admin/developer
- **409 Conflict**: Category name already exists for user

---

### Rename Category (Admin Only)

**PATCH** `/api/journals/categories/[id]`

Rename a journal category.

#### Request Body

```json
{
  "name": "Professional"
}
```

#### Request

```bash
curl -X PATCH https://www.veritablegames.com/api/journals/categories/jcat-1-work \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Professional"}'
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "jcat-1-work",
    "user_id": 1,
    "name": "Professional",
    "sort_order": 1,
    "created_at": "2026-02-16T08:00:00Z"
  }
}
```

#### Restrictions

- Cannot rename "Uncategorized" category
- Name must be unique for user

#### Error Responses

- **400 Bad Request**: Missing or invalid name
- **400 Bad Request**: Attempting to rename "Uncategorized"
- **403 Forbidden**: User is not admin/developer
- **404 Not Found**: Category not found
- **409 Conflict**: New name already exists

---

### Delete Category (Admin Only)

**DELETE** `/api/journals/categories/[id]`

Delete a journal category (moves journals to Uncategorized).

#### Request

```bash
curl -X DELETE https://www.veritablegames.com/api/journals/categories/jcat-1-work \
  -b cookies.txt
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

#### Behavior

1. All journals in deleted category moved to "Uncategorized"
2. Category deleted from database
3. Cannot delete "Uncategorized" category

#### Error Responses

- **400 Bad Request**: Attempting to delete "Uncategorized"
- **403 Forbidden**: User is not admin/developer
- **404 Not Found**: Category not found

---

### Reorder Categories (Admin Only)

**POST** `/api/journals/categories/reorder`

Reorder journal categories.

#### Request Body

```json
{
  "orderedIds": ["jcat-1-uncategorized", "jcat-1-work", "jcat-1-personal"]
}
```

#### Request

```bash
curl -X POST https://www.veritablegames.com/api/journals/categories/reorder \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"orderedIds": ["jcat-1-uncategorized", "jcat-1-work", "jcat-1-personal"]}'
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Categories reordered successfully"
}
```

**Note**: "Uncategorized" should always be first (sort_order = 0).

#### Error Responses

- **400 Bad Request**: Invalid orderedIds array
- **403 Forbidden**: User is not admin/developer
- **404 Not Found**: Some category IDs not found

---

## Journal Movement

### Move Journal to Category

**POST** `/api/journals/[slug]/move`

Move a journal to a different category.

#### Request Body

```json
{
  "categoryId": "jcat-1-work"
}
```

#### Request

```bash
curl -X POST https://www.veritablegames.com/api/journals/my-journal/move \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"categoryId": "jcat-1-work"}'
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Journal moved successfully"
}
```

#### Authorization

- **Regular users**: Can move their own journals
- **Admins/developers**: Can move any journal

#### Error Responses

- **400 Bad Request**: Missing or invalid categoryId
- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: User doesn't own journal (non-admin)
- **404 Not Found**: Journal or category not found

---

## Rate Limits

Journals API has the following rate limits:

| Endpoint Pattern                   | Rate Limit | Window   |
| ---------------------------------- | ---------- | -------- |
| `GET /api/journals`                | 60 req/min | 1 minute |
| `POST /api/journals`               | 20 req/min | 1 minute |
| `PATCH /api/journals/[slug]`       | 30 req/min | 1 minute |
| `GET /api/journals/search`         | 30 req/min | 1 minute |
| `DELETE /api/journals/bulk-delete` | 10 req/min | 1 minute |
| `POST /api/journals/restore`       | 10 req/min | 1 minute |
| Category endpoints                 | 20 req/min | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1708088400
```

### Rate Limit Exceeded

**Status**: 429 Too Many Requests

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 30
}
```

---

## Changelog

### Version 3.0 (February 16, 2026)

**Added**:

- Full-text search with `/api/journals/search`
- Relevance ranking in search results
- Centralized authorization utilities

**Changed**:

- Improved search performance (50-80% faster)
- Better error handling with custom error classes
- Consistent permission checks across all endpoints

**Fixed**:

- User ID type inconsistencies (string vs number)
- Ownership checks now handle NULL user_id correctly

### Version 2.0 (February 15, 2026)

**Added**:

- Dedicated `journals` table (separated from wiki_pages)
- Soft delete and restore functionality
- Deleted journals trash view
- Category organization

**Changed**:

- Journals now in `wiki.journals` table (was `wiki.wiki_pages`)
- Slug format simplified (removed `journals/` prefix)
- 40-60% faster queries

**Removed**:

- Archive functionality (not used)
- Namespace filtering (no longer needed)

### Version 1.0 (October 2025)

**Initial Release**:

- Basic journal CRUD operations
- Stored in wiki_pages with namespace='journals'
- Revision history via wiki_revisions

---

## Related Documentation

- [Architecture](../features/JOURNALS_ARCHITECTURE_2026.md) - System architecture
- [Schema Evolution](../database/JOURNALS_SCHEMA_EVOLUTION.md) - Migration history
- [Error Handling](./errors.md) - Complete error codes reference

---

**Last Updated**: February 16, 2026
**API Version**: 3.0
**Maintained By**: Development Team
