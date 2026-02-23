# Content Security Policy Configuration for Three.js Stellar Viewer

## Recommended CSP Header

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests
```

## Security Justifications

### `script-src 'self' 'unsafe-eval'`

- **'self'**: Only allows scripts from same origin
- **'unsafe-eval'**: Required for Three.js shader compilation (WebGL shaders use
  eval-like functions)
- **Removed 'unsafe-inline'**: No longer needed with static module loading

### `worker-src 'self' blob:`

- **'self'**: Web Workers from same origin
- **blob:**: Required for dynamically created worker scripts (orbital-worker.js,
  stellar-worker.js)

### Security Improvements

1. **Eliminated inline script injection** - Direct ES6 module imports
2. **Removed global namespace pollution** - Module-scoped variables
3. **Added integrity checks** - SRI hashes for external dependencies
4. **Proper error handling** - No information leakage

## Implementation in Next.js

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval';
              worker-src 'self' blob:;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: blob:;
              connect-src 'self';
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'none';
              upgrade-insecure-requests
            `
              .replace(/\s+/g, ' ')
              .trim(),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

## Security Testing

### CSP Validation Tools

- **CSP Evaluator**: https://csp-evaluator.withgoogle.com/
- **Observatory by Mozilla**: https://observatory.mozilla.org/
- **SecurityHeaders.com**: https://securityheaders.com/

### Manual Testing

```bash
# Test CSP compliance
curl -I https://your-domain.com | grep -i content-security-policy

# Validate header syntax
npx csp-parse-test "your-csp-header-here"
```

## Monitoring and Reporting

### CSP Violation Reporting

```javascript
// Add to CSP header
report-uri /api/csp-violation-report;
report-to csp-endpoint
```

### Report API Implementation

```javascript
// pages/api/csp-violation-report.js
export default function handler(req, res) {
  if (req.method === 'POST') {
    console.warn('CSP Violation:', req.body);
    // Log to security monitoring system
    res.status(204).end();
  } else {
    res.status(405).end();
  }
}
```
