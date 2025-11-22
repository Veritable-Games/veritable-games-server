#!/usr/bin/env python3
"""
Phase 6B: Parse Multi-Author and Book Titles
Extract authors from complex title patterns
"""

import psycopg2
import os
import re

DB_CONNECTION = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

def parse_anna_archive_format(title):
    """
    Parse Anna's Archive format: "Title -- Author -- Year -- Publisher -- Hash -- Anna's Archive"
    """
    if " -- Anna's Archive" not in title and "-- Anna's Archive" not in title:
        return None

    # Remove the Anna's Archive suffix
    title_clean = re.sub(r"\s*--\s*Anna's Archive.*$", "", title)

    # Split by --
    parts = [p.strip() for p in title_clean.split(' -- ')]

    if len(parts) < 2:
        return None

    # Second part is usually author(s)
    potential_author = parts[1]

    # Skip if it looks like a year or ISBN
    if re.match(r'^\d{4}$', potential_author) or re.match(r'978\d{10}', potential_author):
        return None

    # Skip publisher names
    publishers = {'ak press', 'pm press', 'penguin', 'random', 'cambridge', 'oxford',
                  'routledge', 'verso', 'continuum', 'marion boyars'}
    if potential_author.lower() in publishers:
        return None

    # Handle semicolon-separated authors (take first)
    if ';' in potential_author:
        authors = [a.strip() for a in potential_author.split(';')]
        potential_author = authors[0]

    # Handle comma-separated "Last, First" format
    if ',' in potential_author and len(potential_author.split(',')) == 2:
        parts_name = [p.strip() for p in potential_author.split(',')]
        # Flip to "First Last"
        potential_author = f"{parts_name[1]} {parts_name[0]}"

    # Validate author name
    if len(potential_author) < 4 or len(potential_author) > 80:
        return None

    words = potential_author.split()
    if len(words) < 1:
        return None

    return potential_author

def parse_double_dash_format(title):
    """
    Parse format: "Title -- Author -- Publisher"
    """
    if title.count(' -- ') < 2:
        return None

    parts = [p.strip() for p in title.split(' -- ')]

    if len(parts) < 2:
        return None

    # Check if second part looks like an author (not a year, publisher, etc.)
    potential_author = parts[1]

    # Skip years, ISBNs, hashes
    if re.match(r'^\d{4}$', potential_author):
        return None
    if re.match(r'^[0-9a-f]{32}$', potential_author):  # Hash
        return None
    if re.match(r'978\d{10}', potential_author):  # ISBN
        return None

    # Skip obvious non-authors
    skip_patterns = [
        r'^\d+$',  # Just numbers
        r'^[A-Z]{2,}$',  # All caps (like "PS", "WIA-HP")
    ]

    for pattern in skip_patterns:
        if re.match(pattern, potential_author):
            return None

    # Validate length
    if len(potential_author) < 4 or len(potential_author) > 80:
        return None

    return potential_author

def main():
    conn = psycopg2.connect(DB_CONNECTION)
    cur = conn.cursor()

    # Get documents without authors
    cur.execute("""
        SELECT id, title
        FROM library.library_documents
        WHERE created_by = 3 AND author IS NULL
        ORDER BY id
    """)

    docs = cur.fetchall()

    print(f"Processing {len(docs)} documents without authors...")

    updates = []

    for doc_id, title in docs:
        author = None

        # Try Anna's Archive format first
        author = parse_anna_archive_format(title)

        # Try double-dash format
        if not author:
            author = parse_double_dash_format(title)

        if author:
            updates.append((author, doc_id, title[:80]))

    print(f"\nFound {len(updates)} potential authors to update")

    if updates:
        print("\nSample of updates:")
        for i, (author, doc_id, title_short) in enumerate(updates[:10], 1):
            print(f"  {i}. ID {doc_id}: {author}")
            print(f"      Title: {title_short}...")

        print(f"\n...and {len(updates) - 10} more" if len(updates) > 10 else "")

        # Update database
        print("\nUpdating database...")
        for author, doc_id, _ in updates:
            cur.execute("""
                UPDATE library.library_documents
                SET author = %s, updated_at = NOW()
                WHERE id = %s
            """, (author, doc_id))

        conn.commit()
        print(f"✅ Updated {len(updates)} documents")
    else:
        print("No updates found")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
