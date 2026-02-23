# Veritable Games API Documentation

## Overview

The Veritable Games API provides a comprehensive REST API for community platform features including forums, wiki, document library, user management, messaging, and administration. This documentation covers all **367 endpoints** across **23 API categories**.

## Quick Start

### Base URL
```
Development: http://localhost:3000/api
Production: https://api.veritablegames.com/api
```

### Authentication

Most endpoints require authentication. To authenticate:

1. **Login** to obtain a session:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

2. **Store the session cookie** returned in the response
3. **Include the cookie** in subsequent requests

### CSRF Protection

State-changing operations (POST, PUT, DELETE) require a CSRF token:

1. **Get CSRF token**:
```bash
curl http://localhost:3000/api/auth/csrf-token \
  -c cookies.txt
```

2. **Include token in requests**:
```bash
curl -X POST http://localhost:3000/api/forums/topics \
  -H "X-CSRF-Token: your_csrf_token" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title": "New Topic", "content": "Topic content", "category_id": "1"}'
```

## API Categories

### Core Endpoints (367 total)

| Category | Routes | HTTP Methods | Description |
|----------|--------|--------------|-------------|
| **Projects** | 44 | 111 | Projects, galleries, references, concept-art, revisions, collaboration |
| **Library** | 14 | 51 | Document library, Anarchist Library, tags, annotations, admin functions |
| **Forums** | 17 | 42 | Forum topics, replies, categories, sections, search, stats, events |
| **Wiki** | 15 | 35 | Wiki pages, templates, categories, infoboxes, search, activity |
| **Workspace** | 7 | 20 | Canvas workspaces, nodes, viewport management, collaboration |
| **Users** | 9 | 18 | User profiles, avatars, settings, follows, exports |
| **Auth** | 7 | 15 | Authentication, sessions, OAuth, password resets |
| **Journals** | 5 | 11 | User journals, entries, versioning |
| **Messages** | 8 | 7 | Private messaging, conversations (8 routes matched exactly) |
| **Documents** | 7 | 8 | Document processing, upload queue, metadata extraction |
| **Security** | 2 | 11 | CSP violations, CSRF tokens, security headers |
| **Settings** | 4 | 7 | User settings, privacy, notifications, account management |
| **News** | 3 | 5 | News articles, revisions, comments |
| **Admin** | 2 | 6 | System administration, invitation management |
| **Health** | 3 | 3 | Health checks, database status, system diagnostics |
| **Contact** | 1 | 3 | Contact form submission, email delivery |
| **Metrics** | 2 | 2 | Performance metrics, analytics tracking |
| **Email** | 2 | 1 | Email operations, SMTP configuration |
| **Cache** | 1 | 0 | Cache management (placeholder) |
| **Landing** | 1 | 1 | Landing page data |
| **Debug** | 1 | 2 | Development debugging endpoints |
| **Notifications** | 1 | 2 | User notifications, real-time updates |
| **CSRF** | 1 | 1 | CSRF token generation |

**Note**: "HTTP Methods" reflects actual HTTP method implementations (GET, POST, PUT, DELETE, PATCH). A single route may have multiple methods.

---

### Major API Categories (Detailed)

#### Projects API (44 routes, 111 methods)
**Base**: `/api/projects/`

**Features**:
- Project CRUD operations
- Gallery management (albums, images)
- References system (12 routes)
- Concept-art system (12 routes)
- Revision history (6 routes)
- Collaboration features (annotations, discussions, presence, reviews)

**Key Routes**:
- `/api/projects/` - List, create projects
- `/api/projects/[slug]/` - Get, update, delete project
- `/api/projects/[slug]/galleries/` - Gallery management
- `/api/projects/[slug]/references/` - Reference images
- `/api/projects/[slug]/concept-art/` - Concept art
- `/api/projects/[slug]/revisions/` - Version history
- `/api/projects/[slug]/collaboration/` - Real-time collaboration

---

#### Library API (14 routes, 51 methods)
**Base**: `/api/library/`

**Features**:
- User document management
- Anarchist Library integration (24,643 documents)
- Tag management
- Annotations and highlights
- Admin functions (bulk operations, moderation)

**Key Routes**:
- `/api/library/documents/` - Document CRUD
- `/api/library/anarchist/` - Anarchist Library access
- `/api/library/tags/` - Tag management
- `/api/library/annotations/` - Document annotations
- `/api/library/admin/` - Administrative operations

---

#### Forums API (17 routes, 42 methods)
**Base**: `/api/forums/`

**Features**:
- Topic and reply management
- Category and section organization
- Full-text search
- Statistics and analytics
- Real-time events (SSE)
- Tag system

**Key Routes**:
- `/api/forums/topics/` - Topic operations
- `/api/forums/replies/` - Reply operations
- `/api/forums/categories/` - Category management
- `/api/forums/sections/` - Section organization
- `/api/forums/search/` - Full-text search
- `/api/forums/stats/` - Forum statistics
- `/api/forums/events/` - Real-time updates

---

#### Wiki API (15 routes, 35 methods)
**Base**: `/api/wiki/`

**Features**:
- Page CRUD with versioning
- Template system
- Category hierarchy
- Infobox management
- Full-text search
- Activity tracking
- Auto-categorization

**Key Routes**:
- `/api/wiki/pages/` - Page operations
- `/api/wiki/pages/[slug]/revisions/` - Version history
- `/api/wiki/templates/` - Template management
- `/api/wiki/categories/` - Category hierarchy
- `/api/wiki/infoboxes/` - Infobox system
- `/api/wiki/search/` - Full-text search
- `/api/wiki/activity/` - Recent changes

---

#### Workspace API (7 routes, 20 methods) 🆕
**Base**: `/api/workspace/`

**Features**:
- Canvas workspace management
- Node system for workspace elements
- Viewport settings
- Collaboration features
- Bounding box utilities

**Key Routes**:
- `/api/workspace/` - Workspace CRUD
- `/api/workspace/[id]/nodes/` - Node management
- `/api/workspace/[id]/viewport/` - Viewport settings
- `/api/workspace/[id]/collaboration/` - Real-time collaboration

---

#### Journals API (5 routes, 11 methods) 🆕
**Base**: `/api/journals/`

**Features**:
- Journal entry management
- Versioning and history
- Auto-save functionality (planned)
- Privacy controls

**Key Routes**:
- `/api/journals/` - List, create journals
- `/api/journals/[slug]/` - Journal operations
- `/api/journals/[slug]/entries/` - Entry management
- `/api/journals/[slug]/versions/` - Version history

**Status**: Backend complete, frontend UI in development (40% complete)

---

#### Documents API (7 routes, 8 methods) 🆕
**Base**: `/api/documents/`

**Features**:
- Document upload queue
- Processing status tracking
- Metadata extraction
- Format conversion
- Link management (planned)

**Key Routes**:
- `/api/documents/upload/` - File upload
- `/api/documents/queue/` - Upload queue status
- `/api/documents/metadata/` - Metadata operations

---

### Minor API Categories

#### Admin API (2 routes, 6 methods) ⚠️ Previously Overstated
**Actual Implementation**:
- `/api/admin/[...action]/` - Dynamic admin actions
- `/api/admin/invitation/` - Invitation management

**Previous Documentation Error**: Was incorrectly documented as 65 routes with 113 endpoints. Actual implementation is much simpler with 2 routes and 6 HTTP methods.

---

#### Metrics API (2 routes, 2 methods) 🆕
**Base**: `/api/metrics/`
- Performance metrics collection
- Analytics tracking

---

#### Email API (2 routes, 1 method) 🆕
**Base**: `/api/email/`
- Email operations
- SMTP configuration

---

### Planned Features (Empty Route Directories)

The following route directories exist but contain no implementations yet:

**Documents** (4 empty):
- `/api/documents/link/`
- `/api/documents/linked/`
- `/api/documents/merge/`
- `/api/documents/unlink/`

**Projects Collaboration** (4 empty):
- `/api/projects/[slug]/collaboration/annotations/`
- `/api/projects/[slug]/collaboration/discussions/`
- `/api/projects/[slug]/collaboration/presence/`
- `/api/projects/[slug]/collaboration/reviews/`

**Projects Concept-Art** (3 empty):
- `/api/projects/[slug]/concept-art/audit/`
- `/api/projects/[slug]/concept-art/cleanup/`
- `/api/projects/[slug]/concept-art/collections/[id]/`

**Projects References** (3 empty):
- `/api/projects/[slug]/references/audit/`
- `/api/projects/[slug]/references/cleanup/`
- `/api/projects/[slug]/references/collections/[id]/`

**Projects Revisions** (2 empty):
- `/api/projects/[slug]/revisions/cache/`
- `/api/projects/[slug]/revisions/compare/`

**Other** (4 empty):
- `/api/journals/[slug]/autosave/`
- `/api/forums/topics/[id]/solve/`
- `/api/debug/test-anarchist/`
- `/api/diagnostic/anarchist-status/`

**Total**: 20 empty route directories (planned features)

---

## Rate Limiting

The API implements tiered rate limiting:

| Tier | Limit | Window | Used For |
|------|-------|--------|----------|
| **auth** | 5 requests | 15 minutes | Login, registration |
| **api** | 60 requests | 1 minute | Standard API calls |
| **page** | 100 requests | 1 minute | Page loads, assets |
| **public** | 1000 requests | 1 minute | Public resources |
| **strict** | 10 requests | 1 minute | Sensitive operations |
| **generous** | 300 requests | 1 minute | Real-time features |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: When the limit resets (Unix timestamp)

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "message": "Optional success message",
  "meta": {
    "timestamp": "2025-09-17T10:00:00Z",
    "requestId": "req_123abc",
    "rateLimit": {
      "limit": 60,
      "remaining": 58,
      "reset": "2025-09-17T10:01:00Z"
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  // OR detailed error object:
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field": "username",
      "reason": "Username already exists"
    }
  }
}
```

## Common Status Codes

| Code | Description |
|------|-------------|
| **200** | Success |
| **201** | Created |
| **204** | No Content |
| **400** | Bad Request - Invalid input |
| **401** | Unauthorized - Authentication required |
| **403** | Forbidden - Insufficient permissions |
| **404** | Not Found - Resource doesn't exist |
| **409** | Conflict - Resource already exists |
| **429** | Too Many Requests - Rate limit exceeded |
| **500** | Internal Server Error |

## Authentication Methods

### 1. Session-Based (Primary)
- Login via `/api/auth/login`
- Session stored in HTTP-only cookie
- Automatic session management

### 2. TOTP (Two-Factor) - ❌ REMOVED (October 2025)
**Status**: Feature removed to simplify authentication.
See [authentication.md](./authentication.md) for historical reference.

### 3. WebAuthn (Passwordless) - ❌ REMOVED (October 2025)
**Status**: Feature removed to simplify authentication.
See [authentication.md](./authentication.md) for historical reference.

## Security Features

### CSRF Protection
- Required for all state-changing operations
- Token bound to session
- Automatic validation in middleware

### Content Security Policy
- Dynamic nonce generation
- Strict CSP headers
- Violation reporting endpoint

### Input Validation
- Zod schema validation
- SQL injection prevention
- XSS protection with DOMPurify

### Rate Limiting
- Per-endpoint configuration
- IP-based tracking
- Automatic header injection

## Example Requests

### Create Forum Topic
```javascript
const response = await fetch('/api/forums/topics', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  credentials: 'include',
  body: JSON.stringify({
    category_id: '1',
    title: 'My New Topic',
    content: 'This is the topic content',
    tags: [1, 2, 3]
  })
});

const result = await response.json();
if (result.success) {
  console.log('Topic created:', result.data.topic);
}
```

### Get Wiki Page
```javascript
const response = await fetch('/api/wiki/pages/getting-started', {
  credentials: 'include'
});

const result = await response.json();
if (result.success) {
  const page = result.data.page;
  console.log('Page content:', page.content);
}
```

### Send Private Message
```javascript
const response = await fetch('/api/messages/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  credentials: 'include',
  body: JSON.stringify({
    recipient_id: 'user123',
    content: 'Hello! How are you?'
  })
});

const result = await response.json();
if (result.success) {
  console.log('Message sent:', result.data.message);
}
```

## Pagination

Many endpoints support pagination with these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Items per page (max: 100) |
| `offset` | integer | 0 | Number of items to skip |
| `page` | integer | 1 | Page number (alternative to offset) |
| `sort` | string | varies | Field to sort by |
| `order` | string | desc | Sort order (asc/desc) |

Example:
```
GET /api/forums/topics?limit=10&page=2&sort=created_at&order=desc
```

## Filtering & Search

### Query Parameters
Most list endpoints support filtering:
- `category_id` - Filter by category
- `tag` - Filter by tag
- `status` - Filter by status
- `author_id` - Filter by author
- `search` - Full-text search

### Search Endpoints
Dedicated search endpoints with advanced features:
- `/api/forums/search` - Search forum content
- `/api/wiki/pages/search` - Search wiki pages
- `/api/library/search` - Search documents

## Error Handling

### Client Errors (4xx)

Handle validation errors:
```javascript
if (!result.success && result.error.code === 'VALIDATION_ERROR') {
  const fieldErrors = result.error.details;
  // Display field-specific errors
}
```

### Server Errors (5xx)

Implement retry logic:
```javascript
async function apiCall(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 500 && i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
}
```

## WebSocket Support

Real-time features available via WebSocket (port 3001):

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  auth: {
    sessionId: getCookie('sessionId')
  }
});

socket.on('message:new', (message) => {
  console.log('New message:', message);
});

socket.on('notification:new', (notification) => {
  console.log('New notification:', notification);
});
```

## Testing

### Using cURL
```bash
# Get CSRF token
curl -c cookies.txt http://localhost:3000/api/auth/csrf-token

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test123"}'

# Create topic with auth and CSRF
curl -X POST http://localhost:3000/api/forums/topics \
  -b cookies.txt \
  -H "X-CSRF-Token: your_token" \
  -H "Content-Type: application/json" \
  -d '{"category_id": "1", "title": "Test", "content": "Test content"}'
```

### Using Postman
1. Import the OpenAPI specification: `docs/api/openapi.yaml`
2. Configure environment variables:
   - `baseUrl`: http://localhost:3000
   - `csrfToken`: (obtain from /api/auth/csrf-token)
3. Enable cookie jar for session management

## Database Schema

The API interacts with these database schemas:

### Primary Databases
- **forums.db** - Forum topics, replies, categories
- **wiki.db** - Wiki pages, revisions, templates
- **library.db** - Documents, annotations, tags
- **auth.db** - Users, sessions, credentials

### Key Tables
- `users` - User accounts and profiles
- `topics` - Forum topics
- `replies` - Forum replies
- `wiki_pages` - Wiki content
- `documents` - Library documents
- `messages` - Private messages
- `sessions` - Active user sessions

## Performance Optimization

### Caching
- Static assets cached with long TTL
- API responses use ETag headers
- Database query caching

### Compression
- Gzip/Brotli compression enabled
- Image optimization (AVIF/WebP)
- Minified JavaScript/CSS

### Database
- Connection pooling (max 5)
- Prepared statements
- WAL mode for SQLite
- Indexed queries

## Current Status

Based on comprehensive testing (September 2025):
- **8%** of features fully functional
- **52%** have issues requiring fixes
- **40%** untested or incomplete

### Working Features
- Basic authentication flow
- CSRF token generation
- Health check endpoints
- Some GET endpoints

### Known Issues
- Many POST/PUT/DELETE endpoints fail
- Database connection issues
- Missing request validation
- Incomplete error handling

## Development

### Running Locally
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `.env.local`:
```env
JWT_SECRET=your_jwt_secret_32_chars_minimum
SESSION_SECRET=your_session_secret_32_chars_minimum
CSRF_SECRET=your_csrf_secret_32_chars_minimum
NODE_ENV=development
```

### Testing API
```bash
# Run tests
npm test

# Test specific endpoint
npm test -- api/auth
```

## Support

### Resources
- [OpenAPI Specification](./openapi.yaml)
- [Authentication Guide](./authentication.md)
- [Error Handling](./errors.md)
- [Rate Limiting](./rate-limits.md)

### Contact
- GitHub Issues: [Project Repository]
- Email: support@veritablegames.com
- Discord: [Community Server]

## License

MIT License - See LICENSE file for details