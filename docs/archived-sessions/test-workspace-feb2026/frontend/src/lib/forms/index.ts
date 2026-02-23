/**
 * Forms Library Export
 *
 * Centralized export for all form-related utilities, hooks, and components.
 * Provides a clean API for type-safe form handling throughout the application.
 */

// Validation schemas and types
export * from './schemas';

// Custom hooks
export * from './hooks';

// Form components
export * from './components';

// Re-export commonly used react-hook-form utilities
export {
  useForm,
  useFormContext,
  useController,
  useFieldArray,
  Controller,
  FormProvider,
  type UseFormReturn,
  type FieldValues,
  type Path,
  type Control,
} from 'react-hook-form';
