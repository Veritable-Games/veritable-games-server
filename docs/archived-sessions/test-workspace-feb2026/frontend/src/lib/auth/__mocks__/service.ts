import { User } from '../utils';

export class AuthService {
  // Mock implementation for testing
  async hashPassword(password: string): Promise<string> {
    return `mock-hash-${password}`;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return hash === `mock-hash-${password}`;
  }

  generateToken(user: { id: number; username: string; email: string; role: string }): string {
    return `mock-token-${user.id}`;
  }

  verifyToken(
    token: string
  ): { userId: number; username: string; email: string; role: string } | null {
    if (token.startsWith('mock-token-')) {
      const idStr = token.split('-')[2];
      if (!idStr) return null;
      const id = parseInt(idStr);
      return {
        userId: id,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
      };
    }
    return null;
  }

  async validateSession(sessionId: string): Promise<User | null> {
    // This will be mocked in individual tests
    return null;
  }

  async login(username: string, password: string): Promise<User | null>;
  async login(data: {
    username: string;
    password: string;
  }): Promise<{ user: User; sessionId: string }>;
  async login(
    usernameOrData: string | { username: string; password: string },
    password?: string
  ): Promise<User | null | { user: User; sessionId: string }> {
    // Simple mock implementation for testing
    if (typeof usernameOrData === 'string' && password) {
      if (usernameOrData === 'testuser' && password === 'wrongpassword') {
        return null;
      }
      return null; // Default mock behavior
    }

    // Object-based login
    const data = usernameOrData as { username: string; password: string };
    if (data.username && data.password) {
      const mockUser: User = {
        id: 1,
        uuid: 'mock-uuid-' + Date.now(),
        username: data.username,
        email: 'test@example.com',
        display_name: 'Test User',
        role: 'user',
        email_verified: false,
        reputation: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true,
      };

      return { user: mockUser, sessionId: 'mock-session-id' };
    }

    throw new Error('Invalid credentials');
  }

  async register(data: any): Promise<{ user: User; sessionId: string }> {
    const mockUser: User = {
      id: 1,
      uuid: 'mock-uuid-' + Date.now(),
      username: data.username,
      email: data.email,
      display_name: data.display_name || data.username,
      role: 'user',
      email_verified: false,
      reputation: 0,
      post_count: 0,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      is_active: true,
    };

    return { user: mockUser, sessionId: 'mock-session-id' };
  }

  async getUserById(id: number): Promise<User | null> {
    return null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return null;
  }

  async updateProfile(userId: number, data: any): Promise<User | null> {
    return null;
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    // Mock implementation
  }

  async createSession(userId: number): Promise<string> {
    return 'mock-session-id';
  }

  async logout(sessionId: string): Promise<void> {
    // Mock implementation
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Mock implementation
  }

  async getUserPermissions(userId: number, categoryId?: number): Promise<string[]> {
    return [];
  }

  async hasPermission(userId: number, permission: string, categoryId?: number): Promise<boolean> {
    return false;
  }

  async grantPermission(
    userId: number,
    permission: string,
    entityType?: string,
    entityId?: string,
    grantedBy?: number
  ): Promise<void> {
    // Mock implementation
  }

  async revokePermission(
    userId: number,
    permission: string,
    entityType?: string,
    entityId?: string,
    revokedBy?: number
  ): Promise<void> {
    // Mock implementation
  }

  async getUserActivity(userId: number, limit?: number, offset?: number): Promise<any[]> {
    return [];
  }

  async getUserStats(userId: number): Promise<{
    forum_posts: number;
    wiki_edits: number;
    total_activity: number;
    joined_days_ago: number;
  }> {
    return {
      forum_posts: 0,
      wiki_edits: 0,
      total_activity: 0,
      joined_days_ago: 0,
    };
  }
}

// Export mock instance
export const authService = new AuthService();
