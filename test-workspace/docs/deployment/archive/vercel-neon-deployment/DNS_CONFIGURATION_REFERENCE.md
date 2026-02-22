# DNS Configuration Quick Reference

**For connecting veritablegames.com (Squarespace) to Vercel**

---

## Squarespace DNS Settings

**Log in**: Squarespace → Settings → Domains → veritablegames.com → DNS Settings

### Option 1: CNAME + A Record (Recommended)

**For www subdomain (www.veritablegames.com)**:
```
Type:  CNAME
Host:  www
Value: cname.vercel-dns.com
TTL:   Automatic
```

**For root domain (veritablegames.com)**:
```
Type:  A
Host:  @
Value: 76.76.21.21
TTL:   Automatic
```

### Option 2: A Records Only (Alternative)

**For root domain**:
```
Type:  A
Host:  @
Value: 76.76.21.21
TTL:   Automatic

Type:  A
Host:  @
Value: 76.76.21.22
TTL:   Automatic
```

**For www subdomain**:
```
Type:  CNAME
Host:  www
Value: cname.vercel-dns.com
TTL:   Automatic
```

---

## Vercel Domain Configuration

**In Vercel Dashboard**:

1. Go to: Project → Settings → Domains
2. Click: **"Add Domain"**
3. Enter: `veritablegames.com`
4. Enter: `www.veritablegames.com` (second domain)
5. Click: **"Add"**

Vercel will provide the exact DNS records above.

---

## DNS Propagation

**Check propagation status**:
- [whatsmydns.net](https://whatsmydns.net/)
- [dnschecker.org](https://dnschecker.org/)

**Expected time**: 5 minutes to 48 hours (usually < 1 hour)

**Vercel will show**:
- ⏳ "Pending Verification" → DNS not propagated yet
- ✅ "Valid Configuration" → DNS working, HTTPS certificate provisioned

---

## SSL Certificate

**Automatic** - Vercel handles this:
- Provisions Let's Encrypt certificate
- Auto-renewal
- HTTP → HTTPS redirect enabled

**No action required!**

---

## Testing After DNS Change

1. **Check DNS resolution**:
   ```bash
   nslookup veritablegames.com
   # Should return: 76.76.21.21
   ```

2. **Check HTTPS**:
   ```bash
   curl -I https://veritablegames.com
   # Should return: 200 OK with Vercel headers
   ```

3. **Browser test**:
   - Visit: https://veritablegames.com
   - Check: SSL certificate is valid (green lock icon)
   - Verify: Site loads correctly

---

## Troubleshooting

### DNS not propagating

1. Clear DNS cache (your computer):
   ```bash
   # Mac/Linux
   sudo dscacheutil -flushcache

   # Windows
   ipconfig /flushdns
   ```

2. Try different DNS server:
   - Google DNS: 8.8.8.8
   - Cloudflare DNS: 1.1.1.1

3. Wait longer (up to 48 hours max)

### "Invalid Configuration" in Vercel

**Causes**:
- DNS records not set correctly
- TTL too high (should be Automatic or 3600)
- DNS not propagated yet

**Fix**: Double-check DNS records match exactly what Vercel shows

### Certificate provisioning failed

**Usually auto-resolves** after DNS propagation. If not:
1. Vercel Dashboard → Domains → Click "Refresh"
2. Wait 5 minutes
3. Contact Vercel support if issue persists

---

## Quick Commands

```bash
# Check DNS A record
dig veritablegames.com

# Check DNS CNAME record
dig www.veritablegames.com

# Check HTTPS certificate
openssl s_client -connect veritablegames.com:443 -servername veritablegames.com

# Check site response
curl -I https://veritablegames.com
```

---

**Ready to configure?** Follow steps in main deployment guide: `VERCEL_DEPLOYMENT_GUIDE.md`
