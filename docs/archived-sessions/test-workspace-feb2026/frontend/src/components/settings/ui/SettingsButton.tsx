/**
 * SettingsButton Component
 * Standardized button component for settings pages
 */

import React, { forwardRef } from 'react';

interface SettingsButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  /** Button size */
  buttonSize?: 'sm' | 'md' | 'lg';
  /** Loading state */
  isLoading?: boolean;
  /** Loading text to display */
  loadingText?: string;
  /** Icon to display before text */
  leftIcon?: React.ReactNode;
  /** Icon to display after text */
  rightIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const SettingsButton = forwardRef<HTMLButtonElement, SettingsButtonProps>(
  (
    {
      variant = 'primary',
      buttonSize = 'md',
      isLoading = false,
      loadingText = 'Loading...',
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    // Variant styles - matching site standard from forums
    const variantStyles = {
      primary: `
        text-neutral-300
        hover:text-white
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-neutral-500/50
        hover:border-neutral-400/70
        disabled:bg-neutral-800/20
        disabled:text-neutral-300/50
        disabled:border-neutral-500/25
      `,
      secondary: `
        text-neutral-300
        hover:text-white
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-neutral-500/50
        hover:border-neutral-400/70
        disabled:bg-neutral-800/20
        disabled:text-neutral-300/50
        disabled:border-neutral-500/25
      `,
      danger: `
        text-red-400
        hover:text-red-300
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-red-500/50
        hover:border-red-400/70
        disabled:bg-neutral-800/20
        disabled:text-red-400/50
        disabled:border-red-500/25
      `,
      ghost: `
        bg-transparent
        text-neutral-300
        hover:text-white
        hover:bg-neutral-800/40
        border
        border-transparent
        hover:border-neutral-500/50
        disabled:text-neutral-600
        disabled:hover:bg-transparent
        disabled:hover:border-transparent
      `,
      success: `
        text-green-400
        hover:text-green-300
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-green-500/50
        hover:border-green-400/70
        disabled:bg-neutral-800/20
        disabled:text-green-400/50
        disabled:border-green-500/25
      `,
    };

    // Size styles - matching forums compact style
    const sizeStyles = {
      sm: 'px-2 h-6 text-xs',
      md: 'px-3 h-8 text-sm',
      lg: 'px-4 h-10 text-base',
    };

    // Combine all styles
    const buttonClasses = `
      inline-flex
      items-center
      justify-center
      font-medium
      rounded
      transition-colors
      focus:outline-none
      disabled:cursor-not-allowed
      ${variantStyles[variant]}
      ${sizeStyles[buttonSize]}
      ${fullWidth ? 'w-full' : ''}
      ${className}
    `.trim();

    // Loading spinner component
    const LoadingSpinner = () => (
      <svg
        className="-ml-1 mr-2 h-4 w-4 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={buttonClasses}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && <LoadingSpinner />}
        {!isLoading && leftIcon && (
          <span className="-ml-0.5 mr-2" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {isLoading ? loadingText : children}
        {!isLoading && rightIcon && (
          <span className="-mr-0.5 ml-2" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

SettingsButton.displayName = 'SettingsButton';

// Button group component for related actions
interface SettingsButtonGroupProps {
  children: React.ReactNode;
  /** Alignment of buttons */
  align?: 'left' | 'center' | 'right' | 'between';
  /** Spacing between buttons */
  spacing?: 'sm' | 'md' | 'lg';
  /** Stack buttons on mobile */
  stackOnMobile?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function SettingsButtonGroup({
  children,
  align = 'left',
  spacing = 'md',
  stackOnMobile = false,
  className = '',
}: SettingsButtonGroupProps) {
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  const spacingClasses = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
  };

  return (
    <div
      className={`flex ${stackOnMobile ? 'flex-col sm:flex-row' : 'flex-row'} ${alignmentClasses[align]} ${spacingClasses[spacing]} ${className} `.trim()}
    >
      {children}
    </div>
  );
}

// Icon button variant for compact actions
interface SettingsIconButtonProps extends Omit<
  SettingsButtonProps,
  'leftIcon' | 'rightIcon' | 'fullWidth'
> {
  /** Accessible label for the icon button */
  'aria-label': string;
  /** Icon to display */
  icon: React.ReactNode;
  /** Whether to show a tooltip */
  tooltip?: string;
}

export const SettingsIconButton = forwardRef<HTMLButtonElement, SettingsIconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      icon,
      tooltip,
      buttonSize = 'md',
      variant = 'ghost',
      className = '',
      ...props
    },
    ref
  ) => {
    // Size-specific padding for square buttons
    const sizeStyles = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3',
    };

    // Variant styles - matching site standard from forums
    const variantStyles = {
      primary: `
        text-neutral-300
        hover:text-white
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-neutral-500/50
        hover:border-neutral-400/70
        disabled:bg-neutral-800/20
        disabled:text-neutral-300/50
        disabled:border-neutral-500/25
      `,
      secondary: `
        text-neutral-300
        hover:text-white
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-neutral-500/50
        hover:border-neutral-400/70
        disabled:bg-neutral-800/20
        disabled:text-neutral-300/50
        disabled:border-neutral-500/25
      `,
      danger: `
        text-red-400
        hover:text-red-300
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-red-500/50
        hover:border-red-400/70
        disabled:bg-neutral-800/20
        disabled:text-red-400/50
        disabled:border-red-500/25
      `,
      ghost: `
        bg-transparent
        text-neutral-300
        hover:text-white
        hover:bg-neutral-800/40
        border
        border-transparent
        hover:border-neutral-500/50
        disabled:text-neutral-600
        disabled:hover:bg-transparent
        disabled:hover:border-transparent
      `,
      success: `
        text-green-400
        hover:text-green-300
        bg-neutral-800/40
        hover:bg-neutral-700/60
        border
        border-green-500/50
        hover:border-green-400/70
        disabled:bg-neutral-800/20
        disabled:text-green-400/50
        disabled:border-green-500/25
      `,
    };

    const buttonClasses = `
      inline-flex
      items-center
      justify-center
      rounded
      transition-colors
      disabled:cursor-not-allowed
      ${variantStyles[variant]}
      ${sizeStyles[buttonSize]}
      ${className}
    `.trim();

    const button = (
      <button ref={ref} className={buttonClasses} aria-label={ariaLabel} {...props}>
        {icon}
      </button>
    );

    // If tooltip is provided, wrap in a tooltip container
    if (tooltip) {
      return (
        <div className="group relative">
          {button}
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            {tooltip}
          </div>
        </div>
      );
    }

    return button;
  }
);

SettingsIconButton.displayName = 'SettingsIconButton';

// Save button with common states
interface SettingsSaveButtonProps extends Omit<SettingsButtonProps, 'variant' | 'leftIcon'> {
  /** Save state */
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  /** Custom text for each state */
  text?: {
    idle?: string;
    saving?: string;
    saved?: string;
    error?: string;
  };
}

export function SettingsSaveButton({
  saveState = 'idle',
  text = {},
  className = '',
  ...props
}: SettingsSaveButtonProps) {
  const defaultText = {
    idle: 'Save Settings',
    saving: 'Saving...',
    saved: 'Saved!',
    error: 'Save Failed',
  };

  const buttonText = {
    idle: text.idle || defaultText.idle,
    saving: text.saving || defaultText.saving,
    saved: text.saved || defaultText.saved,
    error: text.error || defaultText.error,
  };

  const getIcon = () => {
    switch (saveState) {
      case 'saved':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <SettingsButton
      variant={saveState === 'error' ? 'danger' : saveState === 'saved' ? 'secondary' : 'primary'}
      isLoading={saveState === 'saving'}
      leftIcon={getIcon()}
      className={className}
      {...props}
    >
      {buttonText[saveState]}
    </SettingsButton>
  );
}
