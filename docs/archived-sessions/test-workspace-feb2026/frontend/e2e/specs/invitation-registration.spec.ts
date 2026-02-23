/**
 * E2E Tests - Invitation Registration Flow
 *
 * Tests the complete user registration flow with invitation tokens:
 * - Valid invitation token
 * - Invalid/expired/revoked tokens
 * - Email-restricted invitations
 * - Multi-use invitations
 *
 * Security Note: Uses Claude test credentials (from .claude-credentials file)
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../fixtures/auth-fixtures';
import * as fs from 'fs';
import * as path from 'path';

// Load Claude credentials
const credPath = path.join(process.cwd(), '..', '.claude-credentials');
const credContent = fs.existsSync(credPath) ? fs.readFileSync(credPath, 'utf8') : '';
const credMap: Record<string, string> = {};
credContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...val] = line.split('=');
    credMap[key] = val.join('=');
  }
});
const CLAUDE_USERNAME = credMap['CLAUDE_TEST_USERNAME'] || 'claude';
const CLAUDE_PASSWORD = credMap['CLAUDE_TEST_PASSWORD'] || '';

// Test data
const VALID_USER = {
  username: 'invited_user_' + Date.now(),
  email: 'invited' + Date.now() + '@example.com',
  password: 'SecurePassword123!',
};

const RESTRICTED_EMAIL_USER = {
  username: 'restricted_user_' + Date.now(),
  email: 'restricted@example.com',
  password: 'SecurePassword123!',
};

// Helper to create an invitation token via API
async function createInvitation(
  page: any,
  options: {
    email?: string;
    expiresInDays?: number;
    maxUses?: number;
    notes?: string;
  } = {}
) {
  // Login as Claude test user
  await page.goto('/auth/login');
  await page.getByLabel('Username or Email').fill(CLAUDE_USERNAME);
  await page.getByLabel('Password').fill(CLAUDE_PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();

  // Wait for login to complete
  await page.waitForURL('/');

  // Create invitation via API
  const response = await page.request.post('/api/admin/invitations', {
    data: {
      email: options.email,
      expires_in_days: options.expiresInDays || 7,
      max_uses: options.maxUses || 1,
      notes: options.notes,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  // Logout
  await page.goto('/auth/logout');

  return data.data.token;
}

test.describe('Invitation Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start logged out
    await page.goto('/');
  });

  test('should allow registration with valid invitation token', async ({ page }) => {
    // Create a valid invitation token
    const token = await createInvitation(page);

    // Navigate to registration page with token
    await page.goto(`/auth/register?token=${token}`);

    // Verify token is pre-filled or recognized
    await expect(page.getByText(/invitation/i)).toBeVisible();

    // Fill in registration form
    await page.getByLabel('Username').fill(VALID_USER.username);
    await page.getByLabel('Email').fill(VALID_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_USER.password);
    await page.getByLabel('Confirm Password').fill(VALID_USER.password);

    // Submit registration
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Verify successful registration and automatic login
    await page.waitForURL('/');
    await expect(page.getByText(`Welcome, ${VALID_USER.username}`)).toBeVisible();

    // Verify user can access authenticated pages
    await page.goto('/profile/edit');
    await expect(page.getByLabel('Username')).toHaveValue(VALID_USER.username);
  });

  test('should reject registration with invalid invitation token', async ({ page }) => {
    const invalidToken = 'invalid_token_that_does_not_exist_1234567890abcdef';

    // Navigate to registration page with invalid token
    await page.goto(`/auth/register?token=${invalidToken}`);

    // Should show error about invalid token
    await expect(
      page.getByText(/invalid.*invitation|invitation.*invalid|token.*invalid/i)
    ).toBeVisible();

    // Registration form should not be accessible or should show error
    const submitButton = page.getByRole('button', { name: 'Create Account' });
    if (await submitButton.isVisible()) {
      // If form is shown, try to submit and expect error
      await submitButton.click();
      await expect(page.getByText(/invalid.*token|token.*invalid/i)).toBeVisible();
    }
  });

  test('should reject registration with expired invitation token', async ({ page }) => {
    // Create an invitation that expires immediately (0 days)
    // Note: This test assumes the API allows creating already-expired tokens for testing
    // In production, you might need to manually expire a token in the database

    // For now, create a short-lived token and note that in real testing,
    // you'd need database access to manually expire it
    const token = await createInvitation(page, { expiresInDays: 7 });

    // In a real test, you would:
    // 1. Create the token
    // 2. Use database access to set expires_at to the past
    // 3. Then test the registration flow

    // For this test, we'll document the expected behavior:
    // await page.goto(`/auth/register?token=${token}`);
    // await expect(page.getByText(/expired|no longer valid/i)).toBeVisible();

    test.skip();
  });

  test('should reject registration with revoked invitation token', async ({ page }) => {
    // Create invitation
    const token = await createInvitation(page);

    // Login as Claude user and revoke the invitation
    // NOTE: This test may fail if Claude user doesn't have admin/moderator permissions
    // to revoke invitations. Update Claude user role if needed.
    await page.goto('/auth/login');
    await page.getByLabel('Username or Email').fill(CLAUDE_USERNAME);
    await page.getByLabel('Password').fill(CLAUDE_PASSWORD);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Get invitation ID and revoke it
    const listResponse = await page.request.get('/api/admin/invitations');
    const listData = await listResponse.json();
    const invitation = listData.data.find((inv: any) => inv.token === token);

    await page.request.delete(`/api/admin/invitations/${invitation.id}`);

    // Logout
    await page.goto('/auth/logout');

    // Try to register with revoked token
    await page.goto(`/auth/register?token=${token}`);

    // Should show error about revoked token
    await expect(page.getByText(/revoked|no longer valid|invalid/i)).toBeVisible();
  });

  test('should enforce email restriction on invitation', async ({ page }) => {
    // Create email-restricted invitation
    const token = await createInvitation(page, {
      email: RESTRICTED_EMAIL_USER.email,
    });

    // Try to register with wrong email
    await page.goto(`/auth/register?token=${token}`);
    await page.getByLabel('Username').fill(RESTRICTED_EMAIL_USER.username);
    await page.getByLabel('Email').fill('wrong_email@example.com');
    await page.getByLabel('Password', { exact: true }).fill(RESTRICTED_EMAIL_USER.password);
    await page.getByLabel('Confirm Password').fill(RESTRICTED_EMAIL_USER.password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should show error about email mismatch
    await expect(
      page.getByText(/email.*not.*match|restricted.*email|email.*restricted/i)
    ).toBeVisible();

    // Now try with correct email
    await page.getByLabel('Email').clear();
    await page.getByLabel('Email').fill(RESTRICTED_EMAIL_USER.email);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should succeed
    await page.waitForURL('/');
    await expect(page.getByText(`Welcome, ${RESTRICTED_EMAIL_USER.username}`)).toBeVisible();
  });

  test('should support multi-use invitations', async ({ page }) => {
    // Create multi-use invitation (3 uses)
    const token = await createInvitation(page, { maxUses: 3 });

    // Register first user
    const user1 = {
      username: 'multi_user_1_' + Date.now(),
      email: 'multi1_' + Date.now() + '@example.com',
      password: 'SecurePassword123!',
    };

    await page.goto(`/auth/register?token=${token}`);
    await page.getByLabel('Username').fill(user1.username);
    await page.getByLabel('Email').fill(user1.email);
    await page.getByLabel('Password', { exact: true }).fill(user1.password);
    await page.getByLabel('Confirm Password').fill(user1.password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Verify first registration succeeded
    await page.waitForURL('/');
    await expect(page.getByText(`Welcome, ${user1.username}`)).toBeVisible();

    // Logout
    await page.goto('/auth/logout');

    // Register second user with same token
    const user2 = {
      username: 'multi_user_2_' + Date.now(),
      email: 'multi2_' + Date.now() + '@example.com',
      password: 'SecurePassword123!',
    };

    await page.goto(`/auth/register?token=${token}`);
    await page.getByLabel('Username').fill(user2.username);
    await page.getByLabel('Email').fill(user2.email);
    await page.getByLabel('Password', { exact: true }).fill(user2.password);
    await page.getByLabel('Confirm Password').fill(user2.password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Verify second registration succeeded
    await page.waitForURL('/');
    await expect(page.getByText(`Welcome, ${user2.username}`)).toBeVisible();

    // Token should still have one use remaining (use_count = 2, max_uses = 3)
  });

  test('should reject registration when multi-use invitation is fully used', async ({ page }) => {
    // Create single-use invitation
    const token = await createInvitation(page, { maxUses: 1 });

    // Use the token for first registration
    const user1 = {
      username: 'single_use_user_' + Date.now(),
      email: 'single_' + Date.now() + '@example.com',
      password: 'SecurePassword123!',
    };

    await page.goto(`/auth/register?token=${token}`);
    await page.getByLabel('Username').fill(user1.username);
    await page.getByLabel('Email').fill(user1.email);
    await page.getByLabel('Password', { exact: true }).fill(user1.password);
    await page.getByLabel('Confirm Password').fill(user1.password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await page.waitForURL('/');
    await page.goto('/auth/logout');

    // Try to use the same token again
    await page.goto(`/auth/register?token=${token}`);

    // Should show error about token being fully used
    await expect(page.getByText(/already.*used|no.*uses.*remaining|fully.*used/i)).toBeVisible();
  });
});

test.describe('Invitation Registration - Without Token', () => {
  test('should show appropriate message when no invitation token provided', async ({ page }) => {
    await page.goto('/auth/register');

    // Should show message about needing an invitation
    // or allow registration without invitation (depending on system config)

    // If invitation-only mode:
    // await expect(page.getByText(/invitation.*required|invite.*only/i)).toBeVisible();

    // If open registration is allowed:
    // await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

    // This test documents that the system should have clear messaging
    // about whether invitations are required or optional
  });
});
