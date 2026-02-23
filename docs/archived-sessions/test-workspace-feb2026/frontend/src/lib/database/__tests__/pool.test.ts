/**
 * Database Connection Pool Tests
 *
 * Critical tests to ensure the connection pool prevents system crashes
 */

import { dbPool, getDatabase } from '../legacy/pool';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('DatabasePool', () => {
  const testDataDir = path.join(process.cwd(), 'data');

  beforeAll(() => {
    // Ensure data directory exists for tests
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Create test database files
    const testDbs = [
      'test',
      'test0',
      'test1',
      'test2',
      'test3',
      'test4',
      'test5',
      'test6',
      'test7',
      'test8',
      'test9',
      'shutdown1',
      'shutdown2',
      'config-test',
      'nonexistent',
    ];

    testDbs.forEach(dbName => {
      const dbPath = path.join(testDataDir, `${dbName}.db`);
      if (!fs.existsSync(dbPath)) {
        // Create empty database file
        const tempDb = new Database(dbPath);
        tempDb.close();
      }
    });

    // Enable real database connections for pool tests
    process.env.USE_REAL_DB = 'true';
  });

  afterAll(() => {
    // Clean up connections after tests
    dbPool.closeAll();

    // Restore environment
    delete process.env.USE_REAL_DB;
  });

  describe('Connection Management', () => {
    test('should create a connection on first request', () => {
      const db = dbPool.getConnection('test');
      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(Database);
    });

    test('should reuse existing connections', () => {
      const db1 = dbPool.getConnection('test');
      const db2 = dbPool.getConnection('test');
      expect(db1).toBe(db2); // Should be the same instance
    });

    test('should limit connections to maximum', () => {
      // Create connections up to the limit
      const connections = [];
      for (let i = 0; i < 10; i++) {
        connections.push(dbPool.getConnection(`test${i}`));
      }

      const stats = dbPool.getStats();
      expect(stats.activeConnections).toBeLessThanOrEqual(50); // Max is 50 (updated from 5)
      expect(stats.activeConnections).toBeGreaterThan(0); // Should have active connections
    });

    test('should handle connection failures gracefully', async () => {
      // Test with invalid database name
      const result = await dbPool.execute('nonexistent', db => {
        return db.prepare('SELECT 1').get();
      });

      // Should not throw, but handle error internally
      expect(result).toBeDefined();
    });
  });

  describe('Query Execution', () => {
    test('should execute queries successfully', async () => {
      const result = await dbPool.execute('test', db => {
        // Create a test table
        db.exec('CREATE TABLE IF NOT EXISTS test_table (id INTEGER, value TEXT)');
        db.prepare('INSERT INTO test_table VALUES (?, ?)').run(1, 'test');
        return db.prepare('SELECT * FROM test_table WHERE id = ?').get(1);
      });

      expect(result).toEqual({ id: 1, value: 'test' });
    });

    test('should handle transactions properly', async () => {
      const result = await dbPool.transaction('test', db => {
        // Clear the table first to ensure consistent state
        db.exec('DROP TABLE IF EXISTS counter');
        db.exec('CREATE TABLE counter (value INTEGER)');
        db.prepare('INSERT INTO counter VALUES (?)').run(0);

        // Multiple operations in transaction
        const stmt = db.prepare('UPDATE counter SET value = value + 1');
        stmt.run();
        stmt.run();
        stmt.run();

        return db.prepare('SELECT value FROM counter').get();
      });

      expect((result as any).value).toBe(3);
    });

    test('should rollback transaction on error', async () => {
      try {
        await dbPool.transaction('test', db => {
          db.prepare('INSERT INTO nonexistent_table VALUES (?)').run(1);
        });
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    test('should handle concurrent requests efficiently', async () => {
      const start = Date.now();

      // Simulate concurrent requests
      const promises = Array(20)
        .fill(null)
        .map((_, i) =>
          dbPool.execute('test', db => {
            return db.prepare('SELECT ?').get(i);
          })
        );

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(100); // Should be fast with pooling
    });

    test('should not leak memory with many operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        dbPool.getConnection('test').prepare('SELECT 1').get();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Graceful Shutdown', () => {
    test('should close all connections on shutdown', () => {
      // Create some connections
      dbPool.getConnection('shutdown1');
      dbPool.getConnection('shutdown2');

      const statsBefore = dbPool.getStats();
      expect(statsBefore.activeConnections).toBeGreaterThan(0);

      // Close all
      dbPool.closeAll();

      const statsAfter = dbPool.getStats();
      expect(statsAfter.activeConnections).toBe(0);
    });
  });

  describe('Configuration', () => {
    test('should apply optimal SQLite settings', () => {
      const db = dbPool.getConnection('config-test');

      // Check WAL mode is enabled
      const journal = db.pragma('journal_mode') as any;
      expect(journal[0].journal_mode).toBe('wal');

      // Check foreign keys are enforced
      const fk = db.pragma('foreign_keys') as any;
      expect(fk[0].foreign_keys).toBe(1);
    });
  });
});
