# Error Handling Guide

## Overview

The Veritable Games API uses consistent error handling patterns across all endpoints. This guide covers error codes, response formats, and best practices for handling errors in client applications.

## Error Response Format

### Basic Error Response
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Detailed Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "username",
      "reason": "Username already exists",
      "suggestion": "Try a different username"
    }
  },
  "meta": {
    "timestamp": "2025-09-17T10:00:00Z",
    "requestId": "req_abc123",
    "rateLimit": {
      "limit": 60,
      "remaining": 0,
      "reset": "2025-09-17T10:01:00Z"
    }
  }
}
```

## HTTP Status Codes

### Success Codes (2xx)

| Code | Name | Description | Usage |
|------|------|-------------|-------|
| **200** | OK | Request successful | GET, PUT, DELETE success |
| **201** | Created | Resource created | POST success |
| **204** | No Content | Success with no body | DELETE without response |

### Client Error Codes (4xx)

| Code | Name | Description | Common Causes |
|------|------|-------------|---------------|
| **400** | Bad Request | Invalid request | Missing fields, invalid data |
| **401** | Unauthorized | Authentication required | No session, expired token |
| **403** | Forbidden | Access denied | Insufficient permissions |
| **404** | Not Found | Resource not found | Invalid ID, deleted resource |
| **409** | Conflict | Resource conflict | Duplicate entry, race condition |
| **410** | Gone | Resource deleted | Permanently removed |
| **422** | Unprocessable Entity | Validation failed | Business logic violation |
| **429** | Too Many Requests | Rate limit exceeded | Too many API calls |

### Server Error Codes (5xx)

| Code | Name | Description | Action |
|------|------|-------------|--------|
| **500** | Internal Server Error | Server error | Retry with backoff |
| **502** | Bad Gateway | Upstream error | Retry after delay |
| **503** | Service Unavailable | Maintenance/overload | Check status page |
| **504** | Gateway Timeout | Request timeout | Retry with smaller payload |

## Error Codes

### Authentication Errors

| Code | Message | Resolution |
|------|---------|------------|
| `AUTH_REQUIRED` | Authentication required | Login to access resource |
| `INVALID_CREDENTIALS` | Invalid username or password | Check credentials |
| `SESSION_EXPIRED` | Session has expired | Re-authenticate |
| `INVALID_TOKEN` | Invalid or expired token | Request new token |
| `ACCOUNT_LOCKED` | Account temporarily locked | Wait or contact support |
| `EMAIL_NOT_VERIFIED` | Email verification required | Check email for verification |
| `TOTP_REQUIRED` | Two-factor authentication required | Enter TOTP code |
| `TOTP_INVALID` | Invalid TOTP code | Check authenticator app |

### Validation Errors

| Code | Message | Resolution |
|------|---------|------------|
| `VALIDATION_ERROR` | Validation failed | Check field requirements |
| `REQUIRED_FIELD` | Required field missing | Provide missing field |
| `INVALID_FORMAT` | Invalid format | Match expected format |
| `VALUE_TOO_SHORT` | Value too short | Meet minimum length |
| `VALUE_TOO_LONG` | Value too long | Reduce to maximum length |
| `INVALID_EMAIL` | Invalid email format | Provide valid email |
| `INVALID_URL` | Invalid URL format | Provide valid URL |
| `DUPLICATE_ENTRY` | Value already exists | Choose different value |

### Authorization Errors

| Code | Message | Resolution |
|------|---------|------------|
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions | Request access or upgrade role |
| `ROLE_REQUIRED` | Specific role required | Contact admin for role |
| `RESOURCE_OWNER_ONLY` | Only owner can modify | Must be resource owner |
| `ADMIN_ONLY` | Admin access required | Admin privileges needed |

### Resource Errors

| Code | Message | Resolution |
|------|---------|------------|
| `RESOURCE_NOT_FOUND` | Resource not found | Check ID or slug |
| `RESOURCE_DELETED` | Resource has been deleted | Resource no longer available |
| `RESOURCE_LOCKED` | Resource is locked | Wait or contact moderator |
| `RESOURCE_ARCHIVED` | Resource is archived | Request restoration |

### Rate Limiting Errors

| Code | Message | Resolution |
|------|---------|------------|
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Wait before retry |
| `DAILY_LIMIT_REACHED` | Daily limit reached | Wait until tomorrow |
| `CONCURRENT_LIMIT` | Too many concurrent requests | Reduce parallel requests |

### Database Errors

| Code | Message | Resolution |
|------|---------|------------|
| `DATABASE_ERROR` | Database operation failed | Retry request |
| `CONNECTION_ERROR` | Database connection failed | Wait and retry |
| `TRANSACTION_FAILED` | Transaction rolled back | Retry entire operation |
| `DEADLOCK_DETECTED` | Database deadlock | Retry with backoff |

### CSRF Errors

| Code | Message | Resolution |
|------|---------|------------|
| `CSRF_TOKEN_MISSING` | CSRF token missing | Include X-CSRF-Token header |
| `CSRF_TOKEN_INVALID` | Invalid CSRF token | Request new token |
| `CSRF_TOKEN_EXPIRED` | CSRF token expired | Refresh token |
| `CSRF_MISMATCH` | CSRF token mismatch | Ensure token matches session |

## Error Handling Patterns

### Client-Side Error Handling

#### Basic Error Handler
```javascript
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data);
    }

    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

class ApiError extends Error {
  constructor(status, data) {
    super(data.error?.message || data.error);
    this.status = status;
    this.code = data.error?.code;
    this.details = data.error?.details;
  }
}
```

#### Comprehensive Error Handler
```javascript
function handleApiError(error) {
  // Network errors
  if (!error.status) {
    console.error('Network error:', error);
    showNotification('Network error. Please check your connection.');
    return;
  }

  // Handle by status code
  switch (error.status) {
    case 400:
      handleValidationError(error);
      break;
    case 401:
      handleAuthenticationError(error);
      break;
    case 403:
      handleAuthorizationError(error);
      break;
    case 404:
      handleNotFoundError(error);
      break;
    case 429:
      handleRateLimitError(error);
      break;
    case 500:
    case 502:
    case 503:
      handleServerError(error);
      break;
    default:
      handleGenericError(error);
  }
}
```

#### Specific Error Handlers
```javascript
function handleValidationError(error) {
  if (error.details?.field) {
    // Show field-specific error
    const field = document.querySelector(`[name="${error.details.field}"]`);
    if (field) {
      field.classList.add('error');
      showFieldError(field, error.details.reason);
    }
  } else {
    showNotification(error.message, 'error');
  }
}

function handleAuthenticationError(error) {
  if (error.code === 'SESSION_EXPIRED') {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?return=${returnUrl}`;
  } else {
    showNotification('Please log in to continue', 'warning');
  }
}

function handleRateLimitError(error) {
  const resetTime = error.details?.reset;
  if (resetTime) {
    const resetDate = new Date(resetTime);
    const waitTime = Math.ceil((resetDate - Date.now()) / 1000);
    showNotification(`Rate limit exceeded. Please wait ${waitTime} seconds.`, 'warning');
  } else {
    showNotification('Too many requests. Please slow down.', 'warning');
  }
}

function handleServerError(error) {
  console.error('Server error:', error);
  showNotification('Server error. Our team has been notified.', 'error');

  // Report to error tracking service
  if (window.Sentry) {
    window.Sentry.captureException(error);
  }
}
```

### Retry Logic

#### Exponential Backoff
```javascript
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry client errors (except 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, i);
      const jitter = Math.random() * delay * 0.1; // 10% jitter

      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}

// Usage
const data = await retryWithBackoff(() =>
  apiRequest('/api/forums/topics', {
    method: 'POST',
    body: JSON.stringify(topicData)
  })
);
```

#### Rate Limit Aware Retry
```javascript
async function retryWithRateLimit(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const resetTime = error.details?.reset;
        if (resetTime) {
          const waitTime = new Date(resetTime) - Date.now();
          if (waitTime > 0 && waitTime < 60000) { // Max 1 minute wait
            console.log(`Rate limited. Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
      }

      // For other errors, use exponential backoff
      if (error.status >= 500 && i < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
}
```

### Form Validation

#### Client-Side Validation
```javascript
class FormValidator {
  constructor(form) {
    this.form = form;
    this.errors = {};
  }

  validate() {
    this.errors = {};
    const formData = new FormData(this.form);

    // Required fields
    for (const field of this.form.querySelectorAll('[required]')) {
      if (!formData.get(field.name)) {
        this.addError(field.name, 'This field is required');
      }
    }

    // Email validation
    for (const field of this.form.querySelectorAll('[type="email"]')) {
      const value = formData.get(field.name);
      if (value && !this.isValidEmail(value)) {
        this.addError(field.name, 'Invalid email address');
      }
    }

    // Min/max length
    for (const field of this.form.querySelectorAll('[minlength], [maxlength]')) {
      const value = formData.get(field.name);
      const minLength = field.getAttribute('minlength');
      const maxLength = field.getAttribute('maxlength');

      if (value) {
        if (minLength && value.length < parseInt(minLength)) {
          this.addError(field.name, `Minimum ${minLength} characters required`);
        }
        if (maxLength && value.length > parseInt(maxLength)) {
          this.addError(field.name, `Maximum ${maxLength} characters allowed`);
        }
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  addError(field, message) {
    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field].push(message);
  }

  showErrors() {
    // Clear previous errors
    this.form.querySelectorAll('.error-message').forEach(el => el.remove());
    this.form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    // Show new errors
    for (const [field, messages] of Object.entries(this.errors)) {
      const input = this.form.querySelector(`[name="${field}"]`);
      if (input) {
        input.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = messages[0];
        input.parentNode.appendChild(errorDiv);
      }
    }
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// Usage
const form = document.querySelector('#create-topic-form');
const validator = new FormValidator(form);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validator.validate()) {
    validator.showErrors();
    return;
  }

  try {
    const response = await apiRequest('/api/forums/topics', {
      method: 'POST',
      body: new FormData(form)
    });

    showNotification('Topic created successfully!', 'success');
    window.location.href = `/forums/topics/${response.data.topic.id}`;
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      validator.errors = error.details.errors;
      validator.showErrors();
    } else {
      handleApiError(error);
    }
  }
});
```

## Error Recovery Strategies

### Optimistic Updates
```javascript
async function optimisticUpdate(action, rollback) {
  // Apply optimistic update
  action();

  try {
    // Make API call
    const result = await apiRequest(...);
    return result;
  } catch (error) {
    // Rollback on failure
    rollback();
    throw error;
  }
}

// Usage
const originalTitle = topic.title;
optimisticUpdate(
  () => { topic.title = newTitle; render(); },
  () => { topic.title = originalTitle; render(); }
);
```

### Offline Queue
```javascript
class OfflineQueue {
  constructor() {
    this.queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    window.addEventListener('online', () => this.processQueue());
  }

  add(request) {
    this.queue.push({
      ...request,
      timestamp: Date.now()
    });
    this.save();
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const request = this.queue[0];

      try {
        await apiRequest(request.url, request.options);
        this.queue.shift();
        this.save();
      } catch (error) {
        if (error.status >= 400 && error.status < 500) {
          // Permanent error, remove from queue
          this.queue.shift();
          this.save();
        } else {
          // Temporary error, try later
          break;
        }
      }
    }
  }

  save() {
    localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
  }
}
```

## Monitoring & Logging

### Error Tracking
```javascript
// Log errors to monitoring service
function logError(error, context = {}) {
  const errorData = {
    message: error.message,
    stack: error.stack,
    status: error.status,
    code: error.code,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    ...context
  };

  // Send to monitoring endpoint
  fetch('/api/monitoring/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData)
  }).catch(console.error);

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorData);
  }
}
```

### Error Boundaries (React)
```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError(error, {
      component: errorInfo.componentStack,
      props: this.props
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Testing Error Handling

### Unit Tests
```javascript
describe('Error Handling', () => {
  test('handles validation errors', async () => {
    fetch.mockResponseOnce(JSON.stringify({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          field: 'email',
          reason: 'Invalid email format'
        }
      }
    }), { status: 400 });

    await expect(apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid' })
    })).rejects.toThrow('Validation failed');
  });

  test('retries on server error', async () => {
    fetch
      .mockResponseOnce('', { status: 500 })
      .mockResponseOnce('', { status: 500 })
      .mockResponseOnce(JSON.stringify({ success: true }));

    const result = await retryWithBackoff(() =>
      apiRequest('/api/endpoint')
    );

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
  });
});
```

### E2E Tests
```javascript
test('displays validation errors', async ({ page }) => {
  await page.goto('/forums/new-topic');

  // Submit empty form
  await page.click('button[type="submit"]');

  // Check for validation errors
  await expect(page.locator('.error-message'))
    .toContainText('This field is required');

  // Fill invalid data
  await page.fill('[name="title"]', 'x'); // Too short
  await page.click('button[type="submit"]');

  await expect(page.locator('.error-message'))
    .toContainText('Minimum 3 characters required');
});
```

## Best Practices

1. **Always handle errors gracefully** - Never let errors crash the application
2. **Provide meaningful error messages** - Help users understand what went wrong
3. **Log errors for debugging** - Track errors in production
4. **Implement retry logic** - Handle temporary failures automatically
5. **Validate on client and server** - Improve UX while maintaining security
6. **Use error boundaries** - Catch React component errors
7. **Test error scenarios** - Include error cases in test suites
8. **Monitor error rates** - Set up alerts for error spikes
9. **Document error codes** - Maintain comprehensive error documentation
10. **Provide recovery options** - Help users resolve errors