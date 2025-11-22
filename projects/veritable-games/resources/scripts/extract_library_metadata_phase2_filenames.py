#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 2: Filename Mining

Extracts author names from filename patterns:
- "Title - Author Name.pdf"
- "Author Last, First [Author Last, First].pdf"
- "Book Title - Author Name.ext"

Usage:
    python3 extract_library_metadata_phase2_filenames.py [--dry-run] [--limit N] [--test]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

# Confidence threshold
CONFIDENCE_MEDIUM = 75

class FilenameExtractor:
    """Extract author names from document filenames."""

    def __init__(self):
        self.false_positives = self._load_false_positives()
        self.stats = {
            'total': 0,
            'extracted': 0,
            'high_confidence': 0,
            'medium_confidence': 0,
            'low_confidence': 0,
            'no_metadata': 0,
            'by_pattern': {},
        }

    def _load_false_positives(self) -> set:
        """Load known false positive patterns in filenames."""
        return {
            'PDFDrive', 'PDFDrive.com', 'annas-archive', 'Project Gutenberg',
            'Wikipedia', 'Libcom', 'The Anarchist Library', 'AK Press',
            'PM Press', 'Verso Books', 'Oxford', 'Cambridge', 'Routledge',
            'Springer', 'Wiley', 'Pearson', 'McGraw-Hill', 'Penguin',
            'Random House', 'Simon & Schuster', 'HarperCollins',
            'Converted', 'Source', 'Downloaded', 'Archived', 'Backup',
            # Events and concepts that appear at end of titles
            'General Strike', 'Labour Movement', 'Workers Movement',
            'Civil War', 'World War', 'Social Movement', 'Class Struggle',
            'Of Labour', 'Of Freedom', 'Of Power', 'Of Justice',
            'Resisted Colonialism', 'Against Fascism', 'Against Capitalism',
            # Title endings
            'The State', 'The City', 'The Future', 'The Past', 'The Present',
            'And Beyond', 'In Practice', 'In Theory', 'In Action',
        }

    def _is_common_title_ending(self, name: str) -> bool:
        """Check if this looks like a common title ending rather than author."""
        title_endings = [
            r'general strike',
            r'labour movement',
            r'workers? movement',
            r'civil war',
            r'class struggle',
            r'of (the )?(labour|freedom|power|justice|state)',
            r'resisted colonialism',
            r'against (fascism|capitalism|power)',
            r'in (practice|theory|action|focus)',
            r'and beyond',
            r'wikipedia$',
            r'libcom$',
        ]

        name_lower = name.lower()
        return any(re.search(pattern, name_lower) for pattern in title_endings)

    def is_valid_author_name(self, name: str) -> bool:
        """Validate if string looks like a person's name."""
        if not name or len(name) < 3 or len(name) > 60:
            return False

        # Check false positives
        if any(fp.lower() in name.lower() for fp in self.false_positives):
            return False

        # Check for common title endings
        if self._is_common_title_ending(name):
            return False

        # Check for file extensions
        if re.search(r'\.(pdf|md|txt|doc|epub)$', name.lower()):
            return False

        # Check for numbers (usually not in names, except Roman numerals)
        if re.search(r'\d{2,}', name):  # Multiple digits
            return False

        # Check for common non-name patterns
        non_name_patterns = [
            r'\bVol\b', r'\bVolume\b', r'\bEd\b', r'\bEdition\b',
            r'\bChapter\b', r'\bPart\b', r'\[.*\]', r'\(.*\)',
            r'\bThe\b.*\bOf\b', r'\bA\b.*\bTo\b',
        ]
        if any(re.search(pattern, name, re.IGNORECASE) for pattern in non_name_patterns):
            return False

        # Must have at least 2 words (first and last name)
        words = name.split()
        if len(words) < 2:
            return False

        # Most words should be capitalized
        capitalized = sum(1 for w in words if w and w[0].isupper())
        if capitalized < 2:
            return False

        return True

    def extract_frontmatter(self, md_path: Path) -> Dict:
        """Parse existing YAML frontmatter from markdown file."""
        try:
            with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            # Extract frontmatter between --- markers
            match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
            if not match:
                return {}

            return yaml.safe_load(match.group(1)) or {}
        except Exception as e:
            return {}

    def pattern_1_dash_author(self, filename: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 1: Title - Author Name.ext or title-author-name.md
        Examples:
          - "The Art of Game Design - Jesse Schell.pdf"
          - "A Half-Built Garden - Ruthanna Emrys.pdf"
          - "bullshit-jobs-david-graeber.md"
          - "between-the-world-and-me-ta-nehisi-coates.md"
        """
        # Remove extension and category prefix
        name = re.sub(r'\.(pdf|md|txt|doc|epub)$', '', filename, flags=re.IGNORECASE)
        name = re.sub(r'^\d+_[A-Za-z_]+_[A-Za-z_]+_', '', name)

        # Pattern 1: Title - Author Name (with space)
        match = re.match(r'^(.+?)\s*-\s*([A-Z][a-zA-Z\s\.,\'-]+)$', name)
        if match:
            title_part = match.group(1)
            author_part = match.group(2).strip()

            # Author part should be 2-4 words
            words = author_part.split()
            if 2 <= len(words) <= 4:
                if self.is_valid_author_name(author_part):
                    return author_part, 85, 'dash_space_author'

        # Pattern 2: title-author-name (last 2-3 dash-separated parts)
        parts = name.split('-')
        if len(parts) >= 2:
            # Try last 2 parts
            author_candidate = ' '.join(parts[-2:]).title()
            if self.is_valid_author_name(author_candidate):
                return author_candidate, 80, 'dash_author'

            # Try last 3 parts
            if len(parts) >= 3:
                author_candidate = ' '.join(parts[-3:]).title()
                if self.is_valid_author_name(author_candidate):
                    return author_candidate, 75, 'dash_author'

        return None, 0, None

    def pattern_2_author_brackets(self, filename: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 2: Title - Author Last, First [Author Last, First].ext
        Examples:
          - "Sister Outsider - Lorde, Audre [Lorde, Audre].pdf"
        """
        # Look for [Author Last, First] pattern
        match = re.search(r'\[([A-Z][a-zA-Z]+),\s*([A-Z][a-zA-Z]+)\]', filename)
        if match:
            last_name = match.group(1)
            first_name = match.group(2)
            author = f"{first_name} {last_name}"

            if self.is_valid_author_name(author):
                return author, 90, 'author_brackets'

        # Also check pattern before brackets
        match = re.search(r'-\s*([A-Z][a-zA-Z]+),\s*([A-Z][a-zA-Z]+)\s*\[', filename)
        if match:
            last_name = match.group(1)
            first_name = match.group(2)
            author = f"{first_name} {last_name}"

            if self.is_valid_author_name(author):
                return author, 85, 'author_comma'

        return None, 0, None

    def pattern_3_parentheses_author(self, filename: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 3: Title (Author Name).ext or Title (Author Name - Publisher).ext
        Examples:
          - "Book Title (John Doe).pdf"
          - "Essay Title (Jane Smith - Oxford).pdf"
        """
        # Remove extension
        name = re.sub(r'\.(pdf|md|txt|doc|epub)$', '', filename, flags=re.IGNORECASE)

        # Pattern: (Author Name) or (Author Name - something)
        match = re.search(r'\(([A-Z][a-zA-Z\s\.,\'-]+?)(?:\s*-\s*[^)]+)?\)$', name)
        if match:
            author_part = match.group(1).strip()

            # Should be 2-4 words
            words = author_part.split()
            if 2 <= len(words) <= 4:
                if self.is_valid_author_name(author_part):
                    return author_part, 75, 'parentheses_author'

        return None, 0, None

    def pattern_4_underscore_author(self, filename: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 4: Title_Author_Name.ext
        Examples:
          - "Book_Title_John_Doe.pdf"
          - "New_York_2140_Kim_Stanley_Robinson.md"
          - "Utopia_for_Realists_-_Rutger_Bregman.md"
        """
        # Remove extension and prefix numbers
        name = re.sub(r'\.(pdf|md|txt|doc|epub)$', '', filename, flags=re.IGNORECASE)
        name = re.sub(r'^\d+_[A-Za-z_]+_[A-Za-z_]+_', '', name)

        # Check for "Title_-_Author_Name" pattern first
        match = re.search(r'_-_([A-Z][a-zA-Z_\s]+)$', name)
        if match:
            author_part = match.group(1).replace('_', ' ').strip()
            if self.is_valid_author_name(author_part):
                return author_part, 85, 'underscore_dash_author'

        # Split by underscore, take last 2-3 parts as potential author
        parts = name.split('_')
        if len(parts) >= 2:
            # Try last 2 parts (capitalized)
            author_candidate = ' '.join(parts[-2:])
            if author_candidate[0].isupper() and self.is_valid_author_name(author_candidate):
                return author_candidate, 80, 'underscore_author'

            # Try last 3 parts (capitalized)
            if len(parts) >= 3:
                author_candidate = ' '.join(parts[-3:])
                if author_candidate[0].isupper() and self.is_valid_author_name(author_candidate):
                    return author_candidate, 75, 'underscore_author'

        return None, 0, None

    def extract_author_from_filename(self, md_path: Path) -> Dict:
        """
        Try all filename patterns to extract author.
        Returns best result across all patterns.
        """
        filename = md_path.name

        # Try all patterns
        patterns = [
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

    def update_frontmatter(self, md_path: Path, metadata: Dict, dry_run: bool = False) -> bool:
        """Update YAML frontmatter with extracted metadata."""
        try:
            with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            # Extract existing frontmatter
            match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
            if not match:
                return False

            frontmatter_str = match.group(1)
            body = match.group(2)

            # Parse frontmatter
            frontmatter = yaml.safe_load(frontmatter_str) or {}

            # Only update if author is missing
            if frontmatter.get('author'):
                return False

            if not metadata['author']:
                return False

            # Update with new author
            frontmatter['author'] = metadata['author']

            # Recreate frontmatter
            new_frontmatter_lines = ['---']

            # Preserve order: title, author, date, source_url, topics
            if frontmatter.get('title'):
                title = frontmatter['title'].replace("'", "''")
                new_frontmatter_lines.append(f"title: '{title}'")

            if frontmatter.get('author'):
                author = frontmatter['author'].replace("'", "''")
                new_frontmatter_lines.append(f"author: '{author}'")

            if frontmatter.get('date'):
                new_frontmatter_lines.append(f"date: '{frontmatter['date']}'")

            if frontmatter.get('source_url'):
                new_frontmatter_lines.append(f"source_url: {frontmatter['source_url']}")

            if frontmatter.get('topics'):
                topics = frontmatter['topics']
                if isinstance(topics, list):
                    topics_str = ', '.join(topics)
                    new_frontmatter_lines.append(f"topics: [{topics_str}]")

            new_frontmatter_lines.append('---')

            # Combine
            new_content = '\n'.join(new_frontmatter_lines) + '\n' + body

            # Write back
            if not dry_run:
                with open(md_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

            return True

        except Exception as e:
            print(f"Error updating {md_path.name}: {e}")
            return False

    def process_documents(self, limit: int = None, dry_run: bool = False, test_mode: bool = False):
        """Process all documents missing author metadata."""

        print("="*70)
        print("Library Metadata Extraction - Phase 2: Filename Mining")
        print("="*70)
        print()

        if dry_run:
            print("🔍 DRY-RUN MODE - No files will be modified")
        if test_mode:
            print("🧪 TEST MODE - Processing sample for validation")
        if limit:
            print(f"📊 Limit: {limit} documents")
        print()

        # Get all markdown files
        md_files = sorted(LIBRARY_PATH.glob('*.md'))

        # Filter to only those missing author
        files_to_process = []
        for md_path in md_files:
            frontmatter = self.extract_frontmatter(md_path)
            if not frontmatter.get('author'):
                files_to_process.append(md_path)

        print(f"Found {len(files_to_process)} documents missing authors")
        print(f"(out of {len(md_files)} total documents)")
        print()

        if limit:
            files_to_process = files_to_process[:limit]

        # Process each file
        for idx, md_path in enumerate(files_to_process, 1):
            self.stats['total'] += 1

            # Show progress every 10 files or for first 20
            show_details = (idx <= 20) or (idx % 10 == 0) or test_mode

            if show_details:
                print(f"[{idx:5d}/{len(files_to_process)}] {md_path.name[:60]}")

            # Extract author from filename
            result = self.extract_author_from_filename(md_path)

            author = result['author']
            confidence = result['confidence']
            pattern = result['pattern']

            # Track confidence
            if confidence >= 90:
                self.stats['high_confidence'] += 1
                conf_marker = "✓"
            elif confidence >= CONFIDENCE_MEDIUM:
                self.stats['medium_confidence'] += 1
                conf_marker = "~"
            else:
                self.stats['low_confidence'] += 1
                conf_marker = "?"

            # Skip if no metadata or low confidence
            if not author:
                self.stats['no_metadata'] += 1
                if show_details:
                    print(f"          ❌ No author in filename")
                    print()
                continue

            if confidence < CONFIDENCE_MEDIUM:
                if show_details:
                    print(f"          ⚠️  Low confidence ({confidence}%), skipping")
                    print(f"          Candidate: {author}")
                    print()
                continue

            # Display results
            if show_details:
                print(f"          {conf_marker} Author: {author} (conf: {confidence}%)")
                print(f"          Pattern: {pattern}")
                print(f"          Filename: {md_path.name}")

            # Update frontmatter
            if self.update_frontmatter(md_path, result, dry_run=dry_run):
                self.stats['extracted'] += 1

                # Track by pattern
                if pattern not in self.stats['by_pattern']:
                    self.stats['by_pattern'][pattern] = 0
                self.stats['by_pattern'][pattern] += 1

                if show_details:
                    if not dry_run:
                        print(f"          ✅ Frontmatter updated")
                    else:
                        print(f"          ℹ️  Would update frontmatter")

            if show_details:
                print()

        # Print summary
        print(f"\n{'='*70}")
        print("EXTRACTION SUMMARY - PHASE 2")
        print(f"{'='*70}")
        print(f"Total documents processed: {self.stats['total']}")
        print(f"Authors extracted: {self.stats['extracted']}")
        print(f"No author in filename: {self.stats['no_metadata']}")
        print()
        print("By Confidence:")
        print(f"  High (≥90%): {self.stats['high_confidence']}")
        print(f"  Medium (75-89%): {self.stats['medium_confidence']}")
        print(f"  Low (<75%): {self.stats['low_confidence']} (skipped)")
        print()
        print("By Pattern:")
        for pattern, count in sorted(self.stats['by_pattern'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {pattern}: {count}")
        print(f"{'='*70}")

        if dry_run:
            print("\nDRY-RUN MODE - No files were modified")
        elif test_mode:
            print("\nTEST MODE - Review results before full run")


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

    extractor = FilenameExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run, test_mode=test_mode)


if __name__ == '__main__':
    main()
