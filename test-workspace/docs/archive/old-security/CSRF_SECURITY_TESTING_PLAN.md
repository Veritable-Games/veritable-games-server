# 🔒 CSRF Security Testing Plan

## Overview

Comprehensive testing strategy for the CSRF vulnerability fix that re-enables session binding while maintaining authentication flow compatibility.

## Critical Security Tests

### 1. CSRF Token Verification Tests

#### A. Basic CSRF Protection

```bash
# Test: Verify CSRF protection blocks unauthenticated requests
curl -X POST http://localhost:3000/api/forums/topics \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Test"}' \
  --cookie-jar cookies.txt

# Expected: 403 CSRF token required
```

#### B. Session Binding Verification

```bash
# Test: Verify session-bound tokens are required for non-auth endpoints
curl -X POST http://localhost:3000/api/wiki/pages \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: invalid_token" \
  -d '{"title":"Test","content":"Test"}' \
  --cookie "session_id=test123;csrf-secret=test_secret"

# Expected: 403 CSRF verification failed
```

### 2. Authentication Flow Tests

#### A. User Registration Flow

```javascript
// Test registration with CSRF protection
const testRegistration = async () => {
  // 1. Get CSRF token
  const csrfResponse = await fetch('/api/auth/csrf-token', {
    method: 'GET',
    credentials: 'include',
  });
  const { token } = await csrfResponse.json();

  // 2. Register user
  const registerResponse = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
    },
    credentials: 'include',
    body: JSON.stringify({
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!',
      display_name: 'Test User',
    }),
  });

  // Expected: 200 success with X-CSRF-Token-Refresh header
  console.log('Registration success:', registerResponse.ok);
  console.log('CSRF refresh required:', registerResponse.headers.get('X-CSRF-Token-Refresh'));
};
```

#### B. User Login Flow

```javascript
// Test login with session transition
const testLogin = async () => {
  // 1. Get initial CSRF token (anonymous session)
  const csrfResponse = await fetch('/api/auth/csrf-token', {
    method: 'GET',
    credentials: 'include',
  });
  const { token } = await csrfResponse.json();

  // 2. Login user
  const loginResponse = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
    },
    credentials: 'include',
    body: JSON.stringify({
      username: 'testuser',
      password: 'SecurePass123!',
    }),
  });

  // Expected: 200 success with session cookie + CSRF refresh signal
  console.log('Login success:', loginResponse.ok);
  console.log('Auth state changed:', loginResponse.headers.get('X-Auth-State-Changed'));
};
```

### 3. Session Transition Tests

#### A. Pre-Auth to Post-Auth Transition

```javascript
// Test CSRF token validity across authentication boundary
const testSessionTransition = async () => {
  // 1. Get CSRF token before authentication
  const preAuthToken = await getCSRFToken();

  // 2. Login (creates new session)
  await login('testuser', 'SecurePass123!');

  // 3. Try to use pre-auth token for authenticated action
  const response = await fetch('/api/forums/topics', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': preAuthToken,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ title: 'Test', content: 'Test' }),
  });

  // Expected: Should work due to auth transition handling
  console.log('Cross-session CSRF token works:', response.ok);
};
```

### 4. Security Attack Simulation

#### A. Cross-Site Request Forgery Attack

```html
<!-- Malicious form that should be blocked -->
<form action="http://localhost:3000/api/forums/topics" method="POST" style="display:none">
  <input name="title" value="Malicious Post" />
  <input name="content" value="This should be blocked" />
  <input type="submit" value="Submit" />
</form>
<script>
  // This should fail due to missing CSRF token
  document.forms[0].submit();
</script>
```

#### B. Session Hijacking Prevention

```javascript
// Test: Verify tokens are bound to specific sessions
const testSessionBinding = async () => {
  // Login as user A
  const userAResponse = await loginUser('userA', 'password123');
  const userAToken = await getCSRFToken();

  // Login as user B (different browser/session)
  const userBResponse = await loginUser('userB', 'password456');

  // Try to use user A's token with user B's session
  const maliciousResponse = await fetch('/api/forums/topics', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': userAToken,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ title: 'Should Fail', content: 'Cross-session attack' }),
  });

  // Expected: 403 CSRF verification failed
  console.log('Cross-session attack blocked:', !maliciousResponse.ok);
};
```

### 5. Client-Side Hook Tests

#### A. useCSRFToken Hook Integration

```javascript
// Test hook provides valid tokens and handles refreshes
const TestComponent = () => {
  const { token, isReady, secureFetch } = useCSRFToken();

  const testSecureFetch = async () => {
    try {
      const response = await secureFetch('/api/forums/topics', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', content: 'Test' }),
      });

      console.log('Secure fetch success:', response.ok);
    } catch (error) {
      console.error('Secure fetch failed:', error);
    }
  };

  return (
    <div>
      <div>Token ready: {isReady ? 'Yes' : 'No'}</div>
      <div>Token: {token.substring(0, 8)}...</div>
      <button onClick={testSecureFetch}>Test Secure Fetch</button>
    </div>
  );
};
```

## Manual Testing Checklist

### Pre-Deployment Tests

- [ ] Anonymous user can get CSRF token
- [ ] Anonymous user cannot access protected endpoints without token
- [ ] User registration works with CSRF token
- [ ] User login works with CSRF token
- [ ] Login triggers CSRF token refresh signal
- [ ] Post-login requests work with new session-bound tokens
- [ ] Logout invalidates CSRF tokens properly
- [ ] Cross-session attacks are blocked
- [ ] Session-bound verification works for all protected endpoints

### Authentication Flow Tests

- [ ] Register → Login → Protected action (complete flow)
- [ ] Login → Multiple protected actions (token persistence)
- [ ] Logout → Login → Protected action (token refresh)
- [ ] Session expiry → Renew → Protected action (token migration)

### Security Boundary Tests

- [ ] Missing CSRF token rejected (403)
- [ ] Invalid CSRF token rejected (403)
- [ ] Expired CSRF token rejected (403)
- [ ] Cross-origin requests blocked (CORS + CSRF)
- [ ] Cross-session token usage blocked (403)
- [ ] Malicious form submission blocked (403)

### Performance Tests

- [ ] CSRF validation latency < 5ms
- [ ] Token generation latency < 10ms
- [ ] Memory usage stable under load
- [ ] No token leakage in logs or responses

## Automated Testing Script

```bash
#!/bin/bash
# CSRF Security Test Suite

echo "🔒 Starting CSRF Security Tests..."

# Start development server
npm run dev &
SERVER_PID=$!
sleep 5

# Wait for server to be ready
while ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; do
  echo "Waiting for server..."
  sleep 2
done

echo "✅ Server ready, running tests..."

# Run test suite
npm test -- --testPathPattern="csrf" --verbose
TEST_RESULT=$?

# Cleanup
kill $SERVER_PID

if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ All CSRF security tests passed!"
  exit 0
else
  echo "❌ CSRF security tests failed!"
  exit 1
fi
```

## Production Monitoring

### Security Metrics to Track

- CSRF verification success/failure rates
- Session transition events
- Authentication state change frequencies
- Token refresh request patterns
- Failed authentication attempts with CSRF context

### Alert Conditions

- CSRF failure rate > 1% (potential attack)
- Unusual token refresh patterns (potential attack)
- Cross-session token usage attempts (definite attack)
- High volume of missing token requests (misconfiguration or attack)

### Logging Format

```json
{
  "timestamp": "2025-09-08T10:30:00Z",
  "level": "SECURITY",
  "event": "csrf_verification",
  "result": "success|failure",
  "session_id": "sess_***",
  "path": "/api/forums/topics",
  "error": "token_expired|session_mismatch|missing_token",
  "client_ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

## Rollback Plan

### Immediate Rollback (< 5 minutes)

```bash
# Revert to vulnerable but functional state
git checkout HEAD~1 -- src/lib/security/middleware.ts
npm run build
pm2 restart veritable-games
```

### Gradual Rollback (if needed)

1. Disable session binding verification (emergency mode)
2. Add feature flag to control CSRF binding level
3. Monitor for 24 hours before permanent revert
4. Document issues for future security improvements

This testing plan ensures the CSRF security fix works correctly while maintaining full system functionality.
