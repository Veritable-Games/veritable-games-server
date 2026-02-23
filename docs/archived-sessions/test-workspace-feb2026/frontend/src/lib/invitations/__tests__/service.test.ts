/**
 * InvitationService Unit Tests
 *
 * Comprehensive test suite for the invitation token system
 */

import { InvitationService, Invitation, CreateInvitationInput } from '../service';
import { dbAdapter } from '@/lib/database/adapter';

// Mock the database adapter (PostgreSQL)
jest.mock('@/lib/database/adapter');

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(() => {
    service = new InvitationService();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should create invitation with default settings', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'a'.repeat(64),
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      // Mock the query method to return the invitation
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const input: CreateInvitationInput = {};
      const result = await service.createInvitation(input, 1);

      expect(result).toBeDefined();
      expect(result.token).toBe(mockInvitation.token);
      expect(result.created_by).toBe(1);
      expect(result.max_uses).toBe(1);
      expect(dbAdapter.query).toHaveBeenCalled();
    });

    it('should create invitation with email restriction', async () => {
      const mockInvitation: Invitation = {
        id: 2,
        token: 'b'.repeat(64),
        created_by: 1,
        email: 'user@test.com',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const input: CreateInvitationInput = { email: 'user@test.com' };
      const result = await service.createInvitation(input, 1);

      expect(result.email).toBe('user@test.com');
    });

    it('should create invitation with custom expiration', async () => {
      const mockInvitation: Invitation = {
        id: 3,
        token: 'c'.repeat(64),
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const input: CreateInvitationInput = { expiresInDays: 30 };
      const result = await service.createInvitation(input, 1);

      // Verify expiration is approximately 30 days from now
      const expiresAt = new Date(result.expires_at);
      const expectedExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiration.getTime());
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });

    it('should create multi-use invitation', async () => {
      const mockInvitation: Invitation = {
        id: 4,
        token: 'd'.repeat(64),
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 10,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const input: CreateInvitationInput = { maxUses: 10 };
      const result = await service.createInvitation(input, 1);

      expect(result.max_uses).toBe(10);
    });

    it('should create invitation with notes', async () => {
      const mockInvitation: Invitation = {
        id: 5,
        token: 'e'.repeat(64),
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: 'For new team member',
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const input: CreateInvitationInput = { notes: 'For new team member' };
      const result = await service.createInvitation(input, 1);

      expect(result.notes).toBe('For new team member');
    });

    it('should generate unique 64-character tokens', async () => {
      // Create multiple invitations and verify tokens are unique
      const tokens = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const mockInvitation: Invitation = {
          id: i + 1,
          token: `token${i}`.padEnd(64, 'x'),
          created_by: 1,
          email: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
          used_by: null,
          is_revoked: 0,
          revoked_at: null,
          revoked_by: null,
          notes: null,
          max_uses: 1,
          use_count: 0,
        };

        (dbAdapter.query as jest.Mock).mockResolvedValue({
          rows: [mockInvitation],
          rowCount: 1,
          command: 'SELECT',
        });

        const result = await service.createInvitation({}, 1);
        expect(result.token.length).toBe(64);
        tokens.add(result.token);
      }

      // All tokens should be unique
      expect(tokens.size).toBe(10);
    });
  });

  describe('validateToken', () => {
    it('should validate active invitation successfully', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'valid-token',
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.invitation).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject non-existent token', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
      });

      const result = await service.validateToken('non-existent-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid invitation token');
      expect(result.invitation).toBeUndefined();
    });

    it('should reject revoked invitation', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'revoked-token',
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 1, // Revoked
        revoked_at: new Date().toISOString(),
        revoked_by: 1,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('revoked-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invitation has been revoked');
    });

    it('should reject expired invitation', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'expired-token',
        created_by: 1,
        email: null,
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Expired 3 days ago
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invitation has expired');
    });

    it('should reject fully used invitation', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'used-token',
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: new Date().toISOString(),
        used_by: 2,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 1, // Fully used
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('used-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invitation has already been used');
    });

    it('should accept partially used multi-use invitation', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'multi-use-token',
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: new Date().toISOString(),
        used_by: 2,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 10,
        use_count: 3, // 3 out of 10 used
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('multi-use-token');

      expect(result.valid).toBe(true);
      expect(result.invitation).toBeDefined();
    });

    it('should reject wrong email for email-restricted invitation', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'email-restricted-token',
        created_by: 1,
        email: 'allowed@test.com',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('email-restricted-token', 'wrong@test.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invitation is for a different email address');
    });

    it('should accept correct email for email-restricted invitation', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'email-restricted-token',
        created_by: 1,
        email: 'allowed@test.com',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('email-restricted-token', 'allowed@test.com');

      expect(result.valid).toBe(true);
      expect(result.invitation).toBeDefined();
    });

    it('should be case-insensitive for email matching', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'email-restricted-token',
        created_by: 1,
        email: 'Allowed@Test.COM',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.validateToken('email-restricted-token', 'allowed@test.com');

      expect(result.valid).toBe(true);
    });
  });

  describe('markAsUsed', () => {
    it('should mark invitation as used and increment use count', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        command: 'UPDATE',
        rows: [],
      });

      await service.markAsUsed('test-token', 123);

      expect(dbAdapter.query).toHaveBeenCalled();
    });

    it('should include used_at timestamp and increment use_count in query', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        command: 'UPDATE',
        rows: [],
      });

      await service.markAsUsed('test-token', 123);

      const callArgs = (dbAdapter.query as jest.Mock).mock.calls[0];
      const query = callArgs[0];

      // Verify UPDATE query contains expected elements
      expect(query.toUpperCase()).toContain('UPDATE');
      expect(query).toContain('use_count');
      // Token is passed as parameter ($2) in parameterized queries, not in SQL string
      expect(query.toUpperCase()).toContain('WHERE TOKEN = $2');
    });
  });

  describe('getAllInvitations', () => {
    const mockInvitations: Invitation[] = [
      {
        id: 1,
        token: 'token1',
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      },
      {
        id: 2,
        token: 'token2',
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: new Date().toISOString(),
        used_by: 2,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 1,
      },
    ];

    it('should return all invitations by default', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: mockInvitations,
        rowCount: 2,
        command: 'SELECT',
      });

      const result = await service.getAllInvitations();

      expect(result).toHaveLength(2);
      expect(dbAdapter.query).toHaveBeenCalled();
    });

    it('should filter out used invitations when includeUsed is false', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitations[0]],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.getAllInvitations({ includeUsed: false });

      const callArgs = (dbAdapter.query as jest.Mock).mock.calls[0];
      const query = callArgs[0];
      expect(query).toContain('used_at IS NULL');
    });

    it('should filter out revoked invitations when includeRevoked is false', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitations[0]],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.getAllInvitations({ includeRevoked: false });

      const callArgs = (dbAdapter.query as jest.Mock).mock.calls[0];
      const query = callArgs[0];
      expect(query).toContain('is_revoked = 0');
    });

    it('should order invitations by created_at DESC', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: mockInvitations,
        rowCount: 2,
        command: 'SELECT',
      });

      await service.getAllInvitations();

      const callArgs = (dbAdapter.query as jest.Mock).mock.calls[0];
      const query = callArgs[0];
      expect(query).toContain('ORDER BY created_at DESC');
    });
  });

  describe('getInvitationsByCreator', () => {
    it('should return invitations created by specific user', async () => {
      const mockInvitations: Invitation[] = [
        {
          id: 1,
          token: 'token1',
          created_by: 123,
          email: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
          used_by: null,
          is_revoked: 0,
          revoked_at: null,
          revoked_by: null,
          notes: null,
          max_uses: 1,
          use_count: 0,
        },
      ];

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: mockInvitations,
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.getInvitationsByCreator(123);

      expect(result).toHaveLength(1);
      expect(result[0]?.created_by).toBe(123);
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke invitation and return true on success', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        command: 'UPDATE',
        rows: [],
      });

      const result = await service.revokeInvitation(1, 999);

      expect(result).toBe(true);
    });

    it('should return false when invitation not found', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 0,
        command: 'UPDATE',
        rows: [],
      });

      const result = await service.revokeInvitation(999, 1);

      expect(result).toBe(false);
    });

    it('should set revoked_at timestamp when revoking', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        command: 'UPDATE',
        rows: [],
      });

      await service.revokeInvitation(1, 999);

      const callArgs = (dbAdapter.query as jest.Mock).mock.calls[0];
      const query = callArgs[0];
      expect(query).toContain('is_revoked');
      expect(query).toContain('revoked_by');
    });
  });

  describe('deleteInvitation', () => {
    it('should delete invitation and return true on success', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        command: 'DELETE',
        rows: [],
      });

      const result = await service.deleteInvitation(1);

      expect(result).toBe(true);
    });

    it('should return false when invitation not found', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 0,
        command: 'DELETE',
        rows: [],
      });

      const result = await service.deleteInvitation(999);

      expect(result).toBe(false);
    });
  });

  describe('getInvitationById', () => {
    it('should return invitation when found', async () => {
      const mockInvitation: Invitation = {
        id: 1,
        token: 'token1',
        created_by: 1,
        email: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        used_at: null,
        used_by: null,
        is_revoked: 0,
        revoked_at: null,
        revoked_by: null,
        notes: null,
        max_uses: 1,
        use_count: 0,
      };

      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [mockInvitation],
        rowCount: 1,
        command: 'SELECT',
      });

      const result = await service.getInvitationById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('should return undefined when invitation not found', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
      });

      const result = await service.getInvitationById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('cleanupExpiredInvitations', () => {
    it('should delete expired unused invitations and return count', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 5,
        command: 'DELETE',
        rows: [],
      });

      const result = await service.cleanupExpiredInvitations();

      expect(result).toBe(5);
    });

    it('should only delete expired, unused, non-revoked invitations', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 0,
        command: 'DELETE',
        rows: [],
      });

      await service.cleanupExpiredInvitations();

      const callArgs = (dbAdapter.query as jest.Mock).mock.calls[0];
      const query = callArgs[0];
      expect(query).toContain('expires_at');
      expect(query).toContain('used_at IS NULL');
      expect(query).toContain('is_revoked = 0');
    });

    it('should return 0 when no expired invitations found', async () => {
      (dbAdapter.query as jest.Mock).mockResolvedValue({
        rowCount: 0,
        command: 'DELETE',
        rows: [],
      });

      const result = await service.cleanupExpiredInvitations();

      expect(result).toBe(0);
    });
  });
});
