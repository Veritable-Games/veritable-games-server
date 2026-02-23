# Deployment Guide

Production deployment checklist and configuration.

## Build Configuration

- SWC compiler for fast builds
- Turbo mode for development
- Bundle analysis: `ANALYZE=true npm run build`
- TypeScript strict mode enabled
- Source maps disabled in production
- Styled-JSX replaced with no-op polyfill

## Environment Variables

```bash
# Security (ALL REQUIRED - generate with: openssl rand -hex 32)
SESSION_SECRET=<32-char-hex>
CSRF_SECRET=<32-char-hex>
ENCRYPTION_KEY=<32-char-hex>

# Database Paths (Optional - defaults provided)
DATABASE_PATH=data/forums.db
USERS_DATABASE_PATH=data/users.db
WIKI_DATABASE_PATH=data/wiki.db
# ... (see frontend/.env.example for full list)

# Application
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## Production Checklist

1. ✅ Set all environment variables
2. ✅ Run `npm run type-check` (CRITICAL)
3. ✅ Run `npm test` to ensure tests pass
4. ✅ Run `npm run build` to verify build succeeds
5. ✅ Check bundle size with `npm run build:analyze`
6. ✅ Set up database backups (`npm run db:backup`)
7. ✅ Configure reverse proxy (NGINX/Apache)
8. ✅ Set up SSL certificates
9. ✅ Consider database encryption (see below)
10. ✅ Set up monitoring and alerting

## Database Encryption (Optional)

For production deployments requiring encryption at rest:

```bash
# Enable in .env.local
DATABASE_ENCRYPTION_ENABLED=true
DATABASE_MASTER_KEY=<64-hex-chars>  # openssl rand -hex 32
KEY_DERIVATION_ITERATIONS=100000

# Encrypt existing databases
npm run encrypt:migrate:dry-run
npm run encrypt:migrate

# Key rotation (every 90 days recommended)
npm run encrypt:rotate

# Monitor
npm run encrypt:status
npm run encrypt:performance
```

**IMPORTANT**: Keep `DATABASE_MASTER_KEY` secure and backed up separately from database files.

## Common Runtime Warnings (Expected)

1. **SIGTERM database warnings** - Expected during hot reload
2. **Turbopack lockfiles** - Multiple package-lock.json (intentional monorepo structure)
3. **Port auto-increment** - Server uses 3001, 3002 if 3000 occupied
