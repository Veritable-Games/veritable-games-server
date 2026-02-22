# Coolify APP_KEY Backup

**CRITICAL: DO NOT LOSE THIS KEY**

This key is required to decrypt environment variables stored in Coolify's database.
If this key is lost, all encrypted environment variables become unrecoverable.

## Current APP_KEY

```
APP_KEY=base64:v51PzU1C3wLDfBJG50MXOs+35oc9W4FR4tQQW61ybh4=
```

**Generated**: February 8, 2026 (during upgrade)
**Location on server**: `/data/coolify/source/.env`

## What This Key Encrypts

- All environment variables in Coolify (POSTGRES_URL, STRIPE_SECRET_KEY, etc.)
- Sensitive application settings
- API tokens and secrets

## Recovery Instructions

If you ever get "The MAC is invalid" error after a Coolify reinstall/migration:

1. Edit `/data/coolify/source/.env` on the server
2. Add this line:
   ```
   APP_PREVIOUS_KEYS=base64:v51PzU1C3wLDfBJG50MXOs+35oc9W4FR4tQQW61ybh4=
   ```
3. Restart Coolify: `docker restart coolify`

## Backup Locations

- [ ] This file (git repo - docs/deployment/)
- [ ] Password manager
- [ ] Offline backup

## History

| Date | Event | Key |
|------|-------|-----|
| 2026-02-08 | Generated during upgrade | base64:v51PzU1C3wLDfBJG50MXOs+35oc9W4FR4tQQW61ybh4= |

---

**Last Updated**: February 8, 2026
