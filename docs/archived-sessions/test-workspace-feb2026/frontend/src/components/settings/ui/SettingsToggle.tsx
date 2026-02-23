/**
 * SettingsToggle Component
 * A switch/toggle component for boolean settings with accessibility
 */

import React, { forwardRef } from 'react';

interface SettingsToggleProps {
  /** Label for the toggle */
  label: string;
  /** Description text below the label */
  description?: string;
  /** Current state of the toggle */
  checked: boolean;
  /** Callback when toggle state changes */
  onChange: (checked: boolean) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Position of the label relative to the toggle */
  labelPosition?: 'left' | 'right' | 'top';
  /** Error message */
  error?: string;
  /** Additional CSS classes */
  className?: string;
  /** Name attribute for form submission */
  name?: string;
  /** Required field */
  required?: boolean;
}

export const SettingsToggle = forwardRef<HTMLInputElement, SettingsToggleProps>(
  (
    {
      label,
      description,
      checked,
      onChange,
      disabled = false,
      size = 'md',
      labelPosition = 'left',
      error,
      className = '',
      name,
      required = false,
    },
    ref
  ) => {
    const toggleId = React.useId();
    const errorId = React.useId();

    // Size configurations with pixel values for inline transform
    const sizeConfig = {
      sm: {
        toggle: 'w-9 h-5',
        dot: 'h-4 w-4',
        translatePx: 16, // translate-x-4 = 1rem = 16px
      },
      md: {
        toggle: 'w-11 h-6',
        dot: 'h-5 w-5',
        translatePx: 20, // 44px track - 20px dot - 4px padding = 20px
      },
      lg: {
        toggle: 'w-14 h-7',
        dot: 'h-6 w-6',
        translatePx: 28, // 56px track - 24px dot - 4px padding = 28px
      },
    };

    const config = sizeConfig[size];

    // Use inline styles for transform to ensure animation works
    const trackClasses = `
      relative ${config.toggle} rounded-full transition-colors duration-300 ease-in-out
      ${checked ? 'bg-neutral-500' : 'bg-neutral-600'}
      ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
    `.trim();

    const dotClasses = `
      ${config.dot} absolute top-0.5 left-0.5 rounded-full bg-white shadow-lg
      transition-transform duration-300 ease-in-out
    `.trim();

    // Use inline style for transform to ensure it works with dynamic values
    const dotStyle: React.CSSProperties = {
      transform: checked ? `translateX(${config.translatePx}px)` : 'translateX(0)',
    };

    const toggleElement = (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={error ? errorId : description ? `${toggleId}-desc` : undefined}
        aria-invalid={error ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative inline-flex flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
      >
        <input
          ref={ref}
          id={toggleId}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          required={required}
          className="sr-only"
          tabIndex={-1}
        />
        <span className={trackClasses}>
          <span className={dotClasses} style={dotStyle} />
        </span>
      </button>
    );

    const labelElement = (
      <div className="flex-1">
        <label
          htmlFor={toggleId}
          className={`cursor-pointer text-sm font-medium text-neutral-300 ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          {label}
          {required && (
            <span className="ml-1 text-red-500" aria-label="required">
              *
            </span>
          )}
        </label>
        {description && (
          <p
            id={`${toggleId}-desc`}
            className={`mt-1 text-xs text-neutral-400 ${disabled ? 'opacity-50' : ''}`}
          >
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" aria-live="polite" className="mt-1 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );

    // Layout based on label position
    if (labelPosition === 'top') {
      return (
        <div className={`space-y-2 ${className}`.trim()}>
          {labelElement}
          {toggleElement}
        </div>
      );
    }

    if (labelPosition === 'right') {
      return (
        <div className={`flex items-start space-x-3 ${className}`.trim()}>
          {toggleElement}
          {labelElement}
        </div>
      );
    }

    // Default: label on left
    return (
      <div className={`flex items-start justify-between py-3 ${className}`.trim()}>
        {labelElement}
        <div className="ml-4 flex-shrink-0">{toggleElement}</div>
      </div>
    );
  }
);

SettingsToggle.displayName = 'SettingsToggle';

// Toggle group for multiple related toggles
export interface ToggleOption {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
}

interface SettingsToggleGroupProps {
  /** Group label */
  label: string;
  /** Group description */
  description?: string;
  /** Array of toggle options */
  options: ToggleOption[];
  /** Callback when any toggle changes */
  onChange: (id: string, checked: boolean) => void;
  /** Show a divider between toggles */
  showDividers?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function SettingsToggleGroup({
  label,
  description,
  options,
  onChange,
  showDividers = true,
  className = '',
}: SettingsToggleGroupProps) {
  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {(label || description) && (
        <div>
          {label && <h4 className="text-sm font-semibold text-neutral-200">{label}</h4>}
          {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
        </div>
      )}

      <div className="space-y-1">
        {options.map((option, index) => (
          <React.Fragment key={option.id}>
            <SettingsToggle
              label={option.label}
              description={option.description}
              checked={option.checked}
              onChange={checked => onChange(option.id, checked)}
              disabled={option.disabled}
              className={
                showDividers && index < options.length - 1 ? 'border-b border-neutral-700/50' : ''
              }
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Compact toggle for inline use
interface SettingsCompactToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label': string;
}

export function SettingsCompactToggle({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: SettingsCompactToggleProps) {
  const trackClasses = `
    relative h-5 w-9 rounded-full transition-colors duration-300 ease-in-out
    ${checked ? 'bg-neutral-500' : 'bg-neutral-600'}
    ${disabled ? 'cursor-not-allowed opacity-50' : ''}
  `.trim();

  const dotClasses =
    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out';

  const dotStyle: React.CSSProperties = {
    transform: checked ? 'translateX(16px)' : 'translateX(0)',
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative inline-flex flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
    >
      <span className={trackClasses}>
        <span className={dotClasses} style={dotStyle} />
      </span>
    </button>
  );
}
