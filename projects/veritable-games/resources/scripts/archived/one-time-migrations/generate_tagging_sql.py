#!/usr/bin/env python3
"""
Generate SQL to tag library documents with reconversion status
Reads the matched and unmatched CSV files and generates SQL statements
"""

import csv
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
SQL_DIR = SCRIPT_DIR.parent / 'sql'

MATCHED_CSV = DATA_DIR / 'pdf-document-mapping.csv'
UNMATCHED_CSV = DATA_DIR / 'pdf-document-mapping-unmatched.csv'
OUTPUT_SQL = SQL_DIR / 'tag_documents_reconversion_status.sql'

def read_matched_ids():
    """Read matched document IDs from CSV"""
    ids = []
    with open(MATCHED_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ids.append(int(row['document_id']))
    return ids

def read_unmatched_ids():
    """Read unmatched document IDs from CSV"""
    ids = []
    with open(UNMATCHED_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ids.append(int(row['document_id']))
    return ids

def generate_values_list(ids, batch_size=100):
    """Generate VALUES list for SQL, batched for readability"""
    values_lines = []
    for i in range(0, len(ids), batch_size):
        batch = ids[i:i+batch_size]
        batch_str = ',\n        '.join(f'({id})' for id in batch)
        values_lines.append(batch_str)
    return ',\n        '.join(values_lines)

def main():
    print("=" * 80)
    print("Generating Reconversion Status Tagging SQL")
    print("=" * 80)

    # Read IDs
    print("\n📂 Reading CSV files...")
    matched_ids = read_matched_ids()
    unmatched_ids = read_unmatched_ids()

    print(f"Matched documents: {len(matched_ids)}")
    print(f"Unmatched documents: {len(unmatched_ids)}")

    # Generate SQL
    print(f"\n📝 Generating SQL...")

    sql_content = f"""-- Tag library documents with reconversion status
-- Generated from pdf-document-mapping.csv and pdf-document-mapping-unmatched.csv
-- Generated: {Path(__file__).name}
--
-- Summary:
--   Matched (ready_for_reconversion): {len(matched_ids)} documents
--   Unmatched (needs_source): {len(unmatched_ids)} documents
--   Total: {len(matched_ids) + len(unmatched_ids)} documents

-- Step 1: Add reconversion_status field
ALTER TABLE library.library_documents
ADD COLUMN IF NOT EXISTS reconversion_status TEXT DEFAULT NULL;

-- Step 2: Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_library_documents_reconversion_status
ON library.library_documents(reconversion_status);

-- Step 3: Tag matched documents (have matching PDF for re-conversion)
UPDATE library.library_documents
SET reconversion_status = 'ready_for_reconversion'
WHERE id IN (
    SELECT document_id FROM (VALUES
        {generate_values_list(matched_ids)}
    ) AS matched(document_id)
);

-- Step 4: Tag unmatched documents (no matching PDF found)
UPDATE library.library_documents
SET reconversion_status = 'needs_source'
WHERE id IN (
    SELECT document_id FROM (VALUES
        {generate_values_list(unmatched_ids)}
    ) AS unmatched(document_id)
);

-- Step 5: Verification queries
SELECT
    reconversion_status,
    COUNT(*) as count
FROM library.library_documents
GROUP BY reconversion_status
ORDER BY count DESC;

-- Expected results:
-- ready_for_reconversion: {len(matched_ids)}
-- needs_source: {len(unmatched_ids)}
-- NULL (if any documents not in either CSV): varies
"""

    # Write output
    with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
        f.write(sql_content)

    print(f"\n✅ Generated SQL: {OUTPUT_SQL}")
    print(f"📊 File size: {OUTPUT_SQL.stat().st_size:,} bytes")
    print("\n🔧 To apply:")
    print(f"   docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < {OUTPUT_SQL}")

if __name__ == '__main__':
    main()
