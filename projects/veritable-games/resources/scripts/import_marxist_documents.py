#!/usr/bin/env python3
"""
Import Marxist Library documents to PostgreSQL database.

Parses 12,731 Marxist documents from markdown files (scraped from Marxists.org)
and imports them into the marxist schema with unified tag support.

Usage:
    python3 import_marxist_documents.py \
      --source-dir /path/to/marxists_org_texts \
      --database postgresql://user:pass@host/db \
      --batch-size 1000 \
      --log-file logs/marxist-import-20260220.log

Data Source:
    /home/user/projects/veritable-games/resources/data/scraping/marxists-org/marxists_org_texts/
    - 12,731 markdown files
    - Format: Markdown with metadata headers
    - Content: Full document text from Marxists.org
"""

import os
import sys
import re
import argparse
import logging
import hashlib
from pathlib import Path
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_batch
import unicodedata

# ============================================================================
# CONFIGURATION
# ============================================================================

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/veritable_games?sslmode=disable')

MARXIST_TAG_PATTERNS = {
    'marxism': [r'\b(?:marxis[mt]|marxist|marxian)\b'],
    'socialism': [r'\b(?:socialis[mt]|socialist|socially?)\b'],
    'communism': [r'\b(?:communis[mt]|communist|communal)\b'],
    'class-struggle': [r'\b(?:class struggle|bourgeoisie|proletariat|working class)\b'],
    'dialectics': [r'\b(?:dialec(?:tic|tical)?|contradiction|dialectical)\b'],
    'imperialism': [r'\b(?:imperialis[mt]|imperialist|empire)\b'],
    'colonialism': [r'\b(?:colonialis[mt]|colonialist|colonial)\b'],
    'revolution': [r'\b(?:revolution(?:ary)?|insurrection|revolt)\b'],
    'labor': [r'\b(?:labour?|worker|trade union|laborer)\b'],
    'political-economy': [r'\b(?:political economy|capital|surplus value|commodity)\b'],
    'capitalism': [r'\b(?:capitalis[mt]|capitalist|capital accumulation)\b'],
    'nationalism': [r'\b(?:nationalism|nationalist|nation state)\b'],
    'democracy': [r'\b(?:democracy|democratic|dictatorship)\b'],
    'history': [r'\b(?:history|historical|epochs?|historical materialism)\b'],
    'philosophy': [r'\b(?:philosophy|philosophical|ideology|dialectical)\b'],
}

AUTHOR_TAGS = {
    'Lenin': ['lenin', 'bolshevism', 'vanguard-party', 'soviet'],
    'Marx': ['marx', 'capital', 'materialism'],
    'Engels': ['engels', 'marxism', 'german-ideology'],
    'Trotsky': ['trotsky', 'permanent-revolution', 'trotskyism'],
    'Luxemburg': ['luxemburg', 'rosa', 'spontaneity'],
    'Stalin': ['stalin', 'soviet', 'socialism-in-one-country'],
    'Gramsci': ['gramsci', 'hegemony', 'cultural-marxism'],
    'Lukacs': ['lukacs', 'reification', 'consciousness'],
    'Mao': ['mao', 'maoism', 'peasant-revolution'],
}

CATEGORY_PATTERNS = {
    'lenin': [r'/lenin/'],
    'marx': [r'/marx/', r'/archive/m/marx'],
    'trotsky': [r'/trotsky/', r'/archive/t/trotsky'],
    'stalin': [r'/stalin/', r'/archive/s/stalin'],
    'engels': [r'/engels/', r'/archive/e/engels'],
    'luxemburg': [r'/luxemburg/', r'/archive/l/luxemburg'],
    'french-left': [r'/france/', r'/french/', r'/archive/f'],
    'italian-left': [r'/italy/', r'/italian/', r'/archive/i'],
    'german-left': [r'/germany/', r'/german/', r'/archive/g'],
    'soviet': [r'/soviet/', r'/ussr/'],
    'chinese': [r'/china/', r'/mao/', r'/archive/c'],
}

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_file):
    """Configure logging to file and console."""
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def sanitize_slug(text: str, max_length: int = 200) -> str:
    """Create URL-safe slug from text."""
    # Normalize unicode
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')

    # Convert to lowercase and replace spaces with hyphens
    text = re.sub(r'[^\w\s-]', '', text).strip()
    text = re.sub(r'[-\s]+', '-', text).lower()

    # Trim to max length
    if len(text) > max_length:
        text = text[:max_length].rstrip('-')

    return text or 'untitled'

def generate_unique_slug(author: str, title: str, source_url: str) -> str:
    """Generate unique slug with hash suffix for collision prevention.

    When author is unknown or slug would be generic, add hash suffix
    derived from source URL to ensure uniqueness.
    """
    base_slug = f"{sanitize_slug(author)}-{sanitize_slug(title)}"

    # If author is Unknown or slug is too generic, add hash suffix
    if author == 'Unknown' or base_slug in ('unknown-untitled', 'unknown-source', 'archive-source'):
        # Create hash from URL for uniqueness
        url_hash = hashlib.md5(source_url.encode()).hexdigest()[:8]
        base_slug = f"{base_slug}-{url_hash}"

    return base_slug

def extract_source_url(content: str) -> str:
    """Extract source URL from markdown metadata."""
    # Look for markdown link or raw URL
    url_patterns = [
        r'\[Source\]\((https?://[^\)]+)\)',
        r'Source:\s*(https?://\S+)',
        r'URL:\s*(https?://\S+)',
        r'https?://www\.marxists\.org/[^\s\)]*',
    ]

    for pattern in url_patterns:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            if match.groups():
                return match.group(1)
            return match.group(0)

    # Default fallback
    return 'https://www.marxists.org/'

def extract_author_from_url(url: str) -> str:
    """Extract author name from Marxists.org URL."""
    # Patterns like /archive/lenin/ or /lenin/
    patterns = [
        r'/(?:archive/)?([a-z]+)/',
        r'/(?:archive/\w/)?([a-z]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, url.lower())
        if match:
            author_code = match.group(1)
            # Map to full names
            author_map = {
                'l': 'Lenin', 'lenin': 'Lenin',
                'm': 'Marx', 'marx': 'Marx',
                'e': 'Engels', 'engels': 'Engels',
                't': 'Trotsky', 'trotsky': 'Trotsky',
                's': 'Stalin', 'stalin': 'Stalin',
                'luxemburg': 'Luxemburg', 'r': 'Luxemburg',
                'g': 'Gramsci', 'gramsci': 'Gramsci',
            }
            return author_map.get(author_code, author_code.title())

    return 'Unknown'

def extract_author_from_filepath(file_path: Path) -> str:
    """Extract author from directory structure as fallback.

    Example: marxists_org_texts/archive/lenin/1920/article.md -> Lenin
    """
    parts = file_path.parts

    # Look for archive patterns in path
    for i, part in enumerate(parts):
        if part == 'archive' and i + 1 < len(parts):
            # Next part should be author code or single letter
            author_code = parts[i + 1].lower()
            author_map = {
                'l': 'Lenin', 'lenin': 'Lenin',
                'm': 'Marx', 'marx': 'Marx',
                'e': 'Engels', 'engels': 'Engels',
                't': 'Trotsky', 'trotsky': 'Trotsky',
                's': 'Stalin', 'stalin': 'Stalin',
                'luxemburg': 'Luxemburg', 'r': 'Luxemburg',
                'g': 'Gramsci', 'gramsci': 'Gramsci',
                'a': 'Anonymous',
                'b': 'Bebel', 'bebel': 'Bebel',
                'h': 'Harman', 'harman': 'Harman',
                'k': 'Kautsky', 'kautsky': 'Kautsky',
                'p': 'Plekhanov', 'plekhanov': 'Plekhanov',
            }
            if author_code in author_map:
                return author_map[author_code]
            if len(author_code) > 2:
                return author_code.title()

    return 'Unknown'

def extract_title_from_content(content: str) -> str:
    """Extract title from markdown content.

    Skips common metadata headers (Source, Archive, Index, etc.) and looks for
    actual article titles, preferring H3 headers (###) which are likely the main content.
    """
    # Headers to skip - these are metadata, not titles
    metadata_headers = {
        'source', 'archive', 'index', 'contents', 'table of contents',
        'published', 'written', 'first printed', 'first published',
        'transcribed', 'html markup', 'note', 'editor\'s note', 'translator\'s note'
    }

    lines = content.strip().split('\n')

    # First pass: Look for H3 headers (###) which are likely real content titles
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('###'):
            # This is an H3 header - likely the real title
            title = re.sub(r'^#+\s*', '', stripped).strip()
            # Remove markdown links
            title = re.sub(r'\[([^\]]+)\]\([^\)]*\)', r'\1', title)
            if title and title.lower() not in metadata_headers:
                return title[:200] if len(title) > 200 else title

    # Second pass: Look for H2 or H1 headers (## or #) that aren't metadata
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('##') or stripped.startswith('#'):
            title = re.sub(r'^#+\s*', '', stripped).strip()
            # Remove markdown links
            title = re.sub(r'\[([^\]]+)\]\([^\)]*\)', r'\1', title)
            # Skip metadata headers
            if title and title.lower() not in metadata_headers:
                return title[:200] if len(title) > 200 else title

    # Third pass: Look for first substantial non-empty line that isn't metadata
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('#'):
            # This is a non-header line - likely a paragraph title or opening
            title = stripped.strip('*_`').strip()
            # Skip if it's metadata or too short
            if title and len(title) > 5 and title.lower() not in metadata_headers:
                return title[:200] if len(title) > 200 else title

    return 'Untitled Document'

def extract_category_from_url(url: str) -> str:
    """Extract category from URL path."""
    url_lower = url.lower()
    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, url_lower):
                return category
    return 'marxist-theory'

def extract_title_from_filename(file_path: Path) -> str:
    """Extract title from filename as fallback when content extraction fails.

    Converts 'my-document-name.md' to 'My Document Name'
    """
    # Get filename without extension
    filename = file_path.stem
    # Replace hyphens and underscores with spaces
    title = re.sub(r'[-_]+', ' ', filename)
    # Capitalize words
    title = ' '.join(word.capitalize() for word in title.split())
    return title if title else 'Untitled Document'

def extract_tags_from_content(content: str, author: str = '', url: str = '') -> list:
    """Extract tags from content and metadata."""
    tags = set()

    # Add author-based tags
    for auth, auth_tags in AUTHOR_TAGS.items():
        if auth.lower() in author.lower():
            tags.update(auth_tags)
            break

    # Add category-based tags
    category = extract_category_from_url(url)
    tags.add(category)

    # Add content-based tags
    content_lower = content.lower()
    for tag, patterns in MARXIST_TAG_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, content_lower):
                tags.add(tag)
                break

    # Always add base tags
    tags.add('marxism')
    tags.add('political-economy')

    return sorted(list(tags))

# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

def get_or_create_tags(conn, tags: list) -> dict:
    """Get or create tags in shared.tags, return mapping of tag_name -> tag_id."""
    if not tags:
        return {}

    try:
        cur = conn.cursor()
        tag_map = {}

        for tag_name in tags:
            # Try to find existing tag
            cur.execute(
                "SELECT id FROM shared.tags WHERE name = %s",
                (tag_name,)
            )
            result = cur.fetchone()

            if result:
                tag_map[tag_name] = result[0]
            else:
                # Create new tag
                cur.execute(
                    "INSERT INTO shared.tags (name, description, created_at) VALUES (%s, %s, NOW()) RETURNING id",
                    (tag_name, f"Marxist content tag: {tag_name}")
                )
                tag_map[tag_name] = cur.fetchone()[0]

        conn.commit()
        return tag_map
    except Exception as e:
        logging.error(f"Error creating tags: {e}")
        conn.rollback()
        return {}

def insert_documents_batch(conn, documents: list) -> int:
    """Insert a batch of documents, return count of inserted records."""
    if not documents:
        return 0

    try:
        cur = conn.cursor()

        insert_query = """
            INSERT INTO marxist.documents
            (slug, title, author, language, content, source_url, document_type, category, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
        """

        rows = []
        for d in documents:
            rows.append((
                d['slug'],
                d['title'],
                d['author'],
                d['language'],
                d['content'],
                d['source_url'],
                d['document_type'],
                d['category'],
                d['notes']
            ))

        # Use executemany for batch performance
        cur.executemany(
            insert_query.replace('RETURNING id', ''),
            rows
        )

        # Count inserted
        count = cur.rowcount
        conn.commit()
        logging.info(f"Inserted {count} documents in batch")
        return count
    except Exception as e:
        logging.error(f"Error inserting documents batch: {e}")
        conn.rollback()
        return 0

def associate_tags_batch(conn, document_data: list) -> int:
    """Associate tags with documents in batch."""
    if not document_data:
        return 0

    try:
        cur = conn.cursor()
        associations = []

        for d in document_data:
            # Get document ID by slug
            cur.execute(
                "SELECT id FROM marxist.documents WHERE slug = %s",
                (d['slug'],)
            )
            result = cur.fetchone()
            if not result:
                continue

            document_id = result[0]
            tags = d.get('tags', [])

            for tag_name in tags:
                # Get tag ID
                cur.execute(
                    "SELECT id FROM shared.tags WHERE name = %s",
                    (tag_name,)
                )
                tag_result = cur.fetchone()
                if tag_result:
                    associations.append((document_id, tag_result[0]))

        # Batch insert associations
        if associations:
            cur.executemany(
                "INSERT INTO marxist.document_tags (document_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                associations
            )
            count = cur.rowcount
            conn.commit()
            logging.info(f"Created {count} tag associations")
            return count

        return 0
    except Exception as e:
        logging.error(f"Error associating tags: {e}")
        conn.rollback()
        return 0

# ============================================================================
# IMPORT FUNCTIONS
# ============================================================================

def import_marxist_documents(source_dir: str, database_url: str, batch_size: int = 1000):
    """Import Marxist documents from source directory to database."""
    source_path = Path(source_dir)

    if not source_path.exists():
        logging.error(f"Source directory does not exist: {source_path}")
        return False

    # Connect to database
    try:
        conn = psycopg2.connect(database_url)
        logging.info(f"Connected to database: {database_url}")
    except Exception as e:
        logging.error(f"Failed to connect to database: {e}")
        return False

    # Find all document files
    document_files = list(source_path.rglob('*.md'))
    total_files = len(document_files)
    logging.info(f"Found {total_files} document files in {source_path}")

    if total_files == 0:
        logging.warning("No document files found!")
        conn.close()
        return False

    # Process documents
    documents_batch = []
    processed = 0
    skipped = 0

    for idx, file_path in enumerate(document_files, 1):
        try:
            # Read file
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            if not content.strip():
                skipped += 1
                continue

            # Extract metadata
            source_url = extract_source_url(content)
            author = extract_author_from_url(source_url)

            # Fallback to filepath-based author extraction if URL extraction fails
            if author == 'Unknown':
                author = extract_author_from_filepath(file_path)
                if author != 'Unknown':
                    logging.debug(f"Using filepath-based author for {file_path.name}: {author}")

            category = extract_category_from_url(source_url)
            title = extract_title_from_content(content)

            # Fallback to filename if title looks generic or problematic
            # (e.g., "Source" or "Untitled Document" from failed extraction)
            if title in ('Source', 'Untitled Document', 'Archive', 'Index') or len(title) < 3:
                filename_title = extract_title_from_filename(file_path)
                if filename_title and filename_title != 'Untitled Document':
                    title = filename_title
                    logging.debug(f"Using filename-based title for {file_path.name}: {title}")

            tags = extract_tags_from_content(content, author, source_url)

            # Generate unique slug with hash suffix for collision prevention
            slug = generate_unique_slug(author, title, source_url)

            document = {
                'slug': slug,
                'title': title,
                'author': author,
                'language': 'en',
                'content': content,
                'source_url': source_url,
                'document_type': 'article',
                'category': category,
                'notes': f"{len(content)} characters, {len(content.split())} words from {source_url}",
                'tags': tags
            }

            documents_batch.append(document)

            # Log progress
            if idx % 1000 == 0:
                logging.info(f"Processed {idx}/{total_files} documents ({processed} inserted, {skipped} skipped)")

            # Insert batch when size reached
            if len(documents_batch) >= batch_size:
                inserted = insert_documents_batch(conn, documents_batch)
                processed += inserted

                # Associate tags
                associated = associate_tags_batch(conn, documents_batch)

                documents_batch = []

        except Exception as e:
            logging.error(f"Error processing {file_path}: {e}")
            skipped += 1
            continue

    # Insert remaining batch
    if documents_batch:
        inserted = insert_documents_batch(conn, documents_batch)
        processed += inserted
        associated = associate_tags_batch(conn, documents_batch)

    # Final statistics
    logging.info(f"\n{'='*60}")
    logging.info(f"IMPORT COMPLETE")
    logging.info(f"{'='*60}")
    logging.info(f"Total files processed: {processed}")
    logging.info(f"Skipped: {skipped}")
    logging.info(f"Failed: {total_files - processed - skipped}")

    # Verify
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM marxist.documents")
        total_documents = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM marxist.document_tags")
        total_tags = cur.fetchone()[0]

        logging.info(f"Database verification:")
        logging.info(f"  Total documents in database: {total_documents}")
        logging.info(f"  Total tag associations: {total_tags}")
    except Exception as e:
        logging.error(f"Error verifying: {e}")

    conn.close()
    logging.info(f"Disconnected from database")
    return True

# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Import Marxist documents to PostgreSQL database'
    )
    parser.add_argument(
        '--source-dir',
        default='/home/user/projects/veritable-games/resources/data/scraping/marxists-org/marxists_org_texts',
        help='Source directory containing document files'
    )
    parser.add_argument(
        '--database',
        default=DATABASE_URL,
        help='PostgreSQL database URL'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=1000,
        help='Batch size for imports'
    )
    parser.add_argument(
        '--log-file',
        default=f'/home/user/projects/veritable-games/resources/logs/marxist-import-{datetime.now().strftime("%Y%m%d")}.log',
        help='Log file path'
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.log_file)

    logging.info(f"Starting Marxist document import")
    logging.info(f"Source directory: {args.source_dir}")
    logging.info(f"Database: {args.database}")
    logging.info(f"Batch size: {args.batch_size}")
    logging.info(f"Log file: {args.log_file}")

    # Run import
    success = import_marxist_documents(
        args.source_dir,
        args.database,
        args.batch_size
    )

    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
