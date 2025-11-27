#!/usr/bin/env python3
"""
Phase 5: Final Targeted Extraction
Handles remaining edge cases:
- Wikipedia articles
- Multi-author works (comma and semicolon separated)
- Last name, First name format
- Extended biographical info (birth-death years)
- Super-deep content search (pages 10-20)
- Enhanced title patterns
"""

import os
import re
import psycopg2
from pathlib import Path
from typing import Optional, Tuple

class Phase5Extractor:
    def __init__(self, markdown_dir: str):
        self.markdown_dir = Path(markdown_dir)
        self.db_connection = os.getenv('DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/veritable_games')

        # Statistics
        self.stats = {
            'processed': 0,
            'authors_extracted': 0,
            'dates_extracted': 0,
            'by_strategy': {},
            'confidence_levels': {'high': 0, 'medium': 0, 'low': 0}
        }

        # Publisher keywords for filtering
        self.publisher_keywords = {
            'press', 'publishing', 'publishers', 'books', 'editions',
            'university', 'classics', 'library', 'archive', 'ltd', 'inc',
            'corporation', 'company', 'group', 'house', 'media'
        }

    def is_publisher(self, text: str) -> bool:
        """Check if text is likely a publisher name."""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in self.publisher_keywords)

    def is_valid_author_name(self, name: str) -> bool:
        """Enhanced validation for author names."""
        if not name or len(name) < 4 or len(name) > 80:
            return False

        # Must have at least 2 words
        words = name.split()
        if len(words) < 2:
            return False

        # Check for publisher indicators
        if self.is_publisher(name):
            return False

        # Reject common false positives
        reject_patterns = [
            r'^\d{4}',  # Starts with year
            r'^(the|a|an|and|or|of|in|on|at|to|for)\s',  # Articles/prepositions
            r'wikipedia|source:|content|page \d+',  # Document markers
            r'^(chapter|section|part|volume)\s',  # Document structure
        ]

        name_lower = name.lower()
        for pattern in reject_patterns:
            if re.search(pattern, name_lower):
                return False

        return True

    def strategy_1_wikipedia(self, title: str) -> Tuple[Optional[str], int, Optional[str]]:
        """
        Wikipedia articles.
        Pattern: "Title - Wikipedia" or "Title - Wikipedia.pdf"
        """
        if re.search(r'\s-\s[Ww]ikipedia', title):
            return 'Wikipedia Contributors', 95, 'wikipedia'
        return None, 0, None

    def strategy_2_semicolon_multi_author(self, title: str) -> Tuple[Optional[str], int, Optional[str]]:
        """
        Semicolon-separated authors in Anna's Archive format.
        Pattern: "Title -- Author1; Author2 -- Publisher"
        Takes first author only.
        """
        # Look for double-dash separated sections
        if ' -- ' not in title:
            return None, 0, None

        parts = title.split(' -- ')
        if len(parts) < 3:
            return None, 0, None

        # Second part should be author(s)
        author_part = parts[1].strip()

        # Check for semicolon separator
        if ';' in author_part:
            authors = [a.strip() for a in author_part.split(';')]
            first_author = authors[0]

            # Handle "Last, First" format
            if ',' in first_author and not self.is_publisher(first_author):
                name_parts = [p.strip() for p in first_author.split(',', 1)]
                if len(name_parts) == 2:
                    # Flip to "First Last"
                    first_author = f"{name_parts[1]} {name_parts[0]}"

            if self.is_valid_author_name(first_author):
                return first_author, 90, 'semicolon_multi'

        return None, 0, None

    def strategy_3_lastname_firstname(self, title: str) -> Tuple[Optional[str], int, Optional[str]]:
        """
        Last name, First name format in Anna's Archive.
        Pattern: "Title -- Last, First -- Publisher"
        Flips to "First Last" format.
        """
        if ' -- ' not in title:
            return None, 0, None

        parts = title.split(' -- ')
        if len(parts) < 3:
            return None, 0, None

        author_part = parts[1].strip()

        # Check for "Last, First" pattern (but not semicolon multi-author)
        if ',' in author_part and ';' not in author_part:
            # Remove biographical info like "(1926-2002)"
            author_part = re.sub(r',\s*\d{4}-\d{4}', '', author_part)

            name_parts = [p.strip() for p in author_part.split(',', 1)]
            if len(name_parts) == 2 and not self.is_publisher(author_part):
                # Flip to "First Last"
                flipped_name = f"{name_parts[1]} {name_parts[0]}"

                if self.is_valid_author_name(flipped_name):
                    return flipped_name, 90, 'lastname_firstname'

        return None, 0, None

    def strategy_4_comma_separated_authors(self, title: str) -> Tuple[Optional[str], int, Optional[str]]:
        """
        Comma-separated authors at start of title.
        Pattern: "Author1, Author2, Author3 - Title"
        Takes first author only.
        """
        # Look for pattern: "Name, Name, Name - Title"
        # Must have at least 2 commas before a dash/hyphen
        if title.count(',') < 2:
            return None, 0, None

        # Split on first dash/hyphen
        dash_match = re.search(r'\s[-–]\s', title)
        if not dash_match:
            return None, 0, None

        before_dash = title[:dash_match.start()].strip()

        # Check if this looks like a list of names
        potential_authors = [a.strip() for a in before_dash.split(',')]
        if len(potential_authors) >= 2:
            first_author = potential_authors[0]

            # Validate it's not a title fragment
            if (self.is_valid_author_name(first_author) and
                len(first_author.split()) >= 2 and
                first_author[0].isupper()):
                return first_author, 85, 'comma_separated'

        return None, 0, None

    def strategy_5_enhanced_title_dash(self, title: str) -> Tuple[Optional[str], int, Optional[str]]:
        """
        Enhanced dash pattern for "Title - Author Name" format.
        More aggressive than Phase 4A to catch remaining cases.
        """
        # Look for single dash with capital words after
        match = re.search(r'\s-\s([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', title)
        if match:
            potential_author = match.group(1).strip()
            if self.is_valid_author_name(potential_author):
                return potential_author, 80, 'enhanced_dash'

        return None, 0, None

    def strategy_6_super_deep_content(self, content: str) -> Tuple[Optional[str], Optional[str], int, Optional[str]]:
        """
        Super-deep content search (pages 10-20) for research papers.
        Looks for author info that appears later in academic papers.
        """
        # Extract pages 10-20
        lines = content.split('\n')

        # Skip frontmatter
        start_idx = 0
        if lines and lines[0].strip() == '---':
            for i in range(1, min(50, len(lines))):
                if lines[i].strip() == '---':
                    start_idx = i + 1
                    break

        # Get lines 1000-2000 (roughly pages 10-20 at 100 lines/page)
        excerpt = '\n'.join(lines[start_idx + 1000:start_idx + 2000])

        # Look for "Author:" or "Authors:" section
        author_match = re.search(r'(?:Author|Authors?):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)', excerpt, re.IGNORECASE)
        if author_match:
            potential_author = author_match.group(1).strip()
            if self.is_valid_author_name(potential_author):
                return potential_author, None, 75, 'super_deep'

        # Look for affiliation patterns
        lines_excerpt = excerpt.split('\n')
        for i in range(len(lines_excerpt) - 1):
            line = lines_excerpt[i].strip()
            next_line = lines_excerpt[i + 1].strip().lower()

            if not line or len(line) < 6:
                continue

            words = line.split()
            if 2 <= len(words) <= 4:
                institution_keywords = ['university', 'college', 'institute', 'department', 'school']
                if any(keyword in next_line for keyword in institution_keywords):
                    if self.is_valid_author_name(line):
                        return line, None, 75, 'super_deep_affiliation'

        return None, None, 0, None

    def extract_from_title(self, title: str) -> Tuple[Optional[str], Optional[str], int, Optional[str]]:
        """Extract author from title using all strategies."""
        strategies = [
            self.strategy_1_wikipedia,
            self.strategy_2_semicolon_multi_author,
            self.strategy_3_lastname_firstname,
            self.strategy_4_comma_separated_authors,
            self.strategy_5_enhanced_title_dash,
        ]

        best_author = None
        best_date = None
        best_confidence = 0
        best_strategy = None

        for strategy in strategies:
            author, confidence, strategy_name = strategy(title)
            if author and confidence > best_confidence:
                best_author = author
                best_confidence = confidence
                best_strategy = strategy_name

        return best_author, best_date, best_confidence, best_strategy

    def extract_from_content(self, content: str) -> Tuple[Optional[str], Optional[str], int, Optional[str]]:
        """Extract from deep content (pages 10-20)."""
        return self.strategy_6_super_deep_content(content)

    def extract_metadata(self, md_path: Path) -> dict:
        """Extract metadata from a single markdown file."""
        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {md_path}: {e}")
            return {}

        # Parse existing frontmatter
        metadata = {}
        if content.startswith('---\n'):
            end_idx = content.find('\n---\n', 4)
            if end_idx > 0:
                frontmatter = content[4:end_idx]
                for line in frontmatter.split('\n'):
                    if ':' in line:
                        key, value = line.split(':', 1)
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        metadata[key] = value

        # NOTE: Don't skip if frontmatter has author - database is source of truth
        # We're only processing docs that DB says have no author

        # Get title
        title = metadata.get('title', md_path.stem)

        # Try title-based extraction first
        author, date, confidence, strategy = self.extract_from_title(title)

        # If title extraction failed, try super-deep content
        if not author:
            author, date, confidence, strategy = self.extract_from_content(content)

        # Update metadata if found
        if author:
            metadata['author'] = author
            self.stats['authors_extracted'] += 1
            self.stats['by_strategy'][strategy] = self.stats['by_strategy'].get(strategy, 0) + 1

            # Track confidence
            if confidence >= 90:
                self.stats['confidence_levels']['high'] += 1
            elif confidence >= 80:
                self.stats['confidence_levels']['medium'] += 1
            else:
                self.stats['confidence_levels']['low'] += 1

            # Update frontmatter in file
            if content.startswith('---\n'):
                end_idx = content.find('\n---\n', 4)
                if end_idx > 0:
                    new_frontmatter = content[4:end_idx]
                    if 'author:' not in new_frontmatter:
                        new_frontmatter += f'\nauthor: "{author}"'
                        new_content = f"---\n{new_frontmatter}\n---\n{content[end_idx+5:]}"
                        with open(md_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)

        if date:
            metadata['date'] = date
            self.stats['dates_extracted'] += 1

        return metadata

    def process_all(self):
        """Process all markdown files, focusing on those without authors."""
        # Get all markdown files
        md_files = sorted(self.markdown_dir.glob("*.md"))
        total = len(md_files)

        print("="*70)
        print("PHASE 5: FINAL TARGETED EXTRACTION")
        print("="*70)
        print(f"Total markdown files: {total}")
        print()

        for idx, md_path in enumerate(md_files, 1):
            # Read current metadata
            try:
                with open(md_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except:
                continue

            # Check if already has author in frontmatter
            has_author = False
            if content.startswith('---\n'):
                end_idx = content.find('\n---\n', 4)
                if end_idx > 0:
                    if 'author:' in content[4:end_idx]:
                        has_author = True

            # Skip if already has author
            if has_author:
                continue

            # Extract metadata
            metadata = self.extract_metadata(md_path)

            self.stats['processed'] += 1

            if self.stats['processed'] % 100 == 0:
                print(f"[{self.stats['processed']:5d}] Processed, {self.stats['authors_extracted']} authors extracted")

        # Print final statistics
        print()
        print("="*70)
        print("PHASE 5 EXTRACTION COMPLETE")
        print("="*70)
        print(f"Documents processed: {self.stats['processed']}")
        print(f"Authors extracted: {self.stats['authors_extracted']}")
        print(f"Dates extracted: {self.stats['dates_extracted']}")
        print()
        print("Confidence levels:")
        print(f"  - High (≥90%): {self.stats['confidence_levels']['high']}")
        print(f"  - Medium (80-89%): {self.stats['confidence_levels']['medium']}")
        print(f"  - Low (75-79%): {self.stats['confidence_levels']['low']}")
        print()
        print("Pattern breakdown:")
        for strategy, count in sorted(self.stats['by_strategy'].items(), key=lambda x: x[1], reverse=True):
            pct = 100.0 * count / max(1, self.stats['authors_extracted'])
            print(f"  - {strategy}: {count} ({pct:.1f}%)")
        print()

if __name__ == '__main__':
    markdown_dir = '/home/user/projects/veritable-games/resources/data/library'
    extractor = Phase5Extractor(markdown_dir)
    extractor.process_all()
