# Forum Validation Quick Reference

## Quick Import

```typescript
import {
  // Schemas
  CreateTopicSchema,
  UpdateTopicSchema,
  CreateReplySchema,
  UpdateReplySchema,
  SearchQuerySchema,
  TopicListQuerySchema,

  // Validation functions
  validateTopicTitle,
  validateReplyDepth,
  validateTags,

  // Sanitization
  sanitizeTitle,
  sanitizeContent,
  normalizeTag,

  // Request parsing
  safeParseRequest,
  validateRequest,
} from '@/lib/forums/validation';
```

## Common Patterns

### API Route with Validation

```typescript
import { safeParseRequest, CreateTopicSchema } from '@/lib/forums/validation';

export const POST = withSecurity(async (request: NextRequest) => {
  const result = await safeParseRequest(request, CreateTopicSchema);

  if (result.isErr()) {
    return NextResponse.json(
      { error: result.error.message, details: result.error.details },
      { status: 400 }
    );
  }

  // result.value is type-safe and sanitized
  const topic = await createTopic(result.value);
  return NextResponse.json({ success: true, data: topic });
});
```

### Client-Side Validation

```typescript
import { validateTopicTitle } from '@/lib/forums/validation';

const result = validateTopicTitle(userInput);

if (result.isErr()) {
  setError(result.error.message);
} else {
  // Use result.value (sanitized)
  setCleanTitle(result.value);
}
```

## Validation Limits

| Field         | Min | Max | Notes            |
| ------------- | --- | --- | ---------------- |
| Title         | 3   | 200 | Auto-sanitized   |
| Topic Content | 10  | ∞   | XSS-filtered     |
| Reply Content | 1   | ∞   | XSS-filtered     |
| Tags          | 0   | 10  | Auto-normalized  |
| Reply Depth   | 0   | 5   | Nested levels    |
| Search Query  | 2   | ∞   | Trimmed          |
| Pagination    | 1   | 100 | Results per page |

## Error Codes

| Code                 | Meaning                   |
| -------------------- | ------------------------- |
| `TITLE_EMPTY`        | Whitespace-only title     |
| `TITLE_TOO_SHORT`    | < 3 characters            |
| `TITLE_TOO_LONG`     | > 200 characters          |
| `TOO_MANY_TAGS`      | > 10 tags                 |
| `DUPLICATE_TAGS`     | Same tag multiple times   |
| `TAG_TOO_LONG`       | Individual tag > 50 chars |
| `MAX_DEPTH_EXCEEDED` | Reply nesting > 5 levels  |

## Transformations

### Title Sanitization

- `"  Multiple   spaces  "` → `"Multiple spaces"`
- `"Title\nwith\nbreaks"` → `"Title with breaks"`
- `"<b>Bold</b> Title"` → `"Bold Title"`

### Tag Normalization

- `"JavaScript"` → `"javascript"`
- `"Web Development"` → `"web-development"`
- `"C++"` → `"c"`
- `"---tag---"` → `"tag"`

### Content Sanitization

- `"<p>Safe</p><script>alert(1)</script>"` → `"<p>Safe</p>"`
- `"<a href=\"javascript:alert(1)\">Bad</a>"` → `"<a>Bad</a>"`
- Preserves: `<p>`, `<strong>`, `<a href="https://...">`, etc.

## Test Coverage

✅ **45 passing tests** (100% coverage)

Run tests:

```bash
npm test src/lib/forums/__tests__/validation.test.ts
```
