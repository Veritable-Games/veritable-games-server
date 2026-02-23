import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import { Navigation } from '../Navigation';
import { useAuth } from '@/contexts/AuthContext';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock Next.js Image
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUsePathname = usePathname as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

describe('Navigation Component', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
    mockUseAuth.mockReturnValue({ user: null });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders navigation with logo and brand text', () => {
    render(<Navigation />);

    // Logo has empty alt (decorative), brand text has alt
    expect(screen.getByAltText('Veritable Games')).toBeInTheDocument();
  });

  it('renders all navigation items', () => {
    render(<Navigation />);

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forums' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Library' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wiki' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'News' })).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    mockUsePathname.mockReturnValue('/forums');
    render(<Navigation />);

    const forumsLink = screen.getByRole('link', { name: 'Forums' });
    expect(forumsLink).toHaveClass('text-blue-400');
  });

  it('shows mobile menu button on mobile', () => {
    render(<Navigation />);

    const mobileMenuButton = screen.getByRole('button');
    expect(mobileMenuButton).toBeInTheDocument();
    // Button container has lg:hidden class
    expect(mobileMenuButton.parentElement).toHaveClass('lg:hidden');
  });

  it('toggles mobile menu when button is clicked', async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const mobileMenuButton = screen.getByRole('button');

    // Menu should be closed initially - only desktop links visible
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);

    // Open mobile menu
    await user.click(mobileMenuButton);

    // Mobile menu items should be visible
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(2); // Desktop + mobile
  });

  it('closes mobile menu when navigation item is clicked', async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const mobileMenuButton = screen.getByRole('button');

    // Open mobile menu
    await user.click(mobileMenuButton);

    // Click a navigation item in mobile menu (the second one will be the mobile link)
    const mobileLinks = screen.getAllByRole('link', { name: 'About' });
    const mobileAboutLink = mobileLinks[1]; // Mobile link is second

    if (!mobileAboutLink) {
      throw new Error('Mobile about link not found');
    }

    await user.click(mobileAboutLink);

    // Mobile menu should close (only desktop link visible)
    expect(screen.getAllByRole('link', { name: 'About' })).toHaveLength(1);
  });

  it('has correct href attributes for navigation links', () => {
    render(<Navigation />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Forums' })).toHaveAttribute('href', '/forums');
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/library');
    expect(screen.getByRole('link', { name: 'Wiki' })).toHaveAttribute('href', '/wiki');
    expect(screen.getByRole('link', { name: 'News' })).toHaveAttribute('href', '/news');
  });

  it('handles active state for root path correctly', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Navigation />);

    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink).toHaveClass('text-blue-400');

    const aboutLink = screen.getByRole('link', { name: 'About' });
    expect(aboutLink).toHaveClass('text-neutral-400');
    expect(aboutLink).not.toHaveClass('text-blue-400');
  });

  it('handles active state for sub-paths correctly', () => {
    mockUsePathname.mockReturnValue('/forums/topic/123');
    render(<Navigation />);

    const forumsLink = screen.getByRole('link', { name: 'Forums' });
    expect(forumsLink).toHaveClass('text-blue-400');
  });

  it('has proper accessibility attributes', () => {
    render(<Navigation />);

    const mobileMenuButton = screen.getByRole('button');
    expect(mobileMenuButton).toHaveAttribute('aria-expanded');
    expect(mobileMenuButton).toHaveAttribute('aria-label');
    expect(mobileMenuButton).toHaveAttribute('aria-controls', 'mobile-menu');
  });

  it('shows correct icon in mobile menu button', async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const mobileMenuButton = screen.getByRole('button');
    const svg = mobileMenuButton.querySelector('svg');

    // Should show hamburger icon initially
    expect(svg?.querySelector('path')).toHaveAttribute('d', 'M4 6h16M4 12h16M4 18h16');

    // Click to open menu
    await user.click(mobileMenuButton);

    // Should show X icon when open
    expect(svg?.querySelector('path')).toHaveAttribute('d', 'M6 18L18 6M6 6l12 12');
  });

  it('applies hover styles correctly', () => {
    render(<Navigation />);

    const aboutLink = screen.getByRole('link', { name: 'About' });
    expect(aboutLink).toHaveClass('hover:text-blue-400');
  });

  it('maintains responsive design classes', () => {
    render(<Navigation />);

    // Desktop navigation should be hidden on mobile (uses lg: breakpoint)
    const desktopNav = document.querySelector('.hidden.lg\\:flex');
    expect(desktopNav).toBeInTheDocument();

    // Mobile menu button should be hidden on desktop
    const mobileButton = screen.getByRole('button').parentElement;
    expect(mobileButton).toHaveClass('lg:hidden');
  });
});
