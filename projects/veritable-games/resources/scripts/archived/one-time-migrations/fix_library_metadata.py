#!/usr/bin/env python3
"""
Fix Library Documents Metadata

Problem: Import script loaded metadata from rows with INDEX File column,
but those rows have empty Author(s) and Publication Date fields.
The metadata exists in separate rows without INDEX File.

Solution: Merge metadata by matching on Document Title, then update database.

Usage:
    python3 fix_library_metadata.py [--dry-run]
"""

import os
import sys
import csv
import psycopg2
from pathlib import Path
from typing import Dict, Optional

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')
TRACKING_CSV = LIBRARY_PATH / 'tracking.csv'


def load_merged_tracking_data():
    """
    Load tracking.csv and merge metadata from duplicate rows.

    Returns dict: {title: {author, publication_date, index_file}}
    """
    metadata_by_title = {}

    if not TRACKING_CSV.exists():
        print(f"Error: tracking.csv not found at {TRACKING_CSV}")
        return metadata_by_title

    try:
        with open(TRACKING_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                title = row.get('Document Title', '').strip()
                if not title:
                    continue

                # Initialize entry if not exists
                if title not in metadata_by_title:
                    metadata_by_title[title] = {
                        'author': None,
                        'publication_date': None,
                        'index_file': None,
                        'page_count': None,
                    }

                # Merge data from this row
                entry = metadata_by_title[title]

                # Update author if present and not already set
                author = row.get('Author(s)', '').strip()
                if author and not entry['author']:
                    entry['author'] = author

                # Update publication date if present and not already set
                pub_date = row.get('Publication Date', '').strip()
                if pub_date and not entry['publication_date']:
                    entry['publication_date'] = pub_date

                # Update index file if present and not already set
                index_file = row.get('INDEX File', '').strip()
                if index_file and not entry['index_file']:
                    entry['index_file'] = index_file

                # Update page count if present and not already set
                page_count = row.get('Page Count', '').strip()
                if page_count and not entry['page_count']:
                    entry['page_count'] = page_count

        print(f"Loaded metadata for {len(metadata_by_title)} unique titles")

        # Show stats
        with_author = sum(1 for e in metadata_by_title.values() if e['author'])
        with_date = sum(1 for e in metadata_by_title.values() if e['publication_date'])
        with_index = sum(1 for e in metadata_by_title.values() if e['index_file'])

        print(f"  - {with_author} with authors")
        print(f"  - {with_date} with publication dates")
        print(f"  - {with_index} with index files")
        print()

        return metadata_by_title

    except Exception as e:
        print(f"Error loading tracking.csv: {e}")
        return {}


def fix_metadata(dry_run=False):
    """Update library documents with correct author and publication_date."""

    print("="*70)
    print("Fixing Library Documents Metadata")
    print("="*70)
    print()

    # Load merged metadata
    metadata = load_merged_tracking_data()
    if not metadata:
        print("No metadata loaded. Exiting.")
        return

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Get all library documents
        cur.execute("""
            SELECT id, title, slug, author, publication_date
            FROM library.library_documents
            WHERE created_by = 3
            ORDER BY id
        """)
        documents = cur.fetchall()

        print(f"Found {len(documents)} library documents to check\n")

        stats = {
            'total': len(documents),
            'updated': 0,
            'no_metadata': 0,
            'already_has_metadata': 0,
        }

        for doc_id, title, slug, current_author, current_pub_date in documents:
            # Skip if already has both author and date
            if current_author and current_pub_date:
                stats['already_has_metadata'] += 1
                continue

            # Look up metadata by title
            meta = metadata.get(title)

            if not meta:
                # Try normalizing title (some titles may have slight differences)
                normalized_title = title.strip().lower()
                meta = next(
                    (m for t, m in metadata.items() if t.strip().lower() == normalized_title),
                    None
                )

            if not meta:
                stats['no_metadata'] += 1
                if not dry_run:
                    print(f"[{doc_id:5d}] NO METADATA: {title[:60]}")
                continue

            # Check if we have new data to add
            new_author = meta.get('author') if not current_author else current_author
            new_pub_date = meta.get('publication_date') if not current_pub_date else current_pub_date

            # Skip if no new data
            if new_author == current_author and new_pub_date == current_pub_date:
                continue

            if dry_run:
                print(f"[{doc_id:5d}] DRY-RUN: Would update '{title[:50]}'")
                if new_author != current_author:
                    print(f"          Author: '{current_author or '(null)'}' → '{new_author or '(null)'}'")
                if new_pub_date != current_pub_date:
                    print(f"          Date: '{current_pub_date or '(null)'}' → '{new_pub_date or '(null)'}'")
            else:
                # Update document
                cur.execute("""
                    UPDATE library.library_documents
                    SET author = %s, publication_date = %s, updated_at = NOW()
                    WHERE id = %s
                """, (new_author, new_pub_date, doc_id))

                print(f"[{doc_id:5d}] UPDATED: {title[:50]}")
                if new_author:
                    print(f"          Author: {new_author}")
                if new_pub_date:
                    print(f"          Date: {new_pub_date}")

            stats['updated'] += 1

        if not dry_run:
            conn.commit()
            print("\nCommitted changes to database ✓")
        else:
            print("\nDRY-RUN - No changes committed")

        print(f"\n{'='*70}")
        print("Summary:")
        print(f"{'='*70}")
        print(f"Total documents: {stats['total']}")
        print(f"Updated: {stats['updated']}")
        print(f"Already had metadata: {stats['already_has_metadata']}")
        print(f"No metadata found: {stats['no_metadata']}")
        print(f"{'='*70}")

    except Exception as e:
        conn.rollback()
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv

    if dry_run:
        print("Running in DRY-RUN mode (no changes will be made)\n")

    fix_metadata(dry_run=dry_run)
