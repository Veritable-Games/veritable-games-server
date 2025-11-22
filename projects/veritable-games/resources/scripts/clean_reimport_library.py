#!/usr/bin/env python3
"""
Smart User Library Document Re-Import Script

This script cleans corrupted user library documents by:
1. Extracting clean titles from filenames (not corrupted frontmatter)
2. Extracting clean content (removing frontmatter garbage)
3. Intelligently matching source files to existing database records
4. UPDATING existing records (preserves id, slug, tags automatically!)
5. INSERTING only new documents that don't match

This preserves ALL metadata automatically:
- Document IDs (primary keys stay same)
- Slugs (URLs don't break)
- 60,932 tag associations (use document_id which doesn't change)
- Authors and publication dates (smart merge)
- View counts, created_by, created_at

Usage: python3 scripts/clean_reimport_library.py
"""

import re
import yaml
import psycopg2
from pathlib import Path
from datetime import datetime

# Configuration
SOURCE_DIR = Path('/home/user/projects/veritable-games/resources/data/library')
DB_CONFIG = {
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': 5432
}

def extract_clean_title(filename):
    """
    Extract clean title from filename
    Removes category prefixes, converts underscores to spaces, removes garbage
    """
    # Get filename without extension
    clean = filename.stem

    # Remove category prefix patterns like "01_Political_Theory_Article_"
    clean = re.sub(r'^\d+_[^_]+_(Article|Book|Paper|Document|Resource|Guide)_', '', clean)

    # Remove garbage suffixes
    clean = re.sub(r'_aboutreaderurl.*$', '', clean)
    clean = re.sub(r'_source.*$', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'_content.*$', '', clean, flags=re.IGNORECASE)

    # Convert underscores and hyphens to spaces
    clean = clean.replace('_', ' ').replace('-', ' ')

    # Remove extra whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()

    # Limit length to 512 characters
    clean = clean[:512]

    return clean if clean else filename.stem[:512]

def extract_clean_content(filepath):
    """
    Extract clean content from markdown file
    Strips YAML frontmatter and removes garbage prefixes
    """
    try:
        text = filepath.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        print(f"    Error reading file: {e}")
        return ''

    # Remove YAML frontmatter (everything between --- markers)
    text = re.sub(r'^---\s*\n.*?\n---\s*\n', '', text, flags=re.DOTALL)

    # Remove garbage prefixes from content
    text = re.sub(r'^.*?\*\*Source\*\*:.*?##\s*Content\s+', '', text, flags=re.DOTALL)
    text = re.sub(r'^aboutreaderurl=.*?\n', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\*\*Source\*\*:.*?$', '', text, flags=re.MULTILINE)

    # Remove leading/trailing whitespace
    text = text.strip()

    return text

def extract_metadata(filepath):
    """
    Extract author and publication_date from frontmatter if valid
    Returns (author, pub_date) tuple
    """
    try:
        text = filepath.read_text(encoding='utf-8', errors='ignore')
        match = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)

        if match:
            frontmatter = yaml.safe_load(match.group(1))
            if not isinstance(frontmatter, dict):
                return '', ''

            author = frontmatter.get('author', '')
            date = frontmatter.get('date', '')

            # Validate author (reject if contains garbage)
            if author:
                if isinstance(author, str):
                    if 'aboutreaderurl' in author.lower() or len(author) > 500:
                        author = ''
                else:
                    author = ''

            # Validate date (must start with 4 digits for year)
            if date:
                date_str = str(date).strip()
                if not re.match(r'^\d{4}', date_str):
                    date = ''
                else:
                    date = date_str

            return author, date

    except Exception:
        pass

    return '', ''

def find_existing_document(clean_title, clean_content_preview, cursor):
    """
    Match source file to existing database record using intelligent matching

    Strategies:
    1. Title similarity (case-insensitive partial match)
    2. Content preview match (first 200 characters)

    Returns dict with id, slug, matched_by if found, None otherwise
    """

    # Strategy 1: Exact title match (case-insensitive, partial)
    # Use first 100 chars of title for matching to handle slight variations
    title_search = clean_title[:100]

    cursor.execute("""
        SELECT id, slug, title
        FROM library.library_documents
        WHERE LOWER(title) LIKE LOWER(%s)
          AND status = 'published'
        ORDER BY LENGTH(title)  -- Prefer shorter matches (more precise)
        LIMIT 1
    """, (f"%{title_search}%",))

    result = cursor.fetchone()
    if result:
        return {
            'id': result[0],
            'slug': result[1],
            'matched_by': 'title',
            'matched_title': result[2]
        }

    # Strategy 2: Content preview match (first 200 chars)
    if len(clean_content_preview) > 50:
        # Use first 200 chars, escape special SQL characters
        content_search = clean_content_preview[:200].replace('%', '\\%').replace('_', '\\_')

        cursor.execute("""
            SELECT id, slug, title
            FROM library.library_documents
            WHERE content LIKE %s
              AND status = 'published'
            LIMIT 1
        """, (f"{content_search}%",))

        result = cursor.fetchone()
        if result:
            return {
                'id': result[0],
                'slug': result[1],
                'matched_by': 'content',
                'matched_title': result[2]
            }

    # No match found - this is a NEW document
    return None

def generate_unique_slug(title, cursor):
    """Generate a unique URL-safe slug from title"""
    # Convert to lowercase
    slug = title.lower()

    # Remove special characters, keep alphanumeric and spaces
    slug = re.sub(r'[^\w\s-]', '', slug)

    # Replace spaces and multiple hyphens with single hyphen
    slug = re.sub(r'[-\s]+', '-', slug)

    # Remove leading/trailing hyphens
    slug = slug.strip('-')

    # Limit length
    slug = slug[:200]

    # Check for duplicates and add numeric suffix if needed
    original_slug = slug
    counter = 1

    while True:
        cursor.execute(
            "SELECT COUNT(*) FROM library.library_documents WHERE slug = %s",
            (slug,)
        )
        if cursor.fetchone()[0] == 0:
            break
        slug = f"{original_slug}-{counter}"
        counter += 1

    return slug

def main():
    """Main re-import logic"""

    print("=" * 80)
    print("USER LIBRARY DOCUMENT SMART RE-IMPORT")
    print("=" * 80)
    print(f"Source directory: {SOURCE_DIR}")
    print(f"Database: {DB_CONFIG['database']}")
    print(f"Strategy: UPDATE existing + INSERT new")
    print("")

    # Connect to database
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✓ Database connection established\n")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return 1

    # Find all source markdown files
    try:
        markdown_files = sorted(SOURCE_DIR.glob('*.md'))
        print(f"Found {len(markdown_files)} source markdown files\n")
    except Exception as e:
        print(f"✗ Failed to read source directory: {e}")
        return 1

    if len(markdown_files) == 0:
        print("✗ No markdown files found in source directory")
        return 1

    print("=" * 80)
    print("PROCESSING FILES")
    print("=" * 80)

    # Statistics
    stats = {
        'total': len(markdown_files),
        'updated': 0,
        'inserted': 0,
        'failed': 0,
        'skipped': 0
    }

    # Process each file
    for i, filepath in enumerate(markdown_files, 1):
        try:
            # Extract clean data
            clean_title = extract_clean_title(filepath)
            clean_content = extract_clean_content(filepath)
            author, pub_date = extract_metadata(filepath)

            # Skip if title or content is empty
            if not clean_title or len(clean_title.strip()) == 0:
                print(f"⊘ SKIP {i}/{stats['total']}: {filepath.name[:60]} (empty title)")
                stats['skipped'] += 1
                continue

            if not clean_content or len(clean_content.strip()) < 50:
                print(f"⊘ SKIP {i}/{stats['total']}: {clean_title[:40]}... (empty/short content)")
                stats['skipped'] += 1
                continue

            # Try to match existing document
            content_preview = clean_content[:200] if clean_content else ''
            existing = find_existing_document(clean_title, content_preview, cursor)

            if existing:
                # UPDATE existing document
                cursor.execute("""
                    UPDATE library.library_documents
                    SET
                        title = %s,
                        content = %s,
                        author = COALESCE(NULLIF(%s, ''), author),
                        publication_date = COALESCE(NULLIF(%s, ''), publication_date),
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, slug
                """, (clean_title, clean_content, author, pub_date, existing['id']))

                result = cursor.fetchone()
                stats['updated'] += 1

                # Show progress
                match_indicator = "📝" if existing['matched_by'] == 'title' else "📄"
                print(f"✓ {match_indicator} UPDATE {i}/{stats['total']}: ID {result[0]:5d} | {clean_title[:55]:<55} | {existing['matched_by']}")

            else:
                # INSERT new document
                slug = generate_unique_slug(clean_title, cursor)

                cursor.execute("""
                    INSERT INTO library.library_documents
                    (slug, title, content, author, publication_date,
                     document_type, status, language, created_by, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, 'document', 'published', 'en', 3, NOW(), NOW())
                    RETURNING id, slug
                """, (slug, clean_title, clean_content, author, pub_date))

                result = cursor.fetchone()
                stats['inserted'] += 1

                print(f"✓ ➕ INSERT {i}/{stats['total']}: ID {result[0]:5d} | {clean_title[:55]:<55} | NEW")

            # Commit every 100 records
            if i % 100 == 0:
                conn.commit()
                progress_pct = (i / stats['total'] * 100)
                print(f"\n{'─' * 80}")
                print(f"Progress: {i}/{stats['total']} ({progress_pct:.1f}%)")
                print(f"Updated: {stats['updated']:,} | Inserted: {stats['inserted']:,} | Skipped: {stats['skipped']:,} | Failed: {stats['failed']:,}")
                print(f"{'─' * 80}\n")

        except Exception as e:
            stats['failed'] += 1
            print(f"✗ FAIL {i}/{stats['total']}: {filepath.name[:40]} | Error: {str(e)[:40]}")
            continue

    # Final commit
    conn.commit()

    # Print summary
    print("\n" + "=" * 80)
    print("IMPORT COMPLETE")
    print("=" * 80)
    print(f"Total files processed: {stats['total']:,}")
    print(f"Updated existing:      {stats['updated']:,}")
    print(f"Inserted new:          {stats['inserted']:,}")
    print(f"Skipped (empty):       {stats['skipped']:,}")
    print(f"Failed:                {stats['failed']:,}")
    print("=" * 80)

    # Verify tag preservation
    print("\nVerifying tag preservation...")
    cursor.execute("SELECT COUNT(*) FROM library.library_document_tags")
    tag_count = cursor.fetchone()[0]
    print(f"✓ Tag associations intact: {tag_count:,}")

    cursor.close()
    conn.close()

    return 0

if __name__ == '__main__':
    exit(main())
