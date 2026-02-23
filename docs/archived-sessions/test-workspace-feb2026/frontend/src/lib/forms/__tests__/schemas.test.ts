/**
 * Form Validation Schemas Test Suite
 *
 * Tests for Zod validation schemas and branded types
 */

import {
  emailSchema,
  usernameSchema,
  passwordSchema,
  loginSchema,
  registerSchema,
  profileSchema,
  newTopicSchema,
  wikiPageSchema,
  libraryDocumentSchema,
  messageSchema,
  searchSchema,
  type Email,
  type Username,
} from '../schemas';

describe('Form Validation Schemas', () => {
  describe('Email Schema', () => {
    it('should validate correct email addresses', () => {
      const validEmails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

      validEmails.forEach(email => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(true);
        if (result.success) {
          // Check branded type
          const branded: Email = result.data;
          expect(branded).toBe(email);
        }
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@.com',
      ];

      invalidEmails.forEach(email => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
      });
    });

    it('should reject emails exceeding max length', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = emailSchema.safeParse(longEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('Username Schema', () => {
    it('should validate correct usernames', () => {
      const validUsernames = ['user123', 'test_user', 'name-with-dash', 'abc'];

      validUsernames.forEach(username => {
        const result = usernameSchema.safeParse(username);
        expect(result.success).toBe(true);
        if (result.success) {
          const branded: Username = result.data;
          expect(branded).toBe(username);
        }
      });
    });

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        'ab', // too short
        'a'.repeat(21), // too long
        'user@name', // invalid character
        'user name', // space
        'user.name', // dot
      ];

      invalidUsernames.forEach(username => {
        const result = usernameSchema.safeParse(username);
        expect(result.success).toBe(false);
      });
    });

    it('should reject reserved usernames', () => {
      const reserved = ['admin', 'root', 'moderator', 'system', 'ADMIN', 'Root'];

      reserved.forEach(username => {
        const result = usernameSchema.safeParse(username);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('reserved word');
        }
      });
    });
  });

  describe('Password Schema', () => {
    it('should validate strong passwords', () => {
      const validPasswords = ['Password123!@$', 'Str0ng@Pass123!', 'MyP@ssw0rd99!'];

      validPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'short', // too short
        'password123', // no uppercase
        'PASSWORD123', // no lowercase
        'Password', // no number
        'Password123', // no special character
        'a'.repeat(129) + 'A1!', // too long
      ];

      weakPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Login Schema', () => {
    it('should validate correct login data', () => {
      const validLogin = {
        username: 'testuser',
        password: 'mypassword',
        rememberMe: true,
      };

      const result = loginSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('should work without rememberMe field', () => {
      const login = {
        username: 'testuser',
        password: 'mypassword',
      };

      const result = loginSchema.safeParse(login);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rememberMe).toBe(false);
      }
    });

    it('should reject empty fields', () => {
      const invalidLogin = {
        username: '',
        password: '',
      };

      const result = loginSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });
  });

  describe('Register Schema', () => {
    it('should validate correct registration data', () => {
      const validRegistration = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'StrongP@ss123!',
        confirmPassword: 'StrongP@ss123!',
        display_name: 'New User',
        invitation_token: 'test-invitation-token-abc123',
        acceptTerms: true,
      };

      const result = registerSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const registration = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'StrongP@ss123!',
        confirmPassword: 'DifferentP@ss99!',
        display_name: 'New User',
        invitation_token: 'test-invitation-token-abc123',
        acceptTerms: true,
      };

      const result = registerSchema.safeParse(registration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Passwords don't match");
      }
    });

    it('should require accepting terms', () => {
      const registration = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'StrongP@ss123!',
        confirmPassword: 'StrongP@ss123!',
        display_name: 'New User',
        invitation_token: 'test-invitation-token-abc123',
        acceptTerms: false,
      };

      const result = registerSchema.safeParse(registration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('accept the terms');
      }
    });
  });

  describe('Profile Schema', () => {
    it('should validate profile updates', () => {
      const profile = {
        display_name: 'John Doe',
        bio: 'Software developer',
        location: 'San Francisco',
        website_url: 'https://example.com',
        github_url: 'https://github.com/johndoe',
      };

      const result = profileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should validate GitHub URLs', () => {
      const invalidGitHub = {
        github_url: 'https://gitlab.com/user',
      };

      const result = profileSchema.safeParse(invalidGitHub);
      expect(result.success).toBe(false);
    });

    it('should validate Discord usernames', () => {
      const validDiscord = {
        discord_username: 'user#1234',
      };

      const result = profileSchema.safeParse(validDiscord);
      expect(result.success).toBe(true);

      const invalidDiscord = {
        discord_username: 'justusername',
      };

      const result2 = profileSchema.safeParse(invalidDiscord);
      expect(result2.success).toBe(false);
    });

    it('should validate avatar positioning', () => {
      const validPositioning = {
        avatar_position_x: 50,
        avatar_position_y: 75,
        avatar_scale: 150,
      };

      const result = profileSchema.safeParse(validPositioning);
      expect(result.success).toBe(true);

      const invalidPositioning = {
        avatar_position_x: 101, // > 100
        avatar_position_y: -1, // < 0
        avatar_scale: 201, // > 200
      };

      const result2 = profileSchema.safeParse(invalidPositioning);
      expect(result2.success).toBe(false);
    });
  });

  describe('Forum Schemas', () => {
    it('should validate new topic creation', () => {
      const topic = {
        category_id: '5',
        title: 'How to implement caching?',
        content: 'I need help implementing a caching layer for my application.',
        tags: ['caching', 'performance'],
      };

      const result = newTopicSchema.safeParse(topic);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category_id).toBe(5); // Transformed to number
      }
    });

    it('should reject topics with too many tags', () => {
      const topic = {
        category_id: '1',
        title: 'Valid title',
        content: 'Valid content that is long enough',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'], // 6 tags
      };

      const result = newTopicSchema.safeParse(topic);
      expect(result.success).toBe(false);
    });

    it('should validate title whitespace requirement', () => {
      const topic = {
        category_id: '1',
        title: '     ', // Only whitespace
        content: 'Valid content',
      };

      const result = newTopicSchema.safeParse(topic);
      expect(result.success).toBe(false);
    });
  });

  describe('Wiki Schemas', () => {
    it('should validate wiki page creation', () => {
      const page = {
        title: 'Getting Started Guide',
        content: 'This guide will help you get started with our platform.',
        summary: 'A beginner-friendly introduction',
        status: 'published',
        protection_level: 'semi',
        categories: ['guides', 'beginners'],
      };

      const result = wikiPageSchema.safeParse(page);
      expect(result.success).toBe(true);
    });

    it('should enforce category limits', () => {
      const page = {
        title: 'Test Page',
        content: 'Content here',
        categories: Array(11).fill('category'), // 11 categories
      };

      const result = wikiPageSchema.safeParse(page);
      expect(result.success).toBe(false);
    });

    it('should validate status enum', () => {
      const page = {
        title: 'Test',
        content: 'Content',
        status: 'invalid-status',
      };

      const result = wikiPageSchema.safeParse(page);
      expect(result.success).toBe(false);
    });
  });

  describe('Message Schema', () => {
    it('should validate message sending', () => {
      const message = {
        recipients: ['user1', 'user2'],
        subject: 'Meeting tomorrow',
        content: "Let's meet at 10 AM",
      };

      const result = messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should require at least one recipient', () => {
      const message = {
        recipients: [],
        content: 'Hello',
      };

      const result = messageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it('should enforce recipient limit', () => {
      const message = {
        recipients: Array(11).fill('user'), // 11 recipients
        content: 'Hello everyone',
      };

      const result = messageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });
  });

  describe('Search Schema', () => {
    it('should validate search queries', () => {
      const search = {
        query: 'typescript tutorials',
        category: 'wiki',
        sort: 'relevance',
        filters: {
          author: 'john',
          tags: ['typescript', 'tutorial'],
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          },
        },
      };

      const result = searchSchema.safeParse(search);
      expect(result.success).toBe(true);
    });

    it('should enforce minimum query length', () => {
      const search = {
        query: 'a', // Too short
      };

      const result = searchSchema.safeParse(search);
      expect(result.success).toBe(false);
    });

    it('should use default values', () => {
      const search = {
        query: 'search term',
      };

      const result = searchSchema.safeParse(search);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('all');
        expect(result.data.sort).toBe('relevance');
      }
    });
  });
});
