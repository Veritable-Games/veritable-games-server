#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 5A: Enhanced Pattern Extraction

Catches patterns missed by previous phases:
1. Authors after "An - Author Name" patterns
2. Multi-author works with commas
3. Authors after introductions/forwards
4. Publication dates in content and titles

Usage:
    python3 extract_library_metadata_phase5_enhanced.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from datetime import datetime

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

class EnhancedExtractor:
    """Enhanced metadata extraction for missed cases."""

    def __init__(self):
        self.publisher_keywords = self._load_publisher_keywords()

    def _load_publisher_keywords(self) -> set:
        """Load publisher keywords."""
        return {
            'publisher', 'publish', 'publishing', 'published', 'press', 'house',
            'llc', 'inc', 'ltd', 'corporation', 'corp', 'limited', 'edition',
            'penguin', 'random', 'oxford', 'cambridge', 'routledge', 'springer',
            'abacus', 'scribner', 'studies', 'series', 'reader', 'mode',
        }

    def is_valid_author_name(self, name: str) -> bool:
        """Validate if text looks like an author name."""
        if not name or len(name) < 3 or len(name) > 60:
            return False

        words = name.split()
        if len(words) < 2 or len(words) > 5:
            return False

        # At least 2 capitalized words
        capitalized = sum(1 for word in words if word and word[0].isupper())
        if capitalized < 2:
            return False

        # Check for publisher keywords
        name_lower = name.lower()
        if any(kw in name_lower for kw in self.publisher_keywords):
            return False

        return True

    def extract_date_from_text(self, text: str) -> Optional[str]:
        """
        Extract publication date (year) from text.

        Patterns:
        - Copyright © 2020
        - Published 2019
        - (2018)
        - 1998
        - 20th century years (1900-2099)
        """
        # Copyright patterns
        copyright_match = re.search(r'Copyright\s*©?\s*(\d{4})', text, re.IGNORECASE)
        if copyright_match:
            return copyright_match.group(1)

        copyright_match2 = re.search(r'©\s*(\d{4})', text)
        if copyright_match2:
            return copyright_match2.group(1)

        # Published/Printed patterns
        published_match = re.search(r'(?:Published|Printed|First published)\s*(?:in\s*)?(\d{4})', text, re.IGNORECASE)
        if published_match:
            return published_match.group(1)

        # Parenthetical year
        paren_match = re.search(r'\((\d{4})\)', text)
        if paren_match:
            year = paren_match.group(1)
            year_int = int(year)
            if 1800 <= year_int <= 2025:  # Reasonable range
                return year

        # Standalone year (1900-2025)
        year_match = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', text)
        if year_match:
            year = year_match.group(1)
            year_int = int(year)
            if 1800 <= year_int <= 2025:
                return year

        return None

    def get_document_data(self, md_path: Path) -> Dict:
        """Extract title and current metadata from frontmatter."""
        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if not content.startswith('---'):
                return {'title': None, 'author': None, 'date': None, 'content': content}

            lines = content.split('\n')
            end_idx = None
            for i in range(1, min(50, len(lines))):
                if lines[i].strip() == '---':
                    end_idx = i
                    break

            if end_idx:
                frontmatter_text = '\n'.join(lines[1:end_idx])
                try:
                    metadata = yaml.safe_load(frontmatter_text) or {}
                    return {
                        'title': metadata.get('title'),
                        'author': metadata.get('author'),
                        'date': metadata.get('date'),
                        'content': '\n'.join(lines[end_idx+1:])
                    }
                except:
                    pass

            return {'title': None, 'author': None, 'date': None, 'content': content}
        except Exception as e:
            return {'title': None, 'author': None, 'date': None, 'content': ''}

    def pattern_abbreviation_author(self, title: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern: "Title (Abbreviation An - Author Name"
        Example: "If This Is A Man The Truce (Abacus 40th An - Primo Levi"
        """
        match = re.search(r'\([^)]*An\s*-\s*([A-Z][a-zA-Z\s\.]+)(?:\s|$)', title)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author_name(author):
                return author, 85, 'abbreviation_author'
        return None, 0, None

    def pattern_intro_by_author(self, title: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern: "Title, with an introd by Author -- Main Author"
        Example: "A dying colonialism, with an introd by Adolfo Gilly -- Frantz Fanon"
        """
        # Look for "-- Author Name" pattern after intro/forward
        if ' -- ' in title and ('introd' in title.lower() or 'forward' in title.lower()):
            parts = title.split(' -- ')
            if len(parts) >= 2:
                # Take the part after "-- " as author
                author_part = parts[1].strip()
                # Remove year, publisher, etc.
                author_part = re.sub(r',?\s*\d{4}.*$', '', author_part).strip()
                # Take first name if comma-separated
                if ',' in author_part:
                    author_part = author_part.split(',')[0].strip()

                if self.is_valid_author_name(author_part):
                    return author_part, 90, 'intro_by_author'
        return None, 0, None

    def pattern_multi_author_title(self, title: str) -> Tuple[Optional[List[str]], int, str]:
        """
        Pattern: "Title -- Author1, Author2, Author3"
        Example: "Conversational Repair -- Makoto Hayashi, Geoffrey Raymond, Jack Sidnell"

        Returns first author only (primary author).
        """
        if ' -- ' in title:
            parts = title.split(' -- ')
            if len(parts) >= 2:
                author_part = parts[1].strip()
                # Remove year, publisher
                author_part = re.sub(r',?\s*\d{4}.*$', '', author_part).strip()

                # Check if it looks like comma-separated authors
                if ',' in author_part:
                    # Split on commas
                    authors = [a.strip() for a in author_part.split(',')]
                    # Take first author (primary)
                    if authors and self.is_valid_author_name(authors[0]):
                        return authors[0], 85, 'multi_author_title'
        return None, 0, None

    def pattern_dash_variation(self, title: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern: Various dash variations missed by Phase 4
        - "Title The Teachings of Bruc - Shannon Lee"
        """
        if ' - ' in title:
            # Split and take last part as potential author
            parts = title.split(' - ')
            if len(parts) >= 2:
                author_part = parts[-1].strip()
                # Clean up
                author_part = re.sub(r',?\s*\d{4}.*$', '', author_part).strip()
                author_part = re.sub(r'\.(pdf|md|txt)$', '', author_part, flags=re.IGNORECASE).strip()

                if self.is_valid_author_name(author_part):
                    return author_part, 75, 'dash_variation'
        return None, 0, None

    def extract_metadata(self, md_path: Path) -> Dict:
        """
        Extract both author and publication date.
        Returns best results across all patterns.
        """
        data = self.get_document_data(md_path)
        title = data.get('title')
        content = data.get('content', '')
        current_author = data.get('author')
        current_date = data.get('date')

        result = {
            'author': None,
            'author_confidence': 0,
            'author_pattern': None,
            'date': None,
            'date_confidence': 0,
            'date_source': None,
        }

        # Skip if already has author
        if current_author:
            result['author'] = current_author

        # Extract author if missing
        if not title or current_author:
            pass  # Skip author extraction
        else:
            # Try all patterns
            patterns = [
                self.pattern_intro_by_author(title),
                self.pattern_abbreviation_author(title),
                self.pattern_multi_author_title(title),
                self.pattern_dash_variation(title),
            ]

            # Find best result
            for author, confidence, pattern in patterns:
                if confidence > result['author_confidence']:
                    result['author'] = author
                    result['author_confidence'] = confidence
                    result['author_pattern'] = pattern

        # Extract publication date
        if current_date:
            result['date'] = current_date
        else:
            # Try title first
            if title:
                date = self.extract_date_from_text(title)
                if date:
                    result['date'] = date
                    result['date_confidence'] = 80
                    result['date_source'] = 'title'

            # Try content (first 10 pages)
            if not result['date'] and content:
                excerpt = '\n'.join(content.split('\n')[:500])  # ~10 pages
                date = self.extract_date_from_text(excerpt)
                if date:
                    result['date'] = date
                    result['date_confidence'] = 70
                    result['date_source'] = 'content'

        return result

    def update_frontmatter(self, md_path: Path, author: Optional[str], date: Optional[str]) -> bool:
        """Update YAML frontmatter with extracted metadata."""
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
            else:
                # No frontmatter - create it
                metadata = {}
                if author:
                    metadata['author'] = author
                if date:
                    metadata['date'] = date

                if metadata:
                    new_frontmatter = yaml.dump(metadata, default_flow_style=False, allow_unicode=True)
                    new_content = f"---\n{new_frontmatter}---\n{content}"

                    with open(md_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

                    return True

        except Exception as e:
            print(f"Error updating {md_path.name}: {e}")
            return False

    def process_documents(self, limit: int = None, dry_run: bool = False):
        """Process all documents to extract missing metadata."""
        md_files = sorted(LIBRARY_PATH.glob('*.md'))

        if limit:
            md_files = md_files[:limit]

        processed = 0
        authors_extracted = 0
        dates_extracted = 0

        print(f"Processing {len(md_files)} documents...")
        print(f"Dry run: {dry_run}")
        print()

        for md_path in md_files:
            result = self.extract_metadata(md_path)
            processed += 1

            author = result['author']
            date = result['date']
            updates = []

            if author and result['author_confidence'] >= 75:
                authors_extracted += 1
                updates.append(f"Author: {author} ({result['author_pattern']})")

            if date and result['date_confidence'] >= 70:
                dates_extracted += 1
                updates.append(f"Date: {date} ({result['date_source']})")

            if updates:
                print(f"✓ {md_path.name}")
                for update in updates:
                    print(f"  {update}")
                print()

                if not dry_run:
                    self.update_frontmatter(md_path, author, date)

        print()
        print("=" * 70)
        print("PHASE 5A COMPLETE")
        print("=" * 70)
        print(f"Documents processed: {processed}")
        print(f"Authors extracted: {authors_extracted}")
        print(f"Publication dates extracted: {dates_extracted}")
        print()


def main():
    dry_run = '--dry-run' in sys.argv
    limit = None

    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    extractor = EnhancedExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    main()
