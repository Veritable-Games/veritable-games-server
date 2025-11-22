#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 2 Improved: Filename Mining

Handles additional patterns:
- "Title -- Author -- Publisher" (double dash)
- "title-author-publisher" (author before publisher)
- Better publisher detection

Usage:
    python3 extract_library_metadata_phase2_improved.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple

# Import the base class from phase 2
sys.path.insert(0, str(Path(__file__).parent))
from extract_library_metadata_phase2_filenames import FilenameExtractor as BaseExtractor

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

class ImprovedFilenameExtractor(BaseExtractor):
    """Enhanced filename extraction with additional patterns."""

    def __init__(self):
        super().__init__()
        self.publisher_keywords = self._load_publisher_keywords()

    def _load_publisher_keywords(self) -> set:
        """Load publisher keywords to detect and stop before them."""
        return {
            'publisher', 'publish', 'publishing', 'published', 'press', 'house',
            'llc', 'inc', 'ltd', 'corporation', 'corp', 'limited',
            'penguin', 'random', 'oxford', 'cambridge', 'routledge', 'springer',
            'wiley', 'pearson', 'mcgraw', 'hill', 'harper', 'collins', 'simon',
            'schuster', 'macmillan', 'hachette', 'verso', 'haymarket',
            'astra', 'kansas', 'independently', 'services',
        }

    def is_publisher_part(self, text: str) -> bool:
        """Check if text contains publisher keywords."""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.publisher_keywords)

    def pattern_5_double_dash_author(self, filename: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 5: Title -- Author -- Publisher (double dash separator)
        Examples:
          - "Slow Down -- Kohei Saito -- Penguin Random House.pdf"
          - "Book Title -- Author Name -- Publisher Inc.pdf"
        """
        # Remove extension and prefix
        name = re.sub(r'\.(pdf|md|txt|doc|epub)$', '', filename, flags=re.IGNORECASE)
        name = re.sub(r'^\d+_[A-Za-z_]+_[A-Za-z_]+_', '', name)

        # Split by double dash
        parts = re.split(r'\s*--\s*', name)

        if len(parts) >= 3:
            # Middle part should be author (between title and publisher/metadata)
            potential_author = parts[1].strip()

            # Check if it looks like an author name
            if self.is_valid_author_name(potential_author):
                # Make sure the part after isn't also an author
                third_part = parts[2].strip()
                if self.is_publisher_part(third_part) or len(third_part) > 40:
                    return potential_author, 90, 'double_dash_author'

        return None, 0, None

    def pattern_6_author_before_publisher(self, filename: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 6: title-author-name-publisher-keyword (author before publisher)
        Examples:
          - "book-title-john-doe-independently-published.pdf"
          - "essay-jane-smith-penguin-random-house.pdf"
        """
        # Remove extension and prefix
        name = re.sub(r'\.(pdf|md|txt|doc|epub)$', '', filename, flags=re.IGNORECASE)
        name = re.sub(r'^\d+_[A-Za-z_]+_[A-Za-z_]+_', '', name)

        parts = name.split('-')

        # Find first publisher keyword
        publisher_idx = None
        for i, part in enumerate(parts):
            if self.is_publisher_part(part):
                publisher_idx = i
                break

        if publisher_idx and publisher_idx >= 2:
            # Try 2-3 parts before publisher as author
            # Try 2 parts before publisher
            if publisher_idx >= 2:
                author_candidate = ' '.join(parts[publisher_idx-2:publisher_idx]).title()
                if self.is_valid_author_name(author_candidate):
                    return author_candidate, 85, 'author_before_publisher'

            # Try 3 parts before publisher
            if publisher_idx >= 3:
                author_candidate = ' '.join(parts[publisher_idx-3:publisher_idx]).title()
                if self.is_valid_author_name(author_candidate):
                    return author_candidate, 80, 'author_before_publisher'

        return None, 0, None

    def extract_author_from_filename(self, md_path: Path) -> Dict:
        """
        Try all filename patterns including new ones.
        Returns best result across all patterns.
        """
        filename = md_path.name

        # Try all patterns (including inherited ones)
        patterns = [
            # New patterns first (higher confidence)
            self.pattern_5_double_dash_author(filename),
            self.pattern_6_author_before_publisher(filename),
            # Inherited patterns
            self.pattern_1_dash_author(filename),
            self.pattern_2_author_brackets(filename),
            self.pattern_3_parentheses_author(filename),
            self.pattern_4_underscore_author(filename),
        ]

        # Find best result by confidence
        best_author = None
        best_confidence = 0
        best_pattern = None

        for author, confidence, pattern in patterns:
            if confidence > best_confidence:
                best_author = author
                best_confidence = confidence
                best_pattern = pattern

        return {
            'author': best_author,
            'confidence': best_confidence,
            'pattern': best_pattern,
        }


def main():
    dry_run = '--dry-run' in sys.argv
    test_mode = '--test' in sys.argv
    limit = None

    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    # Test mode defaults to 100 documents
    if test_mode and not limit:
        limit = 100

    extractor = ImprovedFilenameExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run, test_mode=test_mode)


if __name__ == '__main__':
    main()
