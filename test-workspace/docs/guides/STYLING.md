# Styling & Tailwind Configuration

**Status**: ✅ Production-ready (Tailwind 3 + custom theme + accessibility support)
**Last Updated**: November 10, 2025
**Audience**: Frontend developers implementing component styles

---

## Quick Navigation

### Configuration Files

- **Tailwind Config**: `frontend/tailwind.config.js`
  - Custom color theme (dark mode)
  - Typography configuration
  - Animation keyframes

- **Global Styles**: `frontend/src/app/globals.css`
  - CSS variables for theme
  - Accessibility features
  - Print styles

- **PostCSS Config**: `frontend/postcss.config.js`
  - Tailwind CSS processing
  - Autoprefixer integration

---

## Theme Overview

### Color Scheme

The application uses a **dark theme** with high contrast for accessibility:

```css
Background: #0a0a0a (very dark gray)
Foreground: #ededed (light gray)

Contrast ratio: 15:1 (exceeds WCAG AAA standard)
```

### Color Variables

All colors are defined as CSS variables in `globals.css`:

```css
:root {
  --background: #0a0a0a;
  --foreground: #ededed;
}
```

### Using Colors in Components

**Tailwind Classes**:
```html
<!-- Background -->
<div class="bg-background">...</div>

<!-- Foreground/Text -->
<div class="text-foreground">...</div>

<!-- Use semantic Tailwind colors -->
<div class="bg-gray-900">Dark section</div>
<div class="bg-gray-850">Darker section (custom)</div>
```

**CSS Variables**:
```css
.myComponent {
  color: var(--foreground);
  background: var(--background);
}
```

---

## Tailwind Configuration

### Theme Customization

**`tailwind.config.js`** defines custom theme values:

```javascript
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#ededed',
        gray: {
          850: '#1a202e', // Custom darker gray for tables
        },
      },
      // ... more configuration
    },
  },
};
```

### Typography Configuration

The config includes extensive typography styling for markdown content:

```javascript
typography: {
  DEFAULT: {
    css: {
      // List styling
      ul: { marginLeft: '0.5rem', paddingLeft: '1.25em' },
      ol: { marginLeft: '0.5rem', paddingLeft: '1.25em' },

      // Code styling
      pre: {
        backgroundColor: '#1f2937',
        padding: '1rem',
        border: '1px solid #374151',
      },
      code: {
        backgroundColor: '#374151',
        padding: '0.125rem 0.25rem',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      },

      // Quote styling
      blockquote: {
        borderLeftWidth: '4px',
        borderLeftColor: '#6b7280',
        paddingLeft: '1rem',
      },
    }
  }
}
```

### Animation Configuration

Custom animations for common UI transitions:

```javascript
animation: {
  'slide-up': 'slideUp 0.3s ease-out',
  'fade-in': 'fadeIn 0.2s ease-out',
  'fade-in-up': 'fadeInUp 0.3s ease-out',
},
keyframes: {
  slideUp: {
    '0%': { transform: 'translateY(100%)', opacity: '0' },
    '100%': { transform: 'translateY(0)', opacity: '1' },
  },
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  // ... more keyframes
}
```

---

## How to Style Components

### Pattern 1: Basic Component Styling

```typescript
export function Card({ children, className }) {
  return (
    <div className={cn(
      'rounded-lg border border-gray-800 bg-gray-900 p-4',
      className
    )}>
      {children}
    </div>
  );
}

// Usage
<Card className="mb-4">
  <h2 className="text-lg font-bold text-foreground">Card Title</h2>
  <p className="text-sm text-gray-400">Card content</p>
</Card>
```

### Pattern 2: Responsive Design

```typescript
export function ResponsiveGrid({ children }) {
  return (
    <div className="grid
      grid-cols-1         /* Mobile: 1 column */
      sm:grid-cols-2      /* Tablet: 2 columns */
      lg:grid-cols-3      /* Desktop: 3 columns */
      xl:grid-cols-4      /* Large: 4 columns */
      gap-4
    ">
      {children}
    </div>
  );
}
```

### Pattern 3: Dark Mode Ready

```typescript
export function Themed({ children }) {
  return (
    <div className="
      bg-white dark:bg-slate-950
      text-gray-900 dark:text-gray-100
    ">
      {children}
    </div>
  );
}
```

**Note**: The application currently uses a fixed dark theme, but components are written to support light mode if needed in the future.

### Pattern 4: Interactive States

```typescript
export function Button({ children, disabled }) {
  return (
    <button className="
      px-4 py-2 rounded
      bg-blue-600 hover:bg-blue-700
      text-white
      disabled:opacity-50 disabled:cursor-not-allowed
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
      transition-colors duration-200
    ">
      {children}
    </button>
  );
}
```

### Pattern 5: Conditional Styling with `cn()`

```typescript
import { cn } from '@/lib/utils';

export function Badge({ children, variant = 'default' }) {
  return (
    <span className={cn(
      'px-2 py-1 rounded text-sm font-medium',
      variant === 'default' && 'bg-gray-800 text-gray-200',
      variant === 'success' && 'bg-green-900 text-green-200',
      variant === 'error' && 'bg-red-900 text-red-200',
      variant === 'warning' && 'bg-yellow-900 text-yellow-200',
    )}>
      {children}
    </span>
  );
}

// Usage
<Badge variant="success">Active</Badge>
<Badge variant="error">Failed</Badge>
```

---

## Common Tailwind Utilities

### Spacing

```html
<!-- Padding -->
<div class="p-4">16px padding</div>
<div class="px-4 py-2">Horizontal 16px, vertical 8px</div>

<!-- Margin -->
<div class="m-4">16px margin</div>
<div class="mb-4">16px bottom margin</div>

<!-- Gap (flexbox/grid) -->
<div class="flex gap-4">...</div>
```

### Layout

```html
<!-- Flexbox -->
<div class="flex items-center justify-between">...</div>
<div class="flex flex-col gap-2">...</div>

<!-- Grid -->
<div class="grid grid-cols-3 gap-4">...</div>

<!-- Positioning -->
<div class="fixed bottom-4 right-4">...</div>
<div class="absolute top-0 left-0">...</div>
```

### Typography

```html
<!-- Font size -->
<h1 class="text-4xl">Large heading</h1>
<p class="text-sm">Small text</p>

<!-- Font weight -->
<p class="font-bold">Bold text</p>
<p class="font-light">Light text</p>

<!-- Text alignment -->
<p class="text-center">Centered</p>
<p class="text-right">Right-aligned</p>

<!-- Text color -->
<p class="text-foreground">Default color</p>
<p class="text-gray-500">Gray text</p>
```

### Borders

```html
<!-- Border -->
<div class="border border-gray-700">1px border</div>
<div class="border-2 border-gray-600">2px border</div>

<!-- Border radius -->
<div class="rounded">Default radius</div>
<div class="rounded-lg">Larger radius</div>

<!-- Border color -->
<div class="border border-red-600">Red border</div>
```

### Effects

```html
<!-- Shadow -->
<div class="shadow-lg">Large shadow</div>

<!-- Opacity -->
<div class="opacity-50">50% opacity</div>

<!-- Hover effects -->
<button class="hover:bg-gray-700 hover:shadow-lg">...</button>

<!-- Transitions -->
<div class="transition-colors duration-200">...</div>
```

---

## Dark Mode Support

### Current Implementation

The application uses a **fixed dark theme** defined in CSS variables:

```css
:root {
  --background: #0a0a0a;
  --foreground: #ededed;
}
```

### High Contrast Mode Support

The app includes a media query for high contrast mode preference:

```css
@media (prefers-contrast: high) {
  body {
    --background: #000000;    /* Pure black */
    --foreground: #ffffff;    /* Pure white */
  }
}
```

### Reduced Motion Support

The app respects user's reduced motion preference:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Future: Light Mode Support

If light mode support is added, use Tailwind's `dark:` prefix:

```html
<!-- Light mode by default, dark mode with dark: prefix -->
<div class="bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100">
  ...
</div>
```

---

## Print Styles

Print-specific styles are defined in `src/styles/print.css`:

```css
@media print {
  /* Hide interactive elements */
  nav, footer, button { display: none; }

  /* Optimize for print */
  body { background: white; color: black; }

  /* Page breaks */
  .page-break-before { page-break-before: always; }
}
```

---

## Custom Fonts

The application uses the **Kalinga** font family:

```css
@font-face {
  font-family: 'Kalinga';
  src: url('/fonts/34688578316.ttf') format('truetype');
  font-weight: normal;
}

@font-face {
  font-family: 'Kalinga';
  src: url('/fonts/41956811750.ttf') format('truetype');
  font-weight: bold;
}

body {
  font-family: 'Kalinga', Arial, Helvetica, sans-serif;
}
```

---

## Component Styling Examples

### Example 1: Form Input

```typescript
export function FormInput({ error, disabled, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-md border px-3 py-2',
        'bg-gray-900 text-foreground',
        'border-gray-700 focus:border-blue-500',
        'placeholder:text-gray-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error && 'border-red-600 focus:border-red-600 focus:ring-red-500',
      )}
      disabled={disabled}
      {...props}
    />
  );
}
```

### Example 2: Modal

```typescript
export function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="
        relative
        w-full max-w-md
        rounded-lg
        bg-gray-900
        p-6
        shadow-2xl
      ">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-foreground"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
```

### Example 3: Navigation Bar

```typescript
export function Navbar() {
  return (
    <nav className="
      fixed top-0 left-0 right-0
      bg-background border-b border-gray-800
      backdrop-blur-md bg-black/80
      z-50
    ">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-2xl font-bold text-foreground">Logo</h1>

        <ul className="flex gap-6">
          <li><a href="/" className="hover:text-blue-400 transition-colors">Home</a></li>
          <li><a href="/forums" className="hover:text-blue-400 transition-colors">Forums</a></li>
        </ul>
      </div>
    </nav>
  );
}
```

---

## Accessibility Considerations

### Color Contrast

✅ All text meets WCAG AAA standards (15:1 ratio)
✅ Interactive elements clearly distinguished
✅ No color-only information conveyed

**Good**:
```html
<button class="bg-blue-600 text-white">
  Submit
</button>
```

**Bad** (color-only):
```html
<!-- Don't convey information by color alone -->
<span class="text-green-400">Success</span>

<!-- Do this instead -->
<span class="text-green-400">✓ Success</span>
```

### Focus Indicators

All interactive elements have clear focus indicators:

```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
```

### Reduced Motion

Animations respect the `prefers-reduced-motion` setting:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Performance Tips

### 1. Use Tailwind Classes

```html
<!-- Good - uses Tailwind -->
<div class="flex gap-4 p-4">...</div>

<!-- Bad - uses inline styles -->
<div style="display: flex; gap: 16px; padding: 16px;">...</div>
```

### 2. Avoid Dynamic Classes

```typescript
// Good - classes are static
<div className="bg-gray-900">...</div>

// Bad - dynamic class names aren't purged
const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
<div className={`${bgColor}`}>...</div>

// Better - use conditional className utility
<div className={cn(
  'p-4',
  isDark ? 'bg-gray-900' : 'bg-white'
)}>...</div>
```

### 3. Use CSS Variables for Repetitive Values

```css
:root {
  --spacing-unit: 4px;
  --transition-duration: 0.2s;
}

.element {
  padding: calc(var(--spacing-unit) * 4);
  transition: all var(--transition-duration);
}
```

---

## Testing Styles

### Unit Tests

```typescript
import { render } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('applies background class', () => {
    const { container } = render(<Card />);
    const element = container.querySelector('div');
    expect(element).toHaveClass('bg-gray-900');
  });
});
```

### Visual Regression Tests

```typescript
import { test, expect } from '@playwright/test';

test('button has correct styles', async ({ page }) => {
  await page.goto('/components/button');
  const button = page.locator('button');

  // Check computed styles
  const bgColor = await button.evaluate(
    el => window.getComputedStyle(el).backgroundColor
  );
  expect(bgColor).toBe('rgb(37, 99, 235)'); // blue-600
});
```

---

## Related Documentation

- **[COMPONENTS.md](./COMPONENTS.md)** - Component library with styling examples
- **[docs/REACT_PATTERNS.md](../REACT_PATTERNS.md)** - React styling patterns
- **[ACCESSIBILITY_COMPLIANCE_REPORT.md](../reports/ACCESSIBILITY_COMPLIANCE_REPORT.md)** - Full accessibility audit

---

**Status**: ✅ Complete and current
**Last Updated**: November 10, 2025
