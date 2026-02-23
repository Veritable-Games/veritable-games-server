/**
 * SettingsContainer Component
 * Provides consistent width constraints across all settings components
 * Based on lowest common denominator approach for tab standardization
 */

import React from 'react';

interface SettingsContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Override the default max width */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  /** Variant for different container types */
  variant?: 'content' | 'sidebar' | 'mobile' | 'full';
}

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm', // 384px
  md: 'max-w-md', // 448px
  lg: 'max-w-lg', // 512px
  xl: 'max-w-xl', // 576px
  '2xl': 'max-w-2xl', // 672px (our standard)
  '3xl': 'max-w-3xl', // 768px
  full: 'max-w-full', // 100%
} as const;

const VARIANT_CLASSES = {
  // Main content area - consistent 672px width
  content: 'w-full max-w-2xl mx-auto',

  // Sidebar container - fixed width on desktop
  sidebar: 'flex-shrink-0 w-64 xl:w-72 h-full',

  // Mobile full width
  mobile: 'w-full max-w-full',

  // Full container
  full: 'w-full h-full',
} as const;

export function SettingsContainer({
  children,
  className = '',
  maxWidth,
  variant = 'content',
}: SettingsContainerProps) {
  // Build classes based on variant and optional maxWidth override
  const baseClasses = VARIANT_CLASSES[variant];
  const widthOverride = maxWidth ? MAX_WIDTH_CLASSES[maxWidth] : '';

  // If maxWidth is provided, replace the max-w class in variant
  const containerClasses = widthOverride
    ? baseClasses.replace(/max-w-\w+/, widthOverride)
    : baseClasses;

  return <div className={`${containerClasses} ${className}`.trim()}>{children}</div>;
}

// Specialized containers for common use cases
export function SettingsContentContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SettingsContainer variant="content" className={className}>
      {children}
    </SettingsContainer>
  );
}

export function SettingsSidebarContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SettingsContainer variant="sidebar" className={className}>
      {children}
    </SettingsContainer>
  );
}

export function SettingsMobileContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SettingsContainer variant="mobile" className={className}>
      {children}
    </SettingsContainer>
  );
}

// Responsive tab container that maintains consistent widths
export function SettingsTabContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-xl ${className}`.trim()}>{children}</div>;
}

// Main layout wrapper that ensures consistent outer boundaries
export function SettingsLayoutContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-7xl ${className}`.trim()}>{children}</div>;
}

// Header-specific container that follows site standards
export function SettingsHeaderContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-3xl ${className}`.trim()}>{children}</div>;
}
