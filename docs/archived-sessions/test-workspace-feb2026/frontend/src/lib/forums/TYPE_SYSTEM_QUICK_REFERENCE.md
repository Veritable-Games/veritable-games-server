# Forum Type System Quick Reference

## Overview

The forum system uses **branded types** for type-safe ID handling with runtime
validation. This prevents mixing different ID types and catches errors at both
compile-time and runtime.

## Branded Types

```typescript
type TopicId = Branded<number, 'TopicId'>;
type ReplyId = Branded<number, 'ReplyId'>;
type CategoryId = Branded<number, 'CategoryId'>;
type TagId = Branded<number, 'TagId'>;
type UserId = Branded<number, 'UserId'>;
type ForumId = Branded<number, 'ForumId'>;
```

## Runtime Validators (`branded-helpers.ts`)

### Three Validator Types for Each ID:

1. **Strict Validator** (`toXXXId`) - Throws on invalid input
2. **Safe Validator** (`toXXXIdSafe`) - Returns null on invalid input
3. **Array Validator** (`toXXXIdArray`) - Filters out invalid values

### Example Usage:

```typescript
import {
  toTopicId,
  toTopicIdSafe,
  toTopicIdArray,
} from '@/lib/forums/branded-helpers';

// ✅ Strict validation (throws TypeError on error)
try {
  const topicId = toTopicId(123); // ✅ Returns TopicId
  const invalid = toTopicId('foo'); // ❌ Throws TypeError
} catch (error) {
  console.error('Invalid TopicId:', error.message);
}

// ✅ Safe validation (returns null on error)
const topicId = toTopicIdSafe(123); // ✅ Returns TopicId
const invalid = toTopicIdSafe('foo'); // ✅ Returns null

// ✅ Array validation (filters out invalid values)
const ids = toTopicIdArray([1, 2, 'invalid', 3]); // ✅ [1, 2, 3] as TopicId[]
```

## Integration with Zod

The Zod schemas in `validation.ts` automatically use runtime validators via
`.transform()`:

```typescript
// CreateTopicSchema (validation.ts:149)
export const CreateTopicSchema = z.object({
  category_id: z
    .number()
    .int()
    .positive('Category ID must be a positive integer')
    .transform(toCategoryId), // 🔒 Runtime validation
  // ...
});

// CreateReplySchema (validation.ts:193-194)
export const CreateReplySchema = z.object({
  topic_id: z
    .number()
    .int()
    .positive('Topic ID must be a positive integer')
    .transform(toTopicId), // 🔒 Runtime validation
  parent_id: z
    .number()
    .int()
    .positive('Parent ID must be a positive integer')
    .transform(toReplyId) // 🔒 Runtime validation
    .nullable()
    .optional(),
  // ...
});
```

## Validation Rules

All ID validators enforce the following rules:

- ✅ Must be a number
- ✅ Must be an integer (no decimals)
- ✅ Must be positive (> 0)
- ✅ Must be finite (not NaN or Infinity)

Invalid inputs:

- ❌ Strings: `"123"`, `"abc"`
- ❌ Zero or negative: `0`, `-1`
- ❌ Decimals: `1.5`, `2.7`
- ❌ Special values: `NaN`, `Infinity`, `-Infinity`
- ❌ Non-numbers: `null`, `undefined`, `{}`, `[]`

## Common Patterns

### Pattern 1: API Route with Strict Validation

```typescript
import { safeParseRequest } from '@/lib/forums/validation';
import { CreateTopicSchema } from '@/lib/forums/validation';

export const POST = withSecurity(async request => {
  // Zod automatically validates and brands IDs
  const bodyResult = await safeParseRequest(request, CreateTopicSchema);

  if (bodyResult.isErr()) {
    throw new ValidationError(bodyResult.error.message);
  }

  // ✅ bodyResult.value.category_id is now CategoryId (branded + validated)
  const topic = await forumService.createTopic(bodyResult.value, user.id);

  return NextResponse.json({ success: true, data: { topic } });
});
```

### Pattern 2: Direct Conversion in Service Layer

```typescript
import { toTopicId, toTopicIdSafe } from '@/lib/forums/branded-helpers';

// ✅ Strict conversion (throws on error)
function getTopic(id: unknown): Promise<Topic> {
  const topicId = toTopicId(id); // Validates and brands
  return db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
}

// ✅ Safe conversion (returns null on error)
function getTopicSafe(id: unknown): Promise<Topic | null> {
  const topicId = toTopicIdSafe(id);
  if (!topicId) return null;

  return db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
}
```

### Pattern 3: Array Conversion

```typescript
import { toTopicIdArray } from '@/lib/forums/branded-helpers';

// ✅ Filter and validate multiple IDs
function getTopics(ids: unknown[]): Promise<Topic[]> {
  const topicIds = toTopicIdArray(ids); // Filters out invalid values

  if (topicIds.length === 0) {
    return []; // No valid IDs
  }

  const placeholders = topicIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT * FROM topics WHERE id IN (${placeholders})`)
    .all(...topicIds);
}
```

### Pattern 4: Type Guards vs. Validators

```typescript
import { isTopicId } from '@/lib/forums/types';
import { toTopicIdSafe } from '@/lib/forums/branded-helpers';

// ❌ Type guard (only checks type, doesn't brand)
function example1(value: unknown) {
  if (isTopicId(value)) {
    // value is narrowed to TopicId, but no validation happened
    // This is a TypeScript feature, not runtime validation
  }
}

// ✅ Runtime validator (validates AND brands)
function example2(value: unknown) {
  const topicId = toTopicIdSafe(value);
  if (topicId !== null) {
    // topicId is now TopicId and has been validated at runtime
  }
}
```

## File Locations

- **Type Definitions**: `/frontend/src/lib/forums/types.ts` (lines 25-50)
- **Runtime Validators**: `/frontend/src/lib/forums/branded-helpers.ts`
- **Zod Schemas**: `/frontend/src/lib/forums/validation.ts` (lines 141-198)

## Error Messages

Runtime validators throw descriptive `TypeError` messages:

```typescript
toTopicId('invalid');
// TypeError: Invalid TopicId: must be a positive integer (received: string)

toTopicId(-1);
// TypeError: Invalid TopicId: must be a positive integer (received: -1)

toTopicId(1.5);
// TypeError: Invalid TopicId: must be a positive integer (received: 1.5)

toTopicId(NaN);
// TypeError: Invalid TopicId: must be a positive integer (received: NaN)
```

## Benefits

1. **Compile-Time Safety**: TypeScript prevents mixing different ID types

   ```typescript
   function getTopic(id: TopicId) {
     /* ... */
   }
   const replyId: ReplyId = 123 as ReplyId;
   getTopic(replyId); // ❌ Compile error: ReplyId is not assignable to TopicId
   ```

2. **Runtime Safety**: Validators catch invalid data from APIs, databases, or
   user input

   ```typescript
   const id = toTopicId(userInput); // Validates at runtime
   ```

3. **Self-Documenting**: Function signatures clearly show expected ID types

   ```typescript
   function deleteReply(topicId: TopicId, replyId: ReplyId): Promise<void>;
   // Clear: needs both TopicId and ReplyId
   ```

4. **Automatic in Zod**: Validation happens automatically in API routes
   ```typescript
   const bodyResult = await safeParseRequest(request, CreateTopicSchema);
   // IDs are automatically validated and branded
   ```

## Migration from v0.36

**v0.36** had symbol-based branded types (443 lines of boilerplate):

```typescript
// v0.36 (443 lines in branded-types.ts)
const topicIdSymbol = Symbol('TopicId');
type TopicId = number & { [topicIdSymbol]: true };

function toTopicId(value: number): TopicId {
  return value as TopicId; // ❌ No runtime validation
}
```

**v0.40** has generic utility types (50 lines total):

```typescript
// v0.40 (types.ts + branded-helpers.ts)
type TopicId = Branded<number, 'TopicId'>;

function toTopicId(value: unknown): TopicId {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new TypeError('Invalid TopicId'); // ✅ Runtime validation
  }
  return value as TopicId;
}
```

**Result**: 8.8x less code, proper runtime validation, same compile-time safety.

## Best Practices

1. **Always use runtime validators** when converting external data:

   ```typescript
   // ✅ Good: Validates user input
   const topicId = toTopicId(req.params.id);

   // ❌ Bad: No validation, could crash
   const topicId = req.params.id as TopicId;
   ```

2. **Use safe validators** when you can handle null:

   ```typescript
   // ✅ Good: Gracefully handles invalid input
   const topicId = toTopicIdSafe(userInput);
   if (!topicId) {
     return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
   }
   ```

3. **Let Zod handle validation** in API routes:

   ```typescript
   // ✅ Good: Zod validates and brands automatically
   const bodyResult = await safeParseRequest(request, CreateTopicSchema);

   // ❌ Bad: Manual validation is redundant
   const body = await request.json();
   const categoryId = toCategoryId(body.category_id);
   ```

4. **Use array validators** for bulk operations:

   ```typescript
   // ✅ Good: Filters out invalid IDs gracefully
   const topicIds = toTopicIdArray(req.body.topic_ids);

   // ❌ Bad: Will throw on first invalid ID
   const topicIds = req.body.topic_ids.map(toTopicId);
   ```

## Related Documentation

- **v0.36 vs v0.40 Comparison**: `/FORUM_V036_V040_COMPARISON_MASTER.md`
  (Part 5)
- **Branded Type Utility**: `/frontend/src/types/branded.ts`
- **Result Pattern**: `/frontend/src/lib/utils/result.ts`
- **API Error Handling**: `/frontend/src/lib/utils/api-errors.ts`
