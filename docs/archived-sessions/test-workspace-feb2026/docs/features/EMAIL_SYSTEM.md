# Email System Documentation

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready
**Location**: `frontend/src/lib/email/`, `frontend/src/app/api/email/`

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [SMTP Configuration](#smtp-configuration)
- [Email Service](#email-service)
- [Email Types](#email-types)
- [API Endpoints](#api-endpoints)
- [Email Templates](#email-templates)
- [Email Logging](#email-logging)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Email System provides transactional email functionality using SMTP (via Nodemailer). It supports email verification, security alerts, admin notifications, and general email sending with automatic logging and error handling.

### Key Features

✅ **SMTP Integration**: Nodemailer with configurable SMTP servers
✅ **Singleton Pattern**: Single transporter instance per application
✅ **Email Verification**: Token-based email confirmation system
✅ **Security Alerts**: Notify users of suspicious activity
✅ **Admin Notifications**: Alert admins of important events
✅ **Email Logging**: Track all sent emails in database
✅ **Error Handling**: Automatic retry and failure logging
✅ **HTML & Text**: Support for both HTML and plain text emails
✅ **Template System**: Reusable email templates

### Use Cases

- **Account Verification**: Confirm user email addresses during signup
- **Password Reset**: Send password reset links
- **Security Alerts**: Notify users of failed login attempts
- **Admin Notifications**: Alert admins of new user registrations
- **Transactional Emails**: Order confirmations, receipts, etc. (future)
- **Digest Emails**: Weekly/monthly activity summaries (future)

---

## Architecture

### Component Structure

```
Email System
├── EmailClient (lib/email/client.ts)
│   ├── Singleton SMTP transporter
│   ├── Connection pooling
│   └── Connection verification
├── EmailService (lib/email/service.ts)
│   ├── sendEmail() - General purpose
│   ├── sendVerificationEmail() - Email confirmation
│   ├── sendAdminNotification() - Admin alerts
│   ├── sendSecurityAlert() - Security notifications
│   └── logEmail() - Database logging
├── API Endpoints (app/api/email/)
│   ├── /api/email/confirm - Verify email
│   └── /api/email/resend - Resend verification
└── Email Templates (inline HTML)
    ├── Verification email template
    ├── Admin notification template
    └── Security alert template
```

### Design Principles

1. **Singleton Transporter**: One SMTP connection per application
2. **Async/Non-Blocking**: Emails sent asynchronously
3. **Logging First**: Log email intent before sending
4. **Error Resilience**: Failures logged but don't crash app
5. **Plain Text Fallback**: HTML emails include text version

---

## SMTP Configuration

### Environment Variables

**Required Variables** (in `.env.local`):

```bash
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false  # true for 465 (SSL), false for 587 (STARTTLS)
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Sender Email
SMTP_FROM="Veritable Games <noreply@veritablegames.com>"

# Admin Email (for notifications)
ADMIN_EMAIL=admin@veritablegames.com

# Site URL (for verification links)
NEXT_PUBLIC_SITE_URL=https://www.veritablegames.com
```

### Supported SMTP Providers

| Provider | SMTP Host | Port | Secure | Notes |
|----------|-----------|------|--------|-------|
| **Gmail** | smtp.gmail.com | 587 | false | Requires app password |
| **SendGrid** | smtp.sendgrid.net | 587 | false | API key as password |
| **Mailgun** | smtp.mailgun.org | 587 | false | SMTP credentials from dashboard |
| **AWS SES** | email-smtp.us-east-1.amazonaws.com | 587 | false | IAM SMTP credentials |
| **Postmark** | smtp.postmarkapp.com | 587 | false | Server API token |
| **Office 365** | smtp.office365.com | 587 | false | Microsoft account |
| **Custom** | your-smtp-server.com | 587/465 | varies | Any SMTP server |

### Gmail Setup Example

**1. Enable 2-Factor Authentication**:
- Go to Google Account settings
- Security → 2-Step Verification → Enable

**2. Create App Password**:
- Google Account → Security → App passwords
- Select "Mail" and device
- Copy generated password

**3. Configure Environment**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourname@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop  # 16-character app password
SMTP_FROM="Veritable Games <yourname@gmail.com>"
```

### Verification

**Test SMTP connection**:
```typescript
import { emailClient } from '@/lib/email/client';

const isValid = await emailClient.verify();
console.log('SMTP connection:', isValid ? '✓ Success' : '✗ Failed');
```

---

## Email Service

### EmailService Class

**Location**: `frontend/src/lib/email/service.ts`

**Singleton Instance**:
```typescript
import { EmailService } from '@/lib/email/service';

const emailService = EmailService.getInstance();
```

### Core Methods

#### 1. sendEmail()

**Purpose**: General-purpose email sending

```typescript
interface SendEmailOptions {
  to: string;                      // Recipient email
  subject: string;                 // Email subject
  html: string;                    // HTML body
  text?: string;                   // Plain text version (optional)
  userId?: number;                 // User ID (for logging)
  emailType: string;               // Type: 'verification', 'security_alert', etc.
  metadata?: Record<string, any>;  // Additional data for logging
}

async sendEmail(options: SendEmailOptions): Promise<boolean>
```

**Example**:
```typescript
const success = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to Veritable Games',
  html: '<h1>Welcome!</h1><p>Thanks for joining.</p>',
  text: 'Welcome! Thanks for joining.',
  userId: 5,
  emailType: 'welcome',
  metadata: { registrationDate: new Date().toISOString() }
});
```

**Returns**: `true` if sent successfully, `false` if failed

**Automatic Features**:
- Plain text generation from HTML (if not provided)
- Email logging to database
- Error logging on failure
- SMTP FROM address from environment variable

#### 2. sendVerificationEmail()

**Purpose**: Send email verification link to new users

```typescript
async sendVerificationEmail(
  userId: number,
  email: string,
  username: string
): Promise<boolean>
```

**Process**:
1. Generate random 32-byte hex token
2. Store token in `users.email_verification_token`
3. Set expiration (24 hours from now)
4. Send email with verification link
5. Log email send attempt

**Verification Link**:
```
https://www.veritablegames.com/api/email/confirm?token=abc123def456...
```

**Example**:
```typescript
const sent = await emailService.sendVerificationEmail(
  newUser.id,
  newUser.email,
  newUser.username
);

if (!sent) {
  console.error('Failed to send verification email');
}
```

#### 3. sendAdminNotification()

**Purpose**: Notify admin of new user registrations

```typescript
async sendAdminNotification(newUser: {
  username: string;
  email: string;
  id: number;
}): Promise<boolean>
```

**Recipient**: `ADMIN_EMAIL` environment variable

**Email Content**:
- New user's username, email, ID
- Registration timestamp
- Link to admin panel (future)

**Example**:
```typescript
await emailService.sendAdminNotification({
  username: 'johndoe',
  email: 'john@example.com',
  id: 42
});
```

#### 4. sendSecurityAlert()

**Purpose**: Notify users of security events

```typescript
async sendSecurityAlert(
  userId: number,
  email: string,
  username: string,
  alertType: 'failed_login' | 'password_change' | 'suspicious_activity',
  details: Record<string, any>
): Promise<boolean>
```

**Alert Types**:
- `failed_login`: Multiple failed login attempts detected
- `password_change`: Password was changed
- `suspicious_activity`: Unusual account activity

**Example**:
```typescript
await emailService.sendSecurityAlert(
  userId,
  userEmail,
  username,
  'failed_login',
  {
    ipAddress: '192.168.1.100',
    attemptCount: 5,
    timestamp: new Date().toISOString()
  }
);
```

**Email Subject**:
- "Security Alert: Multiple Failed Login Attempts"
- "Security Alert: Password Changed"
- "Security Alert: Suspicious Activity Detected"

---

## Email Types

### Email Type Registry

| Type | Description | Triggered By | Recipient |
|------|-------------|--------------|-----------|
| **verification** | Email address confirmation | User signup | New user |
| **password_reset** | Password reset link | Forgot password | User |
| **security_alert** | Security notifications | Failed logins, password change | User |
| **admin_notification** | Admin alerts | New user registration | Admin |
| **welcome** | Welcome email | Email verification complete | User |
| **digest** | Activity summary (future) | Cron job (weekly) | User |
| **announcement** | Platform announcements (future) | Admin broadcast | All users |
| **transactional** | Order/purchase emails (future) | Checkout complete | User |

### Email Type Logging

All emails logged to database with type:

```sql
INSERT INTO email_logs (
  user_id, email_type, recipient_email, subject, status, sent_at
) VALUES (
  5, 'verification', 'user@example.com', 'Verify your account', 'sent', NOW()
)
```

---

## API Endpoints

### 2 Email Endpoints

#### 1. GET `/api/email/confirm`

**Purpose**: Verify user email address via token link

**Query Parameters**:
- `token` (required): 32-byte hex verification token

**Process**:
1. Find user by `email_verification_token`
2. Check token not expired (< 24 hours)
3. Mark email as verified
4. Clear token from database
5. Create user session (auto-login)
6. Redirect to dashboard

**Success Response** (302 Redirect):
```
Location: /dashboard?verified=true
```

**Error Responses**:
```json
{
  "error": "Invalid or expired verification token"
}
```

**Example URL**:
```
GET /api/email/confirm?token=abc123def456789...
```

#### 2. POST `/api/email/resend`

**Purpose**: Resend email verification to user

**Authentication**: Required (user must be logged in)

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Rate Limiting**:
- 3 resend requests per hour per user
- 429 status code if exceeded

**Example**:
```typescript
const response = await fetch('/api/email/resend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({ email: currentUser.email }),
});
```

---

## Email Templates

### Template Structure

All email templates use inline HTML with CSS for maximum email client compatibility.

#### Verification Email Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to Veritable Games, {{username}}!</h1>
    <p>Please verify your email address to activate your account.</p>
    <p><a href="{{verificationUrl}}" class="button">Verify Email</a></p>
    <p>Or copy this link: {{verificationUrl}}</p>
    <p>This link expires in 24 hours.</p>
  </div>
</body>
</html>
```

#### Security Alert Template

```html
<!DOCTYPE html>
<html>
<body>
  <div class="container">
    <h1>Security Alert</h1>
    <p>Hi {{username}},</p>
    <p>We detected {{alertType}} on your account:</p>
    <ul>
      <li>Time: {{timestamp}}</li>
      <li>IP Address: {{ipAddress}}</li>
      <li>Details: {{details}}</li>
    </ul>
    <p>If this was you, no action needed. Otherwise, <a href="{{securityUrl}}">secure your account</a>.</p>
  </div>
</body>
</html>
```

#### Admin Notification Template

```html
<!DOCTYPE html>
<html>
<body>
  <div class="container">
    <h1>New User Registration</h1>
    <p>A new user has registered:</p>
    <ul>
      <li>Username: {{username}}</li>
      <li>Email: {{email}}</li>
      <li>User ID: {{userId}}</li>
      <li>Registered: {{registeredAt}}</li>
    </ul>
    <p><a href="{{adminPanelUrl}}">View in Admin Panel</a></p>
  </div>
</body>
</html>
```

### Template Rendering

**Location**: `EmailService` class methods (inline HTML strings)

**Interpolation**: Simple string replacement

```typescript
private renderVerificationEmail(data: {
  username: string;
  verificationUrl: string;
}): string {
  return `
    <html>
      <body>
        <h1>Welcome, ${data.username}!</h1>
        <p>Click here to verify: <a href="${data.verificationUrl}">Verify Email</a></p>
      </body>
    </html>
  `;
}
```

**Future Enhancement**: Migrate to template engine (Handlebars, EJS, or React Email)

---

## Email Logging

### Database Schema

**Table**: `email_logs` (system schema)

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-increment ID |
| `user_id` | INTEGER | Recipient user ID (nullable) |
| `email_type` | VARCHAR(50) | Email type (verification, security_alert, etc.) |
| `recipient_email` | VARCHAR(255) | Recipient email address |
| `subject` | VARCHAR(500) | Email subject |
| `status` | VARCHAR(20) | 'sent' or 'failed' |
| `error_message` | TEXT | Error details (if failed) |
| `metadata` | TEXT/JSONB | Additional data (JSON) |
| `sent_at` | TIMESTAMP | Send timestamp |

**Indexes**:
- INDEX on `(user_id, sent_at DESC)` for user email history
- INDEX on `(email_type, sent_at DESC)` for type-based queries
- INDEX on `status` for failure analysis

### Log Entry Example

```json
{
  "id": 142,
  "user_id": 5,
  "email_type": "verification",
  "recipient_email": "john@example.com",
  "subject": "Verify your Veritable Games account",
  "status": "sent",
  "error_message": null,
  "metadata": {
    "token": "abc123def456",
    "expiresAt": "2025-11-13T10:00:00Z"
  },
  "sent_at": "2025-11-12T10:00:00Z"
}
```

### Query Email Logs

**Get user's email history**:
```sql
SELECT * FROM email_logs
WHERE user_id = 5
ORDER BY sent_at DESC
LIMIT 20;
```

**Check failed emails**:
```sql
SELECT * FROM email_logs
WHERE status = 'failed'
  AND sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

---

## Usage Examples

### Send Verification Email on Signup

```typescript
import { EmailService } from '@/lib/email/service';

const emailService = EmailService.getInstance();

// After user registration
const newUser = await createUser({
  username: 'johndoe',
  email: 'john@example.com',
  password: hashedPassword,
});

// Send verification email
const sent = await emailService.sendVerificationEmail(
  newUser.id,
  newUser.email,
  newUser.username
);

if (!sent) {
  // Email send failed, but user created
  console.error('Failed to send verification email');
  // Consider showing UI notification: "Verification email failed. Check your email settings."
}
```

### Send Security Alert on Failed Login

```typescript
// After detecting 5 failed login attempts
if (failedAttempts >= 5) {
  await emailService.sendSecurityAlert(
    userId,
    userEmail,
    username,
    'failed_login',
    {
      ipAddress: request.ip,
      attemptCount: failedAttempts,
      lastAttempt: new Date().toISOString(),
      location: 'San Francisco, CA',
    }
  );
}
```

### Notify Admin of New User

```typescript
// After successful registration
await emailService.sendAdminNotification({
  username: newUser.username,
  email: newUser.email,
  id: newUser.id,
});
```

### Custom Email

```typescript
const success = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Your Order Confirmation',
  html: `
    <h1>Order Confirmed</h1>
    <p>Order #${orderId} has been confirmed.</p>
    <p>Total: $${total}</p>
  `,
  userId: userId,
  emailType: 'transactional',
  metadata: { orderId, total },
});
```

---

## Testing

### Manual Testing

**Send Test Email**:
```typescript
import { EmailService } from '@/lib/email/service';

const emailService = EmailService.getInstance();

const success = await emailService.sendEmail({
  to: 'your-test-email@example.com',
  subject: 'Test Email',
  html: '<h1>Test</h1><p>If you receive this, SMTP is working!</p>',
  emailType: 'test',
});

console.log('Test email sent:', success);
```

### SMTP Connection Test

```typescript
import { emailClient } from '@/lib/email/client';

const isConnected = await emailClient.verify();

if (isConnected) {
  console.log('✓ SMTP connection successful');
} else {
  console.error('✗ SMTP connection failed');
  console.error('Check your SMTP_HOST, SMTP_USER, and SMTP_PASSWORD');
}
```

### Development Testing

**Use MailHog** (local SMTP testing):

```bash
# Install MailHog
brew install mailhog  # macOS
# or docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Configure .env.local
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=test
SMTP_PASSWORD=test
```

**View emails**: http://localhost:8025

**Benefits**:
- No real emails sent
- View all outgoing emails in web UI
- Test email templates without spam risk

---

## Troubleshooting

### Common Issues

**Q: "SMTP configuration incomplete" error**
A: Ensure all required environment variables are set: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`

**Q: Gmail "Authentication failed" error**
A: Use an app password, not your regular Gmail password. Enable 2FA first.

**Q: Emails not arriving**
A: Check spam/junk folder. Verify `SMTP_FROM` email is authorized by your SMTP provider.

**Q: "Connection timeout" error**
A: Check firewall settings. Port 587 must be open. Try port 465 with `SMTP_SECURE=true`.

**Q: Verification link expired**
A: Tokens expire after 24 hours. Use "Resend verification" feature.

**Q: Rate limit exceeded on resend**
A: Limited to 3 resends per hour. Wait or have admin manually verify.

### Debugging

**Enable Nodemailer Debug Logs**:
```typescript
// In lib/email/client.ts
this.transporter = nodemailer.createTransport({
  // ... existing config
  debug: true,  // Enable debug output
  logger: true, // Log to console
});
```

**Check Email Logs**:
```sql
SELECT * FROM email_logs
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 10;
```

---

## Future Enhancements

### Planned Features

1. **Email Queue System**
   - Background job processing (Bull/BullMQ)
   - Retry failed emails automatically
   - Rate limiting for mass emails
   - Priority queue (urgent vs. normal)

2. **Template Engine**
   - React Email for type-safe templates
   - Template versioning
   - A/B testing support
   - Multi-language templates

3. **Email Analytics**
   - Open rate tracking (pixel tracking)
   - Click tracking (link wrapping)
   - Bounce rate monitoring
   - Unsubscribe management

4. **Transactional Email Service**
   - SendGrid/Mailgun/Postmark integration
   - Better deliverability
   - Dedicated IP address
   - SPF/DKIM/DMARC setup

5. **User Preferences**
   - Email notification settings
   - Digest frequency (daily/weekly/never)
   - Per-type opt-in/out
   - Unsubscribe links

6. **Digest Emails**
   - Weekly activity summary
   - Monthly newsletter
   - Personalized recommendations
   - Scheduled send times

---

## Related Documentation

- **[docs/api/README.md](../api/README.md)** - API reference
- **[docs/features/NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md)** - In-app notifications
- **[docs/features/SETTINGS_USER_MANAGEMENT.md](./SETTINGS_USER_MANAGEMENT.md)** - User settings
- **[CLAUDE.md](../../CLAUDE.md)** - Development guide

---

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready with SMTP integration, verification system, security alerts, and comprehensive logging
