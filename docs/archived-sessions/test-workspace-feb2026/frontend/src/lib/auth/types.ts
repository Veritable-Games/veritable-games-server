/**
 * Auth Types
 *
 * Shared type definitions for the authentication system.
 * This file prevents circular dependencies between utils.ts and service.ts
 */

// Import User type from centralized users/types to avoid conflicts
import type { User, UserProfile } from '@/lib/users/types';

// Re-export for convenience
export type { User, UserProfile } from '@/lib/users/types';

export interface AuthSession {
  user: User;
  sessionId: string;
  expires: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  remember?: boolean;
}

export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface VerificationResult {
  valid: boolean;
  user?: User;
  error?: string;
}
