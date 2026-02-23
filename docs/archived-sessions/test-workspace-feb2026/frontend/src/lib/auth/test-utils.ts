import { NextRequest } from 'next/server';
import { User } from './utils';

/**
 * Test utilities for auth testing
 */

// Create a mock user for testing
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    uuid: 'mock-uuid-' + (overrides.id || 1),
    username: 'testuser',
    email: 'test@example.com',
    display_name: 'Test User',
    role: 'user',
    email_verified: false,
    reputation: 0,
    post_count: 0,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    is_active: true,
    ...overrides,
  };
}

// Create a mock NextRequest with session cookie
export function createMockRequestWithSession(
  sessionId: string = 'valid-session-id',
  url: string = 'http://localhost:3000/api/test'
): NextRequest {
  return new NextRequest(url, {
    headers: {
      cookie: `session_id=${sessionId}`,
    },
  });
}

// Create a mock NextRequest without session
export function createMockRequestWithoutSession(
  url: string = 'http://localhost:3000/api/test'
): NextRequest {
  return new NextRequest(url);
}

// Mock response helper
export function createMockResponse(data: any, status: number = 200) {
  return {
    json: () => Promise.resolve(data),
    status,
    ok: status >= 200 && status < 300,
  };
}

// Common test users
export const TEST_USERS = {
  regularUser: createMockUser({
    id: 1,
    username: 'testuser',
    role: 'user',
  }),
  moderator: createMockUser({
    id: 2,
    username: 'moderator',
    role: 'moderator',
  }),
  admin: createMockUser({
    id: 3,
    username: 'admin',
    role: 'admin',
  }),
};
