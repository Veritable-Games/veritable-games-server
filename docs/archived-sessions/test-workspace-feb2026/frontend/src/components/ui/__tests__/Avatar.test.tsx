import React from 'react';
import { render, screen } from '@testing-library/react';
import Avatar from '../Avatar';

describe('Avatar Component', () => {
  const defaultUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    display_name: 'Test User',
    role: 'user' as const,
    status: 'active' as const,
    email_verified: true,
    reputation: 100,
    post_count: 5,
    is_active: true,
    last_active: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
  };

  it('renders username initial when no avatar URL provided', () => {
    render(<Avatar user={defaultUser} size="md" />);

    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of display_name
  });

  it('renders avatar image when URL is provided', () => {
    const userWithAvatar = {
      ...defaultUser,
      avatar_url: 'https://example.com/avatar.jpg',
    };
    render(<Avatar user={userWithAvatar} size="md" />);

    const image = screen.getByAltText('Test User');
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('falls back to initial when image fails to load', () => {
    const userWithBrokenAvatar = {
      ...defaultUser,
      avatar_url: 'https://example.com/broken-avatar.jpg',
    };
    render(<Avatar user={userWithBrokenAvatar} size="md" />);

    const image = screen.getByAltText('Test User');

    // Simulate image load error
    image.dispatchEvent(new Event('error'));

    // After error, the image should be hidden but gradient should show
    expect(image.style.display).toBe('none');
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<Avatar user={defaultUser} size="xs" />);

    let avatar = screen.getByTestId('avatar-container');
    expect(avatar).toHaveClass('w-6', 'h-6');

    rerender(<Avatar user={defaultUser} size="lg" />);
    avatar = screen.getByTestId('avatar-container');
    expect(avatar).toHaveClass('w-16', 'h-16');
  });

  it('generates consistent initial from display name', () => {
    const johnUser = {
      ...defaultUser,
      id: 2,
      username: 'john',
      email: 'john@example.com',
      display_name: 'John Doe',
    };
    render(<Avatar user={johnUser} size="md" />);
    expect(screen.getByText('J')).toBeInTheDocument();

    const aliceUser = {
      ...defaultUser,
      id: 3,
      username: 'alice',
      email: 'alice@example.com',
      display_name: 'Alice Smith',
    };
    const { rerender } = render(<Avatar user={aliceUser} size="md" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('handles users without display name gracefully', () => {
    const userWithoutDisplayName = { ...defaultUser, display_name: '' };
    render(<Avatar user={userWithoutDisplayName} size="md" />);
    expect(screen.getByText('T')).toBeInTheDocument(); // Falls back to username initial
  });

  it('has proper title attribute for accessibility', () => {
    render(<Avatar user={defaultUser} size="md" />);

    const avatar = screen.getByTestId('avatar-container');
    expect(avatar).toHaveAttribute('title', 'Test User - Click to view profile');
  });

  it('supports custom CSS classes', () => {
    render(<Avatar user={defaultUser} size="md" className="custom-avatar border-red-500" />);

    const avatar = screen.getByTestId('avatar-container');
    expect(avatar).toHaveClass('custom-avatar', 'border-red-500');
  });
});
