/**
 * Integration Tests - Admin Invitations API Routes
 *
 * Tests for /api/admin/invitations endpoints:
 * - GET /api/admin/invitations - List invitations
 * - POST /api/admin/invitations - Create invitation
 * - GET /api/admin/invitations/[id] - Get invitation by ID
 * - DELETE /api/admin/invitations/[id] - Revoke invitation
 */

import { NextRequest } from 'next/server';
import { GET as getInvitations, POST as createInvitation } from '../route';
import { GET as getInvitationById, DELETE as revokeInvitation } from '../[id]/route';

// Mock the auth utilities
jest.mock('@/lib/auth/server', () => ({
  getCurrentUser: jest.fn(),
}));

// Mock the invitation service
jest.mock('@/lib/invitations/service', () => ({
  invitationService: {
    getAllInvitations: jest.fn(),
    createInvitation: jest.fn(),
    getInvitationById: jest.fn(),
    revokeInvitation: jest.fn(),
  },
}));

// Mock the security middleware - it wraps handlers to accept (request, context)
jest.mock('@/lib/security/middleware', () => ({
  withSecurity: (handler: any) => (request: any, context?: any) => handler(request, context),
}));

import { getCurrentUser } from '@/lib/auth/server';
import { invitationService } from '@/lib/invitations/service';

// Mock user objects
const mockAdminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  created_at: new Date().toISOString(),
};

const mockRegularUser = {
  id: 2,
  username: 'user',
  email: 'user@example.com',
  role: 'user',
  created_at: new Date().toISOString(),
};

// Mock invitation object
const mockInvitation = {
  id: 1,
  token: 'a'.repeat(64),
  email: null,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_by_user_id: 1,
  created_at: new Date().toISOString(),
  used_by_user_id: null,
  used_at: null,
  revoked_at: null,
  revoked_by_user_id: null,
  notes: null,
  max_uses: 1,
  use_count: 0,
};

describe('Admin Invitations API - GET /api/admin/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthenticated requests', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations');
    const response = await getInvitations(request, {});

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Authentication required');
  });

  it('should return 403 for non-admin users', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockRegularUser);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations');
    const response = await getInvitations(request, {});

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Admin access required');
  });

  it('should list all invitations for admin users', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getAllInvitations as jest.Mock).mockReturnValue([mockInvitation]);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations');
    const response = await getInvitations(request, {});

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.count).toBe(1);
    expect(data.data[0]).toEqual(mockInvitation);
  });

  it('should respect include_used=false filter', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getAllInvitations as jest.Mock).mockReturnValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/invitations?include_used=false'
    );
    const response = await getInvitations(request, {});

    expect(response.status).toBe(200);
    expect(invitationService.getAllInvitations).toHaveBeenCalledWith({
      includeUsed: false,
      includeRevoked: true,
    });
  });

  it('should respect include_revoked=false filter', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getAllInvitations as jest.Mock).mockReturnValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/invitations?include_revoked=false'
    );
    const response = await getInvitations(request, {});

    expect(response.status).toBe(200);
    expect(invitationService.getAllInvitations).toHaveBeenCalledWith({
      includeUsed: true,
      includeRevoked: false,
    });
  });

  it('should support multiple filter combinations', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getAllInvitations as jest.Mock).mockReturnValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/admin/invitations?include_used=false&include_revoked=false'
    );
    const response = await getInvitations(request, {});

    expect(response.status).toBe(200);
    expect(invitationService.getAllInvitations).toHaveBeenCalledWith({
      includeUsed: false,
      includeRevoked: false,
    });
  });
});

describe('Admin Invitations API - POST /api/admin/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthenticated requests', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const requestBody = JSON.stringify({});
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: requestBody,
    });
    // Add json() method to request
    (request as any).json = jest.fn().mockResolvedValue({});

    const response = await createInvitation(request, {});

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Authentication required');
  });

  it('should return 403 for non-admin users', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockRegularUser);

    const requestBody = JSON.stringify({});
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: requestBody,
    });
    // Add json() method to request
    (request as any).json = jest.fn().mockResolvedValue({});

    const response = await createInvitation(request, {});

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Admin access required');
  });

  it('should create invitation with default settings', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.createInvitation as jest.Mock).mockReturnValue(mockInvitation);

    const requestBody = {};
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockInvitation);
    expect(data.message).toContain('created successfully');
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      {
        email: undefined,
        expiresInDays: 7,
        notes: undefined,
        maxUses: 1,
      },
      mockAdminUser.id
    );
  });

  it('should create invitation with email restriction', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    const emailInvitation = { ...mockInvitation, email: 'newuser@example.com' };
    (invitationService.createInvitation as jest.Mock).mockReturnValue(emailInvitation);

    const requestBody = { email: 'newuser@example.com' };
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.email).toBe('newuser@example.com');
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com',
      }),
      mockAdminUser.id
    );
  });

  it('should create invitation with custom expiration', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.createInvitation as jest.Mock).mockReturnValue(mockInvitation);

    const requestBody = { expires_in_days: 14 };
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(201);
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresInDays: 14,
      }),
      mockAdminUser.id
    );
  });

  it('should create multi-use invitation', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    const multiUseInvitation = { ...mockInvitation, max_uses: 5 };
    (invitationService.createInvitation as jest.Mock).mockReturnValue(multiUseInvitation);

    const requestBody = { max_uses: 5 };
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.data.max_uses).toBe(5);
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        maxUses: 5,
      }),
      mockAdminUser.id
    );
  });

  it('should create invitation with notes', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    const notesInvitation = { ...mockInvitation, notes: 'For new team member' };
    (invitationService.createInvitation as jest.Mock).mockReturnValue(notesInvitation);

    const requestBody = { notes: 'For new team member' };
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.data.notes).toBe('For new team member');
  });

  it('should validate email must be string', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

    const requestBody = { email: 123 }; // Invalid: number instead of string
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Email must be a string');
  });

  it('should validate expires_in_days must be positive number', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

    const requestBody = { expires_in_days: -5 }; // Invalid: negative number
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('expires_in_days must be a positive number');
  });

  it('should validate max_uses must be positive number', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

    const requestBody = { max_uses: 0 }; // Invalid: zero
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('max_uses must be a positive number');
  });

  it('should trim whitespace from email and notes', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.createInvitation as jest.Mock).mockReturnValue(mockInvitation);

    const requestBody = {
      email: '  newuser@example.com  ',
      notes: '  For new member  ',
    };
    const request = new NextRequest('http://localhost:3000/api/admin/invitations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    (request as any).json = jest.fn().mockResolvedValue(requestBody);

    const response = await createInvitation(request, {});

    expect(response.status).toBe(201);
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com', // Trimmed
        notes: 'For new member', // Trimmed
      }),
      mockAdminUser.id
    );
  });
});

describe('Admin Invitations API - GET /api/admin/invitations/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthenticated requests', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/1');
    const context = { params: Promise.resolve({ id: '1' }) };
    const response = await getInvitationById(request, context);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Authentication required');
  });

  it('should return 403 for non-admin users', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockRegularUser);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/1');
    const context = { params: Promise.resolve({ id: '1' }) };
    const response = await getInvitationById(request, context);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Admin access required');
  });

  it('should get invitation by ID for admin users', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getInvitationById as jest.Mock).mockReturnValue(mockInvitation);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/1');
    const context = { params: Promise.resolve({ id: '1' }) };
    const response = await getInvitationById(request, context);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockInvitation);
    expect(invitationService.getInvitationById).toHaveBeenCalledWith(1);
  });

  it('should return 400 for invalid ID format', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/invalid');
    const context = { params: Promise.resolve({ id: 'invalid' }) };
    const response = await getInvitationById(request, context);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Invalid invitation ID');
  });

  it('should return 404 for non-existent invitation', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getInvitationById as jest.Mock).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/999');
    const context = { params: Promise.resolve({ id: '999' }) };
    const response = await getInvitationById(request, context);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Invitation');
  });
});

describe('Admin Invitations API - DELETE /api/admin/invitations/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthenticated requests', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ id: '1' }) };
    const response = await revokeInvitation(request, context);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Authentication required');
  });

  it('should return 403 for non-admin users', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockRegularUser);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ id: '1' }) };
    const response = await revokeInvitation(request, context);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Admin access required');
  });

  it('should revoke invitation for admin users', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getInvitationById as jest.Mock).mockReturnValue(mockInvitation);
    (invitationService.revokeInvitation as jest.Mock).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ id: '1' }) };
    const response = await revokeInvitation(request, context);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('revoked successfully');
    expect(invitationService.revokeInvitation).toHaveBeenCalledWith(1, mockAdminUser.id);
  });

  it('should return 400 for invalid ID format', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/invalid', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ id: 'invalid' }) };
    const response = await revokeInvitation(request, context);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Invalid invitation ID');
  });

  it('should return 404 for non-existent invitation', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getInvitationById as jest.Mock).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/999', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ id: '999' }) };
    const response = await revokeInvitation(request, context);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Invitation');
  });

  it('should handle revocation failure gracefully', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
    (invitationService.getInvitationById as jest.Mock).mockReturnValue(mockInvitation);
    (invitationService.revokeInvitation as jest.Mock).mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/admin/invitations/1', {
      method: 'DELETE',
    });
    const context = { params: Promise.resolve({ id: '1' }) };
    const response = await revokeInvitation(request, context);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Failed to revoke');
  });
});
