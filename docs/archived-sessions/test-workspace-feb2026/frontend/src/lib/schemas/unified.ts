/**
 * Unified Schema Architecture
 *
 * Comprehensive, consistent Zod schemas that integrate with branded types
 * and provide runtime validation with TypeScript type safety.
 */

import { z } from 'zod';
import {
  UserId,
  Username,
  Email,
  Slug,
  ProjectSlug,
  HttpUrl,
  MarkdownContent,
  DatabaseId,
  isEmail,
  isUsername,
  isSlug,
  isHttpUrl,
} from '@/types/branded';

// Base validation patterns with enhanced security
const PATTERNS = {
  PASSWORD:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{12,128}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([0-9A-Fa-f]{3}){1,2}$/,
  DISCORD_TAG: /^.{2,32}#\d{4}$/,
  GITHUB_USERNAME: /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/,
} as const;

// Reserved words to prevent conflicts
const RESERVED_WORDS: readonly string[] = [
  'admin',
  'administrator',
  'root',
  'system',
  'api',
  'www',
  'mail',
  'ftp',
  'moderator',
  'support',
  'help',
  'null',
  'undefined',
  'true',
  'false',
  'anonymous',
  'guest',
  'user',
  'users',
  'test',
  'demo',
];

// Branded type schemas with enhanced validation
export const userIdSchema = z
  .string()
  .min(1, 'User ID is required')
  .max(50, 'User ID too long')
  .refine((val): val is UserId => val.length > 0, 'Invalid user ID')
  .transform((val): UserId => val as UserId);

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(PATTERNS.USERNAME, 'Username can only contain letters, numbers, underscores, and hyphens')
  .refine(
    val => !RESERVED_WORDS.includes(val.toLowerCase()),
    'Username is reserved and cannot be used'
  )
  .refine(
    val => !val.match(/^[_-]|[_-]$/),
    'Username cannot start or end with underscore or hyphen'
  )
  .refine(isUsername, 'Invalid username format')
  .transform((val): Username => val as Username);

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(254, 'Email address too long') // RFC 5321 limit
  .email('Invalid email address')
  .refine(
    val => !val.includes('..'), // Prevent consecutive dots
    'Email contains consecutive dots'
  )
  .refine(isEmail, 'Invalid email format')
  .transform((val): Email => val.toLowerCase() as Email);

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(100, 'Slug must be less than 100 characters')
  .regex(PATTERNS.SLUG, 'Slug can only contain lowercase letters, numbers, and hyphens')
  .refine(val => !RESERVED_WORDS.includes(val.toLowerCase()), 'Slug is reserved and cannot be used')
  .refine(isSlug, 'Invalid slug format')
  .transform((val): Slug => val as Slug);

export const projectSlugSchema = slugSchema.transform(
  (val): ProjectSlug => val as unknown as ProjectSlug
);

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(
    PATTERNS.PASSWORD,
    'Password must contain uppercase, lowercase, number, and special character'
  );

export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL too long')
  .refine(isHttpUrl, 'Must be a valid HTTP/HTTPS URL')
  .transform((val): HttpUrl => val as HttpUrl)
  .optional()
  .or(z.literal(''));

// Enhanced content schemas
export const markdownContentSchema = z
  .string()
  .min(1, 'Content is required')
  .max(100000, 'Content too long')
  .refine(val => val.trim().length > 0, 'Content cannot be empty or only whitespace')
  .transform((val): MarkdownContent => val.trim() as MarkdownContent);

export const shortTextSchema = z
  .string()
  .min(1, 'Text is required')
  .max(255, 'Text too long')
  .refine(val => val.trim().length > 0, 'Text cannot be empty or only whitespace')
  .transform(val => val.trim());

export const longTextSchema = z
  .string()
  .max(2000, 'Text too long')
  .optional()
  .transform(val => val?.trim() || undefined);

// Enhanced authentication schemas
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required').max(254, 'Identifier too long'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: z
      .string()
      .min(2, 'Display name must be at least 2 characters')
      .max(50, 'Display name must be less than 50 characters')
      .refine(
        val => val.trim().length >= 2,
        'Display name must contain at least 2 non-whitespace characters'
      )
      .transform(val => val.trim()),
    acceptTerms: z.boolean().refine(val => val === true, {
      message: 'You must accept the terms of service',
    }),
    acceptPrivacy: z.boolean().refine(val => val === true, {
      message: 'You must accept the privacy policy',
    }),
    captchaToken: z.string().optional(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine(data => data.password !== data.username, {
    message: 'Password cannot be the same as username',
    path: ['password'],
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

// Enhanced profile schema
export const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be less than 50 characters')
    .transform(val => val.trim())
    .optional(),
  bio: z
    .string()
    .max(1000, 'Bio must be less than 1000 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  location: z
    .string()
    .max(100, 'Location must be less than 100 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  websiteUrl: urlSchema,
  githubUrl: z
    .string()
    .url('Invalid GitHub URL')
    .startsWith('https://github.com/', 'Must be a valid GitHub profile URL')
    .refine(val => {
      const username = val.replace('https://github.com/', '');
      return PATTERNS.GITHUB_USERNAME.test(username);
    }, 'Invalid GitHub username')
    .optional()
    .or(z.literal('')),
  mastodonUrl: urlSchema,
  discordUsername: z
    .string()
    .regex(PATTERNS.DISCORD_TAG, 'Invalid Discord username format (username#1234)')
    .optional()
    .or(z.literal('')),
  steamUrl: z
    .string()
    .url('Invalid Steam URL')
    .startsWith('https://steamcommunity.com/', 'Must be a valid Steam profile URL')
    .optional()
    .or(z.literal('')),
  xboxGamertag: z.string().max(15, 'Xbox gamertag must be 15 characters or less').optional(),
  psnId: z.string().max(16, 'PSN ID must be 16 characters or less').optional(),
  blueskyUrl: z
    .string()
    .url('Invalid Bluesky URL')
    .startsWith('https://bsky.app/', 'Must be a valid Bluesky profile URL')
    .optional()
    .or(z.literal('')),
  avatarPositionX: z
    .number()
    .min(0, 'Avatar position X must be between 0 and 100')
    .max(100, 'Avatar position X must be between 0 and 100')
    .default(50),
  avatarPositionY: z
    .number()
    .min(0, 'Avatar position Y must be between 0 and 100')
    .max(100, 'Avatar position Y must be between 0 and 100')
    .default(50),
  avatarScale: z
    .number()
    .min(50, 'Avatar scale must be between 50 and 200')
    .max(200, 'Avatar scale must be between 50 and 200')
    .default(100),
});

// Enhanced forum schemas
export const forumCategorySchema = z.object({
  name: shortTextSchema,
  description: longTextSchema,
  slug: slugSchema,
  color: z
    .string()
    .regex(PATTERNS.HEX_COLOR, 'Color must be a valid hex color code')
    .default('#6B7280'),
  icon: z.string().max(50, 'Icon must be less than 50 characters').optional(),
  displayOrder: z
    .number()
    .int('Display order must be an integer')
    .min(0, 'Display order must be non-negative')
    .default(0),
  isActive: z.boolean().default(true),
  permissions: z
    .object({
      canView: z.array(z.string()).default(['all']),
      canPost: z.array(z.string()).default(['user', 'moderator', 'admin']),
      canModerate: z.array(z.string()).default(['moderator', 'admin']),
    })
    .default(() => ({
      canView: ['all'],
      canPost: ['user', 'moderator', 'admin'],
      canModerate: ['moderator', 'admin'],
    })),
});

export const newTopicSchema = z.object({
  categoryId: z
    .string()
    .min(1, 'Please select a category')
    .transform(val => parseInt(val))
    .refine(val => !isNaN(val) && val > 0, 'Invalid category selection'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be less than 200 characters')
    .refine(
      val => val.trim().length >= 5,
      'Title must contain at least 5 non-whitespace characters'
    )
    .transform(val => val.trim()),
  content: markdownContentSchema,
  tags: z
    .array(
      z
        .string()
        .min(1, 'Tag cannot be empty')
        .max(50, 'Tag too long')
        .transform(val => val.trim().toLowerCase())
    )
    .max(5, 'Maximum 5 tags allowed')
    .default([])
    .refine(tags => new Set(tags).size === tags.length, 'Duplicate tags are not allowed'),
  isPinned: z.boolean().default(false),
  isLocked: z.boolean().default(false),
});

export const replySchema = z.object({
  content: z
    .string()
    .min(5, 'Reply must be at least 5 characters')
    .max(10000, 'Reply must be less than 10000 characters')
    .refine(
      val => val.trim().length >= 5,
      'Reply must contain at least 5 non-whitespace characters'
    )
    .transform(val => val.trim()),
  parentId: z
    .number()
    .int('Parent ID must be an integer')
    .positive('Parent ID must be positive')
    .optional(),
  isSolution: z.boolean().default(false),
});

// Enhanced wiki schemas
export const wikiPageSchema = z.object({
  title: shortTextSchema,
  slug: slugSchema.optional(),
  content: markdownContentSchema,
  summary: z
    .string()
    .max(500, 'Summary must be less than 500 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  protectionLevel: z.enum(['none', 'semi', 'full']).default('none'),
  namespace: z
    .string()
    .max(50, 'Namespace must be less than 50 characters')
    .default('main')
    .optional(),
  categories: z
    .array(z.string().min(1).max(50))
    .max(10, 'Maximum 10 categories allowed')
    .default([]),
  tags: z
    .array(z.string().min(1).max(50))
    .max(20, 'Maximum 20 tags allowed')
    .default([])
    .refine(tags => new Set(tags).size === tags.length, 'Duplicate tags are not allowed'),
  contentFormat: z.enum(['markdown', 'html', 'plain']).default('markdown'),
});

export const wikiRevisionSchema = z.object({
  title: shortTextSchema,
  content: markdownContentSchema,
  summary: z
    .string()
    .max(200, 'Edit summary must be less than 200 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  isMinor: z.boolean().default(false),
});

// Enhanced file upload schemas (client-side only)
// These schemas use File constructor which isn't available on server
// They should only be imported and used in client-side code

// Create fallback schemas for server environment
const createFileSchema = () => {
  if (typeof window === 'undefined') {
    // Server environment - return a schema that always fails
    return z.object({
      file: z.any().refine(() => false, 'File upload only available in browser environment'),
    });
  }

  // Client environment - use real File validation
  return z.object({
    file: z
      .instanceof(File)
      .refine(file => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB')
      .refine(file => file.size > 0, 'File cannot be empty')
      .refine(file => file.name.length <= 255, 'Filename must be less than 255 characters'),
  });
};

const createImageSchema = () => {
  if (typeof window === 'undefined') {
    return z.object({
      file: z.any().refine(() => false, 'Image upload only available in browser environment'),
    });
  }

  return z.object({
    file: z
      .instanceof(File)
      .refine(file => file.size <= 5 * 1024 * 1024, 'Image size must be less than 5MB')
      .refine(
        file => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
        'Only JPG, PNG, GIF, and WebP images are allowed'
      )
      .refine(file => file.name.length <= 255, 'Filename must be less than 255 characters'),
  });
};

const createAvatarSchema = () => {
  if (typeof window === 'undefined') {
    return z.object({
      file: z.any().refine(() => false, 'Avatar upload only available in browser environment'),
    });
  }

  return z.object({
    file: z
      .instanceof(File)
      .refine(file => file.size <= 2 * 1024 * 1024, 'Avatar image must be less than 2MB')
      .refine(
        file => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
        'Only JPG, PNG, GIF, and WebP images are allowed'
      ),
  });
};

export const fileUploadSchema = createFileSchema();
export const imageUploadSchema = createImageSchema();
export const avatarUploadSchema = createAvatarSchema();

// Enhanced search schema
export const searchSchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(200, 'Search query must be less than 200 characters')
    .transform(val => val.trim()),
  category: z.enum(['all', 'topics', 'wiki', 'library', 'users', 'projects']).default('all'),
  sort: z.enum(['relevance', 'date', 'title', 'activity']).default('relevance'),
  filters: z
    .object({
      author: usernameSchema.optional(),
      tags: z.array(z.string()).optional(),
      dateRange: z
        .object({
          start: z.coerce.date().optional(),
          end: z.coerce.date().optional(),
        })
        .optional()
        .refine(
          range => !range || !range.start || !range.end || range.start <= range.end,
          'Start date must be before end date'
        ),
      status: z.string().max(20).optional(),
    })
    .optional(),
  pagination: z
    .object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    })
    .default({ page: 1, limit: 20 }),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int('Page must be an integer').min(1, 'Page must be at least 1').default(1),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ForumCategoryInput = z.infer<typeof forumCategorySchema>;
export type NewTopicInput = z.infer<typeof newTopicSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
export type WikiPageInput = z.infer<typeof wikiPageSchema>;
export type WikiRevisionInput = z.infer<typeof wikiRevisionSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type ImageUploadInput = z.infer<typeof imageUploadSchema>;
export type AvatarUploadInput = z.infer<typeof avatarUploadSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

// Enhanced validation utility with better error handling
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options?: { stripUnknown?: boolean }
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  try {
    const parseOptions = options?.stripUnknown ? { stripUnknown: true } : undefined;
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    const errors: Record<string, string[]> = {};

    result.error.issues.forEach(issue => {
      const path = issue.path.join('.') || 'root';
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(issue.message);
    });

    return { success: false, errors };
  } catch (error) {
    return {
      success: false,
      errors: {
        root: [error instanceof Error ? error.message : 'Unknown validation error'],
      },
    };
  }
}

export function validateAndThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validateWithSchema(schema, data);

  if (!result.success) {
    const errorMessages = Object.entries(result.errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');
    throw new Error(`Validation failed: ${errorMessages}`);
  }

  return result.data;
}
