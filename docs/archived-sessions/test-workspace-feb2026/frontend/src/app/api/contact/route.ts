import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { getClientIP } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

function validateContactForm(data: any): ContactFormData {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!data.email || typeof data.email !== 'string' || data.email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.subject || typeof data.subject !== 'string' || data.subject.trim().length === 0) {
    errors.push('Subject is required');
  }

  if (!data.message || typeof data.message !== 'string' || data.message.trim().length < 10) {
    errors.push('Message must be at least 10 characters long');
  }

  if (errors.length > 0) {
    throw new Error('Validation failed: ' + errors.join(', '));
  }

  return {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    subject: data.subject.trim(),
    message: data.message.trim(),
  };
}

async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const formData = validateContactForm(body);

    // Get client info for logging
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Store contact message in database
    const result = await dbAdapter.query(
      `
      INSERT INTO contact_messages (name, email, subject, message, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [formData.name, formData.email, formData.subject, formData.message, clientIP, userAgent],
      { schema: 'system' }
    );

    const messageId = result.rows[0].id;

    // Log contact form submission for monitoring
    logger.info('Contact form submitted', {
      messageId,
      email: formData.email,
      subject: formData.subject,
      clientIP,
    });

    return NextResponse.json({
      success: true,
      message: "Your message has been sent successfully. We'll get back to you soon!",
      messageId,
    });
  } catch (error) {
    logger.error('Contact form submission failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
      },
      { status: 400 }
    );
  }
}

// Export with security middleware (CSRF protection, rate limiting)
export { POST };
export default withSecurity(POST, {});
