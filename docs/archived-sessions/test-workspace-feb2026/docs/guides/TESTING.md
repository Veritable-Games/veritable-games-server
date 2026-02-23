# Testing Guide

**Last Updated**: December 2025

---

## Overview

Veritable Games uses Jest + React Testing Library for unit and integration testing (22 test files, ~7,600 lines).

---

## Running Tests

### Unit Tests (Jest)

```bash
cd frontend

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- LoginForm.test.tsx

# Run with coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --testPathPattern=auth

# List all tests
npm test -- --listTests
```

---

## Test Organization

### Unit Test Structure

**Unit tests are co-located with the code they test** (Jest best practice):

```
frontend/src/
├── app/api/
│   └── __tests__/              # API route tests
│       └── endpoints.test.ts
├── components/
│   ├── auth/
│   │   └── __tests__/          # Component-specific tests
│   │       ├── LoginForm.test.tsx
│   │       └── RegisterForm.test.tsx
│   └── ui/
│       └── __tests__/
│           └── Button.test.tsx
├── lib/
│   ├── auth/
│   │   └── __tests__/          # Domain-specific tests
│   │       └── session.test.ts
│   ├── database/
│   │   └── __tests__/
│   │       ├── pool.test.ts
│   │       └── query-builder.test.ts
│   └── __tests__/              # Shared lib tests
└── hooks/
    └── __tests__/              # Hook tests (when created)
```

**Current Test Files** (22 total):
- API endpoint tests: `src/app/api/__tests__/endpoints.test.ts`
- Auth component tests: `src/components/auth/__tests__/*.test.tsx`
- Database tests: `src/lib/database/__tests__/*.test.ts`
- Forum service tests: `src/lib/forums/__tests__/*.test.ts`
- Security tests: `src/lib/security/__tests__/*.test.ts`
- Form tests: `src/lib/forms/__tests__/*.test.ts`

---

## Writing Tests

### Unit Test Example

```typescript
// src/components/ui/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../Button';

describe('Button Component', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

### API Route Test Example

```typescript
// src/app/api/__tests__/forums.test.ts
import { POST } from '../forums/topics/route';
import { NextRequest } from 'next/server';

describe('Forums API', () => {
  it('creates a new topic', async () => {
    const request = new NextRequest('http://localhost:3000/api/forums/topics', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Topic',
        content: 'Test content',
        category_id: 1
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
  });
});
```

---

## Test Coverage

### Current Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThresholds: {
  global: {
    branches: 60,
    functions: 60,
    lines: 70,
    statements: 70,
  },
},
```

### Generating Coverage Reports

```bash
cd frontend
npm test -- --coverage

# Coverage report generated in coverage/ directory
# View HTML report: open coverage/lcov-report/index.html
```

---

## Test Configuration

### Jest Configuration (`jest.config.js`)

- **Test Environment**: jsdom (DOM simulation)
- **Transform**: @swc/jest (fast TypeScript compilation)
- **Module Mapper**: `@/` alias → `src/`
- **Test Match Patterns**:
  - `**/__tests__/**/*.(ts|tsx|js)`
  - `**/*.(test|spec).(ts|tsx|js)`
- **Setup File**: `jest.setup.js` (global mocks and polyfills)

---

## CI/CD Integration

Tests run automatically on:

1. **Pre-commit hooks** (via Husky)
   - Runs `npm run type-check`
   - Configured in `.husky/pre-commit`

2. **Pull requests** (if CI configured)
   - Unit tests
   - Type checking

3. **Main branch pushes**
   - Full test suite
   - Coverage reporting

---

## Troubleshooting

### Jest Issues

**Problem**: Tests fail with module resolution errors
**Solution**: Check `@/` alias in `jest.config.js` moduleNameMapper

**Problem**: Database connection errors in tests
**Solution**: Tests use in-memory databases - check `jest.setup.js` mocks

**Problem**: "Unexpected token" errors
**Solution**: Verify @swc/jest is installed and configured in jest.config.js

**Problem**: Tests time out
**Solution**: Increase timeout with `jest.setTimeout(10000)` in test file

---

## Best Practices

### General

1. **Co-locate unit tests** with source code (easier to maintain)
2. **Use descriptive test names** that explain what's being tested
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **One assertion per test** (when possible) for clear failure messages
5. **Test behavior, not implementation** - focus on user-facing functionality

### React Component Testing

6. **Use accessible selectors** - prefer `getByRole`, `getByLabelText` over `getByTestId`
7. **Test user interactions** - clicks, form submissions, keyboard navigation
8. **Mock external dependencies** - API calls, database queries, browser APIs
9. **Test error states** - loading, error messages, edge cases
10. **Avoid testing internal state** - test props and rendered output

### Code Quality

11. **Run tests before commits** - configured in pre-commit hook
12. **Maintain coverage** - aim for 70%+ coverage on critical paths
13. **Fix flaky tests immediately** - intermittent failures indicate problems
14. **Keep tests fast** - unit tests <100ms, integration tests <1s
15. **Document complex test logic** - explain WHY, not WHAT

---

## Common Testing Patterns

### Testing Async Operations

```typescript
it('loads data on mount', async () => {
  const mockData = { users: ['Alice', 'Bob'] };
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockData),
    })
  );

  render(<UserList />);

  // Wait for data to load
  await screen.findByText('Alice');

  expect(screen.getByText('Bob')).toBeInTheDocument();
});
```

### Testing Forms

```typescript
it('submits form with valid data', async () => {
  const handleSubmit = jest.fn();
  const user = userEvent.setup();

  render(<LoginForm onSubmit={handleSubmit} />);

  await user.type(screen.getByLabelText('Username'), 'testuser');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Log In' }));

  expect(handleSubmit).toHaveBeenCalledWith({
    username: 'testuser',
    password: 'password123'
  });
});
```

### Testing Error Handling

```typescript
it('displays error message on API failure', async () => {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('Network error'))
  );

  render(<DataFetcher />);

  await screen.findByText('Failed to load data');
  expect(screen.getByText('Network error')).toBeInTheDocument();
});
```

---

## Test Output Directories

**Generated directories** (ignored by git):

- `coverage/` - Jest coverage reports (HTML, LCOV, JSON)
- `test-reports/` - Custom test analysis reports

**To clean test artifacts**:

```bash
cd frontend
rm -rf coverage/ test-reports/
```

---

## Adding New Tests

### Adding a Unit Test

1. Create `__tests__/` directory next to the file being tested
2. Create test file with `.test.ts` or `.test.tsx` extension
3. Import the module and testing utilities
4. Write test cases using `describe` and `it`
5. Run `npm test -- YourFile.test.tsx` to verify

---

## E2E Testing (Playwright)

### Overview

End-to-end tests use Playwright to test real user flows against the running application. Tests are configured to run against **production by default** for stability.

### Running E2E Tests

#### Production Testing (Default - Recommended)

```bash
cd frontend

# Run all E2E tests against production
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Run specific test suite
npm run test:e2e:forums          # Forum tests only

# Explicit production testing
npm run test:e2e:prod
```

**Why Production by Default?**
- ✅ Stable infrastructure (Coolify + PostgreSQL)
- ✅ No localhost 500 errors or crashes
- ✅ Tests real production environment
- ✅ Faster (no dev server startup)

#### Local Testing (Opt-in for Development)

```bash
# Run against localhost (development)
npm run test:e2e:local           # All tests
npm run test:e2e:local:ui        # Interactive UI mode
npm run test:e2e:local:debug     # Debug mode
npm run test:e2e:forums:local    # Forum tests only
```

**When to Use Local Testing:**
- 🔧 Debugging specific code changes
- 🔧 Testing features not yet deployed
- 🔧 Developing new tests

### Configuration

E2E test environment is controlled by environment variables:

```bash
# Test against production (default)
npm run test:e2e

# Opt-in to localhost testing
USE_LOCALHOST_TESTING=true npm run test:e2e

# Or use explicit URL
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npm run test:e2e
```

**Configuration File**: `frontend/playwright.config.ts`

### Test Organization

```
frontend/e2e/
├── forums/                    # Forum feature tests
│   ├── topics-crud.spec.ts
│   ├── replies-crud.spec.ts
│   ├── voting-complete.spec.ts
│   └── security/
│       ├── csrf.spec.ts
│       ├── sql-injection.spec.ts
│       └── authorization.spec.ts
├── helpers/                   # Shared test helpers
│   └── forum-helpers.ts
├── fixtures/                  # Test fixtures
│   ├── auth-fixtures.ts
│   └── workspace-fixtures.ts
└── global-setup.ts           # Global test setup
```

### Authentication

E2E tests use `.claude-credentials` file (project root):

```bash
# .claude-credentials
CLAUDE_TEST_USERNAME=claude
CLAUDE_TEST_EMAIL=claude@veritablegames.com
CLAUDE_TEST_PASSWORD=<secure-generated-password>
CLAUDE_TEST_ROLE=user
```

**Security Rules**:
- ✅ **DO**: Use `.claude-credentials` for test authentication
- ✅ **DO**: Use relative URLs (`/forums`) in tests
- ❌ **NEVER**: Hardcode passwords in test files
- ❌ **NEVER**: Hardcode absolute URLs

### Writing E2E Tests

**Example**: Forum topic creation test

```typescript
import { test, expect } from '@playwright/test';
import { login, createTopic } from './helpers/forum-helpers';

test.describe('Forum Topics', () => {
  test('authenticated user can create topic', async ({ page }) => {
    // Login using .claude-credentials
    await login(page);

    // Navigate to forum (relative URL)
    await page.goto('/forums/create');

    // Create topic
    const topicId = await createTopic(page, {
      title: 'Test Topic',
      content: 'Test content',
      category: 'general'
    });

    // Verify navigation
    await expect(page).toHaveURL(/\/forums\/topic\/\d+/);
  });
});
```

**Best Practices**:
1. Use helper functions from `e2e/helpers/`
2. Use relative URLs, not absolute
3. Use `data-testid` attributes for reliable selectors
4. Verify navigation after actions
5. Clean up test data when possible

### Debugging E2E Tests

```bash
# Interactive debug mode (production)
npm run test:e2e:debug

# Local debug mode
npm run test:e2e:local:debug

# Generate test code
npm run test:e2e:codegen

# View test report
npx playwright show-report
```

**Debug Features**:
- Playwright Inspector: Step through tests
- Screenshots: Saved on failure to `/tmp/`
- Videos: Recorded on failure
- Traces: Detailed execution traces

### Common Issues

#### Tests Timing Out
- **Cause**: Waiting for elements that don't exist
- **Fix**: Verify selectors, check console for errors

#### Authentication Failing
- **Cause**: `.claude-credentials` missing or incorrect
- **Fix**: Verify file exists in project root with correct format

#### Localhost 500 Errors
- **Cause**: Development server instability
- **Fix**: Use production testing instead (`npm run test:e2e`)

---

## Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **React Testing Library**: https://testing-library.com/docs/react-testing-library/intro
- **Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

## Quick Reference

### Jest Commands

```bash
npm test                          # Run all tests
npm test -- --watch              # Watch mode
npm test -- --coverage           # With coverage
npm test -- ComponentName        # Single file
npm test -- --testPathPattern=auth  # Pattern match
```

### Test File Locations

- Unit tests: `src/**/__tests__/*.test.{ts,tsx}`
- Mocks: `jest.setup.js` (global), or co-located with tests

---

**For more information, see**:
- [CLAUDE.md](../../CLAUDE.md) - Development guide with testing quick reference
- [REACT_PATTERNS.md](../REACT_PATTERNS.md) - React testing patterns
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Common test issues
