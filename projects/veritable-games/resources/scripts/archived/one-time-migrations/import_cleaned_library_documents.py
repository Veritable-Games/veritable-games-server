#!/usr/bin/env python3
"""
Import cleaned library markdown files back into PostgreSQL database

Matches files from library-reflow-working directory with metadata
from CSV backup and updates database content.
"""

import csv
import os
import psycopg2
from pathlib import Path
import sys

# Database connection parameters
# Use localhost since we're running from host, not inside Docker network
DB_PARAMS = {
    'dbname': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': '5432'
}

def normalize_filename(filename: str) -> str:
    """
    Normalize filename for comparison
    Strips 'Article_', 'Book_', 'Planning_' prefixes and .md extension
    """
    # Remove common prefixes
    for prefix in ['Article_', 'Book_', 'Planning_Articles_', 'Planning_Books_', 'Planning_Article_',
                   'Theory_Books_', 'Theory_Articles_']:
        if filename.startswith(prefix):
            filename = filename[len(prefix):]
            break

    # Remove .md extension
    if filename.endswith('.md'):
        filename = filename[:-3]

    return filename

def find_matching_file(file_path_from_db: str, markdown_dir: Path) -> Path | None:
    """
    Find the actual markdown file corresponding to database file_path
    Handles filename variations (with/without Article_ prefix, etc.)
    """
    if not file_path_from_db:
        return None

    # Try exact match first
    exact_path = markdown_dir / file_path_from_db
    if exact_path.exists():
        return exact_path

    # Extract base filename from DB path
    db_filename = Path(file_path_from_db).name
    db_normalized = normalize_filename(db_filename)

    # Search for matching file
    for md_file in markdown_dir.glob('*.md'):
        md_normalized = normalize_filename(md_file.name)
        if md_normalized == db_normalized:
            return md_file

    return None

def import_documents(csv_path: str, markdown_dir: str, dry_run: bool = False):
    """
    Import cleaned markdown content back into database

    Args:
        csv_path: Path to metadata CSV backup
        markdown_dir: Directory containing cleaned markdown files
        dry_run: If True, show what would be done without making changes
    """
    markdown_path = Path(markdown_dir)

    if not markdown_path.exists():
        print(f"Error: Markdown directory not found: {markdown_dir}")
        return 1

    # Read metadata from CSV
    print(f"Reading metadata from: {csv_path}")
    metadata = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            doc_id = int(row['id'])
            metadata[doc_id] = row

    print(f"Loaded metadata for {len(metadata)} documents")
    print()

    # Connect to database
    if not dry_run:
        print("Connecting to database...")
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()
        print("Connected successfully")
        print()

    # Process each document
    stats = {
        'total': 0,
        'found': 0,
        'missing': 0,
        'updated': 0,
        'errors': 0
    }

    for doc_id, meta in metadata.items():
        stats['total'] += 1
        file_path = meta.get('file_path', '')

        # Find corresponding markdown file
        md_file = find_matching_file(file_path, markdown_path)

        if not md_file:
            stats['missing'] += 1
            print(f"[{doc_id}] MISSING: {file_path}")
            continue

        stats['found'] += 1

        try:
            # Read cleaned markdown content
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            if dry_run:
                print(f"[{doc_id}] WOULD UPDATE: {md_file.name} ({len(content):,} bytes)")
            else:
                # Update database
                cur.execute(
                    """
                    UPDATE library.library_documents
                    SET content = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (content, doc_id)
                )
                stats['updated'] += 1
                print(f"[{doc_id}] UPDATED: {md_file.name} ({len(content):,} bytes)")

        except Exception as e:
            stats['errors'] += 1
            print(f"[{doc_id}] ERROR: {md_file.name} - {e}")

    # Commit changes
    if not dry_run:
        print()
        print("Committing changes...")
        conn.commit()
        cur.close()
        conn.close()
        print("Database connection closed")

    # Print summary
    print()
    print("=" * 80)
    print("IMPORT SUMMARY")
    print("=" * 80)
    print(f"Total documents in CSV: {stats['total']}")
    print(f"Markdown files found: {stats['found']}")
    print(f"Markdown files missing: {stats['missing']}")
    print(f"Documents updated: {stats['updated']}")
    print(f"Errors: {stats['errors']}")
    print("=" * 80)

    return 0

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Import cleaned library markdown files into database'
    )
    parser.add_argument(
        '--csv',
        default='/tmp/library_metadata_backup_20251123_004351.csv',
        help='Path to metadata CSV backup'
    )
    parser.add_argument(
        '--markdown-dir',
        default='/home/user/projects/veritable-games/resources/data/library-reflow-working',
        help='Directory containing cleaned markdown files'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying database'
    )

    args = parser.parse_args()

    sys.exit(import_documents(args.csv, args.markdown_dir, args.dry_run))
