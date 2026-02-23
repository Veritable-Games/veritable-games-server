/**
 * Client-Safe Auth Utilities
 *
 * Validation functions that can be used in both client and server components.
 * For server-only functions (getCurrentUser, etc.), use '@/lib/auth/server'.
 */

// Re-export User type for external consumption
export type { User } from './types';

// Common passwords list - expand this as needed
const COMMON_PASSWORDS = [
  'password',
  'password123',
  'admin',
  'qwerty',
  '123456',
  '12345678',
  'letmein',
  'welcome',
  'monkey',
  '1234567890',
  'abc123',
  'Password1',
  'password1',
  'qwertyuiop',
  'dragon',
  'master',
  'admin123',
];

// Check for sequential characters
function hasSequentialChars(password: string): boolean {
  const sequences = ['abc', '123', 'qwe', 'asd', 'zxc', '456', '789', 'xyz'];
  const lower = password.toLowerCase();
  return sequences.some(seq => lower.includes(seq));
}

// Check for repeated characters
function hasRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

// Validate password strength with modern security standards
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Length requirements (increased from 8 to 12)
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Maximum length to prevent DoS
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Character requirements
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common passwords
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a different one');
  }

  // Note: Removed overly strict sequential character check (was blocking legitimate passwords like "Pass123!")
  // Note: Removed repeated character check (was too restrictive)

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate username
export function validateUsername(username: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 30) {
    errors.push('Username must be no more than 30 characters long');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  if (/^[_-]/.test(username) || /[_-]$/.test(username)) {
    errors.push('Username cannot start or end with underscore or hyphen');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate email
export function validateEmail(email: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
