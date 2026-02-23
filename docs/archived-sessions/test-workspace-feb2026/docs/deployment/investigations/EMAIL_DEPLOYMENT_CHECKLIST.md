# Email System Deployment Checklist

## ✅ Development Complete (November 9, 2025)

### Infrastructure Implemented
- [x] Nodemailer SMTP client (Gmail configuration)
- [x] EmailService with verification, admin, and security email methods
- [x] Database schema with email verification and preferences columns
- [x] Database migration script for schema changes
- [x] API routes for email verification and preferences
- [x] Registration flow modified to send verification emails
- [x] Email preferences UI integrated into AccountSettingsForm
- [x] Email logging for audit trail
- [x] TypeScript compilation: 0 errors

### Code Location
- Email Infrastructure: `frontend/src/lib/email/`
  - `client.ts`: Nodemailer singleton
  - `service.ts`: EmailService with all email operations
- API Routes: `frontend/src/app/api/`
  - `email/confirm/route.ts`: Email verification endpoint
  - `email/resend/route.ts`: Resend verification email
  - `settings/email/route.ts`: Email preferences update
- Database: `frontend/scripts/migrations/`
  - `add_email_verification.sql`: Schema changes
  - `run-migrations.js`: Migration runner
- UI Components: `frontend/src/components/settings/`
  - `AccountSettingsForm.tsx`: Email preferences UI

### Git Commit
- Commit: `1be8a0a` (feat(email): Implement complete email verification and notification system)
- Status: ✅ Pushed to GitHub

---

## 🚀 PRODUCTION DEPLOYMENT STEPS

### Phase 1: Coolify Configuration
**Location**: Coolify Dashboard (192.168.1.15:3000)

1. **Add Environment Variables**:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_SECURE`: `false`
   - `SMTP_USER`: `veritablegames@gmail.com`
   - `SMTP_PASSWORD`: `oouu gdum yysj pons` (secure/encrypted)
   - `SMTP_FROM`: `"Veritable Games <noreply@veritablegames.com>"`
   - `ADMIN_EMAIL`: `admin@veritablegames.com`
   - `NEXT_PUBLIC_SITE_URL`: `https://www.veritablegames.com` (for email links)

2. **Verify Build Configuration**:
   - Base directory: `frontend` ✓ (already configured)
   - Node version: 18+ ✓
   - nixpacks.toml for better-sqlite3 ✓ (if needed)

### Phase 2: Database Migration
**On Production Server** (192.168.1.15):

```bash
# SSH into production
ssh user@192.168.1.15

# Navigate to project directory
cd /path/to/veritable-games-main/frontend

# Run migrations
npm run db:migrate
# OR manually:
node scripts/run-migrations.js

# Verify migration success
docker exec m4s0kwo4kc4oooocck4sswc4 npm run db:health
```

**Expected Output**:
- ✓ email_logs table created
- ✓ 5 new columns added to users.users
- ✓ 4 indexes created

### Phase 3: Deployment
**In Coolify Dashboard**:
1. Trigger new deployment or wait for webhook from GitHub
2. Build should complete in ~3 minutes
3. Verify deployment status: green

**Verify with SSH**:
```bash
# Check container status
docker ps | grep m4s0k

# Check logs for errors
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50 | grep -i email
```

### Phase 4: Testing
**Email Verification Flow**:
1. Register a new user at `https://www.veritablegames.com/auth/register`
2. Check veritablegames@gmail.com inbox for:
   - Verification email to user
   - Admin notification to admin@veritablegames.com
3. Click verification link in email
4. Verify email marked as verified in database:
   ```sql
   SELECT username, email, email_verified FROM users.users ORDER BY created_at DESC LIMIT 1;
   ```

**Email Preferences**:
1. Log in with test user
2. Go to Settings → Account
3. Toggle email notification preferences
4. Verify database updates:
   ```sql
   SELECT email_notifications_enabled, email_message_notifications, email_reply_notifications
   FROM users.users WHERE username = 'testuser';
   ```

**Email Logs**:
1. Check email delivery logs in database:
   ```sql
   SELECT * FROM system.email_logs ORDER BY created_at DESC LIMIT 10;
   ```
2. Verify columns: status (sent/failed), error_message (if failed)

### Phase 5: Monitoring
**What to Monitor**:
- ✓ User registrations - watch for verification emails sent
- ✓ Email logs table - monitor failed deliveries
- ✓ Gmail inbox - check for delivery issues or spam folder
- ✓ Docker logs - watch for SMTP connection errors

**Common Issues**:
- **Emails not sent**: Check SMTP credentials in Coolify
- **Emails in spam**: Gmail reputation, check SPF/DKIM alignment
- **Database migration failed**: Check Docker logs for SQL errors
- **CSRF errors**: Ensure security middleware is properly configured

### Phase 6: Verification Checklist
Before marking complete, verify:
- [ ] SMTP environment variables configured in Coolify
- [ ] Database migrations run successfully
- [ ] New user registration works
- [ ] Verification email received in Gmail inbox
- [ ] Email verification link works
- [ ] Admin notification email received
- [ ] Email preferences toggles work in settings
- [ ] Email logs table has records
- [ ] No TypeScript errors in production build
- [ ] Docker logs show no email-related errors

---

## 📋 Reference Information

### Email Service Methods
```typescript
// Send verification email
await emailService.sendVerificationEmail(userId, email, username);

// Send admin notification
await emailService.sendAdminNotification({ username, email, id });

// Send security alert
await emailService.sendSecurityAlert(userId, email, username, alertType, details);

// Generic email (internal use)
await emailService.sendEmail({ to, subject, html, emailType, userId, metadata });
```

### Database Schema
**users.users table additions**:
- `email_verification_token`: TEXT - 32-byte secure token
- `email_verification_expires_at`: TIMESTAMP - 24-hour expiration
- `email_notifications_enabled`: BOOLEAN DEFAULT true
- `email_message_notifications`: BOOLEAN DEFAULT true
- `email_reply_notifications`: BOOLEAN DEFAULT true

**system.email_logs table**:
- `id`: BIGSERIAL PRIMARY KEY
- `user_id`: INTEGER (nullable)
- `email_type`: VARCHAR(50)
- `recipient_email`: VARCHAR(255)
- `subject`: TEXT
- `sent_at`: TIMESTAMP
- `status`: VARCHAR(20) - 'sent' or 'failed'
- `error_message`: TEXT (nullable)
- `metadata`: JSONB (nullable)
- `created_at`: TIMESTAMP DEFAULT now()

### API Endpoints
- `GET /api/email/confirm?token=<token>` - Verify email
- `POST /api/email/resend` - Resend verification (requires email)
- `PUT /api/settings/email` - Update preferences (requires auth)

---

## 📞 Support & Troubleshooting

**If SMTP connection fails**:
1. Verify Gmail app password is correct (not regular password)
2. Check SMTP_USER is correct email address
3. Test with: `npm run dev` and check server logs

**If emails don't arrive**:
1. Check email_logs table for send status
2. Gmail might filter as spam - check spam folder
3. Verify NEXT_PUBLIC_SITE_URL in email links is correct

**If database migration fails**:
1. Check PostgreSQL is running
2. Verify DATABASE_URL is correct
3. Check for existing schema conflicts

---

**Status**: Ready for production deployment
**Last Updated**: November 9, 2025
