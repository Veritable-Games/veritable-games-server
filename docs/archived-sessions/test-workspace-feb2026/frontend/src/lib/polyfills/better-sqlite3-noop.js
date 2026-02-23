/**
 * No-op polyfill for better-sqlite3 in production
 *
 * Production uses PostgreSQL only. This stub prevents runtime errors
 * when legacy SQLite code is imported but not actually executed.
 *
 * The actual better-sqlite3 native bindings are not built in production
 * Docker images (--ignore-scripts in npm ci), so we need this fallback.
 */

// No-op statement class
class Statement {
  run() {
    return { changes: 0, lastInsertRowid: 0 };
  }
  get() {
    return undefined;
  }
  all() {
    return [];
  }
  iterate() {
    return [][Symbol.iterator]();
  }
  pluck() {
    return this;
  }
  expand() {
    return this;
  }
  raw() {
    return this;
  }
  columns() {
    return [];
  }
  bind() {
    return this;
  }
}

// No-op Database class
class Database {
  constructor(filename, options) {
    this.name = filename || ':memory:';
    this.open = true;
    this.inTransaction = false;
    this.readonly = options?.readonly ?? false;
    this.memory = filename === ':memory:';

    // Log warning in development
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(
        '[better-sqlite3-noop] Using no-op Database stub. ' +
          'Native bindings not available. This is expected in production.'
      );
    }
  }

  prepare(sql) {
    return new Statement();
  }

  exec(sql) {
    return this;
  }

  pragma(pragma, options) {
    return undefined;
  }

  transaction(fn) {
    return (...args) => fn(...args);
  }

  backup(destination, options) {
    return Promise.resolve({ totalPages: 0, remainingPages: 0 });
  }

  serialize(options) {
    return Buffer.alloc(0);
  }

  function(name, options, fn) {
    return this;
  }

  aggregate(name, options) {
    return this;
  }

  table(name, options) {
    return this;
  }

  loadExtension(path) {
    return this;
  }

  close() {
    this.open = false;
    return undefined;
  }

  defaultSafeIntegers(toggle) {
    return this;
  }

  unsafeMode(toggle) {
    return this;
  }
}

// Static properties
Database.SqliteError = class SqliteError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SqliteError';
    this.code = code;
  }
};

// Export as both default and named
module.exports = Database;
module.exports.default = Database;
module.exports.Database = Database;
module.exports.Statement = Statement;
module.exports.SqliteError = Database.SqliteError;

// ES module compatibility
module.exports.__esModule = true;
