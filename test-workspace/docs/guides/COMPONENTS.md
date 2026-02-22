# React Components & Patterns

**Status**: ✅ Production-ready (Form components + UI library)
**Last Updated**: November 10, 2025
**Audience**: Frontend developers building React components

---

## Quick Navigation

### Form Components Library

- **Location**: `frontend/src/lib/forms/components.tsx`
- **Purpose**: Reusable, type-safe form components with React Hook Form + Zod integration
- **Components Available**:
  - `FormField` - Wrapper with validation feedback
  - `TypedInput` - Text input with validation
  - `TypedSelect` - Select dropdown with validation
  - `TypedTextarea` - Textarea with validation
  - `FileInput` - File upload input

### UI Component Library

- **Location**: `frontend/src/components/ui/`
- **Purpose**: General-purpose UI components (buttons, cards, modals, etc.)
- **Included**: 17+ UI components (Button, Card, Badge, Alert, Tabs, etc.)

### Game UI Overlay

- **Location**: `frontend/src/components/ui/README.md`
- **Purpose**: Game state display overlay with accessible layout
- **Features**: WCAG 2.1 AA compliant, responsive design, accessible

---

## Form Components Architecture

### Overview

The form components are built on three layers:

```
User Input
    ↓
Form Component (FormField, TypedInput, etc.)
    ↓
React Hook Form (State management)
    ↓
Zod Schema (Validation)
    ↓
API Route (Submission)
```

### Component Hierarchy

```
TypedInput
├─ FormField (Label, error, help text)
├─ Input element (HTML input)
└─ Validation feedback (Icon, message)

TypedSelect
├─ FormField (Label, error, help text)
├─ Select element (HTML select)
└─ Validation feedback

TypedTextarea
├─ FormField (Label, error, help text)
├─ Textarea element (HTML textarea)
└─ Validation feedback
```

### Validation States

Each form field has 4 validation states:

| State | Appearance | Meaning |
|-------|-----------|---------|
| `idle` | No styling | Field untouched |
| `validating` | Spinning icon | Async validation in progress |
| `valid` | Green checkmark | Input passes validation |
| `invalid` | Red border + message | Input fails validation |

---

## How to Use Form Components

### Example 1: Create a Topic Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateTopicSchema } from '@/lib/forums/validation';
import { FormField, TypedInput, TypedTextarea } from '@/lib/forms/components';

export function CreateTopicForm() {
  const form = useForm({
    resolver: zodResolver(CreateTopicSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  });

  const onSubmit = async (data) => {
    const response = await fetch('/api/forums/topics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': getCsrfToken(),
      },
      body: JSON.stringify(data),
    });
    return response.json();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Title field */}
      <FormField
        label="Topic Title"
        error={form.formState.errors.title?.message}
        required
      >
        <TypedInput
          {...form.register('title')}
          placeholder="Enter topic title"
          maxLength={200}
        />
      </FormField>

      {/* Content field */}
      <FormField
        label="Topic Content"
        error={form.formState.errors.content?.message}
        required
      >
        <TypedTextarea
          {...form.register('content')}
          placeholder="Enter topic content"
          minLength={10}
        />
      </FormField>

      <button type="submit">Create Topic</button>
    </form>
  );
}
```

### Example 2: Dynamic Field Validation

```typescript
import { Controller } from 'react-hook-form';
import { FormField, TypedSelect } from '@/lib/forms/components';

export function SelectCategoryForm({ form, categories }) {
  return (
    <FormField
      label="Category"
      error={form.formState.errors.category_id?.message}
      required
    >
      <Controller
        name="category_id"
        control={form.control}
        render={({ field }) => (
          <TypedSelect {...field}>
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </TypedSelect>
        )}
      />
    </FormField>
  );
}
```

### Example 3: File Upload Form

```typescript
import { FileInput } from '@/lib/forms/components';

export function AvatarUploadForm() {
  const form = useForm({
    resolver: zodResolver(AvatarUploadSchema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        label="Avatar Image"
        error={form.formState.errors.avatar?.message}
        helperText="JPG or PNG, max 5MB"
      >
        <FileInput
          {...form.register('avatar')}
          accept=".jpg,.png"
          maxSize={5_000_000}
        />
      </FormField>

      <button type="submit">Upload Avatar</button>
    </form>
  );
}
```

---

## Form Component Reference

### FormField

**Purpose**: Wrapper component for form fields with label, error messages, and validation feedback

**Props**:
```typescript
interface FormFieldProps {
  label?: string;           // Label text
  error?: string;           // Error message (shown in red)
  required?: boolean;       // Shows asterisk
  description?: string;     // Helper text below field
  helperText?: string;      // Additional info text
  validationState?: 'idle' | 'validating' | 'valid' | 'invalid';
  showValidationIcon?: boolean;  // Show checkmark/spinner/error icon
  children: React.ReactNode;     // Form input component
}
```

**Example**:
```typescript
<FormField
  label="Username"
  error={errors.username?.message}
  required
  description="2-20 characters, alphanumeric only"
  validationState={
    isValidating ? 'validating' :
    errors.username ? 'invalid' :
    'valid'
  }
>
  <TypedInput {...register('username')} />
</FormField>
```

### TypedInput

**Purpose**: Text input with built-in validation integration

**Props**:
```typescript
interface TypedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  // Inherits all standard HTML input props:
  // type, placeholder, maxLength, minLength, pattern, required, disabled, etc.
}
```

**Example**:
```typescript
<TypedInput
  type="email"
  placeholder="your@email.com"
  maxLength={255}
  disabled={isSubmitting}
  {...register('email')}
/>
```

### TypedSelect

**Purpose**: Select dropdown with validation integration

**Props**:
```typescript
interface TypedSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  // Inherits all standard HTML select props:
  // disabled, multiple, size, etc.
}
```

**Example**:
```typescript
<TypedSelect {...register('role')}>
  <option value="">Choose a role</option>
  <option value="admin">Administrator</option>
  <option value="moderator">Moderator</option>
  <option value="user">User</option>
</TypedSelect>
```

### TypedTextarea

**Purpose**: Textarea with validation integration and auto-resize

**Props**:
```typescript
interface TypedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // Inherits all standard HTML textarea props:
  // maxLength, minLength, placeholder, disabled, rows, cols, etc.
}
```

**Example**:
```typescript
<TypedTextarea
  placeholder="Enter your message..."
  maxLength={5000}
  minLength={10}
  rows={4}
  {...register('message')}
/>
```

### FileInput

**Purpose**: File upload input with validation

**Props**:
```typescript
interface FileInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  maxSize?: number;      // Max file size in bytes
  accept?: string;       // MIME types or extensions
}
```

**Example**:
```typescript
<FileInput
  accept=".pdf,.doc,.docx"
  maxSize={10_000_000}
  {...register('document')}
/>
```

---

## UI Component Library

### Available Components

**Layout & Structure**:
- `Card` - Container for content
- `Alert` - Alert messages
- `Skeleton` - Placeholder loading state
- `Badge` - Small label/tag

**Interactive**:
- `Button` - Clickable button
- `Tabs` - Tabbed content
- `Toast` - Notification/toast message

**Specialized**:
- `Avatar` - User avatar display
- `Progress` - Progress bar
- `OptimizedImage` - Image with lazy loading
- `EditableDescription` - Editable text field
- `HybridMarkdownRenderer` - Markdown to HTML
- `SearchResultTable` - Search results display
- `IconSelector` - Icon selection dropdown

**Media & Visualization**:
- `OptimizedStellarViewer` - Three.js stellar viewer
- `StellarViewerBackground` - Stellar background component

**Special**:
- `WikiCategoryIcon` - Wiki category icon
- `GameStateOverlay` - Game state UI

---

## Styling Components

### Tailwind CSS Integration

All components use Tailwind CSS for styling. Key utility classes:

**Spacing**:
```css
px-3 py-2        /* Padding */
m-4              /* Margin */
gap-2            /* Grid/flex gap */
```

**Colors**:
```css
bg-background    /* Background color */
text-foreground  /* Text color */
border-input     /* Border color */
text-muted-foreground  /* Muted text */
```

**Interactive States**:
```css
hover:bg-accent
focus-visible:ring-2
disabled:opacity-50
```

### Dark Mode Support

Components automatically support dark mode through Tailwind's `dark:` prefix:

```typescript
// Automatically handled by component styling
<div className="bg-white dark:bg-slate-950">
  {/* Light mode: white background, dark mode: dark background */}
</div>
```

---

## Composition Patterns

### Pattern 1: Complex Form with Multiple Sections

```typescript
export function ProjectEditForm({ project }) {
  const form = useForm({
    resolver: zodResolver(ProjectEditSchema),
    defaultValues: project,
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Basic Info Section */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold mb-4">Basic Information</h2>

        <FormField label="Title" error={form.formState.errors.title?.message}>
          <TypedInput {...form.register('title')} />
        </FormField>

        <FormField label="Slug" error={form.formState.errors.slug?.message}>
          <TypedInput {...form.register('slug')} />
        </FormField>
      </Card>

      {/* Description Section */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold mb-4">Description</h2>

        <FormField label="Description" error={form.formState.errors.description?.message}>
          <TypedTextarea {...form.register('description')} />
        </FormField>
      </Card>

      {/* Submit */}
      <Button type="submit">Save Changes</Button>
    </form>
  );
}
```

### Pattern 2: Conditional Fields

```typescript
export function ArticleForm() {
  const form = useForm({ resolver: zodResolver(ArticleSchema) });
  const articleType = form.watch('type');

  return (
    <form>
      <FormField label="Article Type">
        <TypedSelect {...form.register('type')}>
          <option value="blog">Blog Post</option>
          <option value="tutorial">Tutorial</option>
          <option value="research">Research</option>
        </TypedSelect>
      </FormField>

      {/* Only show for blog posts */}
      {articleType === 'blog' && (
        <FormField label="Tags">
          <TypedInput {...form.register('tags')} />
        </FormField>
      )}

      {/* Only show for tutorials */}
      {articleType === 'tutorial' && (
        <FormField label="Difficulty Level">
          <TypedSelect {...form.register('difficulty')}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </TypedSelect>
        </FormField>
      )}
    </form>
  );
}
```

### Pattern 3: Async Validation

```typescript
export function UsernameForm() {
  const form = useForm({ resolver: zodResolver(UsernameSchema) });
  const [validating, setValidating] = useState(false);

  // Check if username is available
  const checkUsername = async (username) => {
    setValidating(true);
    const response = await fetch(`/api/users/check-username?username=${username}`);
    const { available } = await response.json();
    setValidating(false);
    return available || 'Username is already taken';
  };

  return (
    <FormField
      label="Username"
      error={form.formState.errors.username?.message}
      validationState={
        validating ? 'validating' :
        form.formState.errors.username ? 'invalid' :
        'idle'
      }
    >
      <TypedInput
        {...form.register('username', {
          validate: checkUsername
        })}
      />
    </FormField>
  );
}
```

---

## Common Mistakes

### ❌ Mistake 1: Not Using FormField Wrapper

```typescript
// WRONG - Missing context and error display
<TypedInput {...register('title')} />

// CORRECT - Includes label, errors, and structure
<FormField label="Title" error={errors.title?.message}>
  <TypedInput {...register('title')} />
</FormField>
```

### ❌ Mistake 2: Forgetting Error Display

```typescript
// WRONG - Form submits with no validation feedback
<form onSubmit={form.handleSubmit(onSubmit)}>
  <TypedInput {...register('email')} />
  <button>Submit</button>
</form>

// CORRECT - Shows validation errors
<form onSubmit={form.handleSubmit(onSubmit)}>
  <FormField error={errors.email?.message}>
    <TypedInput {...register('email')} />
  </FormField>
  <button>Submit</button>
</form>
```

### ❌ Mistake 3: Custom Styling Instead of Tailwind

```typescript
// WRONG - Creates custom styles
<input
  className="border: 1px solid #ccc; padding: 8px; ..."
  {...register('field')}
/>

// CORRECT - Uses Tailwind classes
<TypedInput
  className="border border-input px-2 py-1"
  {...register('field')}
/>
```

### ❌ Mistake 4: Not Integrating with React Hook Form

```typescript
// WRONG - Manages its own state
const [username, setUsername] = useState('');

// CORRECT - Integrates with form
const { register, formState: { errors } } = useForm();
<TypedInput {...register('username')} />
```

---

## Accessibility Features

### Built-in Accessibility

All form components include:

✅ **Labels**: Associated with inputs via `<label for="id">`
✅ **Error Messages**: Associated via `aria-describedby`
✅ **Validation States**: Conveyed through color, icon, and text
✅ **Focus Management**: Clear focus outlines
✅ **Keyboard Navigation**: All interactive elements are keyboard accessible
✅ **Screen Readers**: Proper ARIA roles and labels

### Example: Accessible Form

```typescript
<FormField
  label="Email Address"
  required
  error={errors.email?.message}
  description="We'll never share your email"
  validationState={validatingEmail ? 'validating' : 'idle'}
  showValidationIcon
>
  <TypedInput
    type="email"
    placeholder="your@email.com"
    {...register('email')}
  />
</FormField>
```

**Accessibility Features**:
- Label text read by screen readers
- Input associated with label
- Error message read aloud
- Validation icon provides visual feedback
- Focus outline visible for keyboard users

---

## Testing Form Components

### Unit Tests

```typescript
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { FormField, TypedInput } from '@/lib/forms/components';

describe('FormField', () => {
  it('displays label text', () => {
    render(
      <FormField label="Username">
        <input />
      </FormField>
    );
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(
      <FormField label="Email" error="Invalid email">
        <input />
      </FormField>
    );
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
describe('TypedInput with validation', () => {
  it('shows error on invalid input', async () => {
    const { getByPlaceholderText, getByText } = render(<EmailForm />);

    const input = getByPlaceholderText('Email');
    await userEvent.type(input, 'invalid-email');
    await userEvent.tab();

    expect(getByText('Invalid email format')).toBeInTheDocument();
  });
});
```

---

## Related Documentation

- **[TESTING.md](./TESTING.md)** - Complete testing guide with form examples
- **[docs/architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)** - Critical patterns (includes form patterns)
- **[VALIDATION_DOCUMENTATION.md](../../frontend/src/lib/forums/VALIDATION_DOCUMENTATION.md)** - Zod validation schemas

---

**Status**: ✅ Complete and current
**Last Updated**: November 10, 2025
