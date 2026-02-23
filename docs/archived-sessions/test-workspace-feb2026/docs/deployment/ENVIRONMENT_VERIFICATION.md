# Coolify Environment Variables Verification Checklist

**Date**: November 9, 2025
**Status**: Ready for verification

## ✅ Email System Environment Variables

Please verify the following variables are set in Coolify Dashboard → Project Settings → Environment Variables:

### SMTP Configuration (4 variables)
- [ ] `SMTP_HOST` = `smtp.gmail.com`
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_SECURE` = `false`
- [ ] `SMTP_USER` = `veritablegames@gmail.com`

### SMTP Security (1 variable)
- [ ] `SMTP_PASSWORD` = `oouu gdum yysj pons` (should be marked as **secret/encrypted**)

### Email Configuration (2 variables)
- [ ] `SMTP_FROM` = `"Veritable Games <noreply@veritablegames.com>"`
- [ ] `ADMIN_EMAIL` = `admin@veritablegames.com`

### Site Configuration (1 variable)
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://www.veritablegames.com` (production domain)

## 📝 Important Notes

1. **SMTP_PASSWORD Security**: Ensure this is marked as "secret" or "encrypted" in Coolify so it's not exposed in logs
2. **NEXT_PUBLIC_SITE_URL**: Must use `https://www.veritablegames.com` (not localhost) for production email links
3. **No Quotes in Values**: When entering variables in Coolify, do NOT include the quotes around values - they're only needed in .env files
4. **Case Sensitivity**: All variable names are case-sensitive

## 🔄 Variable Purposes

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST` | Gmail SMTP server address |
| `SMTP_PORT` | TLS port for Gmail (587) |
| `SMTP_SECURE` | Use TLS (false for port 587) |
| `SMTP_USER` | Gmail account sending emails |
| `SMTP_PASSWORD` | Gmail app password (not regular password) |
| `SMTP_FROM` | Sender name in email headers |
| `ADMIN_EMAIL` | Where to send new user notifications |
| `NEXT_PUBLIC_SITE_URL` | Base URL for email verification links |

## ✓ Verification Checklist

After checking all variables in Coolify:

1. [ ] All 8 variables are present in Coolify dashboard
2. [ ] SMTP_PASSWORD is marked as secret/encrypted
3. [ ] NEXT_PUBLIC_SITE_URL points to production domain (https://www.veritablegames.com)
4. [ ] No quotes or extra spaces in variable values
5. [ ] Ready to proceed with production migration

---

**Next Step**: Run production database migration via SSH
