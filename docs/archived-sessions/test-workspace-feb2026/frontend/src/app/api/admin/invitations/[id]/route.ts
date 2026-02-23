/**
 * Admin Invitations API - Individual Invitation Management
 *
 * GET /api/admin/invitations/[id] - Get invitation details
 * DELETE /api/admin/invitations/[id] - Revoke invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { invitationService } from '@/lib/invitations/service';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  PermissionError,
  NotFoundError,
} from '@/lib/utils/api-errors';

/**
 * GET /api/admin/invitations/[id]
 * Get invitation details (admin only)
 */
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);

      if (!user) {
        throw new AuthenticationError();
      }

      if (user.role !== 'admin') {
        throw new PermissionError('Admin access required');
      }

      const { id } = await context.params;
      const invitationId = parseInt(id, 10);

      if (isNaN(invitationId)) {
        throw new ValidationError('Invalid invitation ID');
      }

      const invitation = invitationService.getInvitationById(invitationId);

      if (!invitation) {
        throw new NotFoundError('Invitation', invitationId);
      }

      return NextResponse.json({
        success: true,
        data: invitation,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);

/**
 * DELETE /api/admin/invitations/[id]
 * Revoke invitation (admin only)
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);

      if (!user) {
        throw new AuthenticationError();
      }

      if (user.role !== 'admin') {
        throw new PermissionError('Admin access required');
      }

      const { id } = await context.params;
      const invitationId = parseInt(id, 10);

      if (isNaN(invitationId)) {
        throw new ValidationError('Invalid invitation ID');
      }

      // Check if invitation exists
      const invitation = invitationService.getInvitationById(invitationId);

      if (!invitation) {
        throw new NotFoundError('Invitation', invitationId);
      }

      // Revoke the invitation (soft delete - keeps audit trail)
      const revoked = invitationService.revokeInvitation(invitationId, user.id);

      if (!revoked) {
        throw new Error('Failed to revoke invitation');
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation revoked successfully',
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);
