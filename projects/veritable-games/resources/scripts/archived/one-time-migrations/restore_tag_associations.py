#!/usr/bin/env python3
"""
Restore library tag associations from CSV backup
"""

import csv
import psycopg2

# Database connection
conn = psycopg2.connect(
    dbname='veritable_games',
    user='postgres',
    password='postgres',
    host='localhost',
    port='5432'
)

cur = conn.cursor()

# Clear existing associations
print("Clearing existing tag associations...")
cur.execute("TRUNCATE library.library_document_tags")
conn.commit()
print("Cleared.")

# Read CSV and insert
print("\nRestoring tag associations from CSV...")
csv_path = '/tmp/library_tag_associations_20251123_004439.csv'

with open(csv_path, 'r') as f:
    reader = csv.DictReader(f)
    batch = []
    count = 0

    for row in reader:
        document_id = int(row['document_id'])
        tag_id = int(row['tag_id'])
        batch.append((document_id, tag_id))
        count += 1

        # Insert in batches of 1000
        if len(batch) >= 1000:
            cur.executemany(
                "INSERT INTO library.library_document_tags (document_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                batch
            )
            conn.commit()
            print(f"  Inserted {count:,} associations...")
            batch = []

    # Insert remaining
    if batch:
        cur.executemany(
            "INSERT INTO library.library_document_tags (document_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            batch
        )
        conn.commit()

# Verify
cur.execute("SELECT COUNT(*) FROM library.library_document_tags")
final_count = cur.fetchone()[0]

print(f"\n✓ Restored {final_count:,} tag associations")

cur.close()
conn.close()
