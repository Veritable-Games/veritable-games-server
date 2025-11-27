#!/usr/bin/env python3
"""
Hybrid Tag Extraction and Import for Anarchist Library Documents

This script implements a 4-tier hybrid tagging strategy:
1. Extract from original .muse files (#SORTtopics, #topics) - PRIMARY
2. Extract from converted markdown YAML frontmatter - FALLBACK
3. Auto-generate from content keywords - SUPPLEMENT
4. Enrich with author, era, and language tags - UNIVERSAL

Usage:
    python3 extract_and_import_anarchist_tags.py [--dry-run] [--verbose]

Environment:
    DATABASE_URL: PostgreSQL connection string
"""

import os
import sys
import re
import yaml
import psycopg2
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import argparse

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

MUSE_SOURCE_DIR = Path('/home/user/processing/anarchist-library')
MARKDOWN_DIR = Path('/home/user/converted-markdown')

# Keyword patterns for auto-tagging (Tier 3)
KEYWORD_PATTERNS = {
    'anarcho-syndicalism': [
        r'\btrade union(s)?\b', r'\bsyndicalist(s)?\b', r'\bworkers.? control\b',
        r'\bgeneral strike\b', r'\bCNT\b', r'\bIWW\b', r'\blabor movement\b'
    ],
    'anarcha-feminism': [
        r'\bpatriarchy\b', r'\bfeminis[mt]\b', r'\btransfeminis[mt]\b',
        r'\bintersectionality\b', r'\bgender (liberation|oppression)\b'
    ],
    'ecology': [
        r'\bextinction\b', r'\bbiodiversity\b', r'\becosystem(s)?\b',
        r'\bclimate( change)?\b', r'\benvironmental\b', r'\bspecies\b'
    ],
    'mutual-aid': [
        r'\bmutual aid\b', r'\bKropotkin\b', r'\bcooperation\b',
        r'\bcommunal production\b', r'\bsolidarity\b'
    ],
    'direct-action': [
        r'\bdirect action\b', r'\boccupation(s)?\b', r'\bstrike(s)?\b',
        r'\bsabotage\b', r'\binsurrection\b', r'\bbarricade(s)?\b'
    ],
    'anti-capitalism': [
        r'\bcapitalist exploitation\b', r'\banti-capitalism\b',
        r'\bclass struggle\b', r'\bproletariat\b', r'\bbourgeoisie\b'
    ],
    'anti-statism': [
        r'\banti-state\b', r'\bstateless\b', r'\bgovernment oppression\b',
        r'\banti-authoritarian\b', r'\bstate power\b'
    ],
}

# Language code mapping
LANGUAGE_NAMES = {
    'en': 'English', 'es': 'Spanish', 'de': 'German', 'fr': 'French',
    'ru': 'Russian', 'pt': 'Portuguese', 'pl': 'Polish', 'it': 'Italian',
    'tr': 'Turkish', 'el': 'Greek', 'nl': 'Dutch', 'sv': 'Swedish',
    'cs': 'Czech', 'da': 'Danish', 'fi': 'Finnish', 'ja': 'Japanese',
    'zh': 'Chinese', 'ar': 'Arabic', 'fa': 'Persian', 'he': 'Hebrew',
    'ro': 'Romanian', 'eo': 'Esperanto', 'eu': 'Basque', 'ca': 'Catalan',
    'hr': 'Croatian', 'hu': 'Hungarian', 'lt': 'Lithuanian',
}


class TagExtractor:
    """Extracts tags from multiple sources using hybrid strategy."""

    def __init__(self, verbose=False):
        self.verbose = verbose
        self.stats = defaultdict(int)

    def log(self, message):
        if self.verbose:
            print(f"  {message}")

    def extract_from_muse(self, muse_path):
        """Tier 1: Extract tags from original .muse file."""
        try:
            with open(muse_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            tags = []

            # Try #SORTtopics first (most common)
            match = re.search(r'^#SORTtopics\s+(.+)$', content, re.MULTILINE)
            if match:
                tags = [tag.strip() for tag in match.group(1).split(',')]
                self.stats['tier1_sorttopics'] += 1
                self.log(f"Found {len(tags)} tags in #SORTtopics")
            else:
                # Fall back to #topics
                match = re.search(r'^#topics\s+(.+)$', content, re.MULTILINE)
                if match:
                    tags = [tag.strip() for tag in match.group(1).split(',')]
                    self.stats['tier1_topics'] += 1
                    self.log(f"Found {len(tags)} tags in #topics")

            return [tag for tag in tags if tag]  # Filter empty strings

        except Exception as e:
            self.log(f"Error reading .muse file: {e}")
            return []

    def extract_from_yaml(self, md_path):
        """Tier 2: Extract tags from markdown YAML frontmatter."""
        try:
            with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            # Extract frontmatter
            match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
            if not match:
                return []

            metadata = yaml.safe_load(match.group(1)) or {}
            topics = metadata.get('topics', [])

            if topics:
                if isinstance(topics, list):
                    self.stats['tier2_yaml'] += 1
                    self.log(f"Found {len(topics)} tags in YAML frontmatter")
                    return topics
                elif isinstance(topics, str):
                    tags = [t.strip() for t in topics.split(',')]
                    self.stats['tier2_yaml'] += 1
                    return tags

            return []

        except Exception as e:
            self.log(f"Error parsing YAML frontmatter: {e}")
            return []

    def extract_from_content(self, md_path):
        """Tier 3: Auto-generate tags from content using keyword matching."""
        try:
            with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            # Remove frontmatter
            content = re.sub(r'^---\n.*?\n---\n', '', content, flags=re.DOTALL)

            # Convert to lowercase for case-insensitive matching
            content_lower = content.lower()

            generated_tags = []
            for tag_name, patterns in KEYWORD_PATTERNS.items():
                # Count matches for each pattern
                match_count = sum(len(re.findall(pattern, content_lower, re.IGNORECASE))
                                for pattern in patterns)

                # If we find 2+ matches, add the tag
                if match_count >= 2:
                    generated_tags.append(tag_name)

            if generated_tags:
                self.stats['tier3_content'] += 1
                self.log(f"Generated {len(generated_tags)} tags from content")

            return generated_tags

        except Exception as e:
            self.log(f"Error analyzing content: {e}")
            return []

    def generate_metadata_tags(self, metadata, language):
        """Tier 4: Generate tags from document metadata (author, date, language)."""
        enrichment_tags = []

        # Language tag
        if language:
            lang_name = LANGUAGE_NAMES.get(language, language)
            if lang_name:
                enrichment_tags.append(lang_name)

        # Author tag (if present and not too long)
        author = metadata.get('author')
        if author and len(author) < 50 and author.lower() not in ['various', 'anonymous', 'unknown']:
            enrichment_tags.append(f"author:{author}")

        # Era/decade tag from date
        date = metadata.get('date') or metadata.get('pubdate')
        if date:
            # Try to extract year
            year_match = re.search(r'\b(1[6-9]\d{2}|20\d{2})\b', str(date))
            if year_match:
                year = int(year_match.group(1))
                decade = (year // 10) * 10
                century = (year // 100) + 1

                enrichment_tags.append(f"{decade}s")

                if year < 1900:
                    enrichment_tags.append("historical")
                elif year < 1950:
                    enrichment_tags.append("early-20th-century")
                elif year < 2000:
                    enrichment_tags.append("late-20th-century")
                else:
                    enrichment_tags.append("contemporary")

        if enrichment_tags:
            self.log(f"Added {len(enrichment_tags)} enrichment tags")

        return enrichment_tags

    def extract_all_tags(self, slug, language):
        """Execute full hybrid extraction strategy for a document."""
        all_tags = []

        # Find corresponding .muse and .md files
        muse_path = self.find_muse_file(slug, language)
        md_path = self.find_markdown_file(slug, language)

        if not md_path:
            self.log(f"Markdown file not found for {slug}")
            return []

        # Tier 1: Extract from .muse file (PRIMARY)
        if muse_path and muse_path.exists():
            tags = self.extract_from_muse(muse_path)
            if tags:
                all_tags.extend(tags)
                self.log(f"Tier 1 (.muse): {len(tags)} tags")

        # Tier 2: Extract from markdown YAML (FALLBACK)
        if not all_tags and md_path and md_path.exists():
            tags = self.extract_from_yaml(md_path)
            if tags:
                all_tags.extend(tags)
                self.log(f"Tier 2 (YAML): {len(tags)} tags")

        # Tier 3: Auto-generate from content (SUPPLEMENT for documents with few tags)
        if len(all_tags) < 3 and md_path and md_path.exists():
            tags = self.extract_from_content(md_path)
            all_tags.extend(tags)
            if tags:
                self.log(f"Tier 3 (content): {len(tags)} tags")

        # Tier 4: Add metadata-derived tags (UNIVERSAL)
        if md_path and md_path.exists():
            try:
                with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
                if match:
                    metadata = yaml.safe_load(match.group(1)) or {}
                    enrichment = self.generate_metadata_tags(metadata, language)
                    all_tags.extend(enrichment)
                    if enrichment:
                        self.log(f"Tier 4 (enrichment): {len(enrichment)} tags")
            except Exception as e:
                self.log(f"Error extracting metadata: {e}")

        # Normalize and deduplicate tags
        normalized_tags = []
        seen = set()
        for tag in all_tags:
            # Normalize: lowercase, strip whitespace
            normalized = tag.strip().lower()
            if normalized and normalized not in seen:
                normalized_tags.append(normalized)
                seen.add(normalized)

        if not normalized_tags:
            self.stats['no_tags'] += 1

        return normalized_tags

    def find_muse_file(self, slug, language):
        """Locate the original .muse file for a document."""
        lang_suffix = f'_{language}' if language != 'en' else ''
        dir_name = f'anarchist_library_texts{lang_suffix}'
        muse_dir = MUSE_SOURCE_DIR / dir_name

        # Try exact match first
        muse_path = muse_dir / f'{slug}.muse'
        if muse_path.exists():
            return muse_path

        # Try finding by title match (slug might differ)
        if muse_dir.exists():
            for file in muse_dir.glob('*.muse'):
                if file.stem.lower() == slug.lower():
                    return file

        return None

    def find_markdown_file(self, slug, language):
        """Locate the converted markdown file for a document."""
        lang_suffix = f'_{language}' if language != 'en' else ''
        dir_name = f'anarchist_library_texts{lang_suffix}'
        md_dir = MARKDOWN_DIR / dir_name

        # Try exact match
        md_path = md_dir / f'{slug}.md'
        if md_path.exists():
            return md_path

        # Try case-insensitive search
        if md_dir.exists():
            for file in md_dir.glob('*.md'):
                if file.stem.lower() == slug.lower():
                    return file

        return None


class TagImporter:
    """Imports extracted tags to PostgreSQL database."""

    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.conn = None
        self.cur = None
        self.tag_cache = {}  # name -> id mapping

    def connect(self):
        """Connect to PostgreSQL database."""
        try:
            self.conn = psycopg2.connect(DATABASE_URL)
            self.cur = self.conn.cursor()
            print(f"✓ Connected to database")
        except Exception as e:
            print(f"✗ Error connecting to database: {e}")
            sys.exit(1)

    def close(self):
        """Close database connection."""
        if self.cur:
            self.cur.close()
        if self.conn:
            self.conn.close()

    def get_or_create_tag(self, tag_name):
        """Get existing tag ID or create new tag."""
        # Check cache first
        if tag_name in self.tag_cache:
            return self.tag_cache[tag_name]

        if self.dry_run:
            # In dry-run mode, simulate ID
            tag_id = len(self.tag_cache) + 1
            self.tag_cache[tag_name] = tag_id
            return tag_id

        # Check if tag exists in shared.tags
        self.cur.execute(
            "SELECT id FROM shared.tags WHERE name = %s",
            (tag_name,)
        )
        result = self.cur.fetchone()

        if result:
            tag_id = result[0]
        else:
            # Create new tag in shared.tags
            self.cur.execute(
                "INSERT INTO shared.tags (name) VALUES (%s) RETURNING id",
                (tag_name,)
            )
            tag_id = self.cur.fetchone()[0]

        self.tag_cache[tag_name] = tag_id
        return tag_id

    def link_document_tag(self, document_id, tag_id):
        """Create document-tag association."""
        if self.dry_run:
            return

        try:
            self.cur.execute("""
                INSERT INTO anarchist.document_tags (document_id, tag_id)
                VALUES (%s, %s)
                ON CONFLICT (document_id, tag_id) DO NOTHING
            """, (document_id, tag_id))
        except Exception as e:
            print(f"  Warning: Failed to link tag: {e}")

    def update_tag_usage_counts(self):
        """Update usage_count for all tags based on document associations."""
        if self.dry_run:
            return

        # NOTE: Usage counts are now maintained automatically by triggers
        # on both library.library_document_tags and anarchist.document_tags
        # This manual update is no longer needed but kept for safety
        print("\n🔄 Verifying tag usage counts (maintained by triggers)...")
        self.cur.execute("""
            SELECT COUNT(*) FROM shared.tags WHERE usage_count > 0
        """)
        count = self.cur.fetchone()[0]
        print(f"✓ {count} tags have usage_count > 0 (maintained by triggers)")


def main():
    parser = argparse.ArgumentParser(description='Extract and import anarchist library tags')
    parser.add_argument('--dry-run', action='store_true',
                       help='Print what would be done without modifying database')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Print detailed extraction information')
    parser.add_argument('--limit', type=int, default=None,
                       help='Limit number of documents to process (for testing)')
    args = parser.parse_args()

    print("=" * 80)
    print("ANARCHIST LIBRARY TAG EXTRACTION & IMPORT")
    print("=" * 80)
    print(f"Strategy: 4-Tier Hybrid (Muse → YAML → Content → Enrichment)")
    print(f"Database: {DATABASE_URL}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE IMPORT'}")
    print("=" * 80)
    print()

    # Initialize components
    extractor = TagExtractor(verbose=args.verbose)
    importer = TagImporter(dry_run=args.dry_run)
    importer.connect()

    # Get all documents from database
    print("📚 Loading documents from database...")
    importer.cur.execute("""
        SELECT id, slug, language, title
        FROM anarchist.documents
        ORDER BY id
    """)
    documents = importer.cur.fetchall()
    total = len(documents)

    if args.limit:
        documents = documents[:args.limit]
        print(f"⚠️  Limited to {args.limit} documents for testing")

    print(f"✓ Found {total} documents ({len(documents)} will be processed)")
    print()

    # Process each document
    processed = 0
    total_tags = 0
    errors = 0

    for idx, (doc_id, slug, language, title) in enumerate(documents, 1):
        try:
            if idx % 100 == 0 or idx == 1:
                progress = (idx / len(documents)) * 100
                print(f"\n[{idx:5d}/{len(documents)}] {progress:5.1f}% - Processing: {title[:50]}")

            if args.verbose:
                print(f"\n{title} (id={doc_id}, slug={slug}, lang={language})")

            # Extract tags using hybrid strategy
            tags = extractor.extract_all_tags(slug, language or 'en')

            if tags:
                if args.verbose:
                    print(f"  ✓ Extracted {len(tags)} tags: {', '.join(tags[:5])}{'...' if len(tags) > 5 else ''}")

                # Import tags to database
                for tag_name in tags:
                    tag_id = importer.get_or_create_tag(tag_name)
                    importer.link_document_tag(doc_id, tag_id)

                total_tags += len(tags)
                processed += 1

                # Commit every 100 documents
                if not args.dry_run and idx % 100 == 0:
                    importer.conn.commit()
            else:
                if args.verbose:
                    print(f"  ⚠️  No tags extracted")

        except Exception as e:
            errors += 1
            if errors <= 10:
                print(f"  ✗ Error processing {slug}: {e}")

    # Final commit
    if not args.dry_run:
        importer.conn.commit()

    # Update tag usage counts
    if not args.dry_run:
        importer.update_tag_usage_counts()

    # Print statistics
    print("\n" + "=" * 80)
    print("EXTRACTION STATISTICS")
    print("=" * 80)
    print(f"Documents processed:        {processed:,}")
    print(f"Documents without tags:     {extractor.stats['no_tags']:,}")
    print(f"Total tags created:         {total_tags:,}")
    print(f"Unique tags:                {len(importer.tag_cache):,}")
    print(f"Errors:                     {errors:,}")
    print()
    print("TAG SOURCES:")
    print(f"  Tier 1 (#SORTtopics):     {extractor.stats['tier1_sorttopics']:,}")
    print(f"  Tier 1 (#topics):         {extractor.stats['tier1_topics']:,}")
    print(f"  Tier 2 (YAML):            {extractor.stats['tier2_yaml']:,}")
    print(f"  Tier 3 (Content):         {extractor.stats['tier3_content']:,}")
    print("=" * 80)

    if args.dry_run:
        print("\n⚠️  DRY RUN - No changes were made to the database")
        print("Run without --dry-run to perform actual import")
    else:
        print("\n✓ Import complete!")

    importer.close()


if __name__ == '__main__':
    main()
