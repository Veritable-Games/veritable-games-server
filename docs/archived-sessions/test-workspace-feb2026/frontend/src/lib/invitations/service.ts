/**
 * Invitation Service
 *
 * Manages invitation tokens for controlled user registration.
 * Only admins can create invitations.
 */

import { dbAdapter } from '@/lib/database/adapter';
import crypto from 'crypto';

export interface Invitation {
  id: number;
  token: string;
  created_by: number;
  email: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: number | null;
  is_revoked: number;
  revoked_at: string | null;
  revoked_by: number | null;
  notes: string | null;
  max_uses: number;
  use_count: number;
}

export interface CreateInvitationInput {
  email?: string; // Optional: restrict invitation to specific email
  expiresInDays?: number; // Default: 7 days
  notes?: string; // Admin notes
  maxUses?: number; // Default: 1
}

export interface InvitationValidation {
  valid: boolean;
  invitation?: Invitation;
  error?: string;
}

export class InvitationService {
  /**
   * Generate a secure invitation token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new invitation (admin only)
   */
  async createInvitation(input: CreateInvitationInput, adminUserId: number): Promise<Invitation> {
    const token = this.generateToken();
    const expiresInDays = input.expiresInDays !== undefined ? input.expiresInDays : 7;
    const maxUses = input.maxUses !== undefined ? input.maxUses : 0; // Default to unlimited

    // Calculate expiration date (far future for never expires)
    let expiresAt: string;
    if (expiresInDays === 0) {
      // Never expires - set to far future (100 years)
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 100);
      expiresAt = farFuture.toISOString();
    } else {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expiresInDays);
      expiresAt = expiry.toISOString();
    }

    // Handle unlimited uses (0 = 999999)
    const finalMaxUses = maxUses === 0 ? 999999 : maxUses;

    const result = await dbAdapter.query(
      `INSERT INTO invitations (
          token, created_by, email, expires_at, notes, max_uses
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
      [
        token,
        adminUserId,
        input.email || null,
        expiresAt,
        input.notes || null,
        finalMaxUses, // Use 999999 for unlimited
      ],
      { schema: 'auth' }
    );

    // Fetch and return the created invitation
    const invitationResult = await dbAdapter.query(
      'SELECT * FROM invitations WHERE id = $1',
      [result.rows[0].id],
      { schema: 'auth' }
    );

    return invitationResult.rows[0] as Invitation;
  }

  /**
   * Validate an invitation token
   */
  async validateToken(token: string, email?: string): Promise<InvitationValidation> {
    const result = await dbAdapter.query('SELECT * FROM invitations WHERE token = $1', [token], {
      schema: 'auth',
    });

    const invitation = result.rows[0] as Invitation | undefined;

    if (!invitation) {
      return { valid: false, error: 'Invalid invitation token' };
    }

    // Check if revoked
    if (invitation.is_revoked) {
      return { valid: false, error: 'This invitation has been revoked' };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (now > expiresAt) {
      return { valid: false, error: 'This invitation has expired' };
    }

    // Check if already used (and max uses reached)
    if (invitation.use_count >= invitation.max_uses) {
      return { valid: false, error: 'This invitation has already been used' };
    }

    // Check email restriction (if specified)
    if (invitation.email && email && invitation.email.toLowerCase() !== email.toLowerCase()) {
      return { valid: false, error: 'This invitation is for a different email address' };
    }

    return { valid: true, invitation };
  }

  /**
   * Mark invitation as used
   */
  async markAsUsed(token: string, userId: number): Promise<void> {
    await dbAdapter.query(
      `UPDATE invitations
       SET used_at = NOW(),
           used_by = $1,
           use_count = use_count + 1
       WHERE token = $2`,
      [userId, token],
      { schema: 'auth' }
    );
  }

  /**
   * Get all invitations (admin only)
   */
  async getAllInvitations(options?: {
    includeUsed?: boolean;
    includeRevoked?: boolean;
  }): Promise<Invitation[]> {
    const { includeUsed = true, includeRevoked = true } = options || {};

    let query = 'SELECT * FROM invitations WHERE 1=1';
    const params: any[] = [];

    if (!includeUsed) {
      query += ' AND used_at IS NULL';
    }

    if (!includeRevoked) {
      query += ' AND is_revoked = 0';
    }

    query += ' ORDER BY created_at DESC';

    const result = await dbAdapter.query(query, params, { schema: 'auth' });
    return result.rows as Invitation[];
  }

  /**
   * Get invitations created by a specific user
   */
  async getInvitationsByCreator(userId: number): Promise<Invitation[]> {
    const result = await dbAdapter.query(
      'SELECT * FROM invitations WHERE created_by = $1 ORDER BY created_at DESC',
      [userId],
      { schema: 'auth' }
    );

    return result.rows as Invitation[];
  }

  /**
   * Revoke an invitation (admin only)
   */
  async revokeInvitation(invitationId: number, adminUserId: number): Promise<boolean> {
    const result = await dbAdapter.query(
      `UPDATE invitations
         SET is_revoked = 1,
             revoked_at = NOW(),
             revoked_by = $1
         WHERE id = $2`,
      [adminUserId, invitationId],
      { schema: 'auth' }
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Delete an invitation (admin only)
   */
  async deleteInvitation(invitationId: number): Promise<boolean> {
    const result = await dbAdapter.query('DELETE FROM invitations WHERE id = $1', [invitationId], {
      schema: 'auth',
    });

    return (result.rowCount || 0) > 0;
  }

  /**
   * Get invitation by ID
   */
  async getInvitationById(invitationId: number): Promise<Invitation | undefined> {
    const result = await dbAdapter.query(
      'SELECT * FROM invitations WHERE id = $1',
      [invitationId],
      { schema: 'auth' }
    );

    return result.rows[0] as Invitation | undefined;
  }

  /**
   * Clean up expired invitations (maintenance task)
   */
  async cleanupExpiredInvitations(): Promise<number> {
    const result = await dbAdapter.query(
      `DELETE FROM invitations
         WHERE expires_at < NOW()
         AND used_at IS NULL
         AND is_revoked = 0`,
      [],
      { schema: 'auth' }
    );

    return result.rowCount || 0;
  }
}

// Export singleton instance
export const invitationService = new InvitationService();
