/**
 * Reusable Form Components
 *
 * Type-safe form components that integrate with React Hook Form and Zod validation.
 * Provides consistent styling and behavior across all forms.
 */

import React, {
  forwardRef,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  useState,
  useEffect,
} from 'react';
import { UseFormReturn, Path, FieldValues, Controller, useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';

// Base input styles
const inputStyles = {
  base: 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  error: 'border-destructive focus-visible:ring-destructive',
  textarea: 'min-h-[80px] resize-vertical',
};

// Validation state types
type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

// Form field wrapper component with enhanced validation feedback
interface FormFieldProps {
  label?: string;
  labelAction?: React.ReactNode;
  error?: string;
  required?: boolean;
  description?: string;
  helperText?: string;
  validationState?: ValidationState;
  showValidationIcon?: boolean;
  children: React.ReactNode;
}

export function FormField({
  label,
  labelAction,
  error,
  required,
  description,
  helperText,
  validationState = 'idle',
  showValidationIcon = true,
  children,
}: FormFieldProps) {
  const fieldId = React.useId();

  const getValidationIcon = () => {
    if (!showValidationIcon || validationState === 'idle') return null;

    switch (validationState) {
      case 'validating':
        return (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="text-muted-foreground h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
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
          </div>
        );
      case 'valid':
        return (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="h-4 w-4 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case 'invalid':
        return (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="text-destructive h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      {label && !labelAction && (
        <div className="flex items-baseline">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
        </div>
      )}
      {labelAction && (
        <div className="flex items-baseline justify-between gap-2 [&_a]:leading-none [&_button]:leading-none">
          {label && (
            <label
              htmlFor={fieldId}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </label>
          )}
          {labelAction}
        </div>
      )}

      <div className="relative">
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: fieldId })
          : children}
        {getValidationIcon()}
      </div>

      {description && !error && !helperText && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
      {helperText && !error && <p className="text-muted-foreground text-xs">{helperText}</p>}

      {error && (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <svg
            className="h-3 w-3 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// Enhanced typed input component with real-time validation
interface TypedInputProps<T extends FieldValues> extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'name' | 'form'
> {
  form?: UseFormReturn<T>;
  name?: Path<T> | string;
  label?: string;
  description?: string;
  helperText?: string;
  showValidationIcon?: boolean;
  validateOnChange?: boolean;
  debounceMs?: number;
  error?: any;
}

export function TypedInput<T extends FieldValues>({
  form,
  name,
  label,
  description,
  helperText,
  showValidationIcon = true,
  validateOnChange = true,
  debounceMs = 300,
  required,
  className,
  error: externalError,
  ...props
}: TypedInputProps<T>) {
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  if (!form || !name) {
    // Return basic input if form or name is not provided
    // IMPORTANT: Pass name back to input - register() provides name and it was destructured
    // Note: externalError is destructured but not used here (it's for the full form version)
    return (
      <FormField
        label={label}
        error={externalError?.message}
        required={required}
        description={description}
        helperText={helperText}
      >
        <input
          name={name}
          required={required}
          className={cn(inputStyles.base, externalError && inputStyles.error, className)}
          {...props}
        />
      </FormField>
    );
  }

  const typedName = name as Path<T>;
  const error = form.formState.errors[typedName]?.message as string | undefined;
  const fieldState = form.getFieldState(typedName, form.formState);
  // Use useWatch for efficient field subscription (doesn't cause parent re-renders)
  const currentValue = useWatch({ control: form.control, name: typedName });

  // Handle real-time validation
  useEffect(() => {
    if (!validateOnChange || !fieldState.isDirty) return;

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Show validating state immediately
    setValidationState('validating');

    // Debounce validation
    const timer = setTimeout(async () => {
      try {
        await form.trigger(typedName);
        const hasError = form.getFieldState(typedName, form.formState).error;
        setValidationState(hasError ? 'invalid' : 'valid');
      } catch (err) {
        setValidationState('invalid');
      }
    }, debounceMs);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentValue, validateOnChange, debounceMs, form, typedName, fieldState.isDirty]);

  // Reset validation state when field is pristine
  useEffect(() => {
    if (!fieldState.isDirty) {
      setValidationState('idle');
    }
  }, [fieldState.isDirty]);

  return (
    <FormField
      label={label}
      error={error}
      required={required}
      description={description}
      helperText={helperText}
      validationState={validationState}
      showValidationIcon={showValidationIcon}
    >
      <input
        {...form.register(typedName)}
        className={cn(
          inputStyles.base,
          error && inputStyles.error,
          validationState === 'valid' && 'border-green-500 focus-visible:ring-green-500',
          showValidationIcon && 'pr-10',
          className
        )}
        {...props}
      />
    </FormField>
  );
}

// Eye icon components for password toggle
const EyeIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
);

// Typed password input with show/hide toggle
interface TypedPasswordInputProps<T extends FieldValues> extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'name' | 'form' | 'type'
> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label?: string;
  labelAction?: React.ReactNode;
  description?: string;
  helperText?: string;
  showValidationIcon?: boolean;
  validateOnChange?: boolean;
  debounceMs?: number;
}

export function TypedPasswordInput<T extends FieldValues>({
  form,
  name,
  label = 'Password',
  labelAction,
  description,
  helperText,
  showValidationIcon = false, // Default false for password - icon space used by eye toggle
  validateOnChange = true,
  debounceMs = 300,
  required,
  className,
  ...props
}: TypedPasswordInputProps<T>) {
  const [showPassword, setShowPassword] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const error = form.formState.errors[name]?.message as string | undefined;
  const fieldState = form.getFieldState(name, form.formState);
  const currentValue = useWatch({ control: form.control, name });

  // Handle real-time validation
  useEffect(() => {
    if (!validateOnChange || !fieldState.isDirty) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    setValidationState('validating');

    const timer = setTimeout(async () => {
      try {
        await form.trigger(name);
        const hasError = form.getFieldState(name, form.formState).error;
        setValidationState(hasError ? 'invalid' : 'valid');
      } catch (err) {
        setValidationState('invalid');
      }
    }, debounceMs);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentValue, validateOnChange, debounceMs, form, name, fieldState.isDirty]);

  useEffect(() => {
    if (!fieldState.isDirty) {
      setValidationState('idle');
    }
  }, [fieldState.isDirty]);

  return (
    <FormField
      label={label}
      labelAction={labelAction}
      error={error}
      required={required}
      description={description}
      helperText={helperText}
      validationState={showValidationIcon ? validationState : 'idle'}
      showValidationIcon={showValidationIcon}
    >
      <div className="relative">
        <input
          {...form.register(name)}
          type={showPassword ? 'text' : 'password'}
          autoComplete={props.autoComplete || 'current-password'}
          className={cn(
            inputStyles.base,
            error && inputStyles.error,
            validationState === 'valid' &&
              !error &&
              'border-green-500 focus-visible:ring-green-500',
            'pr-10', // Space for eye toggle
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="text-muted-foreground absolute inset-y-0 right-0 flex items-center px-3 transition-colors hover:text-foreground"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </FormField>
  );
}

// Enhanced typed textarea component with real-time validation
interface TypedTextareaProps<T extends FieldValues> extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'name' | 'form'
> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label?: string;
  description?: string;
  helperText?: string;
  showValidationIcon?: boolean;
  validateOnChange?: boolean;
  debounceMs?: number;
  showCharacterCount?: boolean;
  maxLength?: number;
}

export function TypedTextarea<T extends FieldValues>({
  form,
  name,
  label,
  description,
  helperText,
  showValidationIcon = true,
  validateOnChange = true,
  debounceMs = 500, // Longer debounce for textarea
  showCharacterCount = false,
  maxLength,
  required,
  className,
  ...props
}: TypedTextareaProps<T>) {
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const error = form.formState.errors[name]?.message as string | undefined;
  const fieldState = form.getFieldState(name, form.formState);
  const currentValue = form.watch(name) || '';

  // Handle real-time validation
  useEffect(() => {
    if (!validateOnChange || !fieldState.isDirty) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    setValidationState('validating');

    const timer = setTimeout(async () => {
      try {
        await form.trigger(name);
        const hasError = form.getFieldState(name, form.formState).error;
        setValidationState(hasError ? 'invalid' : 'valid');
      } catch (err) {
        setValidationState('invalid');
      }
    }, debounceMs);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentValue, validateOnChange, debounceMs, form, name, fieldState.isDirty]);

  useEffect(() => {
    if (!fieldState.isDirty) {
      setValidationState('idle');
    }
  }, [fieldState.isDirty]);

  // Character count helper text
  const getCharacterCountText = () => {
    if (!showCharacterCount) return helperText;

    const count = (currentValue as string).length;
    const countText = maxLength ? `${count}/${maxLength}` : `${count} characters`;

    if (helperText) {
      return `${helperText} • ${countText}`;
    }
    return countText;
  };

  return (
    <FormField
      label={label}
      error={error}
      required={required}
      description={description}
      helperText={getCharacterCountText()}
      validationState={validationState}
      showValidationIcon={showValidationIcon}
    >
      <textarea
        {...form.register(name)}
        maxLength={maxLength}
        className={cn(
          inputStyles.base,
          inputStyles.textarea,
          error && inputStyles.error,
          validationState === 'valid' && 'border-green-500 focus-visible:ring-green-500',
          showValidationIcon && 'pr-10',
          className
        )}
        {...props}
      />
    </FormField>
  );
}

// Typed select component
interface TypedSelectProps<T extends FieldValues> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'name' | 'form'
> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label?: string;
  description?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export function TypedSelect<T extends FieldValues>({
  form,
  name,
  label,
  description,
  required,
  className,
  options,
  placeholder,
  ...props
}: TypedSelectProps<T>) {
  const error = form.formState.errors[name]?.message as string | undefined;

  return (
    <FormField label={label} error={error} required={required} description={description}>
      <select
        {...form.register(name)}
        className={cn(inputStyles.base, error && inputStyles.error, className)}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(({ value, label, disabled }) => (
          <option key={value} value={value} disabled={disabled}>
            {label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

// Typed checkbox component
interface TypedCheckboxProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label?: string;
  description?: string;
  className?: string;
}

export function TypedCheckbox<T extends FieldValues>({
  form,
  name,
  label,
  description,
  className,
}: TypedCheckboxProps<T>) {
  const error = form.formState.errors[name]?.message as string | undefined;

  return (
    <FormField error={error} description={description}>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          {...form.register(name)}
          className={cn(
            'border-input text-primary focus:ring-ring h-4 w-4 rounded border focus:ring-2 focus:ring-offset-2',
            error && 'border-destructive',
            className
          )}
        />
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}
      </div>
    </FormField>
  );
}

// Form error message component
interface FormMessageProps {
  error?: string;
  warning?: string;
  info?: string;
  success?: string;
}

export function FormMessage({ error, warning, info, success }: FormMessageProps) {
  if (!error && !warning && !info && !success) return null;

  if (error) {
    return (
      <p className="text-destructive mt-2 flex items-center gap-1 text-xs">
        <svg
          className="h-3 w-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {error}
      </p>
    );
  }

  if (warning) {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-500">
        <svg
          className="h-3 w-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {warning}
      </p>
    );
  }

  if (info) {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-500">
        <svg
          className="h-3 w-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {info}
      </p>
    );
  }

  if (success) {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-500">
        <svg
          className="h-3 w-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {success}
      </p>
    );
  }

  return null;
}

// Submit button with loading state
interface FormSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
}

export function FormSubmit({
  isLoading = false,
  loadingText = 'Submitting...',
  children = 'Submit',
  disabled,
  className,
  ...props
}: FormSubmitProps) {
  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      className={cn(
        'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="-ml-1 mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
