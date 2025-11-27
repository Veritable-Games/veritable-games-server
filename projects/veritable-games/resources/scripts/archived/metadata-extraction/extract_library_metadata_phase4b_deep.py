#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 4B: Deep Content Analysis

Extends Phase 3 content extraction to search deeper in documents (pages 1-10)
specifically targeting research papers and academic documents where authors
appear after abstracts and titles.

New strategies:
1. Multi-author patterns (Author¹, Author², etc.)
2. Author lists after "Abstract:" sections
3. Extended page search (10 pages instead of 3)
4. Academic paper formatting (superscripts, affiliations)
5. Publication date extraction from citations

Usage:
    python3 extract_library_metadata_phase4b_deep.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple

# Import base extractor from Phase 3
sys.path.insert(0, str(Path(__file__).parent))
from extract_library_metadata_phase3_content import ContentExtractor as BaseExtractor

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

class DeepContentExtractor(BaseExtractor):
    """Enhanced content extraction with deeper search and academic patterns."""

    def get_first_pages(self, content: str, num_pages: int = 10) -> str:
        """
        Extract first N pages of content, skipping frontmatter.
        Extended to 10 pages for research papers.
        """
        lines = content.split('\n')

        # Skip frontmatter
        start_idx = 0
        if lines and lines[0].strip() == '---':
            for i in range(1, min(50, len(lines))):
                if lines[i].strip() == '---':
                    start_idx = i + 1
                    break

        # Take first N pages worth of content (100 lines per page estimate)
        page_lines = num_pages * 100
        return '\n'.join(lines[start_idx:start_idx + page_lines])

    def strategy_6_multi_author_pattern(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 6: Multi-author patterns in academic papers.

        Patterns:
        - "Author Name¹, Author Name², Author Name³"
        - "Author Name1, Author Name2, Author Name3"
        - Takes first author only

        Important: Must have multiple authors to avoid title fragments.
        """
        # Pattern with superscript numbers (¹²³) or regular numbers (123)
        # Must match at least 2 names to be valid multi-author
        pattern = r'([A-Z][a-z]+\s+[A-Z][a-z]+)[¹²³1234567890,\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)'

        match = re.search(pattern, excerpt)

        if match:
            first_author = match.group(1).strip()
            second_author = match.group(2).strip()

            # Both must be valid names to confirm multi-author pattern
            if self.is_valid_author_name(first_author) and self.is_valid_author_name(second_author):
                # Additional check: neither should be location/event words
                location_words = {'general', 'strike', 'orleans', 'belgian', 'swedish', 'iranian',
                                 'british', 'american', 'european', 'asian', 'african',
                                 'revolution', 'rebellion', 'uprising', 'protest'}

                first_lower = first_author.lower()
                if any(word in first_lower for word in location_words):
                    return None, 0, None

                return first_author, 80, 'multi_author'

        return None, 0, None

    def strategy_7_after_abstract(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 7: Author names after "Abstract:" section.

        Common in research papers where abstract comes first, then author list.
        """
        # Find "Abstract" or "ABSTRACT" section
        abstract_match = re.search(r'(?:Abstract|ABSTRACT)[:\s]*\n', excerpt, re.IGNORECASE)

        if not abstract_match:
            return None, 0, None

        # Get text after abstract (next 500 characters)
        start_pos = abstract_match.end()
        after_abstract = excerpt[start_pos:start_pos + 500]

        # Look for author patterns
        lines = after_abstract.split('\n')

        for i, line in enumerate(lines[:15]):
            line = line.strip()

            if not line:
                continue

            # Skip section headers
            if line.isupper() or line.startswith('#'):
                continue

            words = line.split()

            # Check if it looks like a name (2-4 words, capitalized)
            if 2 <= len(words) <= 4:
                if self.is_valid_author_name(line):
                    return line, 75, 'after_abstract'

        return None, 0, None

    def strategy_8_citation_format(self, excerpt: str) -> Tuple[Optional[str], Optional[str], int, str]:
        """
        Strategy 8: Extract author and year from citation-like formats.

        Patterns:
        - "Smith, J. (2020). Title of paper..."
        - "John Smith (2020). Title..."
        - Returns both author and publication year
        """
        # Pattern: "LastName, FirstInitial. (Year)"
        pattern1 = r'([A-Z][a-z]+,\s+[A-Z]\.?)\s*\((\d{4})\)'
        match = re.search(pattern1, excerpt)

        if match:
            author = match.group(1).strip()
            year = match.group(2)

            # Convert "Smith, J." to "J. Smith"
            parts = author.split(',')
            if len(parts) == 2:
                author = f"{parts[1].strip()} {parts[0].strip()}"

            if self.is_valid_author_name(author):
                return author, year, 85, 'citation_format'

        # Pattern: "FirstName LastName (Year)"
        pattern2 = r'([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\((\d{4})\)'
        match = re.search(pattern2, excerpt)

        if match:
            author = match.group(1).strip()
            year = match.group(2)

            if self.is_valid_author_name(author):
                return author, year, 80, 'citation_format'

        return None, None, 0, None

    def strategy_9_affiliation_author(self, excerpt: str) -> Tuple[Optional[str], int, str]:
        """
        Strategy 9: Author before affiliation line.

        Pattern: Author name on one line, followed by university/institution affiliation.
        """
        lines = excerpt.split('\n')

        for i in range(len(lines) - 1):
            line = lines[i].strip()
            next_line = lines[i + 1].strip().lower()

            if not line or len(line) < 6:
                continue

            # Check if this line is a potential author name
            words = line.split()
            if 2 <= len(words) <= 4:
                # Check if next line contains institution keywords
                institution_keywords = [
                    'university', 'college', 'institute', 'school',
                    'department', 'faculty', 'lab', 'center',
                    'research', 'professor', 'phd', 'ph.d'
                ]

                if any(keyword in next_line for keyword in institution_keywords):
                    if self.is_valid_author_name(line):
                        return line, 85, 'affiliation_author'

        return None, 0, None

    def extract_author_from_content(self, md_path: Path) -> Dict:
        """
        Try all content strategies including deep analysis.
        Returns best result across all patterns.
        """
        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            return {'author': None, 'publication_date': None, 'confidence': 0, 'pattern': None, 'error': str(e)}

        # Get first 10 pages (extended from Phase 3's 3 pages)
        excerpt = self.get_first_pages(content, num_pages=10)

        # Try all strategies (inherited + new)
        strategies = [
            # New deep analysis strategies
            self.strategy_6_multi_author_pattern(excerpt),
            self.strategy_9_affiliation_author(excerpt),
            self.strategy_7_after_abstract(excerpt),
            # Inherited strategies from Phase 3
            self.strategy_1_first_line_author(excerpt),
            self.strategy_2_by_author(excerpt),
            self.strategy_3_url_author(excerpt),
            self.strategy_4_copyright_author(excerpt),
            self.strategy_5_title_then_author(excerpt),
        ]

        # Handle citation format separately (returns author + date)
        citation_result = self.strategy_8_citation_format(excerpt)
        if citation_result[0]:  # Has author
            strategies.append((citation_result[0], citation_result[2], citation_result[3]))
            # Store publication date separately
            pub_date = citation_result[1]
        else:
            pub_date = None

        # Find best result by confidence
        best_author = None
        best_confidence = 0
        best_pattern = None

        for result in strategies:
            if len(result) == 3:
                author, confidence, pattern = result
                if confidence > best_confidence:
                    best_author = author
                    best_confidence = confidence
                    best_pattern = pattern

        return {
            'author': best_author,
            'publication_date': pub_date,
            'confidence': best_confidence,
            'pattern': best_pattern,
        }

    def update_frontmatter(self, md_path: Path, author: str, pub_date: Optional[str] = None) -> bool:
        """Update YAML frontmatter with extracted author and optional publication date."""
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

                    # Update author and date
                    metadata['author'] = author
                    if pub_date:
                        metadata['date'] = pub_date

                    # Rebuild frontmatter
                    new_frontmatter = yaml.dump(metadata, default_flow_style=False, allow_unicode=True)
                    new_content = f"---\n{new_frontmatter}---\n" + '\n'.join(lines[end_idx+1:])

                    with open(md_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

                    return True
            else:
                # No frontmatter - create it
                metadata = {'author': author}
                if pub_date:
                    metadata['date'] = pub_date

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
        Extract authors using deep content analysis.
        """
        md_files = sorted(LIBRARY_PATH.glob('*.md'))

        if limit:
            md_files = md_files[:limit]

        processed = 0
        extracted = 0
        dates_extracted = 0
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

            # Extract author from content
            result = self.extract_author_from_content(md_path)
            processed += 1

            if result['author'] and result['confidence'] >= 75:
                extracted += 1
                author = result['author']
                confidence = result['confidence']
                pattern = result['pattern']
                pub_date = result.get('publication_date')

                if pub_date:
                    dates_extracted += 1

                # Count by pattern
                pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1

                if confidence >= 90:
                    high_confidence += 1
                elif confidence >= 80:
                    medium_confidence += 1
                else:
                    low_confidence += 1

                print(f"✓ {md_path.name}")
                print(f"  Author: {author}")
                if pub_date:
                    print(f"  Date: {pub_date}")
                print(f"  Confidence: {confidence}% ({pattern})")
                print()

                if not dry_run:
                    self.update_frontmatter(md_path, author, pub_date)

        print()
        print("=" * 70)
        print(f"DEEP CONTENT EXTRACTION COMPLETE")
        print("=" * 70)
        print(f"Documents processed: {processed}")
        print(f"Authors extracted: {extracted}")
        print(f"Dates extracted: {dates_extracted}")
        print(f"  - High confidence (≥90%): {high_confidence}")
        print(f"  - Medium confidence (80-89%): {medium_confidence}")
        print(f"  - Low confidence (75-79%): {low_confidence}")
        print(f"Success rate: {extracted/processed*100:.1f}%")
        print()
        if pattern_counts:
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

    extractor = DeepContentExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    main()
