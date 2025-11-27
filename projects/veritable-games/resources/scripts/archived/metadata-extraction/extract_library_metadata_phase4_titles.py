#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 4A: Title Parsing

Extracts authors from document titles where author information is embedded
in the title metadata itself (not in filename or content).

Patterns handled:
1. Anna's Archive: "Title -- Author -- Publisher -- ... -- Anna's Archive"
2. Simple dash separator: "Title - Author Name - Year/Publisher"
3. Comma-year pattern: "Title - Author Name, Year"
4. Author after title: Various formats

Usage:
    python3 extract_library_metadata_phase4_titles.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

class TitleExtractor:
    """Extract author metadata from document titles."""

    def __init__(self):
        self.publisher_keywords = self._load_publisher_keywords()
        self.organization_keywords = self._load_organization_keywords()

    def _load_publisher_keywords(self) -> set:
        """Load publisher keywords to avoid false positives."""
        return {
            'publisher', 'publish', 'publishing', 'published', 'press', 'house',
            'llc', 'inc', 'ltd', 'corporation', 'corp', 'limited',
            'penguin', 'random', 'oxford', 'cambridge', 'routledge', 'springer',
            'wiley', 'pearson', 'mcgraw', 'hill', 'harper', 'collins', 'simon',
            'schuster', 'macmillan', 'hachette', 'verso', 'haymarket',
            'astra', 'kansas', 'independently', 'services', 'blackbird',
            'pdfdrive', 'anna', 'gutenberg', 'libcom', 'source', 'lightning',
        }

    def _load_organization_keywords(self) -> set:
        """Load organization keywords to avoid false positives."""
        return {
            'party', 'union', 'federation', 'international', 'association',
            'committee', 'council', 'movement', 'front', 'league',
            'collective', 'solidarity', 'liberation', 'workers',
            'communist', 'socialist', 'anarchist', 'iww', 'cnt', 'fai',
            'company', 'corporation', 'electric', 'wikipedia', 'institute',
        }

    def is_publisher_part(self, text: str) -> bool:
        """Check if text contains publisher keywords."""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.publisher_keywords)

    def is_organization_name(self, text: str) -> bool:
        """Check if text looks like an organization name."""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.organization_keywords)

    def is_valid_author_name(self, name: str) -> bool:
        """
        Validate if extracted text looks like a person's name.
        """
        if not name or len(name) < 3 or len(name) > 60:
            return False

        # Check for encoding artifacts
        if '■' in name or '�' in name:
            return False

        # Split into words
        words = name.split()
        if len(words) < 2 or len(words) > 5:
            return False

        # Count capitalized words
        capitalized = sum(1 for word in words if word and word[0].isupper())
        if capitalized < 2:
            return False

        # Check for multi-digit numbers (years, ISBNs, hashes)
        if re.search(r'\d{3,}', name):
            return False

        # Check patterns
        name_lower = name.lower()

        # Starting with articles
        if re.match(r'^(the|a|an)\s', name_lower):
            return False

        # Ending with prepositions or conjunctions
        if re.search(r'\s(of|for|and|with|the|in)$', name_lower):
            return False

        # Publisher/organization patterns
        if self.is_publisher_part(name):
            return False
        if self.is_organization_name(name):
            return False

        # Check for common false positive words
        false_positive_words = {
            'source', 'converted', 'updated', 'archive', 'library',
            'wikipedia', 'edition', 'version', 'revised',
        }
        if any(word in name_lower for word in false_positive_words):
            return False

        return True

    def get_document_title(self, md_path: Path) -> Optional[str]:
        """Extract title from YAML frontmatter."""
        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if not content.startswith('---'):
                return None

            lines = content.split('\n')
            for i in range(1, min(50, len(lines))):
                if lines[i].strip() == '---':
                    frontmatter_text = '\n'.join(lines[1:i])
                    try:
                        metadata = yaml.safe_load(frontmatter_text)
                        if metadata and 'title' in metadata:
                            return metadata['title']
                    except:
                        pass
                    break

            return None
        except Exception as e:
            return None

    def pattern_1_annas_archive(self, title: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 1: Anna's Archive format

        Format: "Title -- Author Name -- Publisher/Date -- ISBN -- Hash -- Anna's Archive"

        Examples:
          - "Men Like Gods -- Herbert George Wells -- ..."
          - "Simians, Cyborgs, and Women ... -- Donna Jeanne Haraway -- ..."
        """
        if 'anna' not in title.lower() or 'archive' not in title.lower():
            return None, 0, None

        # Split on " -- " (double dash with spaces)
        parts = [p.strip() for p in title.split(' -- ')]

        if len(parts) >= 3:
            # Second part should be author (between title and publisher/metadata)
            potential_author = parts[1]

            # Validate it looks like an author name
            if self.is_valid_author_name(potential_author):
                # Check third part isn't also an author (should be publisher/date/ISBN)
                third_part = parts[2]
                if not self.is_valid_author_name(third_part) or \
                   self.is_publisher_part(third_part) or \
                   re.search(r'\d{4}', third_part):  # Contains year
                    return potential_author, 95, 'annas_archive'

        return None, 0, None

    def pattern_2_dash_author_year(self, title: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 2: Title - Author Name - Year/Publisher

        Examples:
          - "Game Architecture and Design - Andrew Rollings, Dave Morris"
          - "Behave The Biology of Humans... - Robert M. Sapolsky"
        """
        # Split on single dash (with spaces)
        if ' - ' not in title:
            return None, 0, None

        parts = [p.strip() for p in title.split(' - ')]

        if len(parts) >= 2:
            # Try second part as author
            potential_author = parts[1]

            # Clean up: Remove trailing year/publisher/source markers
            potential_author = re.sub(r',?\s*\d{4}.*$', '', potential_author).strip()
            potential_author = re.sub(r'\s*\*\*Source\*\*.*$', '', potential_author, flags=re.IGNORECASE).strip()

            # Handle multiple authors: "Author1, Author2" -> take first
            if ',' in potential_author:
                potential_author = potential_author.split(',')[0].strip()

            if self.is_valid_author_name(potential_author):
                return potential_author, 85, 'dash_author_year'

        return None, 0, None

    def pattern_3_double_dash_separator(self, title: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 3: Title -- Author Name (double dash, not Anna's Archive)

        Examples:
          - "Racial Capitalism & Prison Abolition -- Cedric Robinson, Robin D G Kelley"
          - "Discourse on Colonialism -- Aimé Césaire -- 2001"
        """
        if 'anna' in title.lower() and 'archive' in title.lower():
            return None, 0, None  # Let pattern_1 handle Anna's Archive

        if ' -- ' not in title:
            return None, 0, None

        # Split on double dash
        parts = [p.strip() for p in title.split(' -- ')]

        if len(parts) >= 2:
            # Try second part as author
            potential_author = parts[1]

            # Clean up: Remove year, publisher info
            potential_author = re.sub(r',?\s*\d{4}.*$', '', potential_author).strip()

            # Handle multiple authors: take first
            if ',' in potential_author:
                potential_author = potential_author.split(',')[0].strip()

            if self.is_valid_author_name(potential_author):
                return potential_author, 90, 'double_dash'

        return None, 0, None

    def pattern_4_author_after_source(self, title: str) -> Tuple[Optional[str], int, str]:
        """
        Pattern 4: Title **Source**: ./filename.pdf - Author in filename

        Examples:
          - "Title **Source**: ./author-name-title.pdf"
        """
        source_match = re.search(r'\*\*Source\*\*:\s*\./(.*?)\.(pdf|md|txt)', title, re.IGNORECASE)

        if not source_match:
            return None, 0, None

        filename = source_match.group(1)

        # Try to extract author from filename using dash pattern
        # Common pattern: "author-name-title.pdf"
        parts = filename.split('-')

        if len(parts) >= 2:
            # Try first 2 parts as author
            author_candidate = ' '.join(parts[:2]).title()
            if self.is_valid_author_name(author_candidate):
                return author_candidate, 75, 'source_filename'

            # Try last 2 parts before extension
            author_candidate = ' '.join(parts[-2:]).title()
            if self.is_valid_author_name(author_candidate):
                return author_candidate, 70, 'source_filename'

        return None, 0, None

    def extract_author_from_title(self, md_path: Path) -> Dict:
        """
        Try all title patterns to extract author.
        Returns best result across all patterns.
        """
        title = self.get_document_title(md_path)

        if not title:
            return {'author': None, 'confidence': 0, 'pattern': None, 'title': None}

        # Try all patterns in order of confidence
        patterns = [
            self.pattern_1_annas_archive(title),
            self.pattern_3_double_dash_separator(title),
            self.pattern_2_dash_author_year(title),
            self.pattern_4_author_after_source(title),
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
            'title': title,
        }

    def update_frontmatter(self, md_path: Path, author: str) -> bool:
        """Update YAML frontmatter with extracted author."""
        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()

            lines = content.split('\n')

            # Check for existing frontmatter
            if lines[0].strip() == '---':
                # Find end of frontmatter
                end_idx = None
                for i in range(1, min(50, len(lines))):
                    if lines[i].strip() == '---':
                        end_idx = i
                        break

                if end_idx:
                    # Parse existing frontmatter
                    frontmatter_text = '\n'.join(lines[1:end_idx])
                    try:
                        metadata = yaml.safe_load(frontmatter_text) or {}
                    except:
                        metadata = {}

                    # Update author
                    metadata['author'] = author

                    # Rebuild frontmatter
                    new_frontmatter = yaml.dump(metadata, default_flow_style=False, allow_unicode=True)
                    new_content = f"---\n{new_frontmatter}---\n" + '\n'.join(lines[end_idx+1:])

                    with open(md_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

                    return True
            else:
                # No frontmatter - create it
                metadata = {'author': author}
                new_frontmatter = yaml.dump(metadata, default_flow_style=False, allow_unicode=True)
                new_content = f"---\n{new_frontmatter}---\n{content}"

                with open(md_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

                return True

        except Exception as e:
            print(f"Error updating frontmatter for {md_path.name}: {e}")
            return False

    def process_documents(self, limit: int = None, dry_run: bool = False):
        """
        Process all library documents without authors.
        Extract authors from titles and update frontmatter.
        """
        md_files = sorted(LIBRARY_PATH.glob('*.md'))

        if limit:
            md_files = md_files[:limit]

        processed = 0
        extracted = 0
        high_confidence = 0
        medium_confidence = 0
        low_confidence = 0

        # Track by pattern
        pattern_counts = {}

        print(f"Processing {len(md_files)} documents...")
        print(f"Dry run: {dry_run}")
        print()

        for md_path in md_files:
            # Check if document already has author in frontmatter
            try:
                with open(md_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                if content.startswith('---'):
                    lines = content.split('\n')
                    for i in range(1, min(50, len(lines))):
                        if lines[i].strip() == '---':
                            frontmatter_text = '\n'.join(lines[1:i])
                            try:
                                metadata = yaml.safe_load(frontmatter_text) or {}
                                if metadata.get('author'):
                                    # Skip - already has author
                                    continue
                            except:
                                pass
                            break
            except:
                pass

            # Extract author from title
            result = self.extract_author_from_title(md_path)
            processed += 1

            if result['author'] and result['confidence'] >= 70:
                extracted += 1
                author = result['author']
                confidence = result['confidence']
                pattern = result['pattern']

                # Count by pattern
                pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1

                if confidence >= 90:
                    high_confidence += 1
                elif confidence >= 80:
                    medium_confidence += 1
                else:
                    low_confidence += 1

                print(f"✓ {md_path.name}")
                print(f"  Title: {result['title'][:80]}...")
                print(f"  Author: {author}")
                print(f"  Confidence: {confidence}% ({pattern})")
                print()

                if not dry_run:
                    self.update_frontmatter(md_path, author)

        print()
        print("=" * 70)
        print(f"EXTRACTION COMPLETE")
        print("=" * 70)
        print(f"Documents processed: {processed}")
        print(f"Authors extracted: {extracted}")
        print(f"  - High confidence (≥90%): {high_confidence}")
        print(f"  - Medium confidence (80-89%): {medium_confidence}")
        print(f"  - Low confidence (70-79%): {low_confidence}")
        print(f"Success rate: {extracted/processed*100:.1f}%")
        print()
        print("Pattern breakdown:")
        for pattern, count in sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {pattern}: {count} ({count/extracted*100:.1f}%)")
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

    extractor = TitleExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    main()
