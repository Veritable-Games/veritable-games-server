#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 3: Enhanced Pattern Matching

Extracts author and publication date from the first 5 pages of documents
using multiple pattern matching strategies.

Strategies:
1. First page author attribution (Name at top of page 1)
2. Copyright blocks (© YEAR Author Name)
3. Report headers (A REPORT BY / Author Name)
4. Expanded tags parsing (author as first tag)
5. URL-based extraction (anarchist library URLs)
6. Byline patterns (By Author Name)

Usage:
    python3 extract_library_metadata_phase3.py [--dry-run] [--limit N] [--test]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from datetime import datetime
from urllib.parse import urlparse

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

# Confidence thresholds
CONFIDENCE_HIGH = 90
CONFIDENCE_MEDIUM = 75
CONFIDENCE_LOW = 50

class MetadataExtractor:
    """Extract metadata from library documents using multiple strategies."""

    def __init__(self):
        self.false_positives = self._load_false_positives()
        self.stats = {
            'total': 0,
            'extracted': 0,
            'high_confidence': 0,
            'medium_confidence': 0,
            'low_confidence': 0,
            'no_metadata': 0,
            'by_strategy': {},
        }

    def _load_false_positives(self) -> set:
        """Load known false positive author names."""
        return {
            # Organizations
            'PDF', 'PDFDrive', 'annas-archive', 'Project Gutenberg',
            'Print', 'Web', 'Published', 'Unknown', 'Continue', 'Bibliography',
            'Trade Union', 'Labor Party', 'Communist Party', 'Working Class',
            'International Workers', 'General Strike', 'Workers Union',

            # Countries and locations
            'United States', 'New Zealand', 'South Africa', 'Costa Rica',
            'Puerto Rico', 'El Salvador', 'Sri Lanka', 'Dominican Republic',
            'Czech Republic', 'Saudi Arabia', 'New York', 'Los Angeles',
            'San Francisco', 'Buenos Aires', 'Mexico City',

            # More countries
            'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
            'Belgium', 'Bolivia', 'Brazil', 'Bulgaria', 'Canada', 'Chad', 'Chile',
            'China', 'Colombia', 'Cuba', 'Denmark', 'Ecuador', 'Egypt', 'Ethiopia',
            'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Haiti',
            'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
            'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Kenya', 'Korea',
            'Luxembourg', 'Mali', 'Mexico', 'Morocco', 'Netherlands', 'Nicaragua',
            'Nigeria', 'Norway', 'Pakistan', 'Palestine', 'Panama', 'Peru',
            'Philippines', 'Poland', 'Portugal', 'Romania', 'Russia', 'Somalia',
            'Spain', 'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Thailand', 'Tonga',
            'Tunisia', 'Turkey', 'Uganda', 'Ukraine', 'Uruguay', 'Venezuela',
            'Vietnam', 'Yemen', 'Zimbabwe', 'Africa', 'Asia', 'Europe', 'America',
            'Ceylon', 'Mombasa', 'Zanzibar', 'Turin',

            # Historical events
            'World War I', 'World War II', 'World War One', 'World War Two',
            'Civil War', 'Spanish Civil War', 'The Holocaust', 'The Depression',
        }

    def _is_organization_name(self, name: str) -> bool:
        """Check if name is an organization rather than a person."""
        org_keywords = [
            'party', 'union', 'federation', 'committee', 'collective', 'caucus',
            'tendency', 'council', 'association', 'society', 'league', 'alliance',
            'coalition', 'group', 'movement', 'organization', 'network', 'club',
            'iww', 'afl', 'cio', 'faq', 'manifesto', 'essay', 'article',
        ]

        name_lower = name.lower()
        return any(keyword in name_lower for keyword in org_keywords)

    def _is_title_like(self, name: str) -> bool:
        """Check if string looks like a title rather than a name."""
        title_patterns = [
            r'\bmanifesto\b',
            r'\bfaq\b',
            r'\bessays?\b',
            r'\barticles?\b',
            r'\bintroduction\b',
            r'\bguide\b',
            r'\bhistory of\b',
            r'\ban? anarchist\b',
            r'\ban? cyborg\b',
            r'\bthe .{3,40}$',  # "The Something Long"
        ]

        name_lower = name.lower()
        return any(re.search(pattern, name_lower, re.IGNORECASE) for pattern in title_patterns)

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
            print(f"Error parsing frontmatter in {md_path.name}: {e}")
            return {}

    def get_first_pages(self, content: str, num_pages: int = 5) -> str:
        """Extract first N pages from markdown content (excluding frontmatter)."""
        lines = content.split('\n')

        # Skip frontmatter (between first two ---  markers)
        start_idx = 0
        if lines and lines[0].strip() == '---':
            # Find end of frontmatter
            for i in range(1, min(50, len(lines))):
                if lines[i].strip() == '---':
                    start_idx = i + 1
                    break

        lines = lines[start_idx:]

        # Look for page markers
        page_count = 0
        result_lines = []

        for line in lines:
            result_lines.append(line)

            # Count page breaks
            if line.startswith('## Page ') or line.startswith('---') and page_count > 0:
                page_count += 1
                if page_count >= num_pages:
                    break

        # If no page markers, just take first 500 lines
        if page_count == 0:
            return '\n'.join(lines[:500])

        return '\n'.join(result_lines)

    def is_valid_author_name(self, name: str) -> bool:
        """Validate if string looks like a person's name."""
        if not name or len(name) < 3 or len(name) > 100:
            return False

        # Check false positives
        if name in self.false_positives:
            return False

        if any(fp.lower() == name.lower() for fp in self.false_positives):
            return False

        # Check if it's an organization
        if self._is_organization_name(name):
            return False

        # Check if it's a title
        if self._is_title_like(name):
            return False

        # Check for numbers (usually not in names)
        if re.search(r'\d', name):
            return False

        # Must have at least 2 words
        words = name.split()
        if len(words) < 2:
            return False

        # At least 2 words should be capitalized
        capitalized = sum(1 for w in words if w and w[0].isupper())
        if capitalized < 2:
            return False

        return True

    def is_valid_date(self, date_str: str) -> bool:
        """Validate if date is reasonable."""
        if not date_str:
            return False

        # Extract year
        year_match = re.search(r'(1[789]\d{2}|20[0-2]\d)', date_str)
        if not year_match:
            return False

        year = int(year_match.group(1))

        # Must be between 1700 and 2024
        if year < 1700 or year > 2024:
            return False

        # Not a conversion date
        if '2025' in date_str:
            return False

        return True

    def strategy_1_first_page_attribution(self, excerpt: str) -> Tuple[Optional[str], Optional[str], int]:
        """
        Strategy 1: First page author attribution.
        Pattern: Author name at top of first page followed by title.

        Example:
            Donna Haraway
            A Cyborg Manifesto
            Science, Technology, and Socialist-Feminism
            1985
        """
        lines = excerpt.split('\n')[:50]  # First 50 lines

        author = None
        date = None
        confidence = 0

        # Look for name pattern in first 10 lines
        for i in range(min(10, len(lines))):
            line = lines[i].strip()

            # Skip empty, markdown headers, and metadata
            if not line or line.startswith('#') or line.startswith('*') or line.startswith('---'):
                continue

            # Check if it looks like a name (2-4 words, capitalized)
            words = line.split()
            if 2 <= len(words) <= 4:
                if self.is_valid_author_name(line):
                    # Check if next few lines contain title-like text
                    next_lines = '\n'.join(lines[i+1:i+5])
                    if len(next_lines) > 10:  # Has content after
                        author = line
                        confidence = 90

                        # Look for year in next few lines
                        for j in range(i+1, min(i+10, len(lines))):
                            year_match = re.search(r'\b(1[789]\d{2}|20[0-2]\d)\b', lines[j])
                            if year_match:
                                date = year_match.group(1)
                                confidence = 95
                                break
                        break

        return author, date, confidence

    def strategy_2_copyright_blocks(self, excerpt: str) -> Tuple[Optional[str], Optional[str], int]:
        """
        Strategy 2: Copyright blocks.
        Pattern: © YEAR Author Name or Copyright YEAR Author Name

        Examples:
            © 2007 David Graeber
            Copyright 1984, 2007 by Audre Lorde
            Text © 1910 Emma Goldman
        """
        author = None
        date = None
        confidence = 0

        # Pattern 1: © YEAR Name
        pattern1 = r'©\s*(1[789]\d{2}|20[0-2]\d)\s+(?:by\s+)?([A-Z][a-zA-Z\s\.,\'-]+)'
        matches = re.findall(pattern1, excerpt)
        if matches:
            year, name = matches[0]
            if self.is_valid_author_name(name.strip()):
                author = name.strip()
                date = year
                confidence = 95
                return author, date, confidence

        # Pattern 2: Copyright YEAR, YEAR by Name
        pattern2 = r'Copyright\s*(?:\d{4},\s*)*(\d{4})\s+by\s+([A-Z][a-zA-Z\s\.,\'-]+)'
        matches = re.findall(pattern2, excerpt, re.IGNORECASE)
        if matches:
            year, name = matches[0]
            if self.is_valid_author_name(name.strip()):
                author = name.strip()
                date = year
                confidence = 95
                return author, date, confidence

        # Pattern 3: Text © YEAR by Name
        pattern3 = r'Text\s*©\s*(\d{4}(?:,\s*\d{4})*)\s+by\s+([A-Z][a-zA-Z\s\.,\'-]+)'
        matches = re.findall(pattern3, excerpt, re.IGNORECASE)
        if matches:
            years, name = matches[0]
            if self.is_valid_author_name(name.strip()):
                author = name.strip()
                # Take first year
                date = re.search(r'\d{4}', years).group(0)
                confidence = 95
                return author, date, confidence

        return author, date, confidence

    def strategy_3_report_headers(self, excerpt: str) -> Tuple[Optional[str], Optional[str], int]:
        """
        Strategy 3: Report/academic paper headers.
        Pattern: A REPORT BY / Author Name, Affiliation

        Example:
            A REPORT BY
            William P. Jones, University of Minnesota
            SEPTEMBER 2023
        """
        author = None
        date = None
        confidence = 0

        lines = excerpt.split('\n')

        for i, line in enumerate(lines[:100]):
            # Look for "A REPORT BY" or "BY" in caps
            if re.search(r'\bA\s+REPORT\s+BY\b', line, re.IGNORECASE) or \
               re.search(r'^\s*BY\s*$', line, re.IGNORECASE):

                # Next line should be author
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()

                    # Remove affiliation (after comma)
                    name_part = next_line.split(',')[0].strip()

                    if self.is_valid_author_name(name_part):
                        author = name_part
                        confidence = 90

                        # Look for date in next few lines
                        for j in range(i, min(i+10, len(lines))):
                            date_match = re.search(r'\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})\b', lines[j], re.IGNORECASE)
                            if date_match:
                                date = date_match.group(2)
                                confidence = 95
                                break
                        break

        return author, date, confidence

    def strategy_4_byline_patterns(self, excerpt: str) -> Tuple[Optional[str], Optional[str], int]:
        """
        Strategy 4: Byline patterns.
        Pattern: By Author Name at article start

        Examples:
            By James Herod
            By Labor for Standing Rock - February 2017
        """
        author = None
        date = None
        confidence = 0

        lines = excerpt.split('\n')[:100]

        for i, line in enumerate(lines):
            # Pattern: "By Name" or "by Name"
            match = re.match(r'^\s*By\s+([A-Z][a-zA-Z\s\.,\'-]+?)(?:\s*[-–—]\s*(.+))?$', line, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                rest = match.group(2)

                if self.is_valid_author_name(name):
                    author = name
                    confidence = 95

                    # Check if date is in the same line
                    if rest:
                        date_match = re.search(r'\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})\b', rest, re.IGNORECASE)
                        if date_match:
                            date = date_match.group(2)
                        else:
                            year_match = re.search(r'\b(1[789]\d{2}|20[0-2]\d)\b', rest)
                            if year_match:
                                date = year_match.group(1)
                    break

        return author, date, confidence

    def strategy_5_url_extraction(self, content: str) -> Tuple[Optional[str], Optional[str], int]:
        """
        Strategy 5: Extract author from URLs.
        Pattern: theanarchistlibrary.org/library/author-name-title
        """
        author = None
        date = None
        confidence = 0

        # Look for anarchist library URLs
        pattern = r'https?://(?:www\.)?theanarchistlibrary\.org/library/([a-z0-9-]+)'
        matches = re.findall(pattern, content)

        if matches:
            # First part is usually author slug
            slug = matches[0]
            parts = slug.split('-')

            # Try to extract author (first 2-3 parts)
            if len(parts) >= 2:
                # Convert slug to name
                potential_author = ' '.join(parts[:2]).title()

                if self.is_valid_author_name(potential_author):
                    author = potential_author
                    confidence = 85  # Medium-high confidence

        return author, date, confidence

    def strategy_6_tags_expanded(self, content: str) -> Tuple[Optional[str], Optional[str], int]:
        """
        Strategy 6: Expanded tags parsing.
        Pattern: Tags: Author Name, topic1, topic2 (author as FIRST tag)
        """
        author = None
        date = None
        confidence = 0

        lines = content.split('\n')[:50]

        for line in lines:
            if line.startswith('Tags:'):
                tags_str = line.replace('Tags:', '').strip()
                tags = [t.strip() for t in tags_str.split(',')]

                if tags:
                    # First tag might be author
                    first_tag = tags[0]

                    # Must be 2-4 words, capitalized
                    if self.is_valid_author_name(first_tag):
                        author = first_tag
                        confidence = 80  # Medium confidence
                        break

        return author, date, confidence

    def extract_metadata(self, md_path: Path) -> Dict:
        """
        Extract metadata using all strategies.
        Returns best result across all strategies.
        """
        try:
            # Read file
            with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            # Get first 5 pages
            excerpt = self.get_first_pages(content)

            # Try all strategies
            strategies = [
                ('first_page_attribution', self.strategy_1_first_page_attribution(excerpt)),
                ('copyright_blocks', self.strategy_2_copyright_blocks(excerpt)),
                ('report_headers', self.strategy_3_report_headers(excerpt)),
                ('byline_patterns', self.strategy_4_byline_patterns(excerpt)),
                ('url_extraction', self.strategy_5_url_extraction(content)),
                ('tags_expanded', self.strategy_6_tags_expanded(content)),
            ]

            # Find best result by confidence
            best_author = None
            best_date = None
            best_confidence = 0
            best_strategy = None

            for strategy_name, (author, date, confidence) in strategies:
                if confidence > best_confidence:
                    best_author = author
                    best_date = date
                    best_confidence = confidence
                    best_strategy = strategy_name

            # Validate results
            if best_author and not self.is_valid_author_name(best_author):
                best_author = None
                best_confidence = 0

            if best_date and not self.is_valid_date(best_date):
                best_date = None

            return {
                'author': best_author,
                'date': best_date,
                'confidence': best_confidence,
                'strategy': best_strategy,
            }

        except Exception as e:
            print(f"Error extracting metadata from {md_path.name}: {e}")
            return {
                'author': None,
                'date': None,
                'confidence': 0,
                'strategy': None,
            }

    def update_frontmatter(self, md_path: Path, metadata: Dict, dry_run: bool = False) -> bool:
        """Update YAML frontmatter with extracted metadata."""
        try:
            with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            # Extract existing frontmatter
            match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
            if not match:
                print(f"No frontmatter found in {md_path.name}")
                return False

            frontmatter_str = match.group(1)
            body = match.group(2)

            # Parse frontmatter
            frontmatter = yaml.safe_load(frontmatter_str) or {}

            # Update with new metadata
            updated = False
            if metadata['author'] and not frontmatter.get('author'):
                frontmatter['author'] = metadata['author']
                updated = True

            if metadata['date'] and not frontmatter.get('date'):
                frontmatter['date'] = metadata['date']
                updated = True

            if not updated:
                return False

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
            print(f"Error updating frontmatter in {md_path.name}: {e}")
            return False

    def process_documents(self, limit: int = None, dry_run: bool = False, test_mode: bool = False):
        """Process all documents missing metadata."""

        print("="*70)
        print("Library Metadata Extraction - Phase 3: Enhanced Pattern Matching")
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

        # Filter to only those missing metadata
        files_to_process = []
        for md_path in md_files:
            frontmatter = self.extract_frontmatter(md_path)
            if not frontmatter.get('author') or not frontmatter.get('date'):
                files_to_process.append(md_path)

        print(f"Found {len(files_to_process)} documents missing metadata")
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

            # Extract metadata
            result = self.extract_metadata(md_path)

            author = result['author']
            date = result['date']
            confidence = result['confidence']
            strategy = result['strategy']

            # Track confidence
            if confidence >= CONFIDENCE_HIGH:
                self.stats['high_confidence'] += 1
                conf_marker = "✓"
            elif confidence >= CONFIDENCE_MEDIUM:
                self.stats['medium_confidence'] += 1
                conf_marker = "~"
            else:
                self.stats['low_confidence'] += 1
                conf_marker = "?"

            # Skip if no metadata or low confidence
            if not author and not date:
                self.stats['no_metadata'] += 1
                if show_details:
                    print(f"          ❌ No metadata found")
                    print()
                continue

            if confidence < CONFIDENCE_MEDIUM:
                if show_details:
                    print(f"          ⚠️  Low confidence ({confidence}%), skipping")
                    if author:
                        print(f"          Candidate author: {author}")
                    print()
                continue

            # Display results
            if show_details:
                if author:
                    print(f"          {conf_marker} Author: {author} (conf: {confidence}%)")
                if date:
                    print(f"          {conf_marker} Date: {date} (conf: {confidence}%)")
                print(f"          Strategy: {strategy}")

            # Update frontmatter
            if self.update_frontmatter(md_path, result, dry_run=dry_run):
                self.stats['extracted'] += 1

                # Track by strategy
                if strategy not in self.stats['by_strategy']:
                    self.stats['by_strategy'][strategy] = 0
                self.stats['by_strategy'][strategy] += 1

                if show_details:
                    if not dry_run:
                        print(f"          ✅ Frontmatter updated")
                    else:
                        print(f"          ℹ️  Would update frontmatter")

            if show_details:
                print()

        # Print summary
        print(f"\n{'='*70}")
        print("EXTRACTION SUMMARY - PHASE 3")
        print(f"{'='*70}")
        print(f"Total documents processed: {self.stats['total']}")
        print(f"Metadata extracted: {self.stats['extracted']}")
        print(f"No metadata found: {self.stats['no_metadata']}")
        print()
        print("By Confidence:")
        print(f"  High (≥90%): {self.stats['high_confidence']}")
        print(f"  Medium (75-89%): {self.stats['medium_confidence']}")
        print(f"  Low (<75%): {self.stats['low_confidence']} (skipped)")
        print()
        print("By Strategy:")
        for strategy, count in sorted(self.stats['by_strategy'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {strategy}: {count}")
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

    extractor = MetadataExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run, test_mode=test_mode)


if __name__ == '__main__':
    main()
