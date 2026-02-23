import { emailClient } from './client';
import { dbAdapter } from '@/lib/database/adapter';
import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  userId?: number;
  emailType: string;
  metadata?: Record<string, any>;
}

export class EmailService {
  private static instance: EmailService;
  private constructor() {}

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, html, text, userId, emailType, metadata } = options;
    try {
      const transporter = emailClient.getTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@veritablegames.com',
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
      });
      await this.logEmail({
        userId,
        emailType,
        recipientEmail: to,
        subject,
        status: 'sent',
        metadata,
      });
      return true;
    } catch (error: any) {
      logger.error('Email send failed:', error);
      await this.logEmail({
        userId,
        emailType,
        recipientEmail: to,
        subject,
        status: 'failed',
        errorMessage: error.message,
        metadata,
      });
      return false;
    }
  }

  async sendVerificationEmail(userId: number, email: string, username: string): Promise<boolean> {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await dbAdapter.query(
        `UPDATE users.users SET email_verification_token = $1, email_verification_expires_at = $2 WHERE id = $3`,
        [token, expiresAt.toISOString(), userId]
      );

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const verificationUrl = `${siteUrl}/api/email/confirm?token=${token}`;
      const html = this.renderVerificationEmail({ username, verificationUrl });

      return this.sendEmail({
        to: email,
        subject: 'Verify your Veritable Games account',
        html,
        userId,
        emailType: 'verification',
        metadata: { token, expiresAt },
      });
    } catch (error) {
      logger.error('Error sending verification email:', error);
      return false;
    }
  }

  async sendAdminNotification(newUser: {
    username: string;
    email: string;
    id: number;
  }): Promise<boolean> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@veritablegames.com';
      const html = this.renderAdminNotificationEmail({
        username: newUser.username,
        email: newUser.email,
        userId: newUser.id,
        registeredAt: new Date().toISOString(),
      });
      return this.sendEmail({
        to: adminEmail,
        subject: `New user registration: ${newUser.username}`,
        html,
        emailType: 'admin_notification',
        metadata: { newUserId: newUser.id },
      });
    } catch (error) {
      logger.error('Error sending admin notification:', error);
      return false;
    }
  }

  /**
   * Send password reset email
   * Token expires in 1 hour for security
   */
  async sendPasswordResetEmail(userId: number, email: string, username: string): Promise<boolean> {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

      await dbAdapter.query(
        `UPDATE users.users SET password_reset_token = $1, password_reset_expires_at = $2 WHERE id = $3`,
        [token, expiresAt.toISOString(), userId]
      );

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const resetUrl = `${siteUrl}/auth/reset-password?token=${token}`;
      const html = this.renderPasswordResetEmail({ username, resetUrl });

      return this.sendEmail({
        to: email,
        subject: 'Reset your Veritable Games password',
        html,
        userId,
        emailType: 'password_reset',
        metadata: { token, expiresAt: expiresAt.toISOString() },
      });
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      return false;
    }
  }

  async sendSecurityAlert(
    userId: number,
    email: string,
    username: string,
    alertType: 'failed_login' | 'password_change' | 'suspicious_activity',
    details: Record<string, any>
  ): Promise<boolean> {
    try {
      const html = this.renderSecurityAlertEmail({
        username,
        alertType,
        details,
        timestamp: new Date().toISOString(),
      });
      return this.sendEmail({
        to: email,
        subject: `Security Alert: ${this.formatAlertType(alertType)}`,
        html,
        userId,
        emailType: 'security_alert',
        metadata: { alertType, ...details },
      });
    } catch (error) {
      logger.error('Error sending security alert:', error);
      return false;
    }
  }

  private async logEmail(data: {
    userId?: number;
    emailType: string;
    recipientEmail: string;
    subject: string;
    status: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await dbAdapter.query(
        `INSERT INTO system.email_logs (user_id, email_type, recipient_email, subject, status, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          data.userId || null,
          data.emailType,
          data.recipientEmail,
          data.subject,
          data.status,
          data.errorMessage || null,
          JSON.stringify(data.metadata || {}),
        ]
      );
    } catch (error) {
      logger.error('Failed to log email:', error);
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatAlertType(alertType: string): string {
    return alertType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Send a donation receipt email
   */
  async sendDonationReceipt(data: {
    donorEmail: string;
    donorName?: string;
    amount: number;
    currency: string;
    projectNames: string[];
    donationType: 'one_time' | 'recurring';
    donationId: number;
    paymentDate: Date;
  }): Promise<boolean> {
    try {
      const html = this.renderDonationReceiptEmail(data);
      const subject =
        data.donationType === 'recurring'
          ? `Recurring Donation Receipt - Veritable Games`
          : `Donation Receipt - Veritable Games`;

      return this.sendEmail({
        to: data.donorEmail,
        subject,
        html,
        emailType: 'donation_receipt',
        metadata: {
          donationId: data.donationId,
          amount: data.amount,
          currency: data.currency,
          projectNames: data.projectNames,
          donationType: data.donationType,
        },
      });
    } catch (error) {
      logger.error('Error sending donation receipt:', error);
      return false;
    }
  }

  private renderVerificationEmail(data: { username: string; verificationUrl: string }): string {
    const { username, verificationUrl } = data;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verify Email</title><style>body{font-family:Arial;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5}.container{background:white;padding:40px;border-radius:8px}.button{display:inline-block;padding:12px 24px;background:#007bff;color:white;text-decoration:none;border-radius:4px}</style></head><body><div class="container"><h1>Veritable Games</h1><h2>Welcome, ${username}!</h2><p>Please verify your email:</p><p><a href="${verificationUrl}" class="button">Verify Email</a></p><p>Link expires in 24 hours.</p></div></body></html>`;
  }

  private renderAdminNotificationEmail(data: {
    username: string;
    email: string;
    userId: number;
    registeredAt: string;
  }): string {
    const { username, email, userId } = data;
    return `<!DOCTYPE html><html><body><h2>New User: ${username}</h2><p>Email: ${email}</p><p>ID: ${userId}</p></body></html>`;
  }

  private renderSecurityAlertEmail(data: {
    username: string;
    alertType: string;
    details: Record<string, any>;
    timestamp: string;
  }): string {
    const { username, alertType } = data;
    return `<!DOCTYPE html><html><body><h2>Security Alert</h2><p>Hello ${username}, ${alertType} detected.</p></body></html>`;
  }

  private renderPasswordResetEmail(data: { username: string; resetUrl: string }): string {
    const { username, resetUrl } = data;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .button { display: inline-block; padding: 14px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .button:hover { background: #2563eb; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .link-fallback { font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 4px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin-top: 24px; font-size: 14px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Veritable Games</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Password Reset Request</h2>
      <p>Hello ${username},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <div class="link-fallback">
        If the button doesn't work, copy this link into your browser:<br>
        ${resetUrl}
      </div>
      <div class="warning">
        <strong>Important:</strong> This link expires in 1 hour for security reasons. If you didn't request a password reset, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">
      <p>Veritable Games</p>
      <p>If you didn't request this password reset, please ignore this email or contact support if you're concerned.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Send invitation email to prospective user
   */
  async sendInvitationEmail(data: {
    recipientEmail: string;
    recipientName?: string;
    token: string;
    expiresAt: Date;
    createdByUsername: string;
    notes?: string;
    maxUses: number;
  }): Promise<boolean> {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const registrationUrl = `${siteUrl}/auth/login?token=${data.token}`;

      const html = this.renderInvitationEmail({
        recipientName: data.recipientName,
        registrationUrl,
        expiresAt: data.expiresAt,
        createdByUsername: data.createdByUsername,
        notes: data.notes,
      });

      return this.sendEmail({
        to: data.recipientEmail,
        subject: "You've been invited to join Veritable Games",
        html,
        emailType: 'invitation',
        metadata: {
          token: data.token,
          expiresAt: data.expiresAt.toISOString(),
          maxUses: data.maxUses,
        },
      });
    } catch (error) {
      logger.error('Error sending invitation email:', error);
      return false;
    }
  }

  private renderInvitationEmail(data: {
    recipientName?: string;
    registrationUrl: string;
    expiresAt: Date;
    createdByUsername: string;
    notes?: string;
  }): string {
    const greeting = data.recipientName ? `Hello ${data.recipientName},` : 'Hello,';
    const expiresFormatted = data.expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .button { display: inline-block; padding: 14px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .button:hover { background: #2563eb; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .notes { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0; font-style: italic; color: #4b5563; border-left: 4px solid #3b82f6; }
    .link-fallback { font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 4px; }
    .expires { font-size: 14px; color: #6b7280; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Veritable Games</h1>
    </div>
    <div class="content">
      <p>${greeting}</p>
      <p>You've been invited to join <strong>Veritable Games</strong> by ${data.createdByUsername}.</p>
      ${data.notes ? `<div class="notes">"${data.notes}"</div>` : ''}
      <p>We're currently in closed testing, and you've been selected to join our community. Click the button below to create your account:</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${data.registrationUrl}" class="button">Create Your Account</a>
      </p>
      <div class="link-fallback">
        If the button doesn't work, copy this link into your browser:<br>
        ${data.registrationUrl}
      </div>
      <p class="expires">This invitation expires on ${expiresFormatted}.</p>
    </div>
    <div class="footer">
      <p>Veritable Games - Developer Testing Phase</p>
      <p>If you didn't request this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private renderDonationReceiptEmail(data: {
    donorEmail: string;
    donorName?: string;
    amount: number;
    currency: string;
    projectNames: string[];
    donationType: 'one_time' | 'recurring';
    donationId: number;
    paymentDate: Date;
  }): string {
    const displayName = data.donorName || 'Generous Supporter';
    const formattedDate = data.paymentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedAmount = `$${data.amount.toFixed(2)} ${data.currency}`;
    const projectList =
      data.projectNames.length > 0 ? data.projectNames.join(', ') : 'General Fund';
    const isRecurring = data.donationType === 'recurring';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Donation Receipt</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .thank-you { font-size: 28px; font-weight: bold; color: #10b981; margin-bottom: 16px; }
    .receipt-box { background: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb; }
    .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-label { color: #6b7280; }
    .receipt-value { color: #111827; font-weight: 600; }
    .amount { font-size: 24px; color: #3b82f6; }
    .recurring-badge { display: inline-block; background: #dbeafe; color: #2563eb; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .footer a { color: #3b82f6; text-decoration: none; }
    .tax-note { background: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin-top: 24px; font-size: 14px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Veritable Games</h1>
    </div>
    <div class="content">
      <p class="thank-you">Thank you for your donation!</p>
      <p>Hello ${displayName},</p>
      <p>Your ${isRecurring ? 'recurring ' : ''}donation has been received and processed successfully. Here are your receipt details:</p>

      <div class="receipt-box">
        <div class="receipt-row">
          <span class="receipt-label">Receipt #</span>
          <span class="receipt-value">VG-${data.donationId.toString().padStart(6, '0')}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Date</span>
          <span class="receipt-value">${formattedDate}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Amount</span>
          <span class="receipt-value amount">${formattedAmount}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Supporting</span>
          <span class="receipt-value">${projectList}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-label">Type</span>
          <span class="receipt-value">${isRecurring ? '<span class="recurring-badge">Recurring</span>' : 'One-time'}</span>
        </div>
      </div>

      ${
        isRecurring
          ? `<p>As a recurring donor, you'll receive a receipt each time your donation is processed. You can manage your subscription anytime from your <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://veritablegames.com'}/donate/dashboard" style="color: #3b82f6;">donor dashboard</a>.</p>`
          : `<p>Your contribution helps us continue creating innovative games and building an engaged community.</p>`
      }

      <div class="tax-note">
        <strong>Tax Information:</strong> Veritable Games LLC is not a 501(c)(3) nonprofit organization. This donation may not be tax-deductible. Please consult with a tax professional for specific guidance.
      </div>
    </div>
    <div class="footer">
      <p>Veritable Games LLC</p>
      <p>Questions? Contact us at <a href="mailto:support@veritablegames.com">support@veritablegames.com</a></p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://veritablegames.com'}/donate/transparency">View Donation Transparency</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export const emailService = EmailService.getInstance();
