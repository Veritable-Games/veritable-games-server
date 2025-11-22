#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 5B: Web-Based Metadata Lookup

Uses web search to find author and publication date metadata for documents
where local extraction failed.

This script:
1. Gets documents without authors/dates from database
2. Searches web for each document title
3. Extracts metadata from search results
4. Updates frontmatter and syncs to database

Usage:
    python3 extract_library_metadata_phase5b_web.py [--dry-run] [--limit N] [--authors-only] [--dates-only]
"""

import os
import sys
import re
import yaml
import time
import psycopg2
from pathlib import Path
from typing import Dict, Optional, Tuple, List

# Database connection
DB_CONNECTION = "postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games"
LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

class WebMetadataExtractor:
    """Extract metadata using web search."""

    def __init__(self):
        self.search_count = 0
        self.rate_limit_delay = 2  # seconds between searches

    def get_documents_needing_metadata(self, limit: Optional[int] = None, authors_only: bool = False, dates_only: bool = False):
        """Get list of documents from database that need metadata."""
        conn = psycopg2.connect(DB_CONNECTION)
        cur = conn.cursor()

        if authors_only:
            where_clause = "author IS NULL"
        elif dates_only:
            where_clause = "publication_date IS NULL"
        else:
            where_clause = "(author IS NULL OR publication_date IS NULL)"

        query = f"""
            SELECT id, title, slug, author, publication_date
            FROM library.library_documents
            WHERE created_by = 3
              AND {where_clause}
            ORDER BY id
        """

        if limit:
            query += f" LIMIT {limit}"

        cur.execute(query)
        results = cur.fetchall()

        cur.close()
        conn.close()

        return results

    def search_metadata(self, title: str) -> Dict:
        """
        Search web for metadata about the document.

        Returns dict with:
        - author: str or None
        - date: str or None
        - source: str (where metadata was found)
        - confidence: int (0-100)
        """
        # This is a placeholder - in real implementation, would use WebSearch tool
        # For now, return None to indicate no metadata found
        return {
            'author': None,
            'date': None,
            'source': None,
            'confidence': 0
        }

    def extract_metadata_from_search_results(self, search_results: str, title: str) -> Dict:
        """
        Parse search results to extract author and publication date.

        Common patterns in search results:
        - Google Books: "Author Name - 2020 - Fiction"
        - Amazon: "by Author Name (Author), Publication Date"
        - Wikipedia: "Article Title - Wikipedia ... written by Author (Date)"
        - Publisher sites: Usually have structured data
        """
        result = {
            'author': None,
            'date': None,
            'source': None,
            'confidence': 0
        }

        # Pattern 1: "by Author Name" in first few lines
        by_match = re.search(r'(?:by|By)\s+([A-Z][a-zA-Z\s\.,\'-]{5,50})', search_results[:500])
        if by_match:
            author = by_match.group(1).strip()
            author = re.sub(r'[,\.]$', '', author)
            words = author.split()
            if 2 <= len(words) <= 5:
                result['author'] = author
                result['confidence'] = 85
                result['source'] = 'web_by_pattern'

        # Pattern 2: Year in parentheses or standalone
        year_match = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', search_results[:500])
        if year_match:
            year = year_match.group(1)
            year_int = int(year)
            if 1800 <= year_int <= 2025:
                result['date'] = year
                if not result['confidence']:
                    result['confidence'] = 75
                if not result['source']:
                    result['source'] = 'web_year_pattern'

        return result

    def update_frontmatter(self, doc_id: int, slug: str, author: Optional[str], date: Optional[str]) -> bool:
        """Update YAML frontmatter for document."""
        # Find markdown file by slug pattern
        pattern = f"*{slug[:50]}*.md"
        md_files = list(LIBRARY_PATH.glob(pattern))

        if not md_files:
            print(f"  Warning: No file found for slug {slug}")
            return False

        md_path = md_files[0]

        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()

            lines = content.split('\n')

            # Check for existing frontmatter
            if lines[0].strip() == '---':
                end_idx = None
                for i in range(1, min(50, len(lines))):
                    if lines[i].strip() == '---':
                        end_idx = i
                        break

                if end_idx:
                    frontmatter_text = '\n'.join(lines[1:end_idx])
                    try:
                        metadata = yaml.safe_load(frontmatter_text) or {}
                    except:
                        metadata = {}

                    # Update metadata
                    if author and not metadata.get('author'):
                        metadata['author'] = author
                    if date and not metadata.get('date'):
                        metadata['date'] = date

                    # Rebuild frontmatter
                    new_frontmatter = yaml.dump(metadata, default_flow_style=False, allow_unicode=True)
                    new_content = f"---\n{new_frontmatter}---\n" + '\n'.join(lines[end_idx+1:])

                    with open(md_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

                    return True

        except Exception as e:
            print(f"  Error updating {md_path.name}: {e}")
            return False

        return False

    def process_documents(self, limit: int = None, dry_run: bool = False, authors_only: bool = False, dates_only: bool = False):
        """
        Process documents without metadata.
        Search web for metadata and update.
        """
        docs = self.get_documents_needing_metadata(limit=limit, authors_only=authors_only, dates_only=dates_only)

        print(f"Found {len(docs)} documents needing metadata")
        print(f"Dry run: {dry_run}")
        print(f"Authors only: {authors_only}")
        print(f"Dates only: {dates_only}")
        print()

        processed = 0
        authors_found = 0
        dates_found = 0
        updated = 0

        for doc_id, title, slug, current_author, current_date in docs:
            processed += 1

            print(f"[{processed}/{len(docs)}] {title[:80]}...")

            # NOTE: In production, this would use the WebSearch tool
            # For now, this is a placeholder showing the structure
            # You would call: self.search_metadata(title)

            # Placeholder - would normally search web here
            metadata = self.search_metadata(title)

            author = metadata.get('author')
            date = metadata.get('date')
            confidence = metadata.get('confidence', 0)

            if author and not current_author:
                authors_found += 1
                print(f"  ✓ Author: {author} ({metadata['source']})")

            if date and not current_date:
                dates_found += 1
                print(f"  ✓ Date: {date} ({metadata['source']})")

            if (author or date) and confidence >= 75:
                if not dry_run:
                    success = self.update_frontmatter(doc_id, slug, author, date)
                    if success:
                        updated += 1
                print()

            # Rate limiting
            if self.search_count > 0 and self.search_count % 10 == 0:
                print(f"  (Rate limit pause...)")
                time.sleep(self.rate_limit_delay)

            self.search_count += 1

        print()
        print("=" * 70)
        print("PHASE 5B COMPLETE")
        print("=" * 70)
        print(f"Documents processed: {processed}")
        print(f"Authors found: {authors_found}")
        print(f"Dates found: {dates_found}")
        print(f"Documents updated: {updated}")
        print()
        print("NOTE: This is a placeholder implementation.")
        print("To enable web search, integrate with WebSearch tool or API.")
        print()


def main():
    dry_run = '--dry-run' in sys.argv
    authors_only = '--authors-only' in sys.argv
    dates_only = '--dates-only' in sys.argv
    limit = None

    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    extractor = WebMetadataExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run, authors_only=authors_only, dates_only=dates_only)


if __name__ == '__main__':
    main()
