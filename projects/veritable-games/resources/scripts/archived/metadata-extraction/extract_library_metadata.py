#!/usr/bin/env python3
"""
Library Metadata Extraction Script

Extracts author and publication date from markdown content using multi-strategy approach.

Based on analysis of document types:
- TYPE A (60-70%): PDF conversions - medium success
- TYPE B (20%): Web articles - high success (85-95%)
- TYPE C (10%): Academic papers - medium-low success
- TYPE D (10%): Special formats - low success

Usage:
    python3 extract_library_metadata.py [--dry-run] [--limit N] [--confidence LEVEL]

Options:
    --dry-run: Show what would be updated without making changes
    --limit N: Process only first N documents
    --confidence LEVEL: Minimum confidence (low/medium/high), default: medium
"""

import os
import sys
import re
import psycopg2
from pathlib import Path
from typing import Dict, Optional, Tuple
from datetime import datetime

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')


class MetadataExtractor:
    """Multi-strategy metadata extraction from markdown content."""

    def __init__(self):
        self.stats = {
            'total': 0,
            'updated': 0,
            'already_has_metadata': 0,
            'no_metadata_found': 0,
            'by_strategy': {},
            'by_confidence': {'high': 0, 'medium': 0, 'low': 0},
        }

    def extract_title_from_content(self, content: str) -> Optional[str]:
        """Extract title from markdown # heading."""
        lines = content.split('\n')
        for line in lines[:50]:
            line = line.strip()
            if line.startswith('# '):
                title = line[2:].strip()
                title = re.sub(r'#+$', '', title).strip()
                return title
        return None

    def generate_slug(self, title: str) -> str:
        """Generate slug from title (matching import script)."""
        slug = title.lower()
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = slug.strip('-')
        if len(slug) > 200:
            slug = slug[:200].rstrip('-')
        return slug

    def is_valid_author_name(self, name: str) -> bool:
        """Validate author name format."""
        if not name or len(name) < 3:
            return False

        # Must have at least one capital letter
        if not any(c.isupper() for c in name):
            return False

        # Must not be all caps (likely a typo or acronym)
        if name.isupper():
            return False

        # Should look like a name (letters, spaces, dots, commas, hyphens, apostrophes)
        if not re.match(r'^[A-Z][a-zA-Z\s\.,\'-]+$', name):
            return False

        # Filter out common false positives
        false_positives = [
            'print', 'web', 'published', 'welcome', 'reply', 'libcom',
            'dictatorship', 'dictator', 'president', 'union', 'strike',
            'defeat', 'ends', 'against', 'overthrows', 'brings', 'down'
        ]
        name_lower = name.lower()
        for fp in false_positives:
            if fp in name_lower:
                return False

        # Must have at least one space (first name + last name)
        # Exception: single-word names like "Aristotle" (historical authors)
        if ' ' not in name and len(name) < 12:
            # Single word names should be at least 5 chars and start with capital
            if len(name) < 5:
                return False

        return True

    def is_valid_date(self, date_str: str) -> bool:
        """Validate publication date reasonableness."""
        if not date_str:
            return False

        # Reject obvious conversion timestamps
        if '(conversion date)' in date_str:
            return False

        # Reject standalone current year (likely conversion timestamp)
        if date_str.strip() in ['2024', '2025']:
            return False

        # Extract year from date string
        year_match = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', date_str)
        if not year_match:
            return False

        year = int(year_match.group(1))
        # Reasonable publication date range
        return 1800 <= year <= 2024  # Cap at 2024 to avoid conversion timestamps

    def extract_metadata(self, content: str) -> Dict[str, any]:
        """
        Multi-strategy metadata extraction.

        Returns: {
            'author': str | None,
            'publication_date': str | None,
            'confidence': 'high' | 'medium' | 'low',
            'strategy': str
        }
        """
        lines = content.split('\n')
        header_lines = lines[:100]
        footer_lines = lines[-50:] if len(lines) > 50 else []

        author = None
        publication_date = None
        strategy = 'none'
        confidence = 'low'

        # ===================================================================
        # STRATEGY 1: Structured metadata (TYPE B - highest confidence)
        # ===================================================================
        for i, line in enumerate(header_lines):
            # Pattern: "By [Author] -" or "By [Author]\n"
            if re.match(r'^By\s+([A-Z])', line):
                match = re.search(r'^By\s+([A-Z][a-zA-Z\s\.,\'-]+?)(?:\s*-|$)', line)
                if match:
                    candidate = match.group(1).strip()
                    if self.is_valid_author_name(candidate):
                        author = candidate
                        strategy = 'structured_by'
                        confidence = 'high'

            # Pattern: "Author: [Name]"
            if line.startswith('Author:'):
                candidate = line.replace('Author:', '').strip()
                if self.is_valid_author_name(candidate):
                    author = candidate
                    strategy = 'structured_author'
                    confidence = 'high'

            # Pattern: "Date: [date]" or "Published: [date]"
            if line.startswith('Date:') or line.startswith('Published:'):
                date_candidate = re.sub(r'^(Date|Published):\s*', '', line).strip()
                if self.is_valid_date(date_candidate):
                    publication_date = date_candidate
                    if confidence != 'high':
                        confidence = 'high'

        # If we found structured metadata, return early (highest confidence)
        if author and publication_date and confidence == 'high':
            return {
                'author': author,
                'publication_date': publication_date,
                'confidence': 'high',
                'strategy': strategy
            }

        # ===================================================================
        # STRATEGY 2: Author at document end (TYPE B variant)
        # ===================================================================
        if not author and footer_lines:
            for line in reversed(footer_lines):
                line = line.strip()
                # Look for standalone author name (single line with name pattern)
                if line and not line.startswith('#') and not line.startswith('*'):
                    # Check if it looks like a name
                    if self.is_valid_author_name(line) and len(line.split()) <= 5:
                        author = line
                        strategy = 'footer_author'
                        confidence = 'medium' if not publication_date else 'high'
                        break

        # ===================================================================
        # STRATEGY 3: "Written by" pattern (TYPE D)
        # ===================================================================
        if not author:
            for line in header_lines:
                match = re.search(r'(?:Written|Screenplay)\s+by\s+([A-Z][a-zA-Z\s\.,\'&-]+)', line, re.IGNORECASE)
                if match:
                    candidate = match.group(1).strip()
                    if self.is_valid_author_name(candidate):
                        author = candidate
                        strategy = 'written_by'
                        confidence = 'medium'
                        break

        # ===================================================================
        # STRATEGY 4: Academic format (TYPE C) - author in first 20 lines
        # ===================================================================
        if not author:
            for line in header_lines[:20]:
                line = line.strip()
                # Skip markdown headings and common non-author lines
                if line.startswith('#') or len(line) < 5 or len(line) > 60:
                    continue

                # Look for name-like patterns (no special chars except space, dot, comma)
                if re.match(r'^[A-Z][a-zA-Z\s\.,\'-]+$', line):
                    # Check if it's 2-5 words (typical name length)
                    word_count = len(line.split())
                    if 2 <= word_count <= 5:
                        if self.is_valid_author_name(line):
                            author = line
                            strategy = 'academic_header'
                            confidence = 'medium'
                            break

        # ===================================================================
        # STRATEGY 5: Date patterns in content
        # ===================================================================
        if not publication_date:
            for line in header_lines:
                # Pattern: "Month DD, YYYY" (most common)
                match = re.search(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b', line)
                if match:
                    publication_date = match.group(0)
                    if confidence == 'low':
                        confidence = 'medium'
                    break

            # Fallback: Just look for year in first 50 lines
            if not publication_date:
                for line in header_lines[:50]:
                    match = re.search(r'\b(19[89]\d|20[0-2]\d)\b', line)
                    if match:
                        # Check context to avoid false positives (page numbers, etc.)
                        if 'published' in line.lower() or 'copyright' in line.lower() or len(line) < 50:
                            publication_date = match.group(1)
                            confidence = 'low' if not author else 'medium'
                            break

        # ===================================================================
        # STRATEGY 6: Conversion timestamp (fallback - marked low confidence)
        # ===================================================================
        if not publication_date:
            for line in footer_lines:
                if 'Conversion completed:' in line or 'Converted:' in line:
                    # Extract date from conversion timestamp
                    match = re.search(r'((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?([A-Z][a-z]+)\s+(\d{1,2})\s+.*?(\d{4})', line)
                    if match:
                        month = match.group(2)
                        day = match.group(3)
                        year = match.group(4)
                        publication_date = f"{month} {day}, {year} (conversion date)"
                        # Keep confidence low since this is NOT the publication date
                        if not author:
                            confidence = 'low'
                        break

        # Final confidence adjustment
        if author and publication_date:
            # Both found - upgrade confidence if not already high
            if confidence == 'low':
                confidence = 'medium'
        elif not author and not publication_date:
            confidence = 'low'

        return {
            'author': author,
            'publication_date': publication_date,
            'confidence': confidence,
            'strategy': strategy if (author or publication_date) else 'none'
        }


def extract_metadata_from_files(dry_run=False, limit=None, min_confidence='medium'):
    """Main extraction function."""

    print("="*70)
    print("Library Metadata Extraction")
    print("="*70)
    print()

    if dry_run:
        print("🔍 DRY-RUN MODE - No changes will be made")
    if limit:
        print(f"📊 Processing first {limit} documents")
    print(f"✓ Minimum confidence: {min_confidence}\n")

    extractor = MetadataExtractor()

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Get all library documents without metadata
        cur.execute("""
            SELECT id, slug, title, author, publication_date
            FROM library.library_documents
            WHERE created_by = 3
            ORDER BY id
        """)
        all_docs = cur.fetchall()

        print(f"Found {len(all_docs)} total library documents")

        # Filter to only those without metadata
        docs_to_process = [
            doc for doc in all_docs
            if not (doc[3] and doc[4])  # author and publication_date
        ]

        print(f"Processing {len(docs_to_process)} documents without metadata\n")

        if limit:
            docs_to_process = docs_to_process[:limit]

        # Get all markdown files for lookup
        md_files = {md_path.name: md_path for md_path in LIBRARY_PATH.glob('*.md')}

        confidence_levels = {'low': 1, 'medium': 2, 'high': 3}
        min_conf_level = confidence_levels.get(min_confidence, 2)

        for idx, (doc_id, slug, db_title, current_author, current_pub_date) in enumerate(docs_to_process, 1):
            extractor.stats['total'] += 1

            # Try to find markdown file by reconstructing filename from slug
            # This is heuristic - we look for files ending with the slug
            matching_files = [name for name in md_files.keys() if slug in name.lower()]

            if not matching_files:
                extractor.stats['no_metadata_found'] += 1
                continue

            # Use first match
            md_path = md_files[matching_files[0]]

            # Read content
            try:
                with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                print(f"[{idx:5d}] ERROR reading {md_path.name}: {e}")
                continue

            # Extract metadata
            result = extractor.extract_metadata(content)

            author = result['author']
            pub_date = result['publication_date']
            confidence = result['confidence']
            strategy = result['strategy']

            # Check if meets minimum confidence
            if confidence_levels.get(confidence, 0) < min_conf_level:
                continue

            # Skip if no new metadata found
            if not author and not pub_date:
                extractor.stats['no_metadata_found'] += 1
                continue

            # Update stats
            extractor.stats['by_confidence'][confidence] += 1
            extractor.stats['by_strategy'][strategy] = extractor.stats['by_strategy'].get(strategy, 0) + 1

            if dry_run:
                print(f"[{idx:5d}] {'✓' if confidence == 'high' else '~' if confidence == 'medium' else '?'} {db_title[:55]}")
                print(f"          File: {md_path.name[:60]}")
                if author:
                    print(f"          Author: {author} ({confidence} confidence)")
                if pub_date:
                    print(f"          Date: {pub_date} ({confidence} confidence)")
                print(f"          Strategy: {strategy}")
                print()
            else:
                # Update database
                cur.execute("""
                    UPDATE library.library_documents
                    SET author = COALESCE(%s, author),
                        publication_date = COALESCE(%s, publication_date),
                        updated_at = NOW()
                    WHERE id = %s
                """, (author, pub_date, doc_id))

                print(f"[{idx:5d}] UPDATED: {db_title[:60]}")
                if author:
                    print(f"          Author: {author}")
                if pub_date:
                    print(f"          Date: {pub_date}")
                print(f"          Confidence: {confidence}, Strategy: {strategy}")
                print()

            extractor.stats['updated'] += 1

        if not dry_run:
            conn.commit()
            print("\n✓ Committed changes to database")
        else:
            print("\nDRY-RUN - No changes committed")

        # Print summary
        print(f"\n{'='*70}")
        print("EXTRACTION SUMMARY")
        print(f"{'='*70}")
        print(f"Total documents processed: {extractor.stats['total']}")
        print(f"Documents updated: {extractor.stats['updated']}")
        print(f"No metadata found: {extractor.stats['no_metadata_found']}")
        print()
        print("By Confidence:")
        for conf in ['high', 'medium', 'low']:
            count = extractor.stats['by_confidence'][conf]
            if count > 0:
                print(f"  {conf.capitalize()}: {count}")
        print()
        print("By Strategy:")
        for strategy, count in sorted(extractor.stats['by_strategy'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {strategy}: {count}")
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
    limit = None
    min_confidence = 'medium'

    # Parse --limit
    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    # Parse --confidence
    if '--confidence' in sys.argv:
        try:
            conf_idx = sys.argv.index('--confidence')
            min_confidence = sys.argv[conf_idx + 1]
            if min_confidence not in ['low', 'medium', 'high']:
                print("Error: --confidence must be low, medium, or high")
                sys.exit(1)
        except IndexError:
            print("Error: --confidence requires a value (low/medium/high)")
            sys.exit(1)

    extract_metadata_from_files(dry_run=dry_run, limit=limit, min_confidence=min_confidence)
