/**
 * Reply Test Data Factory
 *
 * Creates test reply data with sensible defaults
 */

let replyCounter = 1000;

export interface ReplyFactoryData {
  content: string;
  parentId?: number;
}

/**
 * Build valid reply data with defaults
 */
export function buildReply(overrides?: Partial<ReplyFactoryData>): ReplyFactoryData {
  const timestamp = Date.now();
  const counter = replyCounter++;

  return {
    content: `[E2E TEST] This is test reply #${counter} created at ${new Date(timestamp).toISOString()}. This reply can be safely deleted.`,
    ...overrides,
  };
}

/**
 * Build nested reply (with parent)
 */
export function buildNestedReply(parentId: number, depth = 1): ReplyFactoryData {
  return buildReply({
    content: `[E2E TEST] Nested reply at depth ${depth}`,
    parentId,
  });
}

/**
 * Build invalid reply data for validation testing
 */
export function buildInvalidReply(type: 'emptyContent'): Partial<ReplyFactoryData> {
  switch (type) {
    case 'emptyContent':
      return { content: '' };

    default:
      throw new Error(`Unknown invalid reply type: ${type}`);
  }
}

/**
 * Build reply with XSS payload
 */
export function buildXSSReply(payload: string): ReplyFactoryData {
  return buildReply({
    content: payload,
  });
}

/**
 * Build reply with SQL injection payload
 */
export function buildSQLInjectionReply(payload: string): ReplyFactoryData {
  return buildReply({
    content: payload,
  });
}

/**
 * Build reply thread (nested replies)
 * Returns array of replies where each reply references the previous as parent
 */
export function buildReplyThread(depth: number): ReplyFactoryData[] {
  const replies: ReplyFactoryData[] = [];

  for (let i = 0; i < depth; i++) {
    replies.push(
      buildReply({
        content: `[E2E TEST] Reply at depth ${i + 1}`,
        // First reply has no parent, subsequent replies reference previous
        parentId: i === 0 ? undefined : 1000 + i - 1,
      })
    );
  }

  return replies;
}

/**
 * Build multiple replies at once
 */
export function buildReplies(
  count: number,
  overrides?: Partial<ReplyFactoryData>
): ReplyFactoryData[] {
  return Array(count)
    .fill(0)
    .map((_, i) =>
      buildReply({
        content: `[E2E TEST] Bulk reply ${i + 1}`,
        ...overrides,
      })
    );
}

/**
 * Reset counter (useful for test isolation)
 */
export function resetReplyCounter(): void {
  replyCounter = 1000;
}
