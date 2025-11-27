#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 3: Content Deep Dive

Extracts authors from document content (first 1-3 pages) for documents
where filename mining was unsuccessful.

Strategies:
1. First page author attribution (name at top)
2. "By Author Name" patterns
3. URL patterns (theanarchistlibrary.org/library/author-name-title)
4. Copyright/attribution blocks
5. Author after title (common in academic papers)

Usage:
    python3 extract_library_metadata_phase3_content.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

class ContentExtractor:
    """Extract author metadata directly from document content."""

    def __init__(self):
        self.publisher_keywords = self._load_publisher_keywords()
        self.organization_keywords = self._load_organization_keywords()
        self.title_patterns = self._load_title_patterns()

    def _load_publisher_keywords(self) -> set:
        """Load publisher keywords to avoid false positives."""
        return {
            'publisher', 'publish', 'publishing', 'published', 'press', 'house',
            'llc', 'inc', 'ltd', 'corporation', 'corp', 'limited',
            'penguin', 'random', 'oxford', 'cambridge', 'routledge', 'springer',
            'wiley', 'pearson', 'mcgraw', 'hill', 'harper', 'collins', 'simon',
            'schuster', 'macmillan', 'hachette', 'verso', 'haymarket',
            'astra', 'kansas', 'independently', 'services', 'blackbird',
            'pdfdrive', 'anna', 'gutenberg', 'libcom', 'ak press', 'pm press',
        }

    def _load_organization_keywords(self) -> set:
        """Load organization keywords to avoid false positives."""
        return {
            'party', 'union', 'federation', 'international', 'association',
            'committee', 'council', 'movement', 'front', 'league',
            'collective', 'solidarity', 'liberation', 'workers',
            'communist', 'socialist', 'anarchist', 'iww', 'cnt', 'fai',
            'company', 'corporation', 'electric', 'general electric',
            # Countries and regions
            'salvador', 'guatemala', 'nicaragua', 'cuba', 'mexico',
            'argentina', 'brazil', 'chile', 'colombia', 'venezuela',
        }

    def _load_title_patterns(self) -> set:
        """Load common title patterns to avoid extracting as authors."""
        return {
            'general strike', 'labour movement', 'civil war', 'world war',
            'of labour', 'of freedom', 'of power', 'of justice',
            'resisted colonialism', 'against fascism',
            'in practice', 'in theory', 'in action',
            'manifesto', 'declaration', 'constitution', 'faq',
            'wikipedia', 'libcom', 'essay', 'pamphlet',
        }

    def is_publisher_part(self, text: str) -> bool:
        """Check if text contains publisher keywords."""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.publisher_keywords)

    def is_organization_name(self, text: str) -> bool:
        """Check if text looks like an organization name."""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.organization_keywords)

    def is_title_pattern(self, text: str) -> bool:
        """Check if text matches common title patterns."""
        text_lower = text.lower()
        return any(pattern in text_lower for pattern in self.title_patterns)

    def is_valid_author_name(self, name: str) -> bool:
        """
        Validate if extracted text looks like a person's name.

        Requirements:
        - 6-60 characters
        - 2-4 words
        - At least 2 capitalized words
        - Not a publisher/organization/title pattern
        - Not starting with articles (The, A, An)
        - Not ending with prepositions (Of, For, And, With)
        """
        if not name or len(name) < 6 or len(name) > 60:
            return False

        # Check for encoding artifacts
        if '■' in name or '�' in name:
            return False

        # Check for commas (likely multiple authors or mixed concepts)
        if ',' in name:
            return False

        # Check for "and" (multiple authors)
        if ' and ' in name.lower():
            return False

        # Split into words
        words = name.split()
        if len(words) < 2 or len(words) > 4:
            return False

        # Check for plural forms (likely not person names)
        last_word = words[-1].lower()
        if last_word.endswith('s') and last_word not in {'status', 'process', 'progress'}:
            # Common plural endings that indicate NOT a person
            if last_word in {'americans', 'workers', 'people', 'citizens', 'members', 'activists'}:
                return False

        # Count capitalized words
        capitalized = sum(1 for word in words if word and word[0].isupper())
        if capitalized < 2:
            return False

        # Check for multi-digit numbers (years, IDs)
        if re.search(r'\d{2,}', name):
            return False

        # Check patterns
        name_lower = name.lower()

        # Specific false positive patterns
        if name_lower.startswith('date:'):
            return False
        if 'unknown' in name_lower:
            return False
        if name_lower.startswith('contributors to'):
            return False
        if 'wikimedia' in name_lower:
            return False

        # Starting with articles
        if re.match(r'^(the|a|an)\s', name_lower):
            return False

        # Ending with prepositions or conjunctions
        if re.search(r'\s(of|for|and|with|the|in)\.?$', name_lower):
            return False

        # Check for common title words
        title_words = {
            'dictatorship', 'resistance', 'revolution', 'strike',
            'movement', 'manifesto', 'declaration', 'constitution',
        }
        if any(word in name_lower for word in title_words):
            return False

        # Publisher/organization/title patterns
        if self.is_publisher_part(name):
            return False
        if self.is_organization_name(name):
            return False
        if self.is_title_pattern(name):
            return False

        # Check for common false positive words
        false_positive_words = {
            'writing', 'marketing', 'publishing', 'learning',
            'story', 'tech', 'drive', 'savvy', 'script',
        }
        if any(word in name_lower for word in false_positive_words):
            return False

        return True

    def get_first_pages(self, content: str, num_pages: int = 3) -> str:
        """
        Extract first N pages of content, skipping frontmatter.
        Estimates ~50 lines per page.
        """
        lines = content.split('\n')

        # Skip frontmatter (between first two --- markers)
        start_idx = 0
        if lines and lines[0].strip() == '---':
            for i in range(1, min(50, len(lines))):
                if lines[i].strip() == '---':
                    start_idx = i + 1
                    break

        # Take first N pages worth of content
        page_lines = num_pages * 50
        return '\n'.join(lines[start_idx:start_idx + page_lines])

    def strategy_1_first_line_author(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 1: Author name on first/early line.

        Example: blessed-is-the-flame.md has "Serafinski" on line 28
        Pattern: Short line (2-4 words) that's a valid name, before title
        """
        lines = excerpt.split('\n')

        for i in range(min(50, len(lines))):
            line = lines[i].strip()

            # Skip empty, headers, lists
            if not line or line.startswith('#') or line.startswith('*') or line.startswith('-'):
                continue

            # Skip very long lines (likely paragraphs)
            if len(line) > 100:
                continue

            words = line.split()

            # Check if it's a short line with 2-4 words
            if 2 <= len(words) <= 4:
                if self.is_valid_author_name(line):
                    # Verify next few lines have content (likely title/subtitle)
                    next_lines = '\n'.join(lines[i+1:i+5])
                    if len(next_lines) > 20:
                        return line, 85, 'first_line_author'

        return None, 0, None

    def strategy_2_by_author(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 2: "By Author Name" patterns.

        Patterns:
        - "by Author Name"
        - "By Author Name"
        - "author: Author Name"
        - "written by Author Name"
        """
        patterns = [
            r'(?:by|By)\s+([A-Z][a-zA-Z\s\'-]+?)(?:\.|,|;|\n|\s{2,})',
            r'(?:written by|Written by)\s+([A-Z][a-zA-Z\s\'-]+?)(?:\.|,|;|\n|\s{2,})',
            r'(?:author|Author):\s*([A-Z][a-zA-Z\s\'-]+?)(?:\.|,|;|\n|\s{2,})',
        ]

        for pattern in patterns:
            match = re.search(pattern, excerpt)
            if match:
                author = match.group(1).strip()

                # Clean up trailing punctuation
                author = re.sub(r'[,\.;:]+$', '', author).strip()

                # Remove trailing words that are likely not part of the name
                author = re.sub(r'\s+(In|The|A|An|And|Or|But|For|Of|With|To|From)$', '', author, flags=re.IGNORECASE)

                if self.is_valid_author_name(author):
                    return author, 90, 'by_author_pattern'

        return None, 0, None

    def strategy_3_url_author(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 3: Extract author from anarchist library URLs.

        Pattern: theanarchistlibrary.org/library/author-name-title
        Example: theanarchistlibrary.org/library/serafinski-blessed-is-the-flame
        """
        url_pattern = r'theanarchistlibrary\.org/library/([a-z\-]+)-([a-z\-]+)'
        match = re.search(url_pattern, excerpt)

        if match:
            # First group is likely author (first part before title)
            author_slug = match.group(1)

            # Convert slug to name
            author_parts = author_slug.split('-')

            # Skip single-word slugs (likely not full names)
            if len(author_parts) < 2:
                return None, 0, None

            # Take first 2-3 parts as author name
            author_name = ' '.join(author_parts[:min(3, len(author_parts))]).title()

            if self.is_valid_author_name(author_name):
                return author_name, 80, 'url_author'

        return None, 0, None

    def strategy_4_copyright_author(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 4: Author from copyright/attribution blocks.

        Patterns:
        - "Copyright © 2020 Author Name"
        - "© Author Name"
        - "Licensed to Author Name"
        """
        patterns = [
            r'Copyright\s*©?\s*\d{4}\s+([A-Z][a-zA-Z\s\.,\'-]{5,50})',
            r'©\s*\d{4}\s+([A-Z][a-zA-Z\s\.,\'-]{5,50})',
            r'©\s+([A-Z][a-zA-Z\s\.,\'-]{5,50})',
        ]

        for pattern in patterns:
            match = re.search(pattern, excerpt)
            if match:
                author = match.group(1).strip()
                author = re.sub(r'[,\.]$', '', author)

                if self.is_valid_author_name(author):
                    return author, 85, 'copyright_author'

        return None, 0, None

    def strategy_5_title_then_author(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 5: Title on first line, author on second/third line.

        Common in academic papers and pamphlets.
        Pattern: Long title line, then short author line
        """
        lines = excerpt.split('\n')

        for i in range(min(10, len(lines))):
            line = lines[i].strip()

            # Skip empty/headers
            if not line or line.startswith('#'):
                continue

            # If this line is long (likely title)
            if len(line) > 30:
                # Check next 3 lines for short author name
                for j in range(i+1, min(i+4, len(lines))):
                    next_line = lines[j].strip()

                    if not next_line:
                        continue

                    words = next_line.split()
                    if 2 <= len(words) <= 4:
                        if self.is_valid_author_name(next_line):
                            return next_line, 80, 'title_then_author'

        return None, 0, None

    def extract_author_from_content(self, md_path: Path) -> Dict:
        """
        Try all content strategies to extract author.
        Returns best result across all strategies.
        """
        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            return {'author': None, 'confidence': 0, 'pattern': None, 'error': str(e)}

        # Get first 3 pages
        excerpt = self.get_first_pages(content, num_pages=3)

        # Try all strategies
        strategies = [
            self.strategy_1_first_line_author(excerpt),
            self.strategy_2_by_author(excerpt),
            self.strategy_3_url_author(excerpt),
            self.strategy_4_copyright_author(excerpt),
            self.strategy_5_title_then_author(excerpt),
        ]

        # Find best result by confidence
        best_author = None
        best_confidence = 0
        best_pattern = None

        for author, confidence, pattern in strategies:
            if confidence > best_confidence:
                best_author = author
                best_confidence = confidence
                best_pattern = pattern

        return {
            'author': best_author,
            'confidence': best_confidence,
            'pattern': best_pattern,
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
        Extract authors from content and update frontmatter.
        """
        md_files = sorted(LIBRARY_PATH.glob('*.md'))

        if limit:
            md_files = md_files[:limit]

        processed = 0
        extracted = 0
        high_confidence = 0
        medium_confidence = 0
        low_confidence = 0

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

            # Extract author from content
            result = self.extract_author_from_content(md_path)
            processed += 1

            if result['author'] and result['confidence'] >= 75:
                extracted += 1
                author = result['author']
                confidence = result['confidence']
                pattern = result['pattern']

                if confidence >= 90:
                    high_confidence += 1
                elif confidence >= 80:
                    medium_confidence += 1
                else:
                    low_confidence += 1

                print(f"✓ {md_path.name}")
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
        print(f"  - Low confidence (75-79%): {low_confidence}")
        print(f"Success rate: {extracted/processed*100:.1f}%")
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

    extractor = ContentExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    main()
