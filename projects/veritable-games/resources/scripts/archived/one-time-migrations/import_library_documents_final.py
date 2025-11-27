#!/usr/bin/env python3
"""
Import cleaned library documents into user library database
with anarchist library architecture + 5-tier author + 4-tier tag extraction

Based on:
- import_anarchist_documents_postgres.py
- extract_and_import_anarchist_tags.py

Author: Claude
Date: 2025-11-24
"""

import os
import re
import sys
import yaml
import psycopg2
from pathlib import Path
from datetime import datetime
from collections import Counter
import unicodedata

# Database connection
DB_PARAMS = {
    'dbname': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': '5432'
}

class LibraryImporter:
    def __init__(self, markdown_dir, dry_run=False):
        self.markdown_dir = Path(markdown_dir)
        self.dry_run = dry_run
        self.conn = None
        self.cur = None

        # Statistics
        self.stats = {
            'total': 0,
            'imported': 0,
            'skipped': 0,
            'errors': 0,
            'duplicates': 0,
        }

        # Author extraction stats
        self.author_stats = {
            'yaml': 0,
            'filename': 0,
            'content': 0,
            'source': 0,
            'null': 0,
        }

        # Tag stats
        self.tag_stats = {
            'total_tags': 0,
            'total_associations': 0,
            'new_tags_created': 0,
        }

        # Keyword patterns for tag extraction (Tier 3)
        self.keyword_patterns = {
            'anarchism': re.compile(r'\b(anarchis[mt]|anarcho[-\s]|libertarian socialist)\b', re.I),
            'anarcha-feminism': re.compile(r'\b(anarcha[-\s]?feminis[mt]|feminist anarchis[mt])\b', re.I),
            'anarcho-syndicalism': re.compile(r'\b(anarcho[-\s]?syndicalis[mt]|syndicalist|iww|cnt|fai)\b', re.I),
            'anti-capitalism': re.compile(r'\b(anti[-\s]?capitalis[mt]|anticapitalis[mt])\b', re.I),
            'anti-statism': re.compile(r'\b(anti[-\s]?statist|anti[-\s]?state|stateless)\b', re.I),
            'direct-action': re.compile(r'\b(direct action|direct[-\s]action)\b', re.I),
            'mutual-aid': re.compile(r'\b(mutual aid|mutual[-\s]aid)\b', re.I),
            'ecology': re.compile(r'\b(ecolog[yi]|environmental|climate)\b', re.I),
            'prison-abolition': re.compile(r'\b(prison abolition|abolish prisons|carceral)\b', re.I),
            'police-abolition': re.compile(r'\b(police abolition|abolish police|defund)\b', re.I),
        }

    def connect(self):
        """Connect to database"""
        if not self.dry_run:
            self.conn = psycopg2.connect(**DB_PARAMS)
            self.cur = self.conn.cursor()

    def close(self):
        """Close database connection"""
        if self.cur:
            self.cur.close()
        if self.conn:
            self.conn.close()

    def slugify(self, text):
        """Generate URL-friendly slug from text"""
        # Normalize unicode characters
        text = unicodedata.normalize('NFKD', text)
        text = text.encode('ascii', 'ignore').decode('ascii')

        # Convert to lowercase and replace spaces/special chars with hyphens
        text = text.lower()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[-\s]+', '-', text)
        text = text.strip('-')

        # Limit length
        return text[:200]

    def extract_yaml_frontmatter(self, content):
        """Extract YAML frontmatter from markdown"""
        # Match YAML frontmatter (--- ... ---)
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
        if match:
            yaml_text = match.group(1)
            try:
                metadata = yaml.safe_load(yaml_text)
                # Remove frontmatter from content
                content_without_frontmatter = content[match.end():]
                return metadata or {}, content_without_frontmatter
            except yaml.YAMLError:
                return {}, content
        return {}, content

    def extract_author_tier1_yaml(self, metadata):
        """Tier 1: Extract author from YAML frontmatter"""
        author = metadata.get('author') or metadata.get('Author')
        if author and isinstance(author, str):
            # Filter out bad placeholder values
            bad_values = ['copyright notice', 'author keywords', 'war minister',
                         'nevada legislature', 'license', 'unknown']
            if author.lower() not in bad_values and len(author) > 2:
                return author.strip()
        return None

    def extract_author_tier2_filename(self, filename):
        """Tier 2: Extract author from filename"""
        # Common patterns:
        # "title-author-name-publisher.md"
        # "author-name-title.md"
        # "how-we-learn-rob-gray.md"

        name = filename.stem

        # Remove common suffixes
        name = re.sub(r'-(annas-archive|pdf|epub|mobi|cambridge).*$', '', name, flags=re.I)

        # Look for author patterns after title
        # Pattern: "title-firstname-lastname" or "title-author-name"
        parts = name.split('-')

        # If filename has "by" in it, take what follows
        if 'by' in parts:
            idx = parts.index('by')
            if idx + 1 < len(parts):
                author_parts = parts[idx+1:]
                author = ' '.join(author_parts).title()
                if len(author) > 3:
                    return author

        # Check if last 2-3 parts look like a name (capitalized words)
        if len(parts) >= 3:
            potential_author = ' '.join(parts[-2:]).title()
            # Simple heuristic: if it's 2 words and doesn't contain common title words
            title_words = ['the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'guide', 'manual']
            if len(potential_author.split()) == 2 and not any(word in potential_author.lower() for word in title_words):
                return potential_author

        return None

    def extract_author_tier3_content(self, content):
        """Tier 3: Extract author from content (first 50 lines)"""
        lines = content.split('\n')[:50]

        for line in lines:
            line = line.strip()

            # Pattern: "by Author Name"
            match = re.search(r'\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', line)
            if match:
                return match.group(1)

            # Pattern: "Author: Name"
            match = re.search(r'^Authors?:\s*(.+)$', line, re.I)
            if match:
                author = match.group(1).strip()
                if len(author) > 3 and len(author) < 100:
                    return author

            # Pattern: "Copyright © Year by Author Name"
            match = re.search(r'Copyright.*?(?:by|©)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', line)
            if match:
                return match.group(1)

            # Pattern: "Names: Author, Year" (Library of Congress format)
            match = re.search(r'Names:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),', line)
            if match:
                return match.group(1)

        return None

    def extract_author_tier4_source(self, metadata):
        """Tier 4: Extract author from source/tags metadata"""
        tags = metadata.get('tags') or metadata.get('Tags') or ''
        if isinstance(tags, str):
            # Look for organizational authors in tags
            # Pattern: "Organization Name, 1980s, PDF"
            parts = [p.strip() for p in tags.split(',')]
            if parts:
                # First part often contains organization name
                potential_author = parts[0]
                # Filter out obvious non-authors
                non_authors = ['pdf', 'epub', 'article', 'book', 'wikipedia']
                if potential_author.lower() not in non_authors and len(potential_author) > 3:
                    return potential_author
        return None

    def extract_author(self, filename, content, metadata):
        """5-tier author extraction"""
        # Tier 1: YAML frontmatter
        author = self.extract_author_tier1_yaml(metadata)
        if author:
            self.author_stats['yaml'] += 1
            return author

        # Tier 2: Filename
        author = self.extract_author_tier2_filename(filename)
        if author:
            self.author_stats['filename'] += 1
            return author

        # Tier 3: Content scanning
        author = self.extract_author_tier3_content(content)
        if author:
            self.author_stats['content'] += 1
            return author

        # Tier 4: Source/tags
        author = self.extract_author_tier4_source(metadata)
        if author:
            self.author_stats['source'] += 1
            return author

        # Tier 5: Fallback
        self.author_stats['null'] += 1
        return None

    def extract_tags_tier1_yaml(self, metadata):
        """Tier 1: Extract tags from YAML frontmatter"""
        tags = set()

        # Check various YAML fields
        for field in ['topics', 'tags', 'keywords', 'Tags', 'Topics']:
            value = metadata.get(field)
            if value:
                if isinstance(value, list):
                    tags.update(str(v).strip().lower() for v in value if v)
                elif isinstance(value, str):
                    # Split by comma or semicolon
                    parts = re.split(r'[,;]', value)
                    tags.update(p.strip().lower() for p in parts if p.strip())

        return tags

    def extract_tags_tier2_frequency(self, content, min_freq=3, top_n=10):
        """Tier 2: Frequency analysis of content"""
        # Tokenize content
        words = re.findall(r'\b[a-z]{4,}\b', content.lower())

        # Common stopwords to exclude
        stopwords = {'that', 'this', 'with', 'from', 'have', 'they', 'were',
                    'been', 'which', 'their', 'would', 'there', 'about', 'into',
                    'more', 'these', 'such', 'when', 'them', 'than', 'other',
                    'some', 'only', 'time', 'very', 'what', 'your', 'could',
                    'also', 'even', 'well', 'much', 'many', 'most', 'over'}

        # Count words
        counter = Counter(word for word in words if word not in stopwords)

        # Get top N frequent words
        tags = set()
        for word, count in counter.most_common(top_n):
            if count >= min_freq and len(word) > 4:
                tags.add(word)

        return tags

    def extract_tags_tier3_patterns(self, content):
        """Tier 3: Keyword pattern matching"""
        tags = set()

        for tag_name, pattern in self.keyword_patterns.items():
            if pattern.search(content):
                tags.add(tag_name)

        return tags

    def extract_tags_tier4_metadata(self, metadata, author, publication_date, language):
        """Tier 4: Metadata enrichment (author, era, language)"""
        tags = set()

        # Author tag
        if author:
            author_tag = f"author:{author.lower()}"
            tags.add(author_tag)

        # Language tag
        if language and language != 'en':
            tags.add(language.lower())
        else:
            tags.add('english')

        # Era tags from publication date
        if publication_date:
            match = re.search(r'(\d{4})', str(publication_date))
            if match:
                year = int(match.group(1))
                decade = (year // 10) * 10
                tags.add(f"{decade}s")

                # Period tags
                if year < 1900:
                    tags.add('historical')
                elif year < 1950:
                    tags.add('early-20th-century')
                elif year < 2000:
                    tags.add('late-20th-century')
                else:
                    tags.add('contemporary')

        return tags

    def extract_tags(self, content, metadata, author, publication_date, language):
        """4-tier tag extraction"""
        all_tags = set()

        # Tier 1: YAML frontmatter
        all_tags.update(self.extract_tags_tier1_yaml(metadata))

        # Tier 2: Frequency analysis (only if we have few tags so far)
        if len(all_tags) < 3:
            all_tags.update(self.extract_tags_tier2_frequency(content))

        # Tier 3: Pattern matching
        all_tags.update(self.extract_tags_tier3_patterns(content))

        # Tier 4: Metadata enrichment
        all_tags.update(self.extract_tags_tier4_metadata(metadata, author, publication_date, language))

        # Clean and validate tags
        clean_tags = set()
        for tag in all_tags:
            tag = tag.strip().lower()
            # Remove invalid characters
            tag = re.sub(r'[^\w\s:-]', '', tag)
            tag = re.sub(r'\s+', '-', tag)
            if len(tag) > 1 and len(tag) < 100:
                clean_tags.add(tag)

        return clean_tags

    def get_or_create_tag(self, tag_name):
        """Get tag ID or create if doesn't exist"""
        if self.dry_run:
            return None

        # Check if tag exists
        self.cur.execute(
            "SELECT id FROM shared.tags WHERE name = %s",
            (tag_name,)
        )
        result = self.cur.fetchone()

        if result:
            return result[0]
        else:
            # Create new tag
            self.cur.execute(
                """
                INSERT INTO shared.tags (name, created_at)
                VALUES (%s, NOW())
                RETURNING id
                """,
                (tag_name,)
            )
            tag_id = self.cur.fetchone()[0]
            self.tag_stats['new_tags_created'] += 1
            return tag_id

    def process_file(self, file_path):
        """Process a single markdown file"""
        self.stats['total'] += 1
        filename = file_path

        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                raw_content = f.read()

            # Extract YAML frontmatter
            metadata, content = self.extract_yaml_frontmatter(raw_content)

            # Extract metadata
            title = metadata.get('title') or metadata.get('Title')
            if not title:
                # Try to extract from first H1 heading
                match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                if match:
                    title = match.group(1).strip()
                else:
                    # Use filename as fallback
                    title = file_path.stem.replace('-', ' ').replace('_', ' ').title()

            # Extract author (5-tier)
            author = self.extract_author(filename, content, metadata)

            # Extract other metadata
            publication_date = metadata.get('date') or metadata.get('publication_date')
            language = metadata.get('language', 'en')
            source_url = metadata.get('source') or metadata.get('url')
            document_type = metadata.get('type', 'article')
            notes = metadata.get('notes')

            # Generate slug
            slug = self.slugify(title)

            # Check for duplicate slug
            if not self.dry_run:
                self.cur.execute(
                    "SELECT id FROM library.library_documents WHERE slug = %s",
                    (slug,)
                )
                if self.cur.fetchone():
                    # Append random suffix to make unique
                    import hashlib
                    hash_suffix = hashlib.md5(str(file_path).encode()).hexdigest()[:8]
                    slug = f"{slug}-{hash_suffix}"
                    self.stats['duplicates'] += 1

            # Extract tags (4-tier)
            tags = self.extract_tags(content, metadata, author, publication_date, language)

            # Store document
            if not self.dry_run:
                self.cur.execute(
                    """
                    INSERT INTO library.library_documents
                    (slug, title, author, publication_date, document_type, content,
                     language, file_path, source_url, notes, original_format, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                    """,
                    (slug, title, author, publication_date, document_type, raw_content,
                     language, str(file_path.name), source_url, notes, 'markdown')
                )
                doc_id = self.cur.fetchone()[0]

                # Link tags
                for tag_name in tags:
                    tag_id = self.get_or_create_tag(tag_name)
                    self.cur.execute(
                        """
                        INSERT INTO library.library_document_tags (document_id, tag_id)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (doc_id, tag_id)
                    )
                    self.tag_stats['total_associations'] += 1

                self.conn.commit()

            self.stats['imported'] += 1
            self.tag_stats['total_tags'] += len(tags)

            return {
                'status': 'success',
                'title': title,
                'author': author,
                'tags': len(tags)
            }

        except Exception as e:
            self.stats['errors'] += 1
            return {
                'status': 'error',
                'error': str(e)
            }

    def run(self):
        """Main import process"""
        print("=" * 80)
        print("LIBRARY DOCUMENT IMPORT")
        print("=" * 80)
        print(f"Directory: {self.markdown_dir}")
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        print("=" * 80)
        print()

        # Find all markdown files
        md_files = list(self.markdown_dir.glob('*.md'))
        print(f"Found {len(md_files)} markdown files")
        print()

        # Connect to database
        if not self.dry_run:
            self.connect()
            print("Connected to database")
            print()

        # Process files
        for idx, file_path in enumerate(md_files, 1):
            if idx % 100 == 0 or idx == 1:
                print(f"[{idx}/{len(md_files)}] Processing...")

            result = self.process_file(file_path)

            if result['status'] == 'error':
                print(f"  ERROR {file_path.name}: {result['error']}")

        # Close connection
        if not self.dry_run:
            self.close()

        # Print summary
        print()
        print("=" * 80)
        print("IMPORT SUMMARY")
        print("=" * 80)
        print(f"Total files: {self.stats['total']}")
        print(f"Imported: {self.stats['imported']}")
        print(f"Skipped: {self.stats['skipped']}")
        print(f"Duplicates: {self.stats['duplicates']}")
        print(f"Errors: {self.stats['errors']}")
        print()
        print("AUTHOR EXTRACTION:")
        print(f"  YAML frontmatter: {self.author_stats['yaml']}")
        print(f"  Filename: {self.author_stats['filename']}")
        print(f"  Content: {self.author_stats['content']}")
        print(f"  Source/tags: {self.author_stats['source']}")
        print(f"  NULL: {self.author_stats['null']}")
        print()
        print("TAG EXTRACTION:")
        print(f"  Total tags: {self.tag_stats['total_tags']}")
        print(f"  Avg tags/doc: {self.tag_stats['total_tags'] / max(self.stats['imported'], 1):.1f}")
        print(f"  Total associations: {self.tag_stats['total_associations']}")
        print(f"  New tags created: {self.tag_stats['new_tags_created']}")
        print("=" * 80)

        return 0 if self.stats['errors'] == 0 else 1


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Import cleaned library documents with anarchist schema'
    )
    parser.add_argument(
        'directory',
        type=Path,
        help='Directory containing markdown files'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview without importing'
    )

    args = parser.parse_args()

    importer = LibraryImporter(args.directory, dry_run=args.dry_run)
    sys.exit(importer.run())
