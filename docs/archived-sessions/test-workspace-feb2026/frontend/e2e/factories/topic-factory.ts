/**
 * Topic Test Data Factory
 *
 * Creates test topic data with sensible defaults
 * Useful for reducing duplication in tests
 */

let topicCounter = 1000; // Start high to avoid conflicts with seed data

export interface TopicFactoryData {
  title: string;
  content: string;
  categoryId?: number;
  category?: string;
  tags?: string[];
}

/**
 * Build valid topic data with defaults
 *
 * @param overrides - Optional overrides for specific fields
 * @returns Topic data object
 */
export function buildTopic(overrides?: Partial<TopicFactoryData>): TopicFactoryData {
  const timestamp = Date.now();
  const counter = topicCounter++;

  return {
    title: `[E2E TEST] Test Topic ${counter}`,
    content: `This is test content created at ${new Date(timestamp).toISOString()}. This topic was automatically created by the E2E test suite and can be safely deleted.`,
    category: 'general',
    tags: ['test', 'e2e'],
    ...overrides,
  };
}

/**
 * Build topic with specific title length
 */
export function buildTopicWithTitleLength(length: number): TopicFactoryData {
  const baseTitle = '[E2E TEST] ';
  const padding = 'A'.repeat(Math.max(0, length - baseTitle.length));

  return buildTopic({
    title: baseTitle + padding,
  });
}

/**
 * Build invalid topic data for validation testing
 */
export function buildInvalidTopic(
  type:
    | 'emptyTitle'
    | 'shortTitle'
    | 'longTitle'
    | 'emptyContent'
    | 'noCategory'
    | 'tooManyTags'
    | 'invalidCategory'
): Partial<TopicFactoryData> {
  switch (type) {
    case 'emptyTitle':
      return buildTopic({ title: '' });

    case 'shortTitle':
      return buildTopic({ title: 'AB' }); // Less than 3 chars

    case 'longTitle':
      return buildTopic({ title: 'A'.repeat(201) }); // More than 200 chars

    case 'emptyContent':
      return buildTopic({ content: '' });

    case 'noCategory':
      return { ...buildTopic(), category: undefined, categoryId: undefined };

    case 'tooManyTags':
      return buildTopic({
        tags: Array(11)
          .fill(0)
          .map((_, i) => `tag${i}`), // More than 10 tags
      });

    case 'invalidCategory':
      return buildTopic({ category: 'nonexistent-category-xyz' });

    default:
      throw new Error(`Unknown invalid topic type: ${type}`);
  }
}

/**
 * Build topic with XSS payload for security testing
 */
export function buildXSSTopic(
  payload: string,
  location: 'title' | 'content' = 'title'
): TopicFactoryData {
  if (location === 'title') {
    return buildTopic({
      title: payload,
      content: 'Safe content',
    });
  } else {
    return buildTopic({
      title: '[E2E TEST] XSS Test Topic',
      content: payload,
    });
  }
}

/**
 * Build topic with SQL injection payload for security testing
 */
export function buildSQLInjectionTopic(
  payload: string,
  location: 'title' | 'content' = 'title'
): TopicFactoryData {
  if (location === 'title') {
    return buildTopic({
      title: payload,
      content: 'Safe content',
    });
  } else {
    return buildTopic({
      title: '[E2E TEST] SQL Injection Test',
      content: payload,
    });
  }
}

/**
 * Build topic with specific tags for tag filtering tests
 */
export function buildTopicWithTags(tags: string[]): TopicFactoryData {
  return buildTopic({ tags });
}

/**
 * Build topic for specific category
 */
export function buildTopicForCategory(categorySlug: string): TopicFactoryData {
  return buildTopic({
    category: categorySlug,
    title: `[E2E TEST] Topic for ${categorySlug}`,
  });
}

/**
 * Build multiple topics at once
 */
export function buildTopics(
  count: number,
  overrides?: Partial<TopicFactoryData>
): TopicFactoryData[] {
  return Array(count)
    .fill(0)
    .map((_, i) =>
      buildTopic({
        title: `[E2E TEST] Bulk Topic ${i + 1}`,
        ...overrides,
      })
    );
}

/**
 * Reset counter (useful for test isolation)
 */
export function resetTopicCounter(): void {
  topicCounter = 1000;
}
