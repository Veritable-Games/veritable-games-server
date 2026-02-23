import { z } from 'zod';

// User validation schemas
export const userSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain at least one number'),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters')
    .optional(),
  bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
  role: z.enum(['user', 'moderator', 'admin']).default('user'),
  status: z.enum(['active', 'banned', 'suspended', 'pending']).default('active'),
});

export const registerSchema = z.object({
  username: userSchema.shape.username,
  email: userSchema.shape.email,
  password: userSchema.shape.password,
  display_name: userSchema.shape.display_name,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  username: userSchema.shape.username.optional(),
  email: userSchema.shape.email.optional(),
  display_name: userSchema.shape.display_name,
  bio: userSchema.shape.bio,
  avatar_url: userSchema.shape.avatar_url,
  role: userSchema.shape.role.optional(),
  status: userSchema.shape.status.optional(),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: userSchema.shape.password,
    confirm_password: z.string().min(1, 'Password confirmation is required'),
  })
  .refine(data => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

// Wiki validation schemas
export const wikiPageSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(255, 'Slug must be less than 255 characters')
    .regex(
      /^[a-z0-9-_/]+$/,
      'Slug can only contain lowercase letters, numbers, hyphens, underscores, and forward slashes'
    ),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(100000, 'Content must be less than 100,000 characters'),
  namespace: z
    .string()
    .max(50, 'Namespace must be less than 50 characters')
    .default('main')
    .optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  protection_level: z.enum(['none', 'semi', 'full']).default('none'),
  summary: z.string().max(500, 'Summary must be less than 500 characters').optional(),
  content_format: z.enum(['markdown', 'html', 'plain']).default('markdown'),
  is_minor: z.boolean().default(false).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10, 'Maximum 10 tags allowed').optional(),
  categories: z.array(z.string().min(1).max(50)).max(5, 'Maximum 5 categories allowed').optional(),
});

export const createWikiPageSchema = z.object({
  slug: wikiPageSchema.shape.slug,
  title: wikiPageSchema.shape.title,
  content: wikiPageSchema.shape.content,
  namespace: wikiPageSchema.shape.namespace,
  status: wikiPageSchema.shape.status,
  protection_level: wikiPageSchema.shape.protection_level,
  summary: wikiPageSchema.shape.summary,
  content_format: wikiPageSchema.shape.content_format,
  tags: wikiPageSchema.shape.tags,
  categories: wikiPageSchema.shape.categories,
});

export const updateWikiPageSchema = z.object({
  title: wikiPageSchema.shape.title.optional(),
  content: wikiPageSchema.shape.content.optional(),
  status: wikiPageSchema.shape.status.optional(),
  protection_level: wikiPageSchema.shape.protection_level.optional(),
  summary: wikiPageSchema.shape.summary,
  content_format: wikiPageSchema.shape.content_format.optional(),
  is_minor: wikiPageSchema.shape.is_minor,
  tags: wikiPageSchema.shape.tags,
  categories: wikiPageSchema.shape.categories,
});

export const wikiCategorySchema = z.object({
  id: z
    .string()
    .min(1, 'Category ID is required')
    .max(100, 'Category ID must be less than 100 characters')
    .regex(
      /^[a-z0-9-_]+$/,
      'Category ID can only contain lowercase letters, numbers, hyphens, and underscores'
    ),
  parent_id: z.string().max(100, 'Parent ID must be less than 100 characters').optional(),
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color code')
    .default('#6B7280'),
  icon: z.string().max(50, 'Icon must be less than 50 characters').optional(),
  sort_order: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .default(0),
});

// Forum validation schemas
export const forumTopicSchema = z.object({
  category_id: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category ID must be less than 100 characters'),
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be less than 200 characters'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be less than 50,000 characters'),
  status: z.enum(['open', 'closed', 'pinned', 'locked']).default('open'),
  is_sticky: z.boolean().default(false).optional(),
});

export const createTopicSchema = z.object({
  category_id: forumTopicSchema.shape.category_id,
  title: forumTopicSchema.shape.title,
  content: forumTopicSchema.shape.content,
  status: forumTopicSchema.shape.status,
  is_sticky: forumTopicSchema.shape.is_sticky,
});

export const updateTopicSchema = z.object({
  title: forumTopicSchema.shape.title.optional(),
  content: forumTopicSchema.shape.content.optional(),
  status: forumTopicSchema.shape.status.optional(),
  is_sticky: forumTopicSchema.shape.is_sticky,
});

export const forumReplySchema = z.object({
  topic_id: z.number().int('Topic ID must be an integer').positive('Topic ID must be positive'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be less than 10,000 characters'),
  parent_id: z
    .number()
    .int('Parent ID must be an integer')
    .positive('Parent ID must be positive')
    .optional(),
  is_solution: z.boolean().default(false).optional(),
});

export const createReplySchema = z.object({
  topic_id: forumReplySchema.shape.topic_id,
  content: forumReplySchema.shape.content,
  parent_id: forumReplySchema.shape.parent_id,
  is_solution: forumReplySchema.shape.is_solution,
});

export const updateReplySchema = z.object({
  content: forumReplySchema.shape.content.optional(),
  is_solution: forumReplySchema.shape.is_solution,
});

export const forumCategorySchema = z.object({
  id: z
    .string()
    .min(1, 'Category ID is required')
    .max(50, 'Category ID must be less than 50 characters')
    .regex(
      /^[a-z0-9-_]+$/,
      'Category ID can only contain lowercase letters, numbers, hyphens, and underscores'
    ),
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color code')
    .default('#6B7280'),
  icon: z.string().max(50, 'Icon must be less than 50 characters').optional(),
  sort_order: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .default(0),
});

// Search validation schemas
export const searchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(200, 'Search query must be less than 200 characters'),
  category_id: z.string().max(100).optional(),
  user_id: z.number().int().positive().optional(),
  status: z.string().max(20).optional(),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
  offset: z
    .number()
    .int('Offset must be an integer')
    .min(0, 'Offset must be non-negative')
    .default(0),
  sort: z
    .enum(['recent', 'popular', 'oldest', 'replies', 'alphabetical', 'activity'])
    .default('recent'),
});

export const paginationSchema = z.object({
  page: z.number().int('Page must be an integer').min(1, 'Page must be at least 1').default(1),
  per_page: z
    .number()
    .int('Per page must be an integer')
    .min(1, 'Per page must be at least 1')
    .max(100, 'Per page cannot exceed 100')
    .default(20),
  sort: searchSchema.shape.sort,
});

// API parameter validation schemas
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a valid number').transform(Number),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(255, 'Slug too long'),
});

export const usernameParamSchema = z.object({
  username: z.string().min(1, 'Username is required').max(30, 'Username too long'),
});

// Content sanitization options
export const sanitizationOptionsSchema = z.object({
  level: z.enum(['minimal', 'safe', 'strict']).default('safe'),
  allow_links: z.boolean().default(true),
  allow_images: z.boolean().default(true),
  allow_code_blocks: z.boolean().default(true),
  max_length: z.number().int().positive().optional(),
});

// Utility validation functions
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors: Record<string, string> = {};

    result.error.issues.forEach((issue: z.ZodIssue) => {
      const path = issue.path.join('.');
      errors[path] = issue.message;
    });

    return { success: false, errors };
  }
}

export function validateAndThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = validateInput(schema, input);

  if (!result.success) {
    const errorMessage = Object.entries(
      (result as { success: false; errors: Record<string, string> }).errors
    )
      .map(([field, message]) => `${field}: ${message}`)
      .join(', ');
    throw new Error(`Validation error: ${errorMessage}`);
  }

  return result.data;
}

// Type exports for convenience
export type UserInput = z.infer<typeof userSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type WikiPageInput = z.infer<typeof wikiPageSchema>;
export type CreateWikiPageInput = z.infer<typeof createWikiPageSchema>;
export type UpdateWikiPageInput = z.infer<typeof updateWikiPageSchema>;
export type WikiCategoryInput = z.infer<typeof wikiCategorySchema>;

export type ForumTopicInput = z.infer<typeof forumTopicSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type ForumReplyInput = z.infer<typeof forumReplySchema>;
export type CreateReplyInput = z.infer<typeof createReplySchema>;
export type UpdateReplyInput = z.infer<typeof updateReplySchema>;
export type ForumCategoryInput = z.infer<typeof forumCategorySchema>;

export type SearchInput = z.infer<typeof searchSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SanitizationOptionsInput = z.infer<typeof sanitizationOptionsSchema>;
