# x402 Payment Protocol - Operations Guide

Day-to-day operations, monitoring, and maintenance for the x402 system.

---

## Monitoring

### View Real-Time Logs

```bash
cd frontend/mcp-servers/cloudflare-x402-proxy

# Production logs
wrangler tail

# Staging logs
wrangler tail --env staging
```

### Log Format

```json
{
  "event": "request",
  "method": "GET",
  "path": "/api/documents/unified",
  "status": 402,
  "duration": 45,
  "userAgent": "python-requests/2.28.0"
}
```

### Bot Detection Logs

When `DEBUG = "true"`, detailed bot detection logs are emitted:

```json
{
  "event": "bot_detection",
  "isBot": true,
  "confidence": 85,
  "shouldCharge": true,
  "signals": [
    {"type": "SCRAPER_UA", "weight": 40, "value": "python-requests/2.28.0"},
    {"type": "NO_ACCEPT_LANGUAGE", "weight": 10},
    {"type": "JSON_NO_COOKIE", "weight": 15}
  ]
}
```

---

## Database Queries

### View Recent Payments (D1)

```bash
wrangler d1 execute x402-payments --remote \
  --command "SELECT * FROM payments ORDER BY timestamp DESC LIMIT 20"
```

### Payment Statistics

```bash
# Total revenue
wrangler d1 execute x402-payments --remote \
  --command "SELECT SUM(amount_usd) as total_usd FROM payments"

# Payments by endpoint
wrangler d1 execute x402-payments --remote \
  --command "SELECT endpoint, COUNT(*) as count, SUM(amount_usd) as revenue FROM payments GROUP BY endpoint ORDER BY revenue DESC"

# Unique payers
wrangler d1 execute x402-payments --remote \
  --command "SELECT COUNT(DISTINCT from_address) as unique_payers FROM payments"
```

### Check KV Cache (Replay Protection)

```bash
# List recent transaction entries
wrangler kv key list --namespace-id YOUR_KV_ID --prefix "tx:"
```

---

## Common Operations

### Update Pricing

Edit `frontend/mcp-servers/cloudflare-x402-proxy/src/pricing.ts`:

```typescript
{
  pattern: /^\/api\/new-endpoint/,
  priceUSD: 0.005,
  description: 'New endpoint description',
  rateLimit: 100,
},
```

Deploy:
```bash
npm run deploy:production
```

### Add Free Endpoint

Add to the free endpoints section in `pricing.ts`:

```typescript
{
  pattern: /^\/api\/public-info/,
  priceUSD: 0,
  description: 'Public information (free)',
  rateLimit: 60,
},
```

### Change Payment Recipient

```bash
wrangler secret put PAYMENT_RECIPIENT
# Enter new wallet address
```

### Toggle Payment Blocking

Edit `wrangler.toml`:

```toml
[vars]
BLOCK_MODE = "false"  # Soft launch (log only)
# or
BLOCK_MODE = "true"   # Enforce payments
```

Deploy:
```bash
npm run deploy:production
```

---

## Troubleshooting

### Issue: Legitimate Users Getting 402

**Symptoms:** Real browser users receiving payment required responses

**Check:**
1. View logs for the affected requests
2. Look for false positive bot signals

**Solution:**
1. Adjust bot detection thresholds in `bot-detection.ts`
2. Add specific User-Agent patterns to allowlist
3. Reduce weight of signals causing false positives

### Issue: Bots Bypassing Detection

**Symptoms:** Known bots getting through without paying

**Check:**
1. Examine User-Agent and headers
2. Check bot confidence score in logs

**Solution:**
1. Add new bot patterns to detection
2. Increase weights for identifying signals
3. Lower BOT_THRESHOLD if needed

### Issue: Payment Verification Failing

**Symptoms:** Valid payments rejected

**Check:**
```bash
# View recent failed verifications
wrangler tail | grep "Payment Failed"
```

**Common causes:**
1. Transaction not yet confirmed (bot retried too fast)
2. Wrong network (testnet tx on mainnet)
3. Insufficient amount sent
4. Wrong recipient address

**Solution:**
1. Ensure bot waits for confirmation (~2-3 seconds on Base)
2. Verify PAYMENT_NETWORK matches transaction network
3. Check PAYMENT_RECIPIENT secret is correct

### Issue: Origin Server Unreachable

**Symptoms:** 502 Bad Gateway errors

**Check:**
```bash
# Test origin directly
curl https://www.veritablegames.com/api/health
```

**Solution:**
1. Verify origin server is running
2. Check ORIGIN_URL in wrangler.toml
3. Ensure no firewall blocking Cloudflare

### Issue: High Latency

**Symptoms:** Slow response times for verified payments

**Check:**
1. RPC response times in logs
2. Origin server response times

**Solution:**
1. Use custom BASE_RPC_URL for faster RPC
2. Optimize origin server performance
3. Consider caching verified payments longer

---

## Maintenance Tasks

### Weekly

1. **Review payment logs** - Check for anomalies
2. **Monitor revenue** - Track daily/weekly trends
3. **Check false positives** - Review human users flagged as bots

### Monthly

1. **Analyze bot traffic** - New patterns to detect
2. **Review pricing** - Adjust based on usage
3. **Update allowlist** - Add new legitimate crawlers
4. **Sync D1 to PostgreSQL** - Update admin dashboard

### As Needed

1. **Update Wrangler** - Keep CLI current
2. **Review x402 spec** - Check for protocol updates
3. **Rotate secrets** - If wallet compromised

---

## Rollback Procedures

### Disable x402 Completely

1. Remove route from wrangler.toml:
```toml
# Comment out or remove
# routes = [...]
```

2. Deploy:
```bash
npm run deploy:production
```

Traffic will go directly to origin, bypassing Worker.

### Emergency: Disable Payment Blocking

Quick fix without full redeploy:

```bash
# Update environment variable
wrangler secret put BLOCK_MODE
# Enter: false
```

### Revert to Previous Version

```bash
# List deployments
wrangler deployments list

# Rollback to specific version
wrangler deployments rollback [VERSION_ID]
```

---

## Performance Metrics

### Target SLAs

| Metric | Target |
|--------|--------|
| Bot detection latency | < 10ms |
| Payment verification | < 500ms |
| Total request latency (human) | < 50ms overhead |
| Total request latency (paying bot) | < 1s |

### Monitoring Points

1. **Worker CPU time** - Cloudflare dashboard
2. **RPC response times** - Custom logging
3. **KV read/write times** - Cloudflare analytics
4. **Origin response times** - Application logs

---

## Alerts to Configure

### Cloudflare (Dashboard > Notifications)

1. **Worker errors spike** - Alert on 5xx responses
2. **Worker CPU exceeded** - Performance issues
3. **D1 database errors** - Storage issues

### Application Level

1. **Revenue drop** - Significant decrease in payments
2. **High rejection rate** - Many failed payment verifications
3. **False positive spike** - Humans getting 402s

---

## Security Checklist

### Regular Checks

- [ ] PAYMENT_RECIPIENT secret is correct
- [ ] No exposed private keys in logs
- [ ] Bot detection not leaking sensitive info
- [ ] KV namespace access restricted
- [ ] D1 database access restricted

### Incident Response

If wallet compromised:
1. Change PAYMENT_RECIPIENT immediately
2. Review recent transactions
3. Consider rotating API keys

If Worker exploited:
1. Rollback to known good version
2. Review code changes
3. Check for unauthorized secrets access

---

## Useful Commands Cheat Sheet

```bash
# View logs
wrangler tail

# Deploy staging
npm run deploy:staging

# Deploy production
npm run deploy:production

# Set secret
wrangler secret put SECRET_NAME

# Query D1
wrangler d1 execute x402-payments --remote --command "SQL"

# List KV keys
wrangler kv key list --namespace-id ID --prefix "tx:"

# Rollback deployment
wrangler deployments rollback VERSION_ID

# Check Worker status
wrangler whoami
```
