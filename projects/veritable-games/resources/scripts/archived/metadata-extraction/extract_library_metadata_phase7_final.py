#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 7: Final Comprehensive Pass

Tries all remaining edge cases and patterns for documents still missing metadata.

Usage:
    python3 extract_library_metadata_phase7_final.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import yaml
from pathlib import Path
from typing import Dict, Optional, Tuple

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

class FinalExtractor:
    """Final comprehensive extraction for remaining documents."""

    def extract_date_aggressive(self, text: str) -> Optional[str]:
        """Aggressively extract any year that looks like a publication date."""
        # Try multiple patterns
        patterns = [
            r'(?:©|Copyright|Published|Printed|Written|First\s+published)\s*(?:in\s*)?(\d{4})',
            r'\((\d{4})\)',
            r'\b(1[789]\d{2}|20[0-2]\d)\b',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                year = match.group(1)
                year_int = int(year)
                if 1800 <= year_int <= 2025:
                    return year
        return None

    def extract_author_aggressive(self, title: str, content_preview: str) -> Optional[str]:
        """Try every possible author extraction pattern."""
        # Pattern 1: Last part after dash/hyphen
        if ' - ' in title or ' – ' in title:
            parts = re.split(r'\s+[-–]\s+', title)
            if len(parts) >= 2:
                last_part = parts[-1].strip()
                # Clean up
                last_part = re.sub(r'\.(pdf|md|txt|epub)$', '', last_part, flags=re.IGNORECASE)
                last_part = re.sub(r',?\s*\d{4}.*$', '', last_part)
                last_part = re.sub(r'\s*\([^)]*\)$', '', last_part)  # Remove parenthetical
                
                words = last_part.split()
                if 2 <= len(words) <= 5:
                    # Check if it looks like a name
                    capitalized = sum(1 for w in words if w and w[0].isupper())
                    if capitalized >= 2:
                        return last_part

        # Pattern 2: Between parentheses after title
        paren_match = re.search(r'\(([A-Z][a-zA-Z\s\.\']+)\)\s*$', title)
        if paren_match:
            author = paren_match.group(1).strip()
            words = author.split()
            if 2 <= len(words) <= 4:
                return author

        # Pattern 3: After "by" in content
        by_match = re.search(r'(?:by|By)\s+([A-Z][a-zA-Z\s\.,\'-]{5,50})', content_preview[:1000])
        if by_match:
            author = by_match.group(1).strip()
            author = re.sub(r'[,\.]$', '', author)
            words = author.split()
            if 2 <= len(words) <= 5:
                return author

        return None

    def get_document_data(self, md_path: Path) -> Dict:
        """Extract all data from document."""
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

    def extract_metadata(self, md_path: Path) -> Dict:
        """Try all extraction methods."""
        data = self.get_document_data(md_path)
        title = data.get('title', '')
        content = data.get('content', '')
        current_author = data.get('author')
        current_date = data.get('date')

        result = {
            'author': None,
            'date': None,
            'author_method': None,
            'date_method': None,
        }

        # Extract author if missing
        if not current_author and title:
            content_preview = '\n'.join(content.split('\n')[:100])
            author = self.extract_author_aggressive(title, content_preview)
            if author:
                result['author'] = author
                result['author_method'] = 'aggressive_extraction'

        # Extract date if missing
        if not current_date:
            # Try title first
            if title:
                date = self.extract_date_aggressive(title)
                if date:
                    result['date'] = date
                    result['date_method'] = 'title'

            # Try content
            if not result['date'] and content:
                excerpt = '\n'.join(content.split('\n')[:500])
                date = self.extract_date_aggressive(excerpt)
                if date:
                    result['date'] = date
                    result['date_method'] = 'content'

        return result

    def update_frontmatter(self, md_path: Path, author: Optional[str], date: Optional[str]) -> bool:
        """Update YAML frontmatter."""
        try:
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()

            lines = content.split('\n')

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

                    if author and not metadata.get('author'):
                        metadata['author'] = author
                    if date and not metadata.get('date'):
                        metadata['date'] = date

                    new_frontmatter = yaml.dump(metadata, default_flow_style=False, allow_unicode=True)
                    new_content = f"---\n{new_frontmatter}---\n" + '\n'.join(lines[end_idx+1:])

                    with open(md_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

                    return True

        except Exception as e:
            print(f"Error updating {md_path.name}: {e}")
            return False

    def process_documents(self, limit: int = None, dry_run: bool = False):
        """Process all documents missing metadata."""
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

            author = result['author']
            date = result['date']

            if author or date:
                processed += 1
                if author:
                    authors_extracted += 1
                if date:
                    dates_extracted += 1

                print(f"✓ {md_path.name}")
                if author:
                    print(f"  Author: {author} ({result['author_method']})")
                if date:
                    print(f"  Date: {date} ({result['date_method']})")
                print()

                if not dry_run:
                    self.update_frontmatter(md_path, author, date)

        print()
        print("=" * 70)
        print("PHASE 7 COMPLETE")
        print("=" * 70)
        print(f"Documents processed: {processed}")
        print(f"Authors extracted: {authors_extracted}")
        print(f"Dates extracted: {dates_extracted}")
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

    extractor = FinalExtractor()
    extractor.process_documents(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    main()
