/**
 * Custom Form Hooks with React Hook Form + Zod
 *
 * Type-safe form handling with automatic validation and error management.
 * Provides consistent form state management across the application.
 */

import { useForm, UseFormReturn, FieldValues, Path, DefaultValues } from 'react-hook-form';
import { zodResolver as createZodResolver } from '@hookform/resolvers/zod';
import { z, ZodSchema, ZodError } from 'zod';
import { useCallback, useTransition } from 'react';
import { logger } from '@/lib/utils/logger';
import {
  loginSchema,
  registerSchema,
  profileSchema,
  newTopicSchema,
  wikiPageSchema,
  replySchema,
  libraryDocumentSchema,
  messageSchema,
  searchSchema,
  forgotPasswordSchema,
} from './schemas';

// Generic typed form hook
export function useTypedForm<T extends FieldValues>(
  schema: ZodSchema<T>,
  defaultValues?: Partial<T>,
  options?: {
    mode?: 'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all';
    reValidateMode?: 'onChange' | 'onBlur' | 'onSubmit';
    shouldFocusError?: boolean;
  }
): UseFormReturn<T> & {
  isSubmitting: boolean;
  submitForm: (onSubmit: (data: T) => Promise<void> | void) => (data: T) => Promise<void>;
} {
  const [isSubmitting, startTransition] = useTransition();

  const form = useForm<T>({
    resolver: createZodResolver(schema),
    defaultValues: (defaultValues ?? {}) as DefaultValues<T>,
    mode: options?.mode || 'onChange',
    reValidateMode: options?.reValidateMode || 'onChange',
    shouldFocusError: options?.shouldFocusError ?? true,
  });

  const submitForm = useCallback(
    (onSubmit: (data: T) => Promise<void> | void) => async (data: T) => {
      try {
        const result = onSubmit(data);
        // Check if the result is a promise
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (error) {
        // Handle server-side validation errors
        if (error instanceof ZodError) {
          error.issues.forEach((err: any) => {
            const field = err.path.join('.') as Path<T>;
            form.setError(field, {
              type: 'server',
              message: err.message,
            });
          });
        } else if (error instanceof Error) {
          form.setError('root.serverError', {
            type: 'server',
            message: error.message,
          });
        } else {
          logger.error('Form submission error:', error);
        }
      }
    },
    [form]
  );

  return {
    ...form,
    isSubmitting,
    submitForm,
  };
}

// Specific form hooks for common use cases
export function useLoginForm() {
  return useTypedForm(
    loginSchema,
    {
      username: '',
      password: '',
      rememberMe: false,
    },
    {
      mode: 'onSubmit', // Only validate on submit, not on change
      reValidateMode: 'onChange', // After first submit, revalidate on change
    }
  );
}

export function useForgotPasswordForm() {
  return useTypedForm(
    forgotPasswordSchema,
    {
      email: '' as z.infer<typeof forgotPasswordSchema>['email'],
    },
    {
      mode: 'onSubmit',
      reValidateMode: 'onChange',
    }
  );
}

// Force recompile: 2026-02-11T09:20
export function useRegisterForm() {
  // Use registerSchema directly - validation happens on submit only
  // Cast empty strings to branded types for default values
  return useTypedForm(
    registerSchema,
    {
      username: '' as z.infer<typeof registerSchema>['username'],
      email: '' as z.infer<typeof registerSchema>['email'],
      password: '',
      display_name: '',
      invitation_token: '',
      acceptTerms: false,
    },
    {
      mode: 'onSubmit', // Only validate on submit, not on change
      reValidateMode: 'onChange', // After first submit, revalidate on change
    }
  );
}

export function useProfileForm(initialData?: any) {
  return useTypedForm(profileSchema, {
    display_name: initialData?.display_name || '',
    bio: initialData?.bio || '',
    location: initialData?.location || '',
    website_url: initialData?.website_url || '',
    github_url: initialData?.github_url || '',
    mastodon_url: initialData?.mastodon_url || '',
    discord_username: initialData?.discord_username || '',
    steam_url: initialData?.steam_url || '',
    xbox_gamertag: initialData?.xbox_gamertag || '',
    psn_id: initialData?.psn_id || '',
    bluesky_url: initialData?.bluesky_url || '',
    avatar_position_x: initialData?.avatar_position_x || 50,
    avatar_position_y: initialData?.avatar_position_y || 50,
    avatar_scale: initialData?.avatar_scale || 100,
  });
}

export function useProfileSettingsForm(options?: { defaultValues?: any }) {
  return useTypedForm(
    profileSchema,
    options?.defaultValues || {
      display_name: '',
      bio: '',
      location: '',
      website_url: '',
      github_url: '',
      mastodon_url: '',
      discord_username: '',
      steam_url: '',
      xbox_gamertag: '',
      psn_id: '',
      bluesky_url: '',
      avatar_url: '',
      avatar_position_x: 50,
      avatar_position_y: 50,
      avatar_scale: 100,
    }
  );
}

export function useTopicForm() {
  return useTypedForm(newTopicSchema, {
    category_id: 0,
    title: '',
    content: '',
    tags: [],
    is_pinned: false,
  });
}

export function useNewTopicForm() {
  return useTypedForm(newTopicSchema, {
    category_id: 0, // Changed from string to number
    title: '',
    content: '',
    tags: [],
    is_pinned: false,
  });
}

export function useReplyForm() {
  return useTypedForm(replySchema, {
    content: '',
  });
}

export function useWikiPageForm(initialData?: any) {
  return useTypedForm(wikiPageSchema, {
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    content: initialData?.content || '',
    summary: initialData?.summary || '',
    status: initialData?.status || 'published',
    protection_level: initialData?.protection_level || 'none',
    categories: initialData?.categories || [],
  });
}

export function useLibraryDocumentForm(initialData?: any) {
  return useTypedForm(libraryDocumentSchema, {
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    tags: initialData?.tags || [],
    collections: initialData?.collections || [],
    status: initialData?.status || 'published',
  });
}

export function useMessageForm() {
  return useTypedForm(messageSchema, {
    recipients: [],
    subject: '',
    content: '',
  });
}

export function useSearchForm() {
  return useTypedForm(searchSchema, {
    query: '',
    category: 'all',
    sort: 'relevance',
  });
}

// Form field error helper
export function getFieldError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: Path<T>
): string | undefined {
  const error = form.formState.errors[fieldName];
  return error?.message as string | undefined;
}

// Form dirty state helper
export function getFormDirtyFields<T extends FieldValues>(form: UseFormReturn<T>): Partial<T> {
  const dirtyFields = form.formState.dirtyFields;
  const values = form.getValues();

  return Object.keys(dirtyFields).reduce((acc, key) => {
    if (dirtyFields[key as keyof typeof dirtyFields]) {
      acc[key as keyof T] = values[key as keyof T];
    }
    return acc;
  }, {} as Partial<T>);
}

// Form reset with confirmation helper
export function useFormResetConfirmation<T extends FieldValues>(form: UseFormReturn<T>) {
  const resetWithConfirmation = useCallback(() => {
    if (form.formState.isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to reset the form?')) {
        form.reset();
      }
    } else {
      form.reset();
    }
  }, [form]);

  return resetWithConfirmation;
}
