import { Pool, PoolClient } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL or POSTGRES_URL environment variable must be set');
}

// Create pool with increased size for multi-instance architecture
// Changed from 5 to 10 to handle multiple concurrent instances
const contentPool = new Pool({
  connectionString: DATABASE_URL,
  max: 10, // Increased from 5 for multi-instance support
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Validate connections before returning from pool
  validationQuery: 'SELECT 1',
});

export class DBPool {
  /**
   * Get a database connection with retry and validation
   */
  async getConnection(schema: 'content'): Promise<PoolClient> {
    if (schema !== 'content') {
      throw new Error(`Unknown schema: ${schema}`);
    }

    // Retry logic: attempt to get connection up to 3 times
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = await contentPool.connect();

        // Validate connection is working
        try {
          await client.query('SELECT 1');
          return client;
        } catch (validationError) {
          // Connection failed validation, release and retry
          client.release(true); // Mark as broken
          throw validationError;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          // Exponential backoff: 100ms, 200ms
          const delayMs = 100 * Math.pow(2, attempt - 1);
          console.error(
            `[DBPool] Connection attempt ${attempt} failed, retrying in ${delayMs}ms: ${lastError.message}`
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error(`Failed to get database connection after ${maxAttempts} attempts`);
  }

  async query(text: string, values?: any[]) {
    const client = await this.getConnection('content');
    try {
      return await client.query(text, values);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await contentPool.end();
  }

  /**
   * Get pool statistics (for monitoring)
   */
  getPoolStats() {
    return {
      total: contentPool.totalCount,
      idle: contentPool.idleCount,
      waiting: contentPool.waitingCount,
    };
  }
}

export const dbPool = new DBPool();
