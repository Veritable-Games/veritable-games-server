/**
 * SettingsSection Component
 * Provides consistent card styling for settings page sections
 */

import React from 'react';

interface SettingsSectionProps {
  /** Section title */
  title: string;
  /** Optional section description */
  description?: string;
  /** Optional icon element or icon component */
  icon?: React.ReactNode;
  /** Children components to render inside the section */
  children: React.ReactNode;
  /** Additional CSS classes for customization */
  className?: string;
  /** Optional action buttons or elements to display in the header */
  headerAction?: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
  className = '',
  headerAction,
}: SettingsSectionProps) {
  return (
    <div
      className={`rounded-lg border border-neutral-700 bg-neutral-900/70 p-6 ${className}`.trim()}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {icon && (
              <div className="mt-0.5 text-neutral-400" aria-hidden="true">
                {icon}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
            </div>
          </div>
          {headerAction && <div className="ml-4 flex-shrink-0">{headerAction}</div>}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// Subcomponent for section groups
interface SettingsSectionGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionGroup({ children, className = '' }: SettingsSectionGroupProps) {
  return <div className={`space-y-6 ${className}`.trim()}>{children}</div>;
}

// Subcomponent for section dividers
export function SettingsSectionDivider() {
  return <div className="my-4 border-t border-neutral-700/50" role="separator" />;
}
