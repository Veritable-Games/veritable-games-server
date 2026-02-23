# Coolify Environment Variables Requirements

**Created**: January 7, 2026
**Purpose**: Document critical .env variables that must be set for Coolify to function

---

## Critical Variables

These variables in `/data/coolify/source/.env` **must not be empty** or Coolify will fail:

| Variable | Purpose | How to Generate |
|----------|---------|-----------------|
| `APP_KEY` | Laravel encryption key | `echo "base64:$(openssl rand -base64 32)"` |
| `DB_PASSWORD` | PostgreSQL connection | `openssl rand -hex 16` |
| `REDIS_PASSWORD` | Redis authentication | `openssl rand -hex 16` |

---

## Quick Diagnostic

If Coolify shows "500 Internal Server Error", check these in order:

### 1. Check Container Status
```bash
docker ps -a --filter name=coolify --format "{{.Names}}: {{.Status}}"
```

Expected: All containers should show "Up X minutes (healthy)"

### 2. Check Coolify Logs
```bash
docker logs coolify --tail 30 2>&1 | grep -i "error\|exception\|failed"
```

Common errors:
- `No application encryption key` → Missing APP_KEY
- `password authentication failed` → DB_PASSWORD mismatch
- `requirepass wrong number of arguments` → Empty REDIS_PASSWORD

### 3. Check .env Variables
```bash
sudo grep -E "^(APP_KEY|DB_PASSWORD|REDIS_PASSWORD)=" /data/coolify/source/.env
```

All should have values (not empty after `=`).

---

## Recovery Procedure

### If APP_KEY is Empty
```bash
sudo bash -c '
  NEW_KEY="base64:$(openssl rand -base64 32)"
  grep -v "^APP_KEY=" /data/coolify/source/.env > /tmp/coolify.env.tmp
  echo "APP_KEY=$NEW_KEY" >> /tmp/coolify.env.tmp
  cp /tmp/coolify.env.tmp /data/coolify/source/.env
'
```

### If DB_PASSWORD is Empty or Wrong
```bash
# 1. Generate new password
NEW_PASS=$(openssl rand -hex 16)

# 2. Set in .env
sudo sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$NEW_PASS/" /data/coolify/source/.env

# 3. Update PostgreSQL user
docker exec coolify-db psql -U coolify -d coolify -c "ALTER USER coolify WITH PASSWORD '$NEW_PASS';"
```

### If REDIS_PASSWORD is Empty
```bash
# 1. Generate new password
NEW_PASS=$(openssl rand -hex 16)

# 2. Set in .env
sudo sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$NEW_PASS/" /data/coolify/source/.env
```

### After Any .env Changes
```bash
cd /data/coolify/source
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Docker Compose Notes

Coolify uses **two** compose files that must be used together:
- `docker-compose.yml` - Base service definitions
- `docker-compose.prod.yml` - Production images and volumes

**Always use both**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml [command]
```

Using only `docker-compose.yml` will fail with:
```
service "coolify" has neither an image nor a build context specified
```

---

## Access URLs

| Network | URL |
|---------|-----|
| Local LAN | http://192.168.1.15:8000 |
| Via WireGuard VPN | http://10.100.0.1:8000 |

---

## Related Documentation

- [COOLIFY_CLI_GUIDE.md](./COOLIFY_CLI_GUIDE.md)
- [SESSION_JANUARY_7_2026_GODOT_CRASH_FIX_AND_COOLIFY_RECOVERY.md](../sessions/SESSION_JANUARY_7_2026_GODOT_CRASH_FIX_AND_COOLIFY_RECOVERY.md)
