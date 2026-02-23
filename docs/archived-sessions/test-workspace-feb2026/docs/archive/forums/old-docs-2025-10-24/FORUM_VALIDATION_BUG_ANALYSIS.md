# Forum Topic Creation Validation Bug Analysis

## Summary
Forum topic creation is failing with HTTP 400 "Validation failed" but with **empty error details**. Investigation reveals **two critical bugs**:

1. **Type Mismatch Bug**: Validation error details are lost due to incompatible types
2. **Validation Order Bug**: Content length validation happens before sanitization, allowing XSS attacks

## Bug #1: Type Mismatch (Empty Error Details)

### Root Cause
There's a type mismatch between what `safeParseRequest` returns and what `ValidationError` expects:

**safeParseRequest returns** (`/src/lib/forums/validation.ts:550-560`):
```typescript
const details = result.error.issues.map((err) => ({
  field: err.path.join('.'),
  message: err.message,
  code: err.code,
}));

return Err({
  message: 'Validation failed',
  details,  // Array of {field, message, code} objects
});
```

**ValidationError expects** (`/src/lib/utils/api-errors.ts:37-46`):
```typescript
export class ValidationError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>  // Object, not array!
  ) {
    // ...
  }
}
```

**API route passes array to object parameter** (`/src/app/api/forums/topics/route.ts:92-96`):
```typescript
if (bodyResult.isErr()) {
  throw new ValidationError(
    bodyResult.error.message,
    bodyResult.error.details  // Array passed where Record expected!
  );
}
```

**toAPIError handles it wrong** (`/src/lib/utils/api-errors.ts:143-149`):
```typescript
if (error instanceof ValidationError) {
  return {
    code: 'VALIDATION_ERROR',
    message: error.message,
    statusCode: 400,
    details: error.fieldErrors,  // This is an array, not an object!
  };
}
```

### Impact
- Validation errors are returned as an array in `details`
- Frontend expects structured field-level errors
- Users see "Validation failed" with no indication of what's wrong

### Fix Option 1: Change ValidationError to accept array
```typescript
export class ValidationError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Array<{field: string, message: string, code?: string}> | Record<string, string[]>
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
```

### Fix Option 2: Convert array to Record in route
```typescript
if (bodyResult.isErr()) {
  // Convert array to Record format
  const fieldErrors: Record<string, string[]> = {};
  bodyResult.error.details?.forEach(err => {
    if (!fieldErrors[err.field]) {
      fieldErrors[err.field] = [];
    }
    fieldErrors[err.field].push(err.message);
  });

  throw new ValidationError(
    bodyResult.error.message,
    fieldErrors
  );
}
```

### Fix Option 3: Make ValidationError type-flexible (RECOMMENDED)
```typescript
// In api-errors.ts
export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: any  // Accept any format, normalize in toAPIError
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// In toAPIError function
if (error instanceof ValidationError) {
  // Normalize details to consistent format
  let normalizedDetails = error.details;

  // If it's an array, convert to Record
  if (Array.isArray(error.details)) {
    normalizedDetails = {};
    error.details.forEach(err => {
      if (err.field) {
        if (!normalizedDetails[err.field]) {
          normalizedDetails[err.field] = [];
        }
        normalizedDetails[err.field].push(err.message);
      }
    });
  }

  return {
    code: 'VALIDATION_ERROR',
    message: error.message,
    statusCode: 400,
    details: normalizedDetails,
  };
}
```

## Bug #2: Validation Order (Security Issue)

### Root Cause
Zod validates **before** transforms, so length checks happen on **unsanitized** input:

**Current schema** (`/src/lib/forums/validation.ts:122-125`):
```typescript
content: z
  .string()
  .min(10, 'Content must be at least 10 characters')  // Checks BEFORE transform
  .transform((content) => sanitizeContent(content)),   // Sanitizes AFTER check
```

### Attack Vector
```javascript
// Malicious input passes validation
{
  title: "Hack",
  content: "<script>alert('XSS')</script>",  // 31 chars - passes min(10)
  category_id: 1
}

// After sanitization
{
  title: "Hack",
  content: "",  // DOMPurify removes script tags - NOW TOO SHORT!
  category_id: 1
}

// Database gets invalid empty content!
```

### Proof
```javascript
// test-validation3.js demonstrates this:
const SchemaValidateFirst = z.string()
  .min(10)                    // Validates BEFORE
  .transform(() => '');       // Transforms to empty

SchemaValidateFirst.safeParse('<script>x</script>');
// Result: SUCCESS with empty string!
```

### Impact
1. **Security**: XSS payloads can bypass length validation
2. **Data Integrity**: Empty content gets saved to database
3. **User Experience**: Topics created with no actual content

### Fix: Validate After Sanitization
```typescript
// Method 1: Use refine() after transform
content: z
  .string()
  .transform((content) => sanitizeContent(content))
  .refine((val) => val.length >= 10, {
    message: 'Content must be at least 10 characters (after sanitization)',
  }),

// Method 2: Use pipe() with separate schemas
content: z.string()
  .pipe(
    z.string()
      .transform((content) => sanitizeContent(content))
      .min(10, 'Content must be at least 10 characters after sanitization')
  ),
```

## Recommended Fix Priority

### Phase 1: Fix Type Mismatch (CRITICAL - breaks UX)
1. Implement Fix Option 3 (flexible ValidationError)
2. Update toAPIError to normalize array/object formats
3. Test with actual validation errors

### Phase 2: Fix Validation Order (SECURITY)
1. Change all content/title schemas to validate after sanitization
2. Use `.refine()` for post-transform validation
3. Add tests for XSS edge cases

### Phase 3: Add Tests
1. Unit tests for validation edge cases
2. Integration tests for API error responses
3. Security tests for XSS attempts

## Test Cases

### Test Case 1: Type Mismatch
```bash
# Current behavior: Empty details
POST /api/forums/topics
{
  "title": "",  # Too short
  "content": "valid content",
  "category_id": 1
}

# Returns: { "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [] } }
# Expected: { "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": { "title": ["Title must be at least 3 characters"] } } }
```

### Test Case 2: XSS Bypass
```bash
# Current behavior: Accepts empty content after sanitization
POST /api/forums/topics
{
  "title": "XSS Test",
  "content": "<script>alert('xss')</script>",  # Sanitizes to ""
  "category_id": 1
}

# Returns: 201 Created (BUG!)
# Expected: 400 Bad Request with "Content must be at least 10 characters"
```

## Files to Modify

1. `/src/lib/utils/api-errors.ts` - Fix ValidationError type and toAPIError normalization
2. `/src/lib/forums/validation.ts` - Fix schema validation order
3. `/src/app/api/forums/topics/route.ts` - Ensure proper error handling
4. Add tests in `/src/lib/forums/__tests__/validation.test.ts`

## Additional Notes

- This affects ALL forum validation (topics, replies, searches)
- Same pattern may exist in other features (wiki, library, etc.)
- Consider auditing all Zod schemas for similar issues
- Document best practices for Zod validation with transforms
