/**
 * Form Validation Schemas with Zod
 *
 * Comprehensive validation schemas for all forms in the application.
 * Provides runtime type safety and client/server validation consistency.
 */

import { z } from 'zod';

// Branded types for domain safety
export type UserId = string & { __brand: 'UserId' };
export type Email = string & { __brand: 'Email' };
export type Username = string & { __brand: 'Username' };

// Base validation patterns
// Password pattern allows most printable special characters
// Allowed special chars: !@#$%^&*(),.?":{}|<>-_/\';[]=+~`
const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~])[A-Za-z\d!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~]{12,}$/;
const usernamePattern = /^[a-zA-Z0-9_-]{3,20}$/;
const urlPattern = /^https?:\/\/.+/;

// Reusable field schemas
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must be less than 255 characters')
  .transform((val): Email => val as Email);

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(usernamePattern, 'Username can only contain letters, numbers, underscores, and hyphens')
  .refine(
    val => !['admin', 'root', 'moderator', 'system'].includes(val.toLowerCase()),
    'Username cannot be a reserved word'
  )
  .transform((val): Username => val as Username);

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(
    passwordPattern,
    'Password must contain uppercase, lowercase, number, and special character'
  );

export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(500, 'URL must be less than 500 characters')
  .optional()
  .or(z.literal(''));

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(100, 'Slug must be less than 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
  .refine(
    val => !val.startsWith('-') && !val.endsWith('-'),
    'Slug cannot start or end with a hyphen'
  );

// Authentication schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

// Schema used during form initialization - allows empty strings to prevent validation errors on mount
export const registerSchemaInit = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
  display_name: z.string(),
  invitation_token: z.string(),
  acceptTerms: z.boolean().optional().default(true),
});

// Schema used on form submission - enforces all validation rules
// Force recompile: 2026-02-11T09:20
export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    display_name: z
      .string()
      .min(2, 'Display name must be at least 2 characters')
      .max(50, 'Display name must be less than 50 characters'),
    invitation_token: z
      .string()
      .min(1, 'Invitation token is required')
      .max(100, 'Invalid invitation token'),
    acceptTerms: z.boolean().optional().default(true),
  })
  .refine(data => data.acceptTerms === true, {
    message: 'You must accept the terms and conditions',
    path: ['acceptTerms'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Profile schemas
export const profileSchema = z.object({
  display_name: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be less than 50 characters')
    .optional(),
  bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  website_url: urlSchema,
  github_url: z
    .string()
    .url('Invalid GitHub URL')
    .startsWith('https://github.com/', 'Must be a valid GitHub URL')
    .optional()
    .or(z.literal('')),
  mastodon_url: urlSchema,
  discord_username: z
    .string()
    .regex(/^.{2,32}#\d{4}$/, 'Invalid Discord username format (username#1234)')
    .optional()
    .or(z.literal('')),
  steam_url: z
    .string()
    .url('Invalid Steam URL')
    .startsWith('https://steamcommunity.com/', 'Must be a valid Steam profile URL')
    .optional()
    .or(z.literal('')),
  xbox_gamertag: z.string().max(15, 'Xbox gamertag must be 15 characters or less').optional(),
  psn_id: z.string().max(16, 'PSN ID must be 16 characters or less').optional(),
  bluesky_url: z
    .string()
    .url('Invalid Bluesky URL')
    .startsWith('https://bsky.app/', 'Must be a valid Bluesky profile URL')
    .optional()
    .or(z.literal('')),
  avatar_position_x: z
    .number()
    .min(0, 'Avatar position X must be between 0 and 100')
    .max(100, 'Avatar position X must be between 0 and 100')
    .default(50),
  avatar_position_y: z
    .number()
    .min(0, 'Avatar position Y must be between 0 and 100')
    .max(100, 'Avatar position Y must be between 0 and 100')
    .default(50),
  avatar_scale: z
    .number()
    .min(50, 'Avatar scale must be between 50 and 200')
    .max(200, 'Avatar scale must be between 50 and 200')
    .default(100),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine(data => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

// Forum schemas
export const forumCategorySchema = z.object({
  name: z
    .string()
    .min(3, 'Category name must be at least 3 characters')
    .max(100, 'Category name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  slug: slugSchema,
  display_order: z.number().min(0, 'Display order must be 0 or greater').default(0),
  is_active: z.boolean().default(true),
});

export const newTopicSchema = z.object({
  category_id: z
    .string()
    .min(1, 'Please select a category')
    .transform(val => parseInt(val))
    .refine(val => !isNaN(val), 'Invalid category selection'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be less than 200 characters')
    .refine(
      val => val.trim().length >= 5,
      'Title must contain at least 5 non-whitespace characters'
    ),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be less than 10000 characters'),
  tags: z.array(z.string().min(1).max(50)).max(5, 'Maximum 5 tags allowed').optional().default([]),
  is_pinned: z.boolean().optional().default(false),
});

export const replySchema = z.object({
  content: z
    .string()
    .min(1, 'Reply content is required')
    .max(10000, 'Reply must be less than 10000 characters'),
  parent_id: z.number().optional(),
});

// Wiki schemas
export const wikiPageSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must be less than 255 characters'),
  slug: slugSchema.optional(), // Auto-generated if not provided
  content: z
    .string()
    .min(10, 'Content must be at least 10 characters')
    .max(50000, 'Content must be less than 50000 characters'),
  summary: z.string().max(500, 'Summary must be less than 500 characters').optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  protection_level: z.enum(['none', 'semi', 'full']).default('none'),
  categories: z.array(z.string()).max(10, 'Maximum 10 categories allowed').optional().default([]),
});

export const wikiRevisionSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must be less than 255 characters'),
  content: z
    .string()
    .min(10, 'Content must be at least 10 characters')
    .max(50000, 'Content must be less than 50000 characters'),
  summary: z.string().max(200, 'Edit summary must be less than 200 characters').optional(),
  is_minor: z.boolean().default(false),
});

// Library schemas
export const libraryDocumentSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must be less than 255 characters'),
  slug: slugSchema.optional(), // Auto-generated if not provided
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  tags: z
    .array(z.string().min(1).max(50))
    .max(20, 'Maximum 20 tags allowed')
    .optional()
    .default([]),
  collections: z.array(z.string()).max(10, 'Maximum 10 collections allowed').optional().default([]),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
});

// File upload schemas
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB')
    .refine(file => file.size > 0, 'File cannot be empty'),
});

export const imageUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(file => file.size <= 5 * 1024 * 1024, 'Image size must be less than 5MB')
    .refine(
      file => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
      'Only JPG, PNG, GIF, and WebP images are allowed'
    ),
});

export const avatarUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(file => file.size <= 2 * 1024 * 1024, 'Avatar image must be less than 2MB')
    .refine(
      file => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
      'Only JPG, PNG, GIF, and WebP images are allowed'
    )
    .refine(file => {
      // Basic image dimension check would require loading the image
      // For now, just check file size and type
      return true;
    }, 'Invalid image dimensions'),
});

// Message schemas
export const messageSchema = z.object({
  recipients: z
    .array(z.string().min(1))
    .min(1, 'At least one recipient is required')
    .max(10, 'Maximum 10 recipients allowed'),
  subject: z
    .string()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject must be less than 200 characters')
    .optional(),
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(5000, 'Message must be less than 5000 characters'),
});

// Admin schemas
export const userModerationSchema = z.object({
  user_id: z.number(),
  action: z.enum(['warn', 'suspend', 'ban', 'activate']),
  reason: z
    .string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason must be less than 500 characters'),
  duration: z.number().min(0, 'Duration must be 0 or greater').optional(), // In hours, 0 = permanent
  internal_note: z.string().max(1000, 'Internal note must be less than 1000 characters').optional(),
});

// Search schemas
export const searchSchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(200, 'Search query must be less than 200 characters'),
  category: z.enum(['all', 'topics', 'wiki', 'library', 'users']).default('all'),
  sort: z.enum(['relevance', 'date', 'title']).default('relevance'),
  filters: z
    .object({
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      dateRange: z
        .object({
          start: z.date().optional(),
          end: z.date().optional(),
        })
        .optional(),
    })
    .optional(),
});

// Type exports for use in components
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ForumCategoryFormData = z.infer<typeof forumCategorySchema>;
export type NewTopicFormData = z.infer<typeof newTopicSchema>;
export type ReplyFormData = z.infer<typeof replySchema>;
export type WikiPageFormData = z.infer<typeof wikiPageSchema>;
export type WikiRevisionFormData = z.infer<typeof wikiRevisionSchema>;
export type LibraryDocumentFormData = z.infer<typeof libraryDocumentSchema>;
export type FileUploadFormData = z.infer<typeof fileUploadSchema>;
export type ImageUploadFormData = z.infer<typeof imageUploadSchema>;
export type AvatarUploadFormData = z.infer<typeof avatarUploadSchema>;
export type MessageFormData = z.infer<typeof messageSchema>;
export type UserModerationFormData = z.infer<typeof userModerationSchema>;
export type SearchFormData = z.infer<typeof searchSchema>;
