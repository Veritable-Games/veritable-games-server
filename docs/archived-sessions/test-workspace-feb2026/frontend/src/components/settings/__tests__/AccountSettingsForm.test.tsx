import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountSettingsForm } from '../AccountSettingsForm';
import { User } from '@/lib/users/types';

// CSRF has been removed from this application

// Mock fetch
global.fetch = jest.fn();

describe('AccountSettingsForm', () => {
  const mockUser: User = {
    id: 1,
    uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    email_verified: false,
    reputation: 0,
    post_count: 0,
    is_active: true,
    last_active: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    display_name: 'Test User',
    bio: undefined,
    avatar_url: undefined,
    location: undefined,
    website_url: undefined,
    github_url: undefined,
    mastodon_url: undefined,
    discord_username: undefined,
    email_notifications_enabled: true,
    email_message_notifications: true,
    email_reply_notifications: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for email preferences
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        email_notifications_enabled: true,
        email_message_notifications: true,
        email_reply_notifications: true,
      }),
    });
  });

  it('renders all sections correctly', async () => {
    render(<AccountSettingsForm user={mockUser} />);

    // Wait for preferences to load
    await waitFor(() => {
      expect(screen.getByText('Account Information')).toBeInTheDocument();
    });

    // Email Address appears in both section title and label
    expect(screen.getAllByText('Email Address').length).toBeGreaterThan(0);
    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
  });

  it('displays user information correctly', async () => {
    render(<AccountSettingsForm user={mockUser} />);

    await waitFor(() => {
      // Username should now be editable
      const usernameInput = screen.getByDisplayValue('testuser');
      expect(usernameInput).not.toBeDisabled();
    });

    const emailInput = screen.getByDisplayValue('test@example.com');
    expect(emailInput).toBeInTheDocument();

    const roleInput = screen.getByDisplayValue('user');
    expect(roleInput).toBeDisabled();
  });

  it('shows display name field with auto-save', async () => {
    render(<AccountSettingsForm user={mockUser} />);

    await waitFor(() => {
      const displayNameInput = screen.getByDisplayValue('Test User');
      expect(displayNameInput).toBeInTheDocument();
    });

    expect(screen.getByText('Display Name (Auto-saved)')).toBeInTheDocument();
  });

  it('handles username update form submission', async () => {
    const mockFetch = fetch as jest.Mock;

    // Mock email preferences fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        email_notifications_enabled: true,
        email_message_notifications: true,
        email_reply_notifications: true,
      }),
    });

    render(<AccountSettingsForm user={mockUser} />);

    await waitFor(() => {
      const usernameInput = screen.getByDisplayValue('testuser');
      expect(usernameInput).toBeInTheDocument();
    });

    // Find and fill username form
    const usernameInput = screen.getByDisplayValue('testuser');
    fireEvent.change(usernameInput, { target: { value: 'newusername' } });

    // Password input should appear after changing username
    await waitFor(() => {
      const passwordInput = screen.getByPlaceholderText(/enter your current password to confirm/i);
      expect(passwordInput).toBeInTheDocument();
      fireEvent.change(passwordInput, { target: { value: 'currentpassword' } });
    });

    // Mock successful username change
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Username changed successfully' }),
    });

    // Submit the form
    const saveButton = screen.getByTestId('save-account-settings');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/settings/account',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            action: 'change-username',
            username: 'newusername',
            currentPassword: 'currentpassword',
          }),
        })
      );
    });
  });

  it('validates password matching', async () => {
    render(<AccountSettingsForm user={mockUser} />);

    await waitFor(() => {
      const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
      expect(newPasswordInput).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your new password/i);

    fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } });

    // Should show error when passwords don't match
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });
});
