import React from 'react';
import { getIconComponent, categoryIconMapping } from '@/lib/icons/iconRegistry';

interface WikiCategoryIconProps {
  /** Icon name from the registry */
  iconName?: string | null;
  /** Category ID for fallback icon lookup */
  categoryId?: string;
  /** Icon size class (default: w-5 h-5) */
  size?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a wiki category icon using the icon registry
 * Supports both database icon names and fallback to category-based icons
 * during the migration from hardcoded to database-driven icons
 */
export default function WikiCategoryIcon({
  iconName,
  categoryId,
  size = 'w-5 h-5',
  className = '',
}: WikiCategoryIconProps) {
  // Try to get icon name from props first, then fallback to category mapping
  let resolvedIconName = iconName;

  if (!resolvedIconName && categoryId && categoryId in categoryIconMapping) {
    resolvedIconName = categoryIconMapping[categoryId as keyof typeof categoryIconMapping];
  }

  // Get the icon component from registry
  const IconComponent = getIconComponent(resolvedIconName || null);

  return <IconComponent className={`${size} ${className}`} aria-hidden="true" />;
}

/**
 * Small variant for use in admin tables and compact displays
 */
export function WikiCategoryIconSmall(props: Omit<WikiCategoryIconProps, 'size'>) {
  return <WikiCategoryIcon {...props} size="w-4 h-4" />;
}

/**
 * Medium variant for use in category displays and cards
 */
export function WikiCategoryIconMedium(props: Omit<WikiCategoryIconProps, 'size'>) {
  return <WikiCategoryIcon {...props} size="w-6 h-6" />;
}

/**
 * Large variant for use in headers and prominent displays
 */
export function WikiCategoryIconLarge(props: Omit<WikiCategoryIconProps, 'size'>) {
  return <WikiCategoryIcon {...props} size="w-8 h-8" />;
}
