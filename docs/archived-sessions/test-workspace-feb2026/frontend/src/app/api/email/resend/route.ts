import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { emailService } from '@/lib/email/service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function postHandler(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const result = await dbAdapter.query(
      'SELECT id, username, email, email_verified FROM users.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0 || result.rows[0].email_verified) {
      return NextResponse.json({
        success: true,
        message: 'If email exists and unverified, verification link sent',
      });
    }

    const user = result.rows[0];
    await emailService.sendVerificationEmail(user.id, user.email, user.username);

    return NextResponse.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    logger.error('Resend verification error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { enableCSRF: true });
