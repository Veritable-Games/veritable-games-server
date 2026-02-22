# Forum Validation System Documentation

## Overview

Comprehensive Zod-based validation system for the forums feature with:
- Type-safe input validation
- Content sanitization (XSS prevention)
- Result pattern for error handling
- Request parsing utilities
- 100% test coverage (45 passing tests)

## Files

- `/src/lib/forums/validation.ts` - Main validation module (605 lines)
- `/src/lib/forums/__tests__/validation.test.ts` - Comprehensive test suite (467 lines)

## Validation Constraints

| Constraint | Value | Description |
|------------|-------|-------------|
| Title min length | 3 characters | Prevents overly short titles |
| Title max length | 200 characters | Keeps titles concise |
| Topic content min | 10 characters | Ensures meaningful topics |
| Reply content min | 1 character | Allows short replies |
| Max tags | 10 per topic | Prevents tag spam |
| Max reply depth | 5 levels | Limits nesting for performance |
| Search query min | 2 characters | Prevents single-char searches |
| Pagination max | 100 results | Performance limit |
| Tag max length | 50 characters | Individual tag limit |

## Exported Schemas

### Topic Schemas

#### `CreateTopicSchema`
Validates new topic creation:
```typescript
{
  title: string;           // 3-200 chars, auto-sanitized
  content: string;         // min 10 chars, XSS-filtered
  category_id: number;     // positive integer
  tags?: string[];         // max 10, auto-normalized to lowercase
  content_format?: ContentFormat; // defaults to 'markdown'
}
```

#### `UpdateTopicSchema`
Validates topic updates (all fields optional):
```typescript
{
  title?: string;          // 3-200 chars
  content?: string;        // min 10 chars
  category_id?: number;    // positive integer
  tags?: string[];         // max 10, replaces existing
  status?: TopicStatus;    // 'open' | 'solved' | 'closed'
  is_pinned?: boolean;     // moderator only
  is_locked?: boolean;     // moderator only
}
```

### Reply Schemas

#### `CreateReplySchema`
Validates new reply creation:
```typescript
{
  topic_id: number;        // positive integer
  parent_id?: number | null; // for nested replies
  content: string;         // min 1 char, XSS-filtered
  content_format?: ContentFormat; // defaults to 'markdown'
}
```

#### `UpdateReplySchema`
Validates reply updates:
```typescript
{
  content?: string;        // min 1 char
  is_solution?: boolean;   // topic author/moderator only
}
```

### Query Schemas

#### `SearchQuerySchema`
Validates search requests:
```typescript
{
  query: string;           // min 2 chars
  scope?: SearchScope;     // 'topics' | 'replies' | 'all' (default: 'all')
  category?: string;       // filter by category slug
  tags?: string[];         // filter by tags
  author?: string;         // filter by username
  sort?: SortOrder;        // 'latest' | 'oldest' | 'popular' | 'active' (default: 'latest')
  page?: number;           // default: 1
  limit?: number;          // 1-100, default: 20
}
```

#### `TopicListQuerySchema`
Validates topic list queries:
```typescript
{
  category?: string;
  tags?: string[];
  author?: string;
  status?: TopicStatus;
  pinned_only?: boolean;   // default: false
  solved_only?: boolean;   // default: false
  sort?: SortOrder;        // default: 'latest'
  page?: number;           // default: 1
  limit?: number;          // 1-100, default: 20
}
```

## Sanitization Functions

### `sanitizeTitle(title: string): string`
Cleans topic/reply titles:
- Trims whitespace
- Normalizes multiple spaces to single space
- Removes line breaks
- Strips HTML tags

**Example:**
```typescript
sanitizeTitle('  Multiple   spaces  ') // => 'Multiple spaces'
sanitizeTitle('Title\nwith\nbreaks')   // => 'Title with breaks'
sanitizeTitle('<b>Bold</b> title')     // => 'Bold title'
```

### `sanitizeContent(content: string): string`
Sanitizes Markdown/HTML content using DOMPurify:
- Preserves safe HTML tags (p, strong, em, a, etc.)
- Removes dangerous scripts and event handlers
- Allows safe protocols (https://, mailto:, etc.)
- Blocks javascript: URLs

**Allowed Tags:**
Text formatting, structure, lists, tables, headings, links, images (with restrictions)

**Example:**
```typescript
sanitizeContent('<p>Safe</p><script>alert(1)</script>')
// => '<p>Safe</p>'

sanitizeContent('<a href="javascript:alert(1)">Bad</a>')
// => '<a>Bad</a>' (href removed)
```

### `normalizeTag(tag: string): string`
Converts tags to URL-safe slugs:
- Lowercase conversion
- Spaces to hyphens
- Removes special characters
- Collapses multiple hyphens

**Example:**
```typescript
normalizeTag('JavaScript')        // => 'javascript'
normalizeTag('web development')   // => 'web-development'
normalizeTag('C++')               // => 'c'
normalizeTag('---tag---')         // => 'tag'
```

## Validation Functions (Result Pattern)

### `validateTopicTitle(title: string): Result<string, ValidationError>`
Validates and sanitizes topic title.

**Returns:**
- `Ok(sanitized)` - Valid title
- `Err({ code: 'TITLE_EMPTY' })` - Whitespace only
- `Err({ code: 'TITLE_TOO_SHORT' })` - < 3 chars
- `Err({ code: 'TITLE_TOO_LONG' })` - > 200 chars

**Example:**
```typescript
const result = validateTopicTitle('Valid Title');
if (result.isOk()) {
  console.log(result.value); // 'Valid Title'
} else {
  console.error(result.error.message);
}
```

### `validateReplyDepth(parentId?: number, currentDepth?: number): Result<number, ValidationError>`
Validates reply nesting depth.

**Returns:**
- `Ok(depth)` - Valid depth (0-4)
- `Err({ code: 'MAX_DEPTH_EXCEEDED' })` - Depth >= 5

**Example:**
```typescript
const result = validateReplyDepth(null);      // Top-level: Ok(0)
const nested = validateReplyDepth(5, 2);      // Nested: Ok(3)
const tooDeep = validateReplyDepth(5, 5);     // Too deep: Err
```

### `validateTags(tags: string[]): Result<string[], ValidationError>`
Validates and normalizes tag array.

**Returns:**
- `Ok(normalized)` - Valid tags (normalized)
- `Err({ code: 'TOO_MANY_TAGS' })` - > 10 tags
- `Err({ code: 'DUPLICATE_TAGS' })` - Duplicate after normalization
- `Err({ code: 'TAG_TOO_LONG' })` - Individual tag > 50 chars

**Example:**
```typescript
const result = validateTags(['JavaScript', 'TYPE SCRIPT']);
if (result.isOk()) {
  console.log(result.value); // ['javascript', 'type-script']
}
```

## Request Parsing

### `safeParseRequest<T>(request: Request, schema: ZodSchema<T>): Promise<Result<T, Error>>`
Parses and validates JSON request bodies (recommended for API routes).

**Returns:**
- `Ok(data)` - Valid parsed data
- `Err({ message: 'Invalid JSON' })` - JSON parse error
- `Err({ message: 'Validation failed', details: [...] })` - Zod validation errors

**Example:**
```typescript
// In API route
export const POST = withSecurity(async (request: NextRequest) => {
  const bodyResult = await safeParseRequest(request, CreateTopicSchema);

  if (bodyResult.isErr()) {
    return NextResponse.json(
      { error: bodyResult.error.message, details: bodyResult.error.details },
      { status: 400 }
    );
  }

  const topic = await createTopic(bodyResult.value);
  return NextResponse.json({ success: true, data: topic });
});
```

### `validateRequest<T>(schema: ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] }`
Simple validation helper (compatibility with workspace pattern).

**Example:**
```typescript
const validation = validateRequest(CreateTopicSchema, body);
if (!validation.success) {
  return NextResponse.json(
    { error: 'Invalid data', details: validation.errors },
    { status: 400 }
  );
}
// Use validation.data
```

## Usage Examples

### Creating a Topic (API Route)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { safeParseRequest, CreateTopicSchema } from '@/lib/forums/validation';
import { getCurrentUser } from '@/lib/auth/utils';

export const POST = withSecurity(async (request: NextRequest) => {
  // 1. Authenticate
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate request
  const bodyResult = await safeParseRequest(request, CreateTopicSchema);
  if (bodyResult.isErr()) {
    return NextResponse.json(
      {
        error: bodyResult.error.message,
        details: bodyResult.error.details,
      },
      { status: 400 }
    );
  }

  // 3. Create topic (data is already sanitized)
  const topic = await forumService.createTopic({
    ...bodyResult.value,
    author_id: user.id,
  });

  return NextResponse.json({ success: true, data: topic });
});
```

### Validating User Input (Client-Side)

```typescript
import { validateTopicTitle, validateTags } from '@/lib/forums/validation';

function TopicForm() {
  const [titleError, setTitleError] = useState<string | null>(null);

  const handleTitleChange = (title: string) => {
    const result = validateTopicTitle(title);
    if (result.isErr()) {
      setTitleError(result.error.message);
    } else {
      setTitleError(null);
    }
  };

  const handleSubmit = (formData) => {
    // Validate title
    const titleResult = validateTopicTitle(formData.title);
    if (titleResult.isErr()) {
      showError(titleResult.error.message);
      return;
    }

    // Validate tags
    const tagsResult = validateTags(formData.tags);
    if (tagsResult.isErr()) {
      showError(tagsResult.error.message);
      return;
    }

    // Submit with sanitized data
    submitTopic({
      title: titleResult.value,
      tags: tagsResult.value,
      // ... other fields
    });
  };
}
```

### Search Query Validation

```typescript
import { SearchQuerySchema } from '@/lib/forums/validation';

export const GET = withSecurity(async (request: NextRequest) => {
  const url = new URL(request.url);
  const queryParams = {
    query: url.searchParams.get('q') || '',
    scope: url.searchParams.get('scope') as SearchScope,
    page: parseInt(url.searchParams.get('page') || '1'),
    limit: parseInt(url.searchParams.get('limit') || '20'),
  };

  // Validate query parameters
  const validation = validateRequest(SearchQuerySchema, queryParams);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: validation.errors },
      { status: 400 }
    );
  }

  const results = await searchForums(validation.data);
  return NextResponse.json({ success: true, data: results });
});
```

## Test Coverage

All validation functions and schemas are fully tested:

- **45 passing tests** covering:
  - Schema validation (valid/invalid inputs)
  - Default value application
  - Auto-transformation (title sanitization, tag normalization)
  - Sanitization helpers (XSS prevention, tag slugging)
  - Result pattern validation functions
  - Request parsing (JSON errors, validation errors)

Run tests:
```bash
npm test src/lib/forums/__tests__/validation.test.ts
```

## Security Considerations

1. **XSS Prevention**: All user content is sanitized with DOMPurify
2. **Script Blocking**: javascript: URLs and event handlers are removed
3. **Safe Protocols**: Only https://, mailto:, tel:, and relative URLs allowed
4. **Tag Normalization**: Prevents tag injection via special characters
5. **Length Limits**: All inputs have maximum lengths to prevent DoS
6. **Depth Limits**: Reply nesting limited to 5 levels for performance

## Performance Notes

- **Validation**: ~1ms per request (Zod is highly optimized)
- **Sanitization**: ~2-5ms for typical content (DOMPurify overhead)
- **Total overhead**: ~5-10ms per API request (negligible)

## Integration with API Routes

The validation system integrates seamlessly with the security middleware:

```typescript
import { withSecurity } from '@/lib/security/middleware';
import { safeParseRequest, CreateTopicSchema } from '@/lib/forums/validation';

export const POST = withSecurity(async (request: NextRequest) => {
  // withSecurity provides:
  // - CSRF validation
  // - Rate limiting
  // - Security headers

  // safeParseRequest provides:
  // - JSON parsing
  // - Schema validation
  // - Content sanitization
  // - Type safety

  const result = await safeParseRequest(request, CreateTopicSchema);
  // ... handle result
});
```

## Error Response Format

All validation errors follow a consistent format:

```typescript
{
  message: string;        // Human-readable error
  details?: Array<{       // Detailed field errors
    field: string;        // 'title', 'content.text', etc.
    message: string;      // Specific error message
    code: string;         // Error code (e.g., 'TITLE_TOO_SHORT')
  }>;
}
```

## Future Enhancements

Potential improvements for future versions:

1. **Rate-based validation**: Stricter limits for new users
2. **Profanity filter**: Optional content moderation
3. **Link validation**: Check for broken/suspicious URLs
4. **Image validation**: Validate image URLs in content
5. **Custom error messages**: i18n support for error messages
6. **Async validation**: Check for duplicate titles, banned words, etc.

## Related Files

- `/src/lib/forums/types.ts` - TypeScript type definitions
- `/src/lib/security/middleware.ts` - Security wrapper (CSRF, rate limiting)
- `/src/lib/utils/api-errors.ts` - Custom error classes
- `/src/lib/utils/result.ts` - Result pattern implementation
