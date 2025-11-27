#!/usr/bin/env python3
"""
Import Anarchist Library markdown documents to PostgreSQL database.

Reads YAML frontmatter from converted .md files and populates the anarchist
schema in PostgreSQL with searchable metadata while keeping content on filesystem.

Usage:
    python3 import_anarchist_documents_postgres.py [library_path] [database_url]

Environment:
    DATABASE_URL: PostgreSQL connection string (postgresql://user:pass@host/db)
    ANARCHIST_LIBRARY_PATH: Path to mounted Docker volume (default: /var/lib/docker/volumes/anarchist-library/_data)
"""

import os
import sys
import re
import yaml
import psycopg2
from pathlib import Path
from datetime import datetime

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

# On server: /var/lib/docker/volumes/anarchist-library/_data
# In container: /app/anarchist-library
LIBRARY_PATH = os.getenv('ANARCHIST_LIBRARY_PATH',
    '/var/lib/docker/volumes/anarchist-library/_data')

# Path where converted markdown files are located before moving to volume
CONVERTED_MARKDOWN_PATH = os.path.expanduser('~/converted-markdown')

def extract_frontmatter(md_path):
    """Parse YAML frontmatter from markdown file."""
    try:
        with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        # Extract frontmatter between --- markers
        match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
        if not match:
            return {}

        return yaml.safe_load(match.group(1)) or {}
    except Exception as e:
        print(f"Error parsing {md_path}: {e}", file=sys.stderr)
        return {}

def get_language_from_path(md_path):
    """Infer language from directory structure."""
    # anarchist_library_texts_XX/document.md → language code XX
    parts = md_path.parts
    for part in parts:
        if part.startswith('anarchist_library_texts_'):
            lang = part.replace('anarchist_library_texts_', '')
            return lang if lang else 'en'
    return 'en'

def get_category_from_path(md_path, metadata):
    """Determine category from directory and metadata."""
    # Try to get from directory structure
    language = get_language_from_path(md_path)
    return f'anarchist-{language}' if language else 'anarchist-en'

def normalize_topics(topics):
    """Convert topics to PostgreSQL array format."""
    if not topics:
        return None
    if isinstance(topics, list):
        return topics
    if isinstance(topics, str):
        return [t.strip() for t in topics.split(',')]
    return None

def import_documents(source_path=None):
    """Import all markdown documents to PostgreSQL."""
    source_dir = Path(source_path or CONVERTED_MARKDOWN_PATH)

    if not source_dir.exists():
        print(f"Error: Source directory does not exist: {source_dir}", file=sys.stderr)
        sys.exit(1)

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        print(f"DATABASE_URL: {DATABASE_URL}", file=sys.stderr)
        sys.exit(1)

    # Find all .md files
    md_files = list(source_dir.rglob('*.md'))
    total = len(md_files)
    print(f"Found {total} markdown files")
    print(f"Source: {source_dir}")
    print(f"Library path: {LIBRARY_PATH}")
    print(f"Importing to: {DATABASE_URL}\n")

    imported = 0
    skipped = 0
    errors = 0

    for idx, md_path in enumerate(sorted(md_files), 1):
        try:
            # Extract metadata from frontmatter
            metadata = extract_frontmatter(md_path)

            if not metadata or 'title' not in metadata:
                # Skip files without title
                skipped += 1
                continue

            # Generate slug from filename
            slug = md_path.stem
            # Ensure slug is safe and unique
            slug = re.sub(r'[^a-z0-9-]', '', slug.lower())
            if not slug:
                slug = f'document-{idx}'

            # Get language from directory structure or metadata
            language = metadata.get('language', get_language_from_path(md_path))
            if not language:
                language = 'en'

            # Determine category
            category = get_category_from_path(md_path, metadata)

            # Relative path from volume root - will be updated when files move to volume
            # For now, store the relative path from source directory
            relative_path = str(md_path.relative_to(source_dir))

            # Extract and normalize data
            title = metadata.get('title', slug)
            author = metadata.get('author')
            # Handle date field - could be 'date' or 'pubdate'
            date = metadata.get('date') or metadata.get('pubdate')
            source_url = metadata.get('source_url')
            topics = normalize_topics(metadata.get('topics'))
            notes = metadata.get('notes')
            original_format = metadata.get('original_format', 'muse')

            # Insert to database
            cur.execute("""
                INSERT INTO anarchist.documents
                (slug, title, author, publication_date, language, file_path,
                 source_url, notes, category, original_format, document_type, view_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (slug) DO UPDATE SET
                    title = EXCLUDED.title,
                    author = EXCLUDED.author,
                    language = EXCLUDED.language,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                slug,
                title,
                author or None,
                date or None,
                language,
                relative_path,
                source_url or None,
                notes or None,
                category,
                original_format,
                'article',
                0  # view_count
            ))

            imported += 1

            if idx % 1000 == 0 or idx == total:
                percent = (idx / total) * 100
                print(f"[{idx:5d}/{total}] {percent:5.1f}% ({imported} imported, {skipped} skipped, {errors} errors)")
                conn.commit()

        except Exception as e:
            errors += 1
            if errors <= 10:  # Show first 10 errors
                print(f"Error importing {md_path}: {e}", file=sys.stderr)

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n{'='*70}")
    print(f"Import complete!")
    print(f"  Imported: {imported}")
    print(f"  Skipped (missing title): {skipped}")
    print(f"  Errors: {errors}")
    print(f"  Total scanned: {total}")
    if total > 0:
        print(f"  Success rate: {(imported/total)*100:.1f}%")
    print(f"{'='*70}")

    return imported == total - skipped and errors == 0

def main():
    """Main entry point."""
    source_path = None
    if len(sys.argv) > 1:
        source_path = sys.argv[1]

    success = import_documents(source_path)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
