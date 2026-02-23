/**
 * SettingsSelect Component
 * A styled select component for settings pages with dark theme optimization
 */

import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SettingsSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Label for the select element */
  label: string;
  /** Array of options or React option elements */
  options?: SelectOption[];
  /** Error message to display */
  error?: string;
  /** Helper text to display below the select */
  helperText?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to hide the label visually (still accessible to screen readers) */
  hideLabel?: boolean;
  /** Show a placeholder option */
  placeholder?: string;
  /** Required field indicator */
  required?: boolean;
  /** Show required indicator */
  showRequiredIndicator?: boolean;
}

export const SettingsSelect = forwardRef<HTMLSelectElement, SettingsSelectProps>(
  (
    {
      label,
      options,
      error,
      helperText,
      size = 'md',
      hideLabel = false,
      placeholder,
      required = false,
      showRequiredIndicator = true,
      className = '',
      children,
      disabled = false,
      ...props
    },
    ref
  ) => {
    // Generate unique IDs for accessibility
    const selectId = React.useId();
    const errorId = React.useId();
    const helperId = React.useId();

    // Size-specific padding classes
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm pr-8',
      md: 'px-3 py-2 pr-10',
      lg: 'px-4 py-3 text-lg pr-10',
    };

    // Dark theme optimized styles
    const selectClasses = `
      w-full
      bg-gray-800
      border
      ${error ? 'border-red-500' : 'border-gray-600'}
      text-white
      rounded-md
      focus:outline-none
      focus:ring-2
      ${error ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'}
      hover:border-gray-500
      disabled:opacity-50
      disabled:cursor-not-allowed
      disabled:hover:border-gray-600
      transition-all
      duration-200
      appearance-none
      cursor-pointer
      ${sizeClasses[size]}
      ${className}
    `.trim();

    const describedBy = [error && errorId, helperText && helperId].filter(Boolean).join(' ');

    return (
      <div className="space-y-1">
        {/* Label */}
        <label
          htmlFor={selectId}
          className={`block text-sm font-medium text-gray-300 ${hideLabel ? 'sr-only' : ''}`}
        >
          {label}
          {required && showRequiredIndicator && (
            <span className="ml-1 text-red-500" aria-label="required">
              *
            </span>
          )}
        </label>

        {/* Select wrapper for custom arrow */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            disabled={disabled}
            className={selectClasses}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedBy || undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map(option => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))
              : children}
          </select>

          {/* Custom dropdown arrow */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className="h-5 w-5 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Helper Text */}
        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-400">
            {helperText}
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div
            id={errorId}
            role="alert"
            aria-live="polite"
            className="flex items-center gap-1 text-sm text-red-400"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}
      </div>
    );
  }
);

SettingsSelect.displayName = 'SettingsSelect';

// Multi-select variant using checkboxes in a dropdown
interface SettingsMultiSelectProps {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  maxHeight?: string;
}

export function SettingsMultiSelect({
  label,
  options,
  value = [],
  onChange,
  error,
  helperText,
  placeholder = 'Select options...',
  maxHeight = '200px',
}: SettingsMultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const selectedLabels = options
    .filter(opt => value.includes(opt.value))
    .map(opt => opt.label)
    .join(', ');

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-300">{label}</label>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full border bg-gray-800 ${error ? 'border-red-500' : 'border-gray-600'} rounded-md px-3 py-2 pr-10 text-left text-white focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-blue-500'} transition-all duration-200 hover:border-gray-500`.trim()}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={selectedLabels ? '' : 'text-gray-400'}>
            {selectedLabels || placeholder}
          </span>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </button>

        {isOpen && (
          <div
            className="absolute z-10 mt-1 w-full rounded-md border border-gray-600 bg-gray-800 shadow-lg"
            style={{ maxHeight }}
          >
            <div className="overflow-auto py-1" role="listbox">
              {options.map(option => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center px-3 py-2 hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    className="mr-2 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                    disabled={option.disabled}
                  />
                  <span className={option.disabled ? 'text-gray-500' : 'text-white'}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {helperText && !error && <p className="text-sm text-gray-400">{helperText}</p>}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
