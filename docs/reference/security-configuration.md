# Security Configuration Reference

## Content Security Policy

Configured in `next.config.js`:

```
default-src 'self'
script-src 'self' 'unsafe-eval'  (required for Three.js shaders)
worker-src 'self' blob:  (required for Web Workers)
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
```

### Why These Directives?

- **'unsafe-eval'** in script-src: Required for Three.js shader compilation
- **blob:** in worker-src: Required for Web Worker functionality
- **'unsafe-inline'** in style-src: Required for dynamic styling in React components

## Security Headers

Applied to all responses:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Header Explanations

- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer-Policy**: Controls referrer information sent with requests
- **Strict-Transport-Security**: Enforces HTTPS connections

## Environment Secrets

Required secrets for production:

```bash
# Generate with: openssl rand -hex 32
SESSION_SECRET=<random-hex-string>
CSRF_SECRET=<random-hex-string>
ENCRYPTION_KEY=<random-hex-string>
```

### Secret Management

- Store secrets in Coolify environment variables (encrypted at rest)
- Never commit secrets to git
- Rotate secrets periodically
- Use different secrets for dev/staging/production

## Database Security

### Connection Security

```
postgresql://username:password@host:port/database?sslmode=require
```

For self-hosted PostgreSQL:
- Use strong passwords
- Limit network access (Docker networks only)
- Enable SSL/TLS for production connections

### Schema Permissions

- Separate schemas for different concerns (public, auth, wiki, etc.)
- Role-based access control at database level
- Application uses single connection user with limited privileges

## Authentication

- Password hashing: bcrypt with salt rounds
- Session management: Secure HTTP-only cookies
- CSRF protection: Token-based validation
- Rate limiting: Implemented at API route level

## Security Auditing

### Run Security Audit

```bash
cd /home/user/veritable-games-migration/frontend
node scripts/comprehensive-security-audit.js
```

### Regular Security Checks

- Review dependencies for vulnerabilities (`npm audit`)
- Check for exposed secrets (`git secrets` or similar tools)
- Monitor application logs for suspicious activity
- Review and update CSP as needed

## Complete CSP Documentation

See `security/csp-config.md` in the veritable-games-site repository for full CSP documentation including:
- Detailed directive explanations
- Browser compatibility notes
- Testing procedures
- Common CSP issues and solutions
