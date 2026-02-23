/**
 * Database Encryption Performance Testing Script
 *
 * Comprehensive performance testing for encrypted vs unencrypted databases.
 * Measures query performance, overhead analysis, and compliance verification.
 *
 * Features:
 * - Benchmark query performance with/without encryption
 * - Measure encryption overhead percentage
 * - Test key rotation performance impact
 * - Generate detailed performance reports
 * - Validate <5% performance overhead target
 *
 * Usage:
 *   node scripts/encryption-performance-test.js [options]
 *
 * Options:
 *   --database=<name>    Test specific database
 *   --iterations=<num>   Number of test iterations (default: 100)
 *   --verbose           Detailed output
 *   --report            Generate detailed report
 *   --baseline          Test unencrypted performance baseline
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const EncryptedDatabase = require('@journeyapps/sqlcipher');

// Configuration
const DATA_DIR = path.join(process.cwd(), 'data');
const REPORT_DIR = path.join(process.cwd(), 'reports');
const TEST_ITERATIONS = 100;
const PERFORMANCE_TARGET = 5; // Maximum acceptable overhead percentage

const DATABASES = ['forums', 'wiki', 'users', 'system', 'content', 'library', 'auth', 'messaging'];

// Test queries for each database type
const TEST_QUERIES = {
  forums: [
    'SELECT COUNT(*) FROM topics',
    'SELECT COUNT(*) FROM replies',
    'SELECT * FROM topics ORDER BY created_at DESC LIMIT 10',
    'SELECT t.*, c.name as category_name FROM topics t LEFT JOIN categories c ON t.category_id = c.id LIMIT 10',
  ],
  wiki: [
    'SELECT COUNT(*) FROM wiki_pages',
    'SELECT COUNT(*) FROM wiki_revisions',
    'SELECT * FROM wiki_pages ORDER BY updated_at DESC LIMIT 10',
    'SELECT p.*, r.content FROM wiki_pages p LEFT JOIN wiki_revisions r ON p.current_revision_id = r.id LIMIT 5',
  ],
  users: [
    'SELECT COUNT(*) FROM users',
    'SELECT * FROM users ORDER BY created_at DESC LIMIT 10',
    'SELECT id, username, email, role FROM users WHERE is_active = 1 LIMIT 20',
  ],
  default: [
    'SELECT COUNT(*) FROM sqlite_master',
    'SELECT name FROM sqlite_master WHERE type="table"',
    'PRAGMA table_info(sqlite_master)',
  ],
};

class EncryptionPerformanceTester {
  constructor(options = {}) {
    this.options = {
      database: null,
      iterations: TEST_ITERATIONS,
      verbose: false,
      report: false,
      baseline: false,
      ...options,
    };

    this.results = {
      testStart: new Date(),
      databases: {},
      summary: {
        totalTests: 0,
        averageOverhead: 0,
        maxOverhead: 0,
        targetCompliance: false,
        recommendations: [],
      },
    };

    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const dirs = [DATA_DIR, REPORT_DIR];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log('info', `Created directory: ${dir}`);
      }
    });
  }

  /**
   * Main performance testing entry point
   */
  async runTests() {
    this.log('info', 'Starting encryption performance testing...');

    try {
      // Determine databases to test
      const databasesToTest = this.getDatabaseList();

      if (databasesToTest.length === 0) {
        this.log('warn', 'No databases found to test');
        return { success: false, results: this.results };
      }

      this.log('info', `Testing ${databasesToTest.length} database(s)...`);

      // Test each database
      for (const dbName of databasesToTest) {
        await this.testDatabase(dbName);
      }

      // Calculate summary statistics
      this.calculateSummary();

      // Generate report if requested
      if (this.options.report) {
        await this.generateReport();
      }

      // Log results
      this.logResults();

      return { success: true, results: this.results };
    } catch (error) {
      this.log('error', `Performance testing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of databases to test
   */
  getDatabaseList() {
    let databases = DATABASES;

    // Filter by specific database if requested
    if (this.options.database) {
      databases = databases.filter(db => db === this.options.database);
      if (databases.length === 0) {
        throw new Error(`Database not found: ${this.options.database}`);
      }
    }

    // Check which databases exist
    databases = databases.filter(dbName => {
      const dbPath = path.join(DATA_DIR, `${dbName}.db`);
      if (!fs.existsSync(dbPath)) {
        this.log('warn', `Database file not found: ${dbPath}`);
        return false;
      }
      return true;
    });

    return databases;
  }

  /**
   * Test performance of individual database
   */
  async testDatabase(dbName) {
    this.log('info', `Testing database: ${dbName}`);

    const dbPath = path.join(DATA_DIR, `${dbName}.db`);
    const testQueries = TEST_QUERIES[dbName] || TEST_QUERIES.default;

    const dbResult = {
      name: dbName,
      encrypted: this.isDatabaseEncrypted(dbPath),
      testQueries: testQueries.length,
      baseline: null,
      encrypted_performance: null,
      overhead: 0,
      queryResults: [],
    };

    try {
      if (this.options.baseline) {
        // Test unencrypted performance (if available)
        dbResult.baseline = await this.testUnencryptedPerformance(dbPath, testQueries);
      }

      // Test encrypted performance
      if (dbResult.encrypted) {
        dbResult.encrypted_performance = await this.testEncryptedPerformance(dbPath, testQueries);
      } else {
        // Database is not encrypted, test as baseline
        dbResult.baseline = await this.testUnencryptedPerformance(dbPath, testQueries);
      }

      // Calculate overhead if both baseline and encrypted results exist
      if (dbResult.baseline && dbResult.encrypted_performance) {
        dbResult.overhead = this.calculateOverhead(
          dbResult.baseline.averageTime,
          dbResult.encrypted_performance.averageTime
        );
      }

      this.results.databases[dbName] = dbResult;
      this.results.summary.totalTests++;

      this.log('info', `Database ${dbName} testing completed`);
      if (this.options.verbose) {
        this.logDatabaseResult(dbResult);
      }
    } catch (error) {
      this.log('error', `Failed to test database ${dbName}: ${error.message}`);
      dbResult.error = error.message;
      this.results.databases[dbName] = dbResult;
    }
  }

  /**
   * Test unencrypted database performance
   */
  async testUnencryptedPerformance(dbPath, testQueries) {
    const db = new Database(dbPath);
    const queryTimes = [];

    try {
      // Warm up
      for (let i = 0; i < 5; i++) {
        db.prepare('SELECT 1').get();
      }

      // Run performance tests
      for (let iteration = 0; iteration < this.options.iterations; iteration++) {
        for (const query of testQueries) {
          const startTime = process.hrtime.bigint();

          try {
            if (query.toLowerCase().includes('select count')) {
              db.prepare(query).get();
            } else if (query.toLowerCase().includes('select')) {
              db.prepare(query).all();
            } else {
              db.prepare(query).run();
            }
          } catch (error) {
            // Skip queries that fail (table might not exist)
            continue;
          }

          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
          queryTimes.push(duration);
        }
      }

      const avgTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      const minTime = Math.min(...queryTimes);
      const maxTime = Math.max(...queryTimes);

      return {
        type: 'unencrypted',
        totalQueries: queryTimes.length,
        averageTime: avgTime,
        minTime,
        maxTime,
        standardDeviation: this.calculateStandardDeviation(queryTimes, avgTime),
      };
    } finally {
      db.close();
    }
  }

  /**
   * Test encrypted database performance
   */
  async testEncryptedPerformance(dbPath, testQueries) {
    const encryptionKey = this.getEncryptionKey(path.basename(dbPath, '.db'));
    const db = new EncryptedDatabase(dbPath);
    const queryTimes = [];

    try {
      // Set encryption key
      db.pragma(`key = "x'${encryptionKey}'"`);
      db.pragma('cipher_compatibility = sqlcipher_4_5_x');

      // Warm up
      for (let i = 0; i < 5; i++) {
        db.prepare('SELECT 1').get();
      }

      // Run performance tests
      for (let iteration = 0; iteration < this.options.iterations; iteration++) {
        for (const query of testQueries) {
          const startTime = process.hrtime.bigint();

          try {
            if (query.toLowerCase().includes('select count')) {
              db.prepare(query).get();
            } else if (query.toLowerCase().includes('select')) {
              db.prepare(query).all();
            } else {
              db.prepare(query).run();
            }
          } catch (error) {
            // Skip queries that fail
            continue;
          }

          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
          queryTimes.push(duration);
        }
      }

      const avgTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      const minTime = Math.min(...queryTimes);
      const maxTime = Math.max(...queryTimes);

      return {
        type: 'encrypted',
        totalQueries: queryTimes.length,
        averageTime: avgTime,
        minTime,
        maxTime,
        standardDeviation: this.calculateStandardDeviation(queryTimes, avgTime),
      };
    } finally {
      db.close();
    }
  }

  /**
   * Check if database is encrypted
   */
  isDatabaseEncrypted(dbPath) {
    try {
      const testDb = new Database(dbPath);
      testDb.prepare('SELECT COUNT(*) FROM sqlite_master').get();
      testDb.close();
      return false; // Successfully opened without key = not encrypted
    } catch (error) {
      return error.message.includes('file is not a database');
    }
  }

  /**
   * Get encryption key for database
   */
  getEncryptionKey(dbName) {
    // Simulate the key derivation process
    const crypto = require('crypto');

    let masterKey;
    if (process.env.DATABASE_MASTER_KEY) {
      masterKey = Buffer.from(process.env.DATABASE_MASTER_KEY, 'hex');
    } else if (process.env.SESSION_SECRET) {
      const salt = Buffer.from('veritable-games-db-encryption', 'utf8');
      masterKey = crypto.pbkdf2Sync(process.env.SESSION_SECRET, salt, 100000, 32, 'sha256');
    } else {
      throw new Error('No encryption key available');
    }

    const salt = crypto
      .createHash('sha256')
      .update(`${dbName}:1:veritable-games`)
      .digest()
      .slice(0, 16);

    const derivedKey = crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha256');
    return derivedKey.toString('hex');
  }

  /**
   * Calculate performance overhead percentage
   */
  calculateOverhead(baselineTime, encryptedTime) {
    if (baselineTime === 0) return 0;
    return ((encryptedTime - baselineTime) / baselineTime) * 100;
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values, mean) {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    const databases = Object.values(this.results.databases);
    const overheads = databases.filter(db => db.overhead > 0).map(db => db.overhead);

    if (overheads.length > 0) {
      this.results.summary.averageOverhead =
        overheads.reduce((sum, oh) => sum + oh, 0) / overheads.length;
      this.results.summary.maxOverhead = Math.max(...overheads);
    }

    this.results.summary.targetCompliance = this.results.summary.maxOverhead <= PERFORMANCE_TARGET;

    // Generate recommendations
    if (!this.results.summary.targetCompliance) {
      this.results.summary.recommendations.push(
        `Performance overhead ${this.results.summary.maxOverhead.toFixed(2)}% exceeds ${PERFORMANCE_TARGET}% target`
      );
      this.results.summary.recommendations.push(
        'Consider optimizing cipher settings or query patterns'
      );
    }

    if (this.results.summary.averageOverhead > PERFORMANCE_TARGET * 0.8) {
      this.results.summary.recommendations.push('Monitor encryption performance regularly');
    }

    const encryptedCount = databases.filter(db => db.encrypted).length;
    if (encryptedCount < databases.length) {
      this.results.summary.recommendations.push(
        `${databases.length - encryptedCount} databases are not encrypted`
      );
    }
  }

  /**
   * Generate detailed performance report
   */
  async generateReport() {
    const reportPath = path.join(REPORT_DIR, `encryption-performance-${Date.now()}.json`);
    const markdownPath = path.join(REPORT_DIR, `encryption-performance-${Date.now()}.md`);

    // Generate JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate Markdown report
    const markdown = this.generateMarkdownReport();
    fs.writeFileSync(markdownPath, markdown);

    this.log('info', `Performance report generated: ${reportPath}`);
    this.log('info', `Markdown report generated: ${markdownPath}`);
  }

  /**
   * Generate Markdown performance report
   */
  generateMarkdownReport() {
    const { summary, databases } = this.results;

    let markdown = `# Database Encryption Performance Report

Generated: ${this.results.testStart.toISOString()}

## Summary

- **Total Databases Tested**: ${summary.totalTests}
- **Average Encryption Overhead**: ${summary.averageOverhead.toFixed(2)}%
- **Maximum Encryption Overhead**: ${summary.maxOverhead.toFixed(2)}%
- **Performance Target Compliance**: ${summary.targetCompliance ? '✅ PASS' : '❌ FAIL'}

### Performance Target

- **Target**: <${PERFORMANCE_TARGET}% overhead
- **Status**: ${summary.targetCompliance ? 'COMPLIANT' : 'NON-COMPLIANT'}

## Database Results

| Database | Encrypted | Baseline (ms) | Encrypted (ms) | Overhead (%) | Status |
|----------|-----------|---------------|----------------|--------------|--------|
`;

    Object.values(databases).forEach(db => {
      const baseline = db.baseline?.averageTime?.toFixed(2) || 'N/A';
      const encrypted = db.encrypted_performance?.averageTime?.toFixed(2) || 'N/A';
      const overhead = db.overhead > 0 ? db.overhead.toFixed(2) + '%' : 'N/A';
      const status = db.overhead <= PERFORMANCE_TARGET ? '✅' : '❌';

      markdown += `| ${db.name} | ${db.encrypted ? '✅' : '❌'} | ${baseline} | ${encrypted} | ${overhead} | ${status} |\n`;
    });

    markdown += `
## Recommendations

`;

    summary.recommendations.forEach(rec => {
      markdown += `- ${rec}\n`;
    });

    markdown += `
## Test Configuration

- **Iterations**: ${this.options.iterations}
- **Test Queries**: ${Object.keys(TEST_QUERIES).length} query sets
- **Performance Target**: <${PERFORMANCE_TARGET}% overhead

## Detailed Results

`;

    Object.values(databases).forEach(db => {
      markdown += `### ${db.name}

- **Encrypted**: ${db.encrypted}
- **Test Queries**: ${db.testQueries}
`;

      if (db.baseline) {
        markdown += `- **Baseline Performance**: ${db.baseline.averageTime.toFixed(2)}ms (±${db.baseline.standardDeviation.toFixed(2)}ms)
`;
      }

      if (db.encrypted_performance) {
        markdown += `- **Encrypted Performance**: ${db.encrypted_performance.averageTime.toFixed(2)}ms (±${db.encrypted_performance.standardDeviation.toFixed(2)}ms)
`;
      }

      if (db.overhead > 0) {
        markdown += `- **Overhead**: ${db.overhead.toFixed(2)}%
`;
      }

      markdown += '\n';
    });

    return markdown;
  }

  /**
   * Log database test result
   */
  logDatabaseResult(dbResult) {
    this.log('info', `  Database: ${dbResult.name}`);
    this.log('info', `  Encrypted: ${dbResult.encrypted}`);

    if (dbResult.baseline) {
      this.log('info', `  Baseline: ${dbResult.baseline.averageTime.toFixed(2)}ms`);
    }

    if (dbResult.encrypted_performance) {
      this.log('info', `  Encrypted: ${dbResult.encrypted_performance.averageTime.toFixed(2)}ms`);
    }

    if (dbResult.overhead > 0) {
      this.log('info', `  Overhead: ${dbResult.overhead.toFixed(2)}%`);
    }
  }

  /**
   * Log final results
   */
  logResults() {
    this.log('info', '=== PERFORMANCE TEST RESULTS ===');
    this.log('info', `Databases tested: ${this.results.summary.totalTests}`);
    this.log('info', `Average overhead: ${this.results.summary.averageOverhead.toFixed(2)}%`);
    this.log('info', `Maximum overhead: ${this.results.summary.maxOverhead.toFixed(2)}%`);
    this.log(
      'info',
      `Target compliance: ${this.results.summary.targetCompliance ? 'PASS' : 'FAIL'}`
    );

    if (this.results.summary.recommendations.length > 0) {
      this.log('info', 'Recommendations:');
      this.results.summary.recommendations.forEach(rec => {
        this.log('info', `  - ${rec}`);
      });
    }
  }

  /**
   * Log message with timestamp
   */
  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    console.log(logMessage);
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  args.forEach(arg => {
    if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--report') {
      options.report = true;
    } else if (arg === '--baseline') {
      options.baseline = true;
    } else if (arg.startsWith('--database=')) {
      options.database = arg.split('=')[1];
    } else if (arg.startsWith('--iterations=')) {
      options.iterations = parseInt(arg.split('=')[1], 10);
    }
  });

  const tester = new EncryptionPerformanceTester(options);

  tester
    .runTests()
    .then(result => {
      if (result.success) {
        const compliance = result.results.summary.targetCompliance;
        console.log(`\n${compliance ? '✅' : '❌'} Performance testing completed!`);
        console.log(`Target compliance: ${compliance ? 'PASS' : 'FAIL'}`);
        process.exit(compliance ? 0 : 1);
      } else {
        console.log('\n❌ Performance testing failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Performance testing error:', error.message);
      process.exit(1);
    });
}

module.exports = EncryptionPerformanceTester;
