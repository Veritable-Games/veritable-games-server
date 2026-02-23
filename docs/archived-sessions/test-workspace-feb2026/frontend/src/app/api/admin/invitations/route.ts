/**
 * Admin Invitations API
 *
 * POST /api/admin/invitations - Create new invitation
 * GET /api/admin/invitations - List all invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { invitationService } from '@/lib/invitations/service';
import { emailService } from '@/lib/email/service';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  PermissionError,
} from '@/lib/utils/api-errors';

/**
 * GET /api/admin/invitations
 * List all invitations (admin only)
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const includeUsed = searchParams.get('include_used') !== 'false';
    const includeRevoked = searchParams.get('include_revoked') !== 'false';

    const invitations = await invitationService.getAllInvitations({
      includeUsed,
      includeRevoked,
    });

    return NextResponse.json({
      success: true,
      data: invitations,
      count: invitations.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * POST /api/admin/invitations
 * Create new invitation (admin only)
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const body = await request.json();
    const { email, expires_in_days, notes, max_uses } = body;

    // Validate input
    if (email && typeof email !== 'string') {
      throw new ValidationError('Email must be a string');
    }

    if (
      expires_in_days !== undefined &&
      (typeof expires_in_days !== 'number' || expires_in_days < 0)
    ) {
      throw new ValidationError('expires_in_days must be a non-negative number');
    }

    if (max_uses !== undefined && (typeof max_uses !== 'number' || max_uses < 0)) {
      throw new ValidationError('max_uses must be a non-negative number');
    }

    // Create invitation
    const invitation = await invitationService.createInvitation(
      {
        email: email?.trim() || undefined,
        expiresInDays: expires_in_days || 7,
        notes: notes?.trim() || undefined,
        maxUses: max_uses || 1,
      },
      user.id
    );

    // Send invitation email if email was provided
    let emailSent = false;
    if (email?.trim() && invitation.token) {
      try {
        // Get creator's username for the email
        const creatorResult = await dbAdapter.query(
          'SELECT username FROM users.users WHERE id = $1',
          [user.id]
        );
        const creatorUsername = creatorResult.rows[0]?.username || 'Admin';

        emailSent = await emailService.sendInvitationEmail({
          recipientEmail: email.trim(),
          token: invitation.token,
          expiresAt: new Date(invitation.expires_at),
          createdByUsername: creatorUsername,
          notes: notes?.trim(),
          maxUses: invitation.max_uses,
        });
      } catch (emailError) {
        // Log but don't fail invitation creation if email fails
        logger.error('Failed to send invitation email:', emailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...invitation,
          email_sent: emailSent,
        },
        message: emailSent
          ? 'Invitation created and email sent successfully'
          : 'Invitation created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
});
