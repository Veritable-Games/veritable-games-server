import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '@/lib/utils/logger';

/**
 * EmailClient - Singleton for managing SMTP connection
 * Ensures only one nodemailer transporter is created per application
 */
class EmailClient {
  private static instance: EmailClient;
  private transporter: Transporter | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EmailClient {
    if (!EmailClient.instance) {
      EmailClient.instance = new EmailClient();
    }
    return EmailClient.instance;
  }

  /**
   * Get or create SMTP transporter
   */
  getTransporter(): Transporter {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587');
      const secure = process.env.SMTP_SECURE === 'true';
      const user = process.env.SMTP_USER;
      const password = process.env.SMTP_PASSWORD;

      if (!host || !user || !password) {
        throw new Error(
          'SMTP configuration incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env.local'
        );
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure, // true for 465, false for 587 (STARTTLS)
        auth: {
          user,
          pass: password,
        },
        tls: {
          // Allow self-signed certs in development
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });
    }

    return this.transporter;
  }

  /**
   * Verify SMTP connection
   * Returns true if connection is successful, false otherwise
   */
  async verify(): Promise<boolean> {
    try {
      await this.getTransporter().verify();
      logger.info('✓ SMTP connection verified');
      return true;
    } catch (error) {
      logger.error('✗ SMTP verification failed:', error);
      return false;
    }
  }

  /**
   * Close transporter connection (for graceful shutdown)
   */
  close(): void {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}

// Export singleton instance
export const emailClient = EmailClient.getInstance();
