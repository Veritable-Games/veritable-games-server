/**
 * Forum Validation Tests
 *
 * Tests for all validation schemas and helper functions
 */

import { z } from 'zod';
import {
  CreateTopicSchema,
  UpdateTopicSchema,
  CreateReplySchema,
  UpdateReplySchema,
  SearchQuerySchema,
  TopicListQuerySchema,
  validateTopicTitle,
  validateReplyDepth,
  validateTags,
  sanitizeTitle,
  sanitizeContent,
  normalizeTag,
  safeParseRequest,
  validateRequest,
} from '../validation';

describe('Forum Validation Schemas', () => {
  describe('CreateTopicSchema', () => {
    it('should validate a valid topic', () => {
      const validTopic = {
        title: 'Valid Topic Title',
        content: 'This is valid content with more than 10 characters',
        category_id: 1,
        tags: ['javascript', 'typescript'],
      };

      const result = CreateTopicSchema.safeParse(validTopic);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Valid Topic Title');
        // Note: content_format is not part of CreateTopicDTO
      }
    });

    it('should reject topic with short title', () => {
      const invalidTopic = {
        title: 'Ab', // Too short (< 3 chars)
        content: 'Valid content here',
        category_id: 1,
      };

      const result = CreateTopicSchema.safeParse(invalidTopic);
      expect(result.success).toBe(false);
    });

    it('should accept topic with short content', () => {
      // Schema allows minimum 1 character for content
      const validTopic = {
        title: 'Valid Title',
        content: 'Short', // Valid (schema min is 1 char, this is 5)
        category_id: 1,
      };

      const result = CreateTopicSchema.safeParse(validTopic);
      expect(result.success).toBe(true);
    });

    it('should reject topic with empty content', () => {
      // Empty content should still be rejected
      const invalidTopic = {
        title: 'Valid Title',
        content: '', // Invalid (empty string)
        category_id: 1,
      };

      const result = CreateTopicSchema.safeParse(invalidTopic);
      expect(result.success).toBe(false);
    });

    it('should reject topic with too many tags', () => {
      const invalidTopic = {
        title: 'Valid Title',
        content: 'Valid content here',
        category_id: 1,
        tags: Array(11).fill('tag'), // 11 tags (max is 10)
      };

      const result = CreateTopicSchema.safeParse(invalidTopic);
      expect(result.success).toBe(false);
    });

    it('should normalize tags to lowercase', () => {
      const topic = {
        title: 'Valid Title',
        content: 'Valid content here',
        category_id: 1,
        tags: ['JavaScript', 'TypeScript', 'NODE.JS'],
      };

      const result = CreateTopicSchema.safeParse(topic);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(['javascript', 'typescript', 'node.js']);
      }
    });
  });

  describe('UpdateTopicSchema', () => {
    it('should allow partial updates', () => {
      const update = {
        title: 'Updated Title',
      };

      const result = UpdateTopicSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should allow moderation fields', () => {
      const update = {
        is_pinned: true,
        is_locked: true,
        status: 'solved' as const,
      };

      const result = UpdateTopicSchema.safeParse(update);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateReplySchema', () => {
    it('should validate a valid reply', () => {
      const validReply = {
        topic_id: 1,
        content: 'Reply content',
        parent_id: null,
      };

      const result = CreateReplySchema.safeParse(validReply);
      expect(result.success).toBe(true);
    });

    it('should validate nested reply', () => {
      const nestedReply = {
        topic_id: 1,
        content: 'Nested reply',
        parent_id: 5,
      };

      const result = CreateReplySchema.safeParse(nestedReply);
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const invalidReply = {
        topic_id: 1,
        content: '',
      };

      const result = CreateReplySchema.safeParse(invalidReply);
      expect(result.success).toBe(false);
    });
  });

  describe('SearchQuerySchema', () => {
    it('should validate search query', () => {
      const query = {
        query: 'javascript async',
        scope: 'topics' as const,
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1); // default
        expect(result.data.limit).toBe(20); // default
      }
    });

    it('should reject short query', () => {
      const query = {
        query: 'a', // Too short (< 2 chars)
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should apply pagination limits', () => {
      const query = {
        query: 'test',
        page: 2,
        limit: 150, // Exceeds max (100)
      };

      const result = SearchQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  describe('TopicListQuerySchema', () => {
    it('should validate topic list filters', () => {
      const filters = {
        category: 'general',
        tags: ['javascript'],
        status: 'open' as const,
        sort: 'latest' as const,
      };

      const result = TopicListQuerySchema.safeParse(filters);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const filters = {};

      const result = TopicListQuerySchema.safeParse(filters);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.pinned_only).toBe(false);
        expect(result.data.solved_only).toBe(false);
      }
    });
  });
});

describe('Sanitization Helpers', () => {
  describe('sanitizeTitle', () => {
    it('should trim whitespace', () => {
      expect(sanitizeTitle('  Title  ')).toBe('Title');
    });

    it('should normalize multiple spaces', () => {
      expect(sanitizeTitle('Title   with   spaces')).toBe('Title with spaces');
    });

    it('should remove line breaks', () => {
      expect(sanitizeTitle('Title\nwith\nbreaks')).toBe('Title with breaks');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeTitle('Title <script>alert("xss")</script>')).toBe('Title alert("xss")');
    });
  });

  describe('sanitizeContent', () => {
    it('should preserve safe HTML', () => {
      const content = '<p>Hello <strong>world</strong></p>';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
    });

    it('should remove dangerous scripts', () => {
      const content = '<p>Safe</p><script>alert("xss")</script>';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Safe');
    });

    it('should allow safe links', () => {
      const content = '<a href="https://example.com">Link</a>';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toContain('<a');
      expect(sanitized).toContain('href');
    });

    it('should remove javascript: URLs', () => {
      const content = '<a href="javascript:alert(1)">Bad Link</a>';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('normalizeTag', () => {
    it('should convert to lowercase', () => {
      expect(normalizeTag('JavaScript')).toBe('javascript');
    });

    it('should convert spaces to hyphens', () => {
      expect(normalizeTag('web development')).toBe('web-development');
    });

    it('should remove special characters', () => {
      expect(normalizeTag('c++@#$')).toBe('c');
    });

    it('should collapse multiple hyphens', () => {
      expect(normalizeTag('web---dev')).toBe('web-dev');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(normalizeTag('-tag-')).toBe('tag');
    });
  });
});

describe('Validation Functions', () => {
  describe('validateTopicTitle', () => {
    it('should accept valid title', () => {
      const result = validateTopicTitle('Valid Title');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Valid Title');
      }
    });

    it('should reject short title', () => {
      const result = validateTopicTitle('Ab');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TITLE_TOO_SHORT');
      }
    });

    it('should reject long title', () => {
      const longTitle = 'A'.repeat(201);
      const result = validateTopicTitle(longTitle);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TITLE_TOO_LONG');
      }
    });

    it('should reject whitespace-only title', () => {
      const result = validateTopicTitle('   ');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TITLE_EMPTY');
      }
    });
  });

  describe('validateReplyDepth', () => {
    it('should return 0 for top-level reply', () => {
      const result = validateReplyDepth(null);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(0);
      }
    });

    it('should increment depth for nested reply', () => {
      const result = validateReplyDepth(5, 2);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(3);
      }
    });

    it('should reject depth exceeding max', () => {
      const result = validateReplyDepth(5, 5); // Already at max (5)
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('MAX_DEPTH_EXCEEDED');
      }
    });
  });

  describe('validateTags', () => {
    it('should accept valid tags', () => {
      const result = validateTags(['javascript', 'typescript']);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(['javascript', 'typescript']);
      }
    });

    it('should normalize tags', () => {
      const result = validateTags(['JavaScript', 'TYPE SCRIPT']);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(['javascript', 'type-script']);
      }
    });

    it('should reject too many tags', () => {
      const tags = Array(11).fill('tag');
      const result = validateTags(tags);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TOO_MANY_TAGS');
      }
    });

    it('should reject duplicate tags', () => {
      const result = validateTags(['javascript', 'JavaScript', 'JAVASCRIPT']);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('DUPLICATE_TAGS');
      }
    });

    it('should filter out empty tags', () => {
      const result = validateTags(['javascript', '   ', 'typescript']);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(['javascript', 'typescript']);
      }
    });
  });
});

describe('Request Parsing', () => {
  describe('safeParseRequest', () => {
    it('should parse valid JSON request', async () => {
      const validData = {
        title: 'Test Topic',
        content: 'This is test content with enough characters',
        category_id: 1,
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(validData),
      } as unknown as Request;

      const result = await safeParseRequest(mockRequest, CreateTopicSchema);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.title).toBe('Test Topic');
      }
    });

    it('should handle invalid JSON', async () => {
      const mockRequest = {
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      } as unknown as Request;

      const result = await safeParseRequest(mockRequest, CreateTopicSchema);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('JSON');
      }
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        title: 'AB', // Too short
        content: 'Short',
        category_id: 1,
      };

      const mockRequest = {
        json: jest.fn().mockResolvedValue(invalidData),
      } as unknown as Request;

      const result = await safeParseRequest(mockRequest, CreateTopicSchema);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Validation failed');
        expect(result.error.details).toBeDefined();
      }
    });
  });

  describe('validateRequest', () => {
    it('should validate valid data', () => {
      const validData = {
        title: 'Test Topic',
        content: 'This is test content',
        category_id: 1,
      };

      const result = validateRequest(CreateTopicSchema, validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test Topic');
      }
    });

    it('should return errors for invalid data', () => {
      const invalidData = {
        title: 'AB', // Too short
      };

      const result = validateRequest(CreateTopicSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
});
