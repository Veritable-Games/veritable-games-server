#!/bin/bash

# Export Database Schemas
# Extracts DDL (schema) from SQLite databases for seed script generation

set -e  # Exit on error

DB_DIR="./data"
SCHEMA_DIR="./scripts/seeds/schemas"

# Databases to export
DATABASES=("auth" "forums" "wiki" "users" "content" "library" "messaging" "system" "cache" "main")

echo "📦 Exporting Database Schemas"
echo "=============================="
echo

for db in "${DATABASES[@]}"; do
  DB_FILE="$DB_DIR/${db}.db"
  SCHEMA_FILE="$SCHEMA_DIR/${db}.sql"

  if [ -f "$DB_FILE" ]; then
    echo "Exporting $db.db schema..."
    sqlite3 "$DB_FILE" ".schema" > "$SCHEMA_FILE"

    # Add header comment
    sed -i "1i-- Schema export from ${db}.db\n-- Generated: $(date)\n-- SQLite version: $(sqlite3 --version)\n" "$SCHEMA_FILE"

    # Count tables
    TABLE_COUNT=$(grep -c "CREATE TABLE" "$SCHEMA_FILE" || echo "0")
    INDEX_COUNT=$(grep -c "CREATE INDEX" "$SCHEMA_FILE" || echo "0")

    echo "  ✓ $db.sql - $TABLE_COUNT tables, $INDEX_COUNT indexes"
  else
    echo "  ⚠  $db.db not found, skipping..."
  fi
done

echo
echo "✅ Schema export complete!"
echo "   Output: $SCHEMA_DIR/"
