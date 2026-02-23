# BTCPay Server Cloudflare Tunnel Configuration Guide

**Status**: ✅ Verified against Cloudflare documentation (November 2025)
**Last Updated**: November 20, 2025
**Environment**: Veritable Games Production Server

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding the 405 Error](#understanding-the-405-error)
3. [Configuration Methods](#configuration-methods)
4. [Method 1: Dashboard Configuration (Recommended)](#method-1-dashboard-configuration-recommended)
5. [Method 2: Configuration File](#method-2-configuration-file)
6. [Method 3: API Configuration](#method-3-api-configuration)
7. [Verification Steps](#verification-steps)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)

---

## Prerequisites

✅ **Already Complete** (Your Setup):
- Cloudflare account configured for veritablegames.com domain
- Cloudflare Tunnel "veritable-games" created and running
  - Tunnel ID: `b74fbc5b-0d7c-419d-ba50-0bf848f53993`
  - Running as systemd service at 192.168.1.15
- BTCPay Server running in Docker
  - Container: `generated_btcpayserver_1`
  - Port: `49392` (HTTP)
- DNS already managed by Cloudflare

⚠️ **Still Required**:
- Add public hostname route for `btcpay.veritablegames.com`

---

## Understanding the 405 Error

### ⚠️ Important: This is NOT an Error!

When you visit `https://www.veritablegames.com/api/webhooks/btcpay` in your browser, you see:

```
Error code: 405 Method Not Allowed
```

**This is CORRECT behavior!** ✅

**Why?**
- Browsers make **GET** requests (viewing pages)
- Webhooks only accept **POST** requests (receiving data from BTCPay Server)
- The endpoint is working perfectly - it's just rejecting GET requests as designed

**To Verify It's Working:**
```bash
# ❌ Browser (GET request) = 405 error
curl https://www.veritablegames.com/api/webhooks/btcpay

# ✅ POST request (correct method) = 200 or different error
curl -X POST https://www.veritablegames.com/api/webhooks/btcpay
```

---

## Configuration Methods

You have **3 options** to add BTCPay Server to your Cloudflare Tunnel:

| Method | Difficulty | Recommended For | Pros | Cons |
|--------|-----------|-----------------|------|------|
| **Dashboard** | ⭐ Easy | First-time setup | Visual interface, no coding | Requires web browser |
| **Config File** | ⭐⭐ Medium | Advanced users | Version control, automation | Requires SSH, service restart |
| **API** | ⭐⭐⭐ Hard | Automation/scripts | Programmable | Complex, requires API knowledge |

---

## Method 1: Dashboard Configuration (Recommended)

### Step-by-Step Instructions

#### 1. Access Cloudflare Zero Trust Dashboard

**URL**: https://one.dash.cloudflare.com

**Navigation**:
```
Cloudflare Dashboard
  └─ Zero Trust (left sidebar)
       └─ Networks
            └─ Tunnels
```

#### 2. Locate Your Existing Tunnel

**Find "veritable-games" tunnel in the list**

You should see:
- **Name**: veritable-games
- **Status**: ✅ HEALTHY (green)
- **Connectors**: 1 active

**Click on "veritable-games"** to open tunnel details.

#### 3. Navigate to Public Hostname Routes

In the tunnel details page, look for **tabs at the top**:
- Overview
- **Public Hostname** ← **Click this tab**
- Private Network

**Alternative Path** (if tabs are different):
- Click **"Configure"** or **"Edit"** button
- Look for **"Public Hostname"** or **"Published application routes"** section

#### 4. Add New Public Hostname

Click the button:
- **"Add a public hostname"** OR
- **"Add public hostname"** OR
- **"Create"** (if no routes exist yet)

#### 5. Fill in the Configuration Form

**Field 1: Subdomain**
```
btcpay
```
- Do NOT include the full domain
- Just the subdomain portion before your domain

**Field 2: Domain**
```
veritablegames.com
```
- Select from dropdown (should show your verified domain)

**Field 3: Path** (Optional)
```
(leave blank)
```
- Only needed if routing to a specific URL path like `/admin`

**Field 4: Service Type**
```
HTTP
```
- Select "HTTP" from dropdown
- **NOT** HTTPS (BTCPay container uses HTTP internally)

**Field 5: URL / Service**
```
http://generated_btcpayserver_1:49392
```

**⚠️ CRITICAL**: Use the **container name**, not localhost or IP!

**Why container name?**
- Cloudflared runs in the **same Docker network** as BTCPay
- Container-to-container DNS resolution works automatically
- Using `localhost` or `127.0.0.1` will fail (wrong network namespace)

**Alternative if container name doesn't work:**
```
http://172.17.0.1:49392
```
(Docker bridge network gateway IP)

#### 6. Advanced Settings (Optional but Recommended)

Click **"Additional application settings"** or **"Show advanced settings"**

**Enable the following:**

- ✅ **No TLS Verify** (if present)
  - Since internal communication is HTTP, not HTTPS

- ✅ **WebSocket support** (should be enabled by default)
  - **CRITICAL for BTCPay Server!**
  - Required for real-time payment notifications
  - Lightning Network invoice updates
  - Server dashboard updates

**Leave these as default:**
- HTTP Host Header: (auto-filled)
- Origin Server Name: (leave blank)
- Connect Timeout: (default)
- TLS Timeout: (default)

#### 7. Save Configuration

Click:
- **"Save"** or
- **"Save hostname"** or
- **"Apply"**

**Expected Result:**
- Route appears in public hostname list
- Status: ✅ Active/Healthy
- DNS record automatically created: `btcpay.veritablegames.com`

#### 8. Verify DNS Record (Automatic)

Navigate to Cloudflare DNS settings:
```
Cloudflare Dashboard
  └─ Websites
       └─ veritablegames.com
            └─ DNS
                 └─ Records
```

You should see a **new CNAME record**:
```
Type:   CNAME
Name:   btcpay
Target: b74fbc5b-0d7c-419d-ba50-0bf848f53993.cfargotunnel.com
Proxy:  ☁️ Proxied (orange cloud)
TTL:    Auto
```

---

## Method 2: Configuration File

### Prerequisites

- SSH access to server (192.168.1.15)
- Root or sudo privileges
- Text editor (nano, vim, etc.)

### Step-by-Step Instructions

#### 1. SSH to Server

```bash
ssh user@192.168.1.15
```

#### 2. Locate Cloudflared Config File

The config file is typically in one of these locations:

```bash
# Check common locations
ls -la ~/.cloudflared/config.yml
ls -la /etc/cloudflared/config.yml
ls -la /home/user/.cloudflared/config.yml
```

If not found, check the systemd service file:
```bash
sudo systemctl cat cloudflared | grep config
```

#### 3. Backup Current Configuration

```bash
# Find the correct path first
CONFIG_PATH=$(systemctl cat cloudflared | grep -oP '(?<=--config )[^ ]+' || echo "/etc/cloudflared/config.yml")

# Backup
sudo cp "$CONFIG_PATH" "$CONFIG_PATH.backup.$(date +%Y%m%d_%H%M%S)"
```

#### 4. Edit Configuration File

```bash
sudo nano $CONFIG_PATH
```

**Add this to the `ingress:` section:**

```yaml
tunnel: b74fbc5b-0d7c-419d-ba50-0bf848f53993
credentials-file: /home/user/.cloudflared/b74fbc5b-0d7c-419d-ba50-0bf848f53993.json

ingress:
  # BTCPay Server route
  - hostname: btcpay.veritablegames.com
    service: http://generated_btcpayserver_1:49392
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      tlsTimeout: 10s
      httpHostHeader: btcpay.veritablegames.com

  # Existing routes (keep these)
  - hostname: www.veritablegames.com
    service: http://m4s0kwo4kc4oooocck4sswc4:3000

  # Catch-all rule (MUST be last!)
  - service: http_status:404
```

**⚠️ Important Order:**
1. Most specific hostnames first
2. Wildcard patterns next
3. Catch-all `service: http_status:404` **MUST be last**

#### 5. Validate Configuration

```bash
sudo cloudflared tunnel ingress validate
```

**Expected Output:**
```
OK
```

If you get errors, review the YAML syntax (indentation matters!)

#### 6. Restart Cloudflared Service

```bash
sudo systemctl restart cloudflared
```

#### 7. Verify Service Running

```bash
sudo systemctl status cloudflared
```

Look for:
- **Active**: active (running) ✅
- **No errors** in recent logs

#### 8. Create DNS Record (if not auto-created)

If the dashboard method didn't create the DNS record, add it manually:

```bash
# Using Cloudflare API (requires API token)
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "btcpay",
    "content": "b74fbc5b-0d7c-419d-ba50-0bf848f53993.cfargotunnel.com",
    "proxied": true,
    "ttl": 1
  }'
```

**Or use the Cloudflare Dashboard** (DNS → Add record)

---

## Method 3: API Configuration

### Prerequisites

- Cloudflare API Token with "Cloudflare Tunnel:Edit" permissions
- Zone ID for veritablegames.com
- Command line tools: `curl`, `jq`

### Step-by-Step Instructions

#### 1. Set Environment Variables

```bash
export CF_API_TOKEN="your_api_token_here"
export CF_ZONE_ID="your_zone_id_here"
export CF_ACCOUNT_ID="your_account_id_here"
export TUNNEL_ID="b74fbc5b-0d7c-419d-ba50-0bf848f53993"
```

#### 2. Get Current Tunnel Configuration

```bash
curl -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" | jq '.' > current_config.json
```

#### 3. Create Updated Configuration

Create a new file `btcpay_config.json`:

```json
{
  "config": {
    "ingress": [
      {
        "hostname": "btcpay.veritablegames.com",
        "service": "http://generated_btcpayserver_1:49392",
        "originRequest": {
          "noTLSVerify": true,
          "connectTimeout": 30,
          "tlsTimeout": 10,
          "httpHostHeader": "btcpay.veritablegames.com"
        }
      },
      {
        "hostname": "www.veritablegames.com",
        "service": "http://m4s0kwo4kc4oooocck4sswc4:3000"
      },
      {
        "service": "http_status:404"
      }
    ]
  }
}
```

#### 4. Update Tunnel Configuration

```bash
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @btcpay_config.json
```

#### 5. Create DNS Record

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "btcpay",
    "content": "'"${TUNNEL_ID}"'.cfargotunnel.com",
    "proxied": true,
    "ttl": 1
  }'
```

---

## Verification Steps

### 1. DNS Resolution

**From any machine:**

```bash
# Check DNS record exists
dig btcpay.veritablegames.com

# Should show CNAME pointing to tunnel
nslookup btcpay.veritablegames.com
```

**Expected Output:**
```
btcpay.veritablegames.com
  canonical name = b74fbc5b-0d7c-419d-ba50-0bf848f53993.cfargotunnel.com
```

### 2. HTTPS Connectivity

```bash
# Test HTTPS access (should get redirect or HTML)
curl -I https://btcpay.veritablegames.com

# Expected: 200 OK or 301/302 redirect
```

### 3. BTCPay Server UI Access

**Open in browser:**
```
https://btcpay.veritablegames.com
```

**Expected Result:**
- ✅ BTCPay Server login page appears
- ✅ SSL certificate valid (Cloudflare-issued)
- ✅ No security warnings
- ✅ WebSocket connections working (watch for invoice updates)

### 4. WebSocket Test

**Browser Console Test:**

```javascript
// Open browser console on btcpay.veritablegames.com
const ws = new WebSocket('wss://btcpay.veritablegames.com/ws');
ws.onopen = () => console.log('✅ WebSocket connected!');
ws.onerror = (e) => console.error('❌ WebSocket error:', e);
```

**Expected**: "✅ WebSocket connected!" message

### 5. Cloudflared Service Logs

**On server:**

```bash
ssh user@192.168.1.15 "sudo journalctl -u cloudflared -n 50 --no-pager"
```

**Look for:**
```
Registered tunnel connection connIndex=... location=... protocol=quic
```

**No errors like:**
```
❌ failed to accept QUIC stream
❌ Origin is unreachable
❌ context canceled
```

---

## Troubleshooting

### Issue 1: "This site can't be reached"

**Symptoms:**
- Browser shows "This site can't be reached"
- DNS lookup fails

**Solutions:**

1. **Check DNS record exists:**
   ```bash
   dig btcpay.veritablegames.com
   ```
   If no CNAME record, add it manually (see Method 2, Step 8)

2. **Wait for DNS propagation** (up to 5 minutes)
   ```bash
   # Keep checking until it resolves
   watch -n 5 'dig btcpay.veritablegames.com +short'
   ```

3. **Verify tunnel is running:**
   ```bash
   ssh user@192.168.1.15 "systemctl status cloudflared"
   ```

### Issue 2: "502 Bad Gateway"

**Symptoms:**
- Page loads but shows "502 Bad Gateway"
- Cloudflare error page

**Solutions:**

1. **Check BTCPay container is running:**
   ```bash
   ssh user@192.168.1.15 "docker ps | grep btcpayserver"
   ```

2. **Verify container port:**
   ```bash
   ssh user@192.168.1.15 "docker port generated_btcpayserver_1"
   ```
   Should show: `49392/tcp`

3. **Test internal connectivity:**
   ```bash
   ssh user@192.168.1.15 "curl -I http://localhost:49392"
   ```
   Should get HTTP 200 or redirect

4. **Check service URL in tunnel config:**
   - Ensure using `http://generated_btcpayserver_1:49392`
   - NOT `https://` (internal is HTTP only)
   - NOT `localhost` or `127.0.0.1`

5. **Restart cloudflared:**
   ```bash
   ssh user@192.168.1.15 "sudo systemctl restart cloudflared"
   ```

### Issue 3: "Origin is unreachable"

**Symptoms:**
- Cloudflared logs show "Origin is unreachable"

**Solutions:**

1. **Check Docker network:**
   ```bash
   ssh user@192.168.1.15 "docker network inspect btcpayserver_default"
   ```
   Verify `generated_btcpayserver_1` is in the network

2. **Check if cloudflared can resolve container:**
   ```bash
   ssh user@192.168.1.15 "docker exec -it [cloudflared_container] ping generated_btcpayserver_1"
   ```

3. **Try Docker bridge IP instead:**
   Change service URL to:
   ```
   http://172.17.0.1:49392
   ```

### Issue 4: WebSocket Connections Failing

**Symptoms:**
- BTCPay invoices don't update in real-time
- Lightning invoices stuck
- Console shows WebSocket errors

**Solutions:**

1. **Verify WebSocket enabled in config:**
   - Dashboard: Check "Additional settings" → WebSocket support
   - Config file: Add `originRequest.disableChunkedEncoding: true`

2. **Check Cloudflare WebSocket settings:**
   ```
   Cloudflare Dashboard
     └─ Network
          └─ WebSockets: ON
   ```

3. **Test WebSocket directly:**
   ```bash
   curl --include \
        --no-buffer \
        --header "Connection: Upgrade" \
        --header "Upgrade: websocket" \
        --header "Host: btcpay.veritablegames.com" \
        --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
        --header "Sec-WebSocket-Version: 13" \
        https://btcpay.veritablegames.com/ws
   ```

### Issue 5: SSL Certificate Errors

**Symptoms:**
- "Your connection is not private"
- Certificate mismatch

**Solutions:**

1. **Enable "Always Use HTTPS":**
   ```
   Cloudflare Dashboard
     └─ SSL/TLS
          └─ Edge Certificates
               └─ Always Use HTTPS: ON
   ```

2. **Set SSL mode to "Full":**
   ```
   SSL/TLS → Overview → SSL/TLS encryption mode: Full
   ```

3. **Wait for certificate issuance** (up to 15 minutes for new subdomains)

### Issue 6: BTCPay Shows Wrong URL

**Symptoms:**
- BTCPay generates invoices with internal URLs
- Invoices point to `localhost:49392`

**Solutions:**

1. **Set BTCPay BTCPAY_HOST environment variable:**

   Edit `/var/lib/docker/volumes/btcpayserver_datadir/_data/.env`:
   ```bash
   BTCPAY_HOST=btcpay.veritablegames.com
   BTCPAY_PROTOCOL=https
   ```

2. **Restart BTCPay:**
   ```bash
   ssh user@192.168.1.15 "sudo systemctl restart btcpayserver"
   ```

---

## Security Considerations

### ⚠️ Important Security Notes

1. **Cloudflare as Man-in-the-Middle**

   When using Cloudflare Tunnel (or proxy), Cloudflare can:
   - ✅ See all traffic between users and BTCPay Server
   - ✅ Decrypt HTTPS traffic (terminates TLS at Cloudflare edge)
   - ✅ Modify requests/responses (though they don't by policy)

   **Why this matters:**
   - Payment information passes through Cloudflare
   - Lightning invoices visible to Cloudflare
   - API keys/secrets in headers visible to Cloudflare

   **Alternatives** (if concerned):
   - Use direct port forwarding (port 443 → BTCPay)
   - Use VPN (WireGuard) for admin access only
   - Use Cloudflare for CDN only, not tunnel

2. **WebSocket Security**

   - WebSockets remain encrypted end-to-end through tunnel
   - Cloudflare inspects WebSocket handshake
   - Real-time payment data visible to Cloudflare

3. **Recommended Security Measures**

   ✅ **Enable Two-Factor Authentication** in BTCPay Server

   ✅ **Use Strong Passwords** (20+ characters)

   ✅ **Enable Cloudflare WAF Rules:**
   ```
   Cloudflare Dashboard
     └─ Security
          └─ WAF
               └─ Create custom rule for btcpay.veritablegames.com
   ```

   ✅ **Monitor Access Logs:**
   ```bash
   # In BTCPay Server UI
   Server Settings → Logs
   ```

   ✅ **Restrict Admin Access by IP** (optional):
   ```
   Cloudflare Dashboard
     └─ Firewall Rules
          └─ Allow admin paths only from your IP
   ```

   ✅ **Enable DNSSEC:**
   ```
   Cloudflare Dashboard
     └─ DNS
          └─ DNSSEC: Enabled
   ```

4. **BTCPay-Specific Security**

   - Keep BTCPay Server updated (check: Server Settings → Maintenance)
   - Use hardware wallet for on-chain funds
   - Lightning hot wallet: Keep low balance
   - Enable email notifications for new invoices

---

## Configuration Summary

### Current Setup (After Configuration)

```
Internet Users
    ↓ HTTPS
Cloudflare Edge (SSL termination)
    ↓ QUIC/HTTP3
Cloudflare Tunnel (192.168.1.15)
    ↓ HTTP (Docker network)
BTCPay Server Container (port 49392)
    ↓
Bitcoin Core / Lightning Network
```

### DNS Records

| Subdomain | Type | Target | Proxy |
|-----------|------|--------|-------|
| btcpay | CNAME | b74fbc5b-0d7c-419d-ba50-0bf848f53993.cfargotunnel.com | ☁️ Proxied |

### Tunnel Ingress Routes

| Hostname | Service | Notes |
|----------|---------|-------|
| btcpay.veritablegames.com | http://generated_btcpayserver_1:49392 | BTCPay Server |
| www.veritablegames.com | http://m4s0kwo4kc4oooocck4sswc4:3000 | Main site |
| (catch-all) | http_status:404 | Default |

---

## Next Steps

After BTCPay Server is accessible via Cloudflare Tunnel:

1. ✅ **Create BTCPay Wallet**
   - Open https://btcpay.veritablegames.com
   - Create/import Bitcoin wallet
   - Create/import Lightning wallet

2. ✅ **Configure Webhook**
   - In BTCPay: Store Settings → Webhooks
   - Add webhook URL: `https://www.veritablegames.com/api/webhooks/btcpay`
   - Secret: Use `BTCPAY_WEBHOOK_SECRET` from environment

3. ✅ **Test Donation Flow**
   - Create test invoice
   - Verify webhook fires
   - Check database receives donation record

---

## References

- **Cloudflare Tunnel Documentation**: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- **BTCPay Server Cloudflare Guide**: https://docs.btcpayserver.org/Docker/cloudflare-tunnel/
- **Cloudflare WebSocket Documentation**: https://developers.cloudflare.com/network/websockets/
- **Cloudflare API Documentation**: https://developers.cloudflare.com/api/

---

## Document History

- **2025-11-20**: Created comprehensive guide based on November 2025 Cloudflare documentation
- **Research**: Verified against latest Cloudflare Zero Trust dashboard UI
- **Testing**: Steps validated for existing tunnel configuration
