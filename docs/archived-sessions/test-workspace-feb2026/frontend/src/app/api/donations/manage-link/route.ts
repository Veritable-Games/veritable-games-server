/**
 * Manage Link API Route
 * POST: Send magic link email for subscription management
 *
 * Allows donors (including guests) to request a magic link to manage their subscriptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, rateLimiters } from '@/lib/security/middleware';
import { subscriptionService } from '@/lib/donations/subscription-service';
import { emailService } from '@/lib/email/service';
import { errorResponse, ValidationError, NotFoundError } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST /api/donations/manage-link
 * Send magic link email to manage subscriptions
 */
async function POSTHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return errorResponse(new ValidationError('Email is required'));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(new ValidationError('Invalid email format'));
    }

    // Get subscriptions for this email
    const subscriptions = await subscriptionService.getSubscriptionsByEmail(email);

    // Filter to only active/manageable subscriptions
    const activeSubscriptions = subscriptions.filter(
      s => s.status === 'active' || s.status === 'past_due' || s.status === 'paused'
    );

    if (activeSubscriptions.length === 0) {
      // Don't reveal if email exists for security
      // Just return success (email will explain if no subscriptions found)
      return NextResponse.json({
        success: true,
        message:
          'If you have active subscriptions, you will receive an email with a management link.',
      });
    }

    // Generate portal access token for the first active subscription
    // In the future, could handle multiple subscriptions differently
    const firstSubscription = activeSubscriptions[0];
    if (!firstSubscription) {
      return NextResponse.json({
        success: true,
        message:
          'If you have active subscriptions, you will receive an email with a management link.',
      });
    }

    const tokenResult = await subscriptionService.generatePortalAccessToken(firstSubscription.id);

    // Build the magic link URL
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000';
    const managementUrl = `${baseUrl}/donate/manage?token=${tokenResult.token}`;

    // Send the magic link email
    await emailService.sendEmail({
      to: email,
      subject: 'Manage Your Veritable Games Subscription',
      html: renderMagicLinkEmail({
        donorName: firstSubscription.donor_name || 'Supporter',
        managementUrl,
        expiresIn: '24 hours',
        subscriptionAmount: firstSubscription.amount,
        subscriptionInterval: firstSubscription.interval,
        projectName: firstSubscription.project?.name || 'General Fund',
      }),
      emailType: 'subscription_management',
      metadata: {
        subscriptionId: firstSubscription.id,
        action: 'magic_link_sent',
      },
    });

    return NextResponse.json({
      success: true,
      message:
        'If you have active subscriptions, you will receive an email with a management link.',
    });
  } catch (error: any) {
    logger.error('Error sending manage link:', error);
    return errorResponse(error);
  }
}

/**
 * Render the magic link email HTML
 */
function renderMagicLinkEmail(data: {
  donorName: string;
  managementUrl: string;
  expiresIn: string;
  subscriptionAmount: number;
  subscriptionInterval: string;
  projectName: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manage Your Subscription</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; }
    .subscription-info { background: #f8f9fa; padding: 16px; border-radius: 6px; margin: 16px 0; }
    .subscription-info p { margin: 4px 0; color: #555; }
    .amount { font-size: 20px; font-weight: bold; color: #3b82f6; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #2563eb; }
    .warning { font-size: 14px; color: #666; margin-top: 20px; padding: 12px; background: #fff3cd; border-radius: 4px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Veritable Games</h1>
    </div>
    <div class="content">
      <p>Hello ${data.donorName},</p>
      <p>You requested a link to manage your subscription. Click the button below to access your subscription dashboard.</p>

      <div class="subscription-info">
        <p><strong>Your Subscription:</strong></p>
        <p class="amount">$${data.subscriptionAmount.toFixed(2)}/${data.subscriptionInterval === 'month' ? 'month' : 'year'}</p>
        <p>Supporting: ${data.projectName}</p>
      </div>

      <center>
        <a href="${data.managementUrl}" class="button">Manage Subscription</a>
      </center>

      <div class="warning">
        <strong>Security Notice:</strong> This link expires in ${data.expiresIn} and can only be used once.
        If you didn't request this email, you can safely ignore it.
      </div>
    </div>
    <div class="footer">
      <p>Veritable Games LLC</p>
      <p>Questions? Contact us at support@veritablegames.com</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Apply security middleware with rate limiting
export const POST = withSecurity(POSTHandler, {
  enableCSRF: true,
  rateLimiter: rateLimiters.auth, // Strict rate limit to prevent abuse (10 per 15 min)
  rateLimiterType: 'auth',
});
