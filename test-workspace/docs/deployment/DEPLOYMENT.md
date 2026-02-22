# Deployment Guide

This guide covers deploying Veritable Games to production via Coolify.

## Quick Reference

| Item | Value |
|------|-------|
| **Production URL** | https://www.veritablegames.com |
| **Coolify Dashboard** | http://192.168.1.15:8000 |
| **Application UUID** | `m4s0kwo4kc4oooocck4sswc4` |
| **Build Pack** | Nixpacks (Node.js 20) |
| **Container Name** | `m4s0kwo4kc4oooocck4sswc4` |

---

## Manual Deployment

Trigger a deployment via CLI:

```bash
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

Or push to main and deploy:

```bash
git push origin main
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

---

## Auto-Deploy (Polling)

Auto-deploy is configured via a cron job that polls GitHub every minute for new commits.

### How It Works

1. Cron runs `/home/user/scripts/auto-deploy.sh` every minute
2. Script fetches latest commits from `origin/main`
3. If new commits detected, triggers `coolify deploy`
4. Logs activity to `/home/user/logs/auto-deploy.log`

### Verify Auto-Deploy is Running

```bash
# Check cron job exists
crontab -l | grep auto-deploy

# Check recent log entries
tail -20 /home/user/logs/auto-deploy.log

# Test manually
bash /home/user/scripts/auto-deploy.sh
```

### Auto-Deploy Script Location

```
/home/user/scripts/auto-deploy.sh
```

### Disable Auto-Deploy

```bash
crontab -l | grep -v auto-deploy | crontab -
```

### Re-enable Auto-Deploy

```bash
(crontab -l 2>/dev/null; echo "* * * * * /home/user/scripts/auto-deploy.sh") | crontab -
```

### Why Polling Instead of Webhooks?

GitHub webhooks require a publicly accessible endpoint. The Coolify dashboard
(port 8000) is only accessible on the local network, so webhooks can't reach it.
The polling approach checks for new commits every minute and achieves the same result.

---

## Monitoring Deployments

### Check Deployment Status

```bash
# List recent deployments
coolify deploy list

# Get specific deployment details
coolify deploy get <deployment_uuid>
```

### Check Container Status

```bash
# Container health
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"

# Container logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Deployed commit
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
```

### Verify Site

```bash
# Health check
curl -s https://www.veritablegames.com/api/health

# HTTP status
curl -sL -o /dev/null -w "%{http_code}" https://www.veritablegames.com/
```

---

## Build Configuration

The project uses Nixpacks with the following configuration in `frontend/nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start"
```

---

## Troubleshooting

### Deployment Failed

1. Check deployment logs:
   ```bash
   coolify deploy get <deployment_uuid>
   ```

2. Check container logs:
   ```bash
   docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100
   ```

3. Common issues:
   - **npm not found**: Nixpacks detected wrong provider. Check `nixpacks.toml` exists.
   - **Module not found**: Check `package.json` dependencies.
   - **Health check failing**: Check `/api/health` endpoint works.

### Container Crash-Looping

```bash
# Check exit code and logs
docker ps -a --filter "name=m4s0kwo4kc4oooocck4sswc4"
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50
```

### Site Returns 503

1. Check container is running and healthy
2. Check Traefik labels on container
3. Verify container is on `coolify` network

### Rollback to Previous Version

```bash
# List available images
docker images | grep m4s0kwo4kc4oooocck4sswc4

# Stop current container
docker stop m4s0kwo4kc4oooocck4sswc4
docker rm m4s0kwo4kc4oooocck4sswc4

# Start with previous image
docker run -d \
  --name m4s0kwo4kc4oooocck4sswc4 \
  --network coolify \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games" \
  -e POSTGRES_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games" \
  -e DATABASE_MODE=postgres \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.entryPoints=http" \
  -l "traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule=Host(\`www.veritablegames.com\`) && PathPrefix(\`/\`)" \
  -l "traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.entryPoints=https" \
  -l "traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.rule=Host(\`www.veritablegames.com\`) && PathPrefix(\`/\`)" \
  -l "traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.tls=true" \
  -l "traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.tls.certresolver=letsencrypt" \
  -l "traefik.http.services.http-0-m4s0kwo4kc4oooocck4sswc4.loadbalancer.server.port=3000" \
  m4s0kwo4kc4oooocck4sswc4:<previous_image_tag>
```

---

## Environment Variables

Critical environment variables are managed in Coolify:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `DATABASE_MODE` | Yes | Must be `postgres` |
| `NODE_ENV` | Yes | Must be `production` |
| `SESSION_SECRET` | Yes | Session encryption key |
| `ENCRYPTION_KEY` | Yes | Data encryption key |

View current variables:
```bash
coolify app env list m4s0kwo4kc4oooocck4sswc4
```

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide
- [docs/deployment/COOLIFY_CLI_GUIDE.md](./docs/deployment/COOLIFY_CLI_GUIDE.md) - CLI reference
- [docs/deployment/COOLIFY_ENVIRONMENT_VARIABLES.md](./docs/deployment/COOLIFY_ENVIRONMENT_VARIABLES.md) - Environment variable management

---

**Last Updated**: December 29, 2025
