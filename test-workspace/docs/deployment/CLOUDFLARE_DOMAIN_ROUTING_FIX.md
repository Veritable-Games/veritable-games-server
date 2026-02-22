# Cloudflare Domain Routing Fix

**Issue**: Published domain (https://www.veritablegames.com) returns "bad gateway" error
**Last Updated**: November 6, 2025
**Status**: ⚠️ Requires Configuration

---

## 🎯 Critical Distinction

There are **TWO COMPLETELY DIFFERENT** access methods:

### 1. Local IP Access (WORKING ✅)
```
http://192.168.1.15:3000
```
- **Works via**: Direct port publishing (bypasses Traefik)
- **Configuration**: `ports_mappings = '3000:3000'` in Coolify
- **FQDN**: NULL (no domain routing)
- **Use case**: Local network access, development, SSH testing

### 2. Published Domain Access (BROKEN ❌)
```
https://www.veritablegames.com
```
- **Requires**: Cloudflare → Traefik → Application routing
- **Configuration**: Proper FQDN + Traefik labels
- **FQDN**: Must be set to actual domain
- **Use case**: Public internet access, production users

## ⚠️ NEVER TEST WITH LOCAL IP WHEN TROUBLESHOOTING DOMAIN ISSUES

**Common Mistake**: Testing `http://192.168.1.15:3000` when the issue is with `https://www.veritablegames.com`

These use completely different routing mechanisms! Local IP working does NOT mean domain routing works.

**Correct Testing**:
- Domain issues → Test with `https://www.veritablegames.com`
- Local issues → Test with `localhost:3000` (from dev machine) or `192.168.1.15:3000` (from network)

---

## 🐛 Current Problem

### Symptoms
- ✅ `http://192.168.1.15:3000` works perfectly
- ❌ `https://www.veritablegames.com` returns "bad gateway"
- ❌ `https://www.veritablegames.com/auth/login` fails with 502

### Root Cause

**Traefik is generating malformed routing rules**:

```
# Current (BROKEN)
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule = Host(``) && PathPrefix(`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io`)
```

Problems:
1. `Host(``)` is **empty** (causing "empty args for matcher Host" error)
2. Domain is in `PathPrefix()` instead of `Host()`
3. Using wrong domain (sslip.io instead of veritablegames.com)

**Should be**:
```
# Correct (WORKING)
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule = Host(`www.veritablegames.com`)
```

### Why This Happens

The `fqdn` field in Coolify's database is **NULL**:

```sql
SELECT uuid, name, fqdn, ports_mappings
FROM applications
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

-- Result:
-- uuid: m4s0kwo4kc4oooocck4sswc4
-- name: veritable-games
-- fqdn: NULL  ← THIS IS THE PROBLEM
-- ports_mappings: 3000:3000
```

When `fqdn` is NULL, Coolify generates malformed Traefik labels with empty `Host()` matcher.

---

## ✅ Solution: Configure Domain Routing

### Step 0: Verify Container's Internal Docker IP (CRITICAL)

**Important**: Coolify's "Published application routes" Service field requires the container's **internal Docker network IP**, not the public IP.

**Find the correct Docker internal IP**:

```bash
ssh user@192.168.1.15 "docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 3 'IPAddress'"
```

Look for the line like:
```
"IPAddress": "10.0.1.6"
```

The last number (`.6` in this example) is what goes in Coolify.

**In Coolify "Published application routes"**, update BOTH records:
- `veritablegames.com` → Service: `http://10.0.1.X:3000` (replace X with actual last octet)
- `www.veritablegames.com` → Service: `http://10.0.1.X:3000` (same as above)

**Why**: Coolify's routing table needs to know where to forward traffic on the Docker network. This is separate from DNS/Cloudflare configuration.

---

### Step 1: Set FQDN in Coolify Database

```bash
# Connect to Coolify database
ssh user@192.168.1.15 "docker exec -i coolify-db psql -U coolify -d coolify"

# Update FQDN to your actual domain
UPDATE applications
SET fqdn = 'www.veritablegames.com'
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

-- Verify the change
SELECT uuid, name, fqdn, ports_mappings
FROM applications
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

-- Expected:
-- fqdn: www.veritablegames.com

-- Exit (Ctrl+D)
```

### Step 2: Remove Direct Port Mapping (Optional)

If you want to use ONLY domain routing (not direct port):

```sql
UPDATE applications
SET ports_mappings = NULL
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';
```

**OR** keep both methods:
```sql
-- Keep both domain routing AND direct port access
-- Leave ports_mappings as '3000:3000'
```

### Step 3: Redeploy Application

This regenerates Traefik labels with correct configuration:

```bash
# Option A: Via Coolify UI
# 1. Go to http://192.168.1.15:8000
# 2. Navigate to application
# 3. Click "Deploy" button

# Option B: Via API (if configured)
curl -X POST http://192.168.1.15:8000/api/v1/deploy/m4s0kwo4kc4oooocck4sswc4

# Option C: Force redeploy via git push
# Make any trivial change and push to trigger webhook
```

### Step 4: Verify Traefik Labels

After redeployment, check the labels:

```bash
ssh user@192.168.1.15 \
  "docker inspect m4s0kwo4kc4oooocck4sswc4 --format '{{range \$key, \$value := .Config.Labels}}{{if or (eq \$key \"traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule\") (eq \$key \"traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.rule\")}}{{printf \"%s = %s\n\" \$key \$value}}{{end}}{{end}}'"

# Expected output (HTTP):
# traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule = Host(`www.veritablegames.com`)

# Expected output (HTTPS):
# traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.rule = Host(`www.veritablegames.com`)
```

### Step 5: Check Traefik Proxy Logs

Verify no more "empty args for matcher Host" errors:

```bash
ssh user@192.168.1.15 "docker logs coolify-proxy --tail 50 2>&1 | grep -E '(error|www.veritablegames|Host)'"

# Should see: Proper Host() matchers, no errors
```

---

## ⚠️ CRITICAL DISTINCTION: Docker IP vs Cloudflare DNS

**DO NOT CONFUSE THESE TWO**:

1. **Coolify Service IP** (Docker internal) → `10.0.1.X:3000`
   - Set in Coolify UI → Published application routes
   - Used for routing traffic within Docker network
   - Changes when container network changes
   - **Update this first** before DNS

2. **Cloudflare DNS Records** → Your **public IP** (`172.221.18.109`)
   - Set in Cloudflare dashboard
   - Used for DNS resolution from the internet
   - Should NOT contain Docker internal IPs
   - Should already be configured correctly if domain is proxied

**The distinction**:
- User → Cloudflare (DNS resolves to public IP) → Traefik/Coolify (forwards to Docker internal IP) → Container

---

## 🌐 Cloudflare Configuration

For domain routing to work, Cloudflare must be properly configured:

### DNS Configuration

```
Type: A
Name: www
Content: <YOUR_PUBLIC_IP or 192.168.1.15 if port-forwarded>
Proxy status: Proxied (orange cloud icon) ✅
TTL: Auto
```

**Finding your public IP**:
```bash
# From your server
curl ifconfig.me
```

### SSL/TLS Settings

**Recommended**: SSL/TLS → Full

```
Settings → SSL/TLS → Overview
Encryption mode: Full (not Full Strict)
```

**Why "Full"?**
- Cloudflare → Server: HTTPS
- Server doesn't need valid SSL cert (Coolify can use self-signed)
- Safer than "Flexible" (which uses HTTP internally)

**Alternative**: Flexible (if Full doesn't work)
```
Encryption mode: Flexible
```

**Why "Flexible" might be needed**:
- Traefik might not have proper SSL cert configured
- Quick fix to get domain working
- Can upgrade to Full later after SSL setup

### Port Forwarding (If Behind NAT)

If your server is behind a router, you need port forwarding:

```
Router Configuration:
External Port 80 → 192.168.1.15:80 (HTTP)
External Port 443 → 192.168.1.15:443 (HTTPS)
```

**Why**: Cloudflare needs to reach your server on ports 80/443, but Traefik handles the forwarding to port 3000.

---

## 🔍 Troubleshooting

### Issue: Still Getting "Bad Gateway"

**Check 1: Container Running**
```bash
ssh user@192.168.1.15 "docker ps | grep m4s0k"

# Expected: Container should be "Up" not "Restarting"
```

**Check 2: Traefik Routing**
```bash
ssh user@192.168.1.15 \
  "docker logs coolify-proxy --tail 30 2>&1 | grep www.veritablegames"

# Look for: Proper routing rules, no errors
```

**Check 3: DNS Propagation**
```bash
# From your local machine
nslookup www.veritablegames.com

# Or
dig www.veritablegames.com

# Should show your server's IP
```

**Check 4: Cloudflare to Server Connectivity**
```bash
# From your local machine (not server)
curl -I https://www.veritablegames.com

# If you get response: Cloudflare can reach server
# If timeout: Port forwarding issue or firewall
```

**Check 5: Traefik to Container Connectivity**
```bash
# From server
ssh user@192.168.1.15 \
  "docker exec coolify-proxy curl -I http://m4s0kwo4kc4oooocck4sswc4:3000"

# Expected: HTTP/1.1 200 OK or 30x redirect
```

### Issue: "Consistent Container Names" Checked but Still Breaks

**Why this doesn't fix routing**:

"Consistent Container Names" only ensures the container name (`m4s0kwo4kc4oooocck4sswc4`) doesn't change on redeployment.

It does **NOT** fix:
- ❌ Traefik routing rules
- ❌ FQDN configuration
- ❌ Domain DNS settings
- ❌ Cloudflare proxy configuration

**The routing issue** happens because `fqdn` is NULL in the database, not because the container name changes.

**What "Consistent Container Names" actually does**:
- ✅ Container keeps same name across deploys
- ✅ Docker network references stay valid
- ✅ Easier debugging (predictable container names)

### Issue: Works with `curl` from Server but Not from Browser

This suggests Cloudflare isn't reaching your server properly.

**Possible causes**:
1. Firewall blocking ports 80/443
2. Port forwarding not configured
3. DNS pointing to wrong IP
4. Cloudflare proxy disabled (gray cloud instead of orange)

**Fix**:
```bash
# Check firewall
ssh user@192.168.1.15 "sudo ufw status"

# Expected: Allow 80/tcp and 443/tcp

# If blocked, open ports:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Issue: Traefik Shows "TLS Handshake Error"

This means HTTPS is misconfigured.

**Quick fix**: Switch Cloudflare to "Flexible" SSL mode temporarily:
```
Cloudflare → SSL/TLS → Overview → Flexible
```

**Proper fix**: Configure SSL in Coolify:
```bash
# TODO: Document Coolify SSL/TLS certificate setup
# This requires either:
# - Let's Encrypt integration in Coolify
# - Custom SSL certificate upload
# - Cloudflare Origin Certificate
```

---

## 📋 Quick Reference

### Test Domain Routing
```bash
# From your local machine (NOT the server)
curl -I https://www.veritablegames.com

# Expected: HTTP/2 200 OK (or 30x redirect)
# If 502: Bad gateway issue (Traefik routing broken)
# If timeout: DNS/firewall issue
```

### View Current Configuration
```bash
# FQDN and ports
ssh user@192.168.1.15 "docker exec -i coolify-db psql -U coolify -d coolify \
  -c 'SELECT name, fqdn, ports_mappings FROM applications WHERE uuid = \"m4s0kwo4kc4oooocck4sswc4\";'"

# Traefik routing rules
ssh user@192.168.1.15 \
  "docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 2 'traefik.http.routers.*rule'"

# Recent Traefik errors
ssh user@192.168.1.15 "docker logs coolify-proxy --tail 20 2>&1 | grep ERR"
```

### Reset to Direct Port Only (Emergency Rollback)
```bash
# If domain routing is broken and you need the site working ASAP
ssh user@192.168.1.15 "docker exec -i coolify-db psql -U coolify -d coolify"

UPDATE applications
SET fqdn = NULL,
    ports_mappings = '3000:3000'
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

-- Exit and redeploy
```

This reverts to local IP access only (`http://192.168.1.15:3000`) but at least the site works.

---

## 🎓 Understanding the Architecture

```
User Browser (Anywhere)
  ↓
Cloudflare CDN (DNS: www.veritablegames.com)
  ↓
Internet → Your Public IP (or port-forwarded IP)
  ↓
Router (if behind NAT)
  ↓ [Port 80/443 forwarded]
Server (192.168.1.15)
  ↓
Traefik Proxy (coolify-proxy container)
  ↓ [Routing rules based on Host header]
Application Container (m4s0kwo4kc4oooocck4sswc4:3000)
  ↓
Next.js Application
  ↓
PostgreSQL Database (veritable-games-postgres)
```

**Key Points**:
1. **Cloudflare** handles DNS and CDN (orange cloud = proxied)
2. **Traefik** routes by domain name (`Host()` matcher)
3. **Container** listens on port 3000 internally
4. **Direct Port** bypasses Traefik entirely (192.168.1.15:3000 works even if Traefik routing is broken)

**This is why**:
- Testing `192.168.1.15:3000` tells you NOTHING about domain routing
- Domain issues require testing the actual domain (`www.veritablegames.com`)
- Traefik errors only affect domain routing, not direct port access

---

## 🔐 Security Considerations

### Cloudflare Proxy Benefits
- ✅ DDoS protection
- ✅ CDN caching
- ✅ Hides your real IP
- ✅ Free SSL certificate
- ✅ Analytics

### Disabling Cloudflare Proxy
If you disable proxy (gray cloud):
- ❌ DNS points directly to your IP (exposed)
- ❌ No DDoS protection
- ❌ No CDN
- ✅ Faster (no Cloudflare overhead)
- ✅ Easier debugging

**Recommendation**: Keep proxy enabled (orange cloud) for production.

---

**Last Updated**: November 6, 2025
**Tested**: ⏳ Pending domain routing fix implementation
**Next Steps**: Update Coolify FQDN and redeploy to test
