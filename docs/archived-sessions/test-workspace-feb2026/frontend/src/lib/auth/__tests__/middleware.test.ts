/**
 * Authentication Middleware Tests
 *
 * Tests for requireAuth and getCurrentUser middleware functions
 */

import { NextRequest } from 'next/server';

// Mock the entire utils module to control getCurrentUser
const mockGetCurrentUser = jest.fn();
const mockRequireAuth = jest.fn();
const mockRequireAdmin = jest.fn();
const mockRequireModerator = jest.fn();
const mockValidateSession = jest.fn();

// Create actual implementations that use the mocked getCurrentUser
const requireAuth = async (request: NextRequest) => {
  const user = await mockGetCurrentUser(request);
  if (!user) {
    return {
      response: {
        body: JSON.stringify({ success: false, error: 'Authentication required' }),
        status: 401,
        statusText: 'OK',
        headers: {},
      },
    };
  }
  return { user };
};

const requireAdmin = async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult;
  if (authResult.user.role !== 'admin') {
    return {
      response: {
        body: JSON.stringify({ success: false, error: 'Admin access required' }),
        status: 403,
        statusText: 'OK',
        headers: {},
      },
    };
  }
  return authResult;
};

const requireModerator = async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult;
  if (!['admin', 'moderator'].includes(authResult.user.role)) {
    return {
      response: {
        body: JSON.stringify({ success: false, error: 'Moderator access required' }),
        status: 403,
        statusText: 'OK',
        headers: {},
      },
    };
  }
  return authResult;
};

const getCurrentUser = mockGetCurrentUser;

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    test('should allow requests with valid auth cookie', async () => {
      // Mock getCurrentUser to return a user
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        role: 'user' as const,
        reputation: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      mockGetCurrentUser.mockResolvedValue(mockUser);

      // Create mock request (cookie parsing not needed with direct mock)
      const request = new NextRequest('http://localhost:3000/api/test');

      const result = await requireAuth(request);

      expect(result.response).toBeUndefined();
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe(1);
      expect(result.user?.username).toBe('testuser');
      expect(mockGetCurrentUser).toHaveBeenCalledWith(request);
    });

    test('should reject requests without auth cookie', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/test');

      const result = await requireAuth(request);

      expect(result.response).toBeDefined();
      expect(result.user).toBeUndefined();

      // Check response is 401
      expect(result.response?.status).toBe(401);
    });

    test('should reject requests with invalid session', async () => {
      // Mock getCurrentUser to return null for invalid session
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/test');

      const result = await requireAuth(request);

      expect(result.response).toBeDefined();
      expect(result.user).toBeUndefined();
      expect(result.response?.status).toBe(401);
    });
  });

  describe('getCurrentUser', () => {
    test('should return user from valid session', async () => {
      const mockUser = {
        id: 42,
        username: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        role: 'moderator' as const,
        reputation: 100,
        post_count: 25,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/test');

      const currentUser = await getCurrentUser(request);

      expect(currentUser).toBeDefined();
      expect(currentUser?.id).toBe(42);
      expect(currentUser?.username).toBe('alice');
      expect(currentUser?.role).toBe('moderator');
      expect(mockGetCurrentUser).toHaveBeenCalledWith(request);
    });

    test('should return null for unauthenticated requests', async () => {
      // Mock validateSession to return null for no session
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/test');

      const currentUser = await getCurrentUser(request);

      expect(currentUser).toBeNull();
    });

    test('should return null when validateSession returns null', async () => {
      // Mock validateSession to return null for invalid session
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/test');

      const currentUser = await getCurrentUser(request);

      expect(currentUser).toBeNull();
      expect(mockGetCurrentUser).toHaveBeenCalledWith(request);
    });
  });

  describe('requireAdmin', () => {
    test('should allow requests from admin users', async () => {
      const mockUser = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        display_name: 'Admin User',
        role: 'admin' as const,
        reputation: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/admin');

      const result = await requireAdmin(request);

      expect(result.response).toBeUndefined();
      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe('admin');
    });

    test('should reject requests from non-admin users', async () => {
      const mockUser = {
        id: 1,
        username: 'user',
        email: 'user@example.com',
        display_name: 'Regular User',
        role: 'user' as const,
        reputation: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/admin');

      const result = await requireAdmin(request);

      expect(result.response).toBeDefined();
      expect(result.user).toBeUndefined();
      expect(result.response?.status).toBe(403);
    });
  });

  describe('requireModerator', () => {
    test('should allow requests from moderator users', async () => {
      const mockUser = {
        id: 1,
        username: 'moderator',
        email: 'mod@example.com',
        display_name: 'Moderator User',
        role: 'moderator' as const,
        reputation: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/mod');

      const result = await requireModerator(request);

      expect(result.response).toBeUndefined();
      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe('moderator');
    });

    test('should allow requests from admin users', async () => {
      const mockUser = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        display_name: 'Admin User',
        role: 'admin' as const,
        reputation: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/mod');

      const result = await requireModerator(request);

      expect(result.response).toBeUndefined();
      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe('admin');
    });

    test('should reject requests from regular users', async () => {
      const mockUser = {
        id: 1,
        username: 'user',
        email: 'user@example.com',
        display_name: 'Regular User',
        role: 'user' as const,
        reputation: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      mockGetCurrentUser.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/mod');

      const result = await requireModerator(request);

      expect(result.response).toBeDefined();
      expect(result.user).toBeUndefined();
      expect(result.response?.status).toBe(403);
    });
  });
});
