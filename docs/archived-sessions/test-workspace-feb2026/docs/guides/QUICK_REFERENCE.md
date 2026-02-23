# Quick Reference Guide

Quick decision tree for common development questions.

## Database Questions

**SQLite or PostgreSQL?**
- SQLite: Development only (localhost:3000, testing)
- PostgreSQL: Production ONLY (192.168.1.15, deployment)
- See: `frontend/src/lib/utils/SAFETY_GUARDS_README.md`

**Need to access a database?**
- Use `dbAdapter.query()` with schema parameter
- NEVER create Database instances directly
- See: [CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md#1-database-access-pattern-must-follow)

**Which schema for my data?**
| Schema | Purpose |
|--------|---------|
| forums | Forum discussions |
| wiki | Wiki pages & revisions |
| content | Projects/news/workspaces |
| users | User profiles (ALWAYS use `users.users`, NOT `auth.users`) |
| auth | Sessions/tokens only (NO user profiles) |
| library | Documents |
| messaging | Messages |
| system | Configuration |

**Need cross-database data?**
- Use `ProfileAggregatorService` - NO cross-database JOINs

## API Development

**Creating an API route?**
1. Create `route.ts` in `src/app/api/[domain]/`
2. Wrap handler with `withSecurity()`
3. Use `dbAdapter.query(sql, params, { schema: 'schemaName' })` for database
4. Return via `NextResponse.json()` or `errorResponse()`

**Working with params in Next.js 15?**
- MUST await: `const params = await context.params`

## Common Operations

**Running commands?**
- Git commands: from ROOT directory
- npm commands: from `frontend/` directory

**Lost admin password?**
```bash
cd frontend
npm run user:reset-admin-password
```

**Building for Docker/CI?**
- Set `NODE_ENV=production`
- Use build caching
- Handle better-sqlite3 native deps via nixpacks.toml

**Ready to deploy?**
- Use Coolify self-hosted
- See [COOLIFY_LOCAL_HOSTING_GUIDE.md](../deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md)

**Testing file uploads?**
- Use `FileQueueManager` component with upload-processor utility

## Related Documentation

- [CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md) - 9 must-follow patterns
- [COMMON_PITFALLS.md](../COMMON_PITFALLS.md) - 26 common mistakes
- [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md) - All 80+ npm scripts
- [DATABASE.md](../database/DATABASE.md) - Complete database architecture
