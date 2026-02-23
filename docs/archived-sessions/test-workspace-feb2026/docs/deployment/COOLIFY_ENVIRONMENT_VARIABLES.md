# Coolify Environment Variables Management

**Status**: ✅ Updated November 20, 2025 (after 502 error resolution)

Complete guide for managing environment variables in Coolify for the Veritable Games deployment.

---

## Architecture

**Both laptop and server CLIs connect to the SAME Coolify instance**:
- Server: Coolify server (Docker) at 192.168.1.15:8000
- Laptop: Coolify CLI client pointing to 192.168.1.15:8000
- Both see identical environment variables (100% synced)

---

## Required Environment Variables

**CRITICAL for application startup** (app will crash-loop without these):
```bash
POSTGRES_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
# OR
DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**Other required variables**:
- `DATABASE_MODE=postgres` (NOT sqlite)
- `NODE_ENV=production`
- `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY` (generated secrets)

---

## Viewing Environment Variables

```bash
# List all environment variables
coolify app env list m4s0kwo4kc4oooocck4sswc4

# Check for specific variables
coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep -i database
coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep -i postgres
```

---

## Adding Environment Variables

### Method 1: Coolify Web UI (Recommended)

1. Open http://192.168.1.15:8000
2. Navigate to application → Environment
3. Add variable with key/value
4. Check "Is Build Variable" if needed at build time
5. Save and redeploy

**Advantages**:
- Most user-friendly
- Automatic encryption
- No CLI knowledge required
- Visual verification

### Method 2: Using Coolify's PHP Console (For Programmatic Addition)

```bash
docker exec coolify php artisan tinker --execute="
\$app = \App\Models\Application::where('uuid', 'm4s0kwo4kc4oooocck4sswc4')->first();
if (\$app) {
    \$env = \App\Models\EnvironmentVariable::create([
        'key' => 'YOUR_VARIABLE_NAME',
        'value' => 'your_variable_value',
        'is_buildtime' => true,   # Available during build
        'is_runtime' => true,      # Available at runtime
        'is_preview' => false,     # false = production, true = preview
        'resourceable_id' => \$app->id,
        'resourceable_type' => 'App\Models\Application',
    ]);
    echo 'SUCCESS: Variable added (ID=' . \$env->id . ')' . PHP_EOL;
}
"
```

**Use Cases**:
- Automation scripts
- Batch variable creation
- CLI-only environments

### Method 3: Direct SQL (Use with Caution)

```bash
# Check existing variables first
docker exec coolify-db psql -U coolify -d coolify -c "
  SELECT id, key, is_preview, is_buildtime, is_runtime
  FROM environment_variables
  WHERE resourceable_id = 1
  ORDER BY id;
"

# Note: Direct SQL insertion requires understanding Coolify's encryption
# Prefer Method 1 or Method 2
```

**⚠️ Warning**: Direct SQL manipulation bypasses encryption and can corrupt data. Only use for diagnosis.

---

## Verifying Variables in Running Container

```bash
# Check all environment variables in the running container
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}'

# Check specific variable
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep POSTGRES_URL
```

---

## After Adding/Changing Variables

**You MUST redeploy for changes to take effect**:

```bash
# Trigger deployment
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4

# Monitor deployment progress
coolify deploy get <deployment_uuid>

# Wait 3-5 minutes for build to complete

# Verify container is healthy
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"
# Should show: "Up X seconds (healthy)" NOT "Restarting"
```

---

## Common Issues

### "❌ DATABASE_URL or POSTGRES_URL environment variable not set"

**Symptom**: Container crash-looping, 502 Bad Gateway error

**Cause**: Missing database connection string in Coolify

**Fix**:
1. Add `POSTGRES_URL` variable using Method 1 or Method 2 above
2. Redeploy application
3. Wait for build to complete
4. Verify logs: `docker logs m4s0kwo4kc4oooocck4sswc4` should NOT show error

### "unserialize(): Error at offset 0 of N bytes"

**Symptom**: Coolify UI shows 500 error on application config page

**Cause**: Corrupted encrypted environment variables

**Fix**: See [COOLIFY_UNSERIALIZE_76_BYTE_ERROR_FIX.md](./COOLIFY_UNSERIALIZE_76_BYTE_ERROR_FIX.md)

**Test**:
```bash
docker exec coolify php artisan tinker --execute="
\$app = \App\Models\Application::where('uuid', 'm4s0kwo4kc4oooocck4sswc4')->first();
if (\$app && \$app->environmentVariables) {
    foreach (\$app->environmentVariables as \$env) {
        try {
            \$value = \$env->value;
            echo 'OK: ' . \$env->key . PHP_EOL;
        } catch (\Exception \$e) {
            echo 'ERROR: ' . \$env->key . ' - ' . \$e->getMessage() . PHP_EOL;
        }
    }
}
"
```

### Environment variables not appearing in container

**Checklist**:
1. Check variable was added for correct environment (preview vs production)
2. Verify `is_buildtime` and `is_runtime` flags are set correctly
3. Redeploy to pick up new variables
4. Check container: `docker inspect m4s0kwo4kc4oooocck4sswc4 | grep ENV -A50`

**Common Causes**:
- `is_preview = true` when deploying to production
- `is_runtime = false` for runtime-required variables
- Deployment not triggered after adding variable
- Cached build not invalidated

---

## Database Schema Reference

**environment_variables table structure** (PostgreSQL in coolify-db):

```sql
id                BIGINT         # Auto-increment ID
key               VARCHAR(255)   # Variable name (e.g., "POSTGRES_URL")
value             TEXT           # Encrypted value
is_preview        BOOLEAN        # false = production, true = preview
is_buildtime      BOOLEAN        # Available during Docker build
is_runtime        BOOLEAN        # Available when container runs
is_shown_once     BOOLEAN        # Show value only once
is_multiline      BOOLEAN        # Multi-line value
is_literal        BOOLEAN        # Literal value (no interpolation)
is_required       BOOLEAN        # Required variable
is_shared         BOOLEAN        # Shared across resources
resourceable_type VARCHAR(255)   # 'App\Models\Application'
resourceable_id   BIGINT         # Application ID (e.g., 1)
uuid              VARCHAR(255)   # Unique identifier
version           VARCHAR(255)   # Coolify version
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

**Key Columns**:
- `is_buildtime`: Variable available during `npm run build`
- `is_runtime`: Variable available when container starts
- `is_preview`: Isolates preview environments from production
- `value`: Always encrypted using Laravel's encryption

---

## Variable Lifecycle

```
1. Add via UI/CLI/SQL
   └─> Stored encrypted in coolify-db

2. Deploy triggered
   └─> Build process reads variables
       ├─> is_buildtime=true → Available during build
       └─> is_runtime=true → Injected into container

3. Container starts
   └─> Runtime variables available as process.env.VARIABLE_NAME
```

---

## Best Practices

1. **Always use Method 1 (Web UI)** unless automating
2. **Set both `is_buildtime` and `is_runtime`** for most variables
3. **Use `is_preview=false`** for production deployments
4. **Never commit secrets** to git - always use Coolify variables
5. **Redeploy after changes** - variables are baked into containers
6. **Backup critical variables** before Coolify upgrades
7. **Document required variables** in project documentation

---

## Security Considerations

### Secret Management

**DO**:
- Use Coolify's encryption for all secrets
- Rotate secrets periodically
- Use strong random values (e.g., `openssl rand -hex 32`)
- Restrict access to Coolify dashboard

**DON'T**:
- Commit secrets to git
- Share secrets in plain text
- Use weak or default secrets
- Store secrets in application code

### Access Control

**Who has access**:
- Coolify admin user
- Anyone with SSH access to server (can read coolify-db)
- Anyone with Coolify API token

**Revoking access**:
1. Change Coolify admin password
2. Regenerate Coolify API tokens
3. Rotate application secrets
4. Redeploy with new secrets

---

## Historical Context

### November 15, 2025: Database Variable Deletion Incident

**What Happened**:
Corrupted `DATABASE_URL` and `POSTGRES_URL` variables (IDs 106-109) were deleted due to encryption issues but never re-added, causing site downtime.

**Impact**:
Application crash-looped with "DATABASE_URL not set" error, resulting in 502 Bad Gateway.

**Resolution** (November 16, 2025):
Variables re-added using Method 2 (PHP artisan tinker), site restored.

**Lesson**:
Always verify critical environment variables exist after Coolify maintenance/upgrades.

**Prevention**:
```bash
# Health check script (run after Coolify upgrades)
coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep -E "POSTGRES_URL|DATABASE_URL|SESSION_SECRET"
```

---

## Related Documentation

- **[COOLIFY_CLI_GUIDE.md](./COOLIFY_CLI_GUIDE.md)** - CLI commands reference
- **[COOLIFY_UNSERIALIZE_76_BYTE_ERROR_FIX.md](./COOLIFY_UNSERIALIZE_76_BYTE_ERROR_FIX.md)** - Encryption error fix
- **[CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Production access
- **[COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)** - Initial setup

---

**Last Updated**: November 20, 2025
