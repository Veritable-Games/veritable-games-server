#!/usr/bin/env python3
"""
Add YAML Frontmatter to Library Documents

Converts embedded metadata in library documents to YAML frontmatter,
matching the anarchist library format for consistent metadata handling.

Before:
    # Title

    Tags: topic, Author Name, topic
    Date: Unknown
    Source: https://...

    Content...

After:
    ---
    title: Title
    author: Author Name
    date: YYYY-MM-DD
    source_url: https://...
    topics: [topic1, topic2]
    ---

    # Title

    Content...

Usage:
    python3 add_frontmatter_to_library_docs.py [--dry-run] [--limit N]
"""

import os
import sys
import re
from pathlib import Path
from typing import Dict, Optional, List

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')


def extract_embedded_metadata(content: str, filename: str) -> Dict:
    """
    Extract metadata from library document content.

    Returns dict with:
    - title: from # heading
    - author: from tags or footer
    - date: from Date line or footer
    - source_url: from Source line
    - topics: list of tags (excluding author)
    """
    lines = content.split('\n')
    metadata = {
        'title': None,
        'author': None,
        'date': None,
        'source_url': None,
        'topics': [],
    }

    # Extract title from first # heading
    for line in lines[:50]:
        line = line.strip()
        if line.startswith('# ') and not metadata['title']:
            metadata['title'] = line[2:].strip()
            metadata['title'] = re.sub(r'#+$', '', metadata['title']).strip()
            break

    # Extract metadata from header section (first 50 lines)
    for i, line in enumerate(lines[:50]):
        line = line.strip()

        # Source URL
        if line.startswith('Source:'):
            url = line.replace('Source:', '').strip()
            if url.startswith('http'):
                metadata['source_url'] = url

        # Date line
        if line.startswith('Date:'):
            date_str = line.replace('Date:', '').strip()
            if date_str and date_str != 'Unknown':
                # Try to parse date
                year_match = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', date_str)
                if year_match:
                    metadata['date'] = year_match.group(1)

        # Tags line - most important for author extraction
        if line.startswith('Tags:'):
            tags_str = line.replace('Tags:', '').strip()
            tags = [t.strip() for t in tags_str.split(',')]

            # Countries/cities to exclude from author detection
            location_keywords = {
                'United States', 'New Zealand', 'South Africa', 'Costa Rica',
                'Puerto Rico', 'El Salvador', 'Sri Lanka', 'Dominican Republic',
                'Czech Republic', 'Saudi Arabia', 'New York', 'Los Angeles',
                'San Francisco', 'Buenos Aires', 'Mexico City', 'New Orleans',
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
                'Ceylon', 'Mombasa', 'Zanzibar', 'Turin'
            }

            for tag in tags:
                tag = tag.strip()

                # Check if it might be an author (2-4 words, capitalized)
                words = tag.split()
                if len(words) >= 2 and len(words) <= 4:
                    # Not a location/country
                    if not any(tag.lower() == loc.lower() for loc in location_keywords):
                        # Has capitalized words (name pattern)
                        capitalized = sum(1 for w in words if w and w[0].isupper())
                        if capitalized >= 2 and not metadata['author']:
                            metadata['author'] = tag
                            continue  # Don't add author to topics

                # Add to topics (filter out PDF only, keep other tags)
                if tag and tag != 'PDF':
                    # Don't add if it's clearly a location/country
                    is_location = any(tag.lower() == loc.lower() for loc in location_keywords)
                    if not is_location:
                        metadata['topics'].append(tag)

    # Extract author/date from footer (last 20 lines)
    footer_lines = lines[-20:] if len(lines) > 20 else lines
    for line in reversed(footer_lines):
        line = line.strip()
        if not line or line.startswith('```') or line.startswith('#'):
            continue

        # Pattern: "Author Name DD/MM/YYYY" or just "DD/MM/YYYY" or "Author Name YYYY"
        match = re.match(r"^([A-Z][a-zA-Z\s\.,\'-]+?)\s+(\d{1,2}/\d{1,2}/\d{4})$", line)
        if match:
            # Extract both author and date
            author_name = match.group(1).strip()
            date_str = match.group(2)

            # Set author if not already found (or if it matches current author)
            if not metadata['author']:
                metadata['author'] = author_name

            # Always extract date
            if not metadata['date']:
                parts = date_str.split('/')
                if len(parts) == 3:
                    # Could be MM/DD/YYYY or DD/MM/YYYY - try both
                    if int(parts[0]) <= 12 and int(parts[1]) <= 12:
                        # Ambiguous - assume MM/DD/YYYY
                        metadata['date'] = f"{parts[2]}-{parts[0]:0>2}-{parts[1]:0>2}"
                    elif int(parts[0]) > 12:
                        # Must be DD/MM/YYYY
                        metadata['date'] = f"{parts[2]}-{parts[1]:0>2}-{parts[0]:0>2}"
                    else:
                        # Assume MM/DD/YYYY
                        metadata['date'] = f"{parts[2]}-{parts[0]:0>2}-{parts[1]:0>2}"
            break

        # Also try just "YYYY" at end
        match = re.match(r"^([A-Z][a-zA-Z\s\.,\'-]+?)\s+(\d{4})$", line)
        if match and not metadata['date']:
            year = match.group(2)
            if 1800 <= int(year) <= 2024:
                metadata['date'] = year
            if not metadata['author']:
                metadata['author'] = match.group(1).strip()
            break

    # Fallback: title from filename if not found
    if not metadata['title']:
        # Remove prefix and extension
        name = filename.stem
        # Remove category prefix pattern
        name = re.sub(r'^\d+_[A-Za-z_]+_[A-Za-z_]+_', '', name)
        # Replace hyphens/underscores with spaces, title case
        metadata['title'] = name.replace('-', ' ').replace('_', ' ').title()

    return metadata


def create_frontmatter(metadata: Dict) -> str:
    """Create YAML frontmatter from metadata dict."""
    lines = ['---']

    if metadata.get('title'):
        # Escape single quotes in title
        title = metadata['title'].replace("'", "''")
        lines.append(f"title: '{title}'")

    if metadata.get('author'):
        author = metadata['author'].replace("'", "''")
        lines.append(f"author: '{author}'")

    if metadata.get('date'):
        lines.append(f"date: '{metadata['date']}'")

    if metadata.get('source_url'):
        lines.append(f"source_url: {metadata['source_url']}")

    if metadata.get('topics'):
        # Format topics as YAML list
        topics_str = ', '.join(metadata['topics'])
        lines.append(f"topics: [{topics_str}]")

    lines.append('---')
    return '\n'.join(lines)


def add_frontmatter_to_file(md_path: Path, dry_run=False) -> bool:
    """Add YAML frontmatter to a single markdown file."""
    try:
        with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        # Skip if already has frontmatter
        if content.startswith('---\n'):
            return False

        # Extract metadata
        metadata = extract_embedded_metadata(content, md_path)

        # Create frontmatter
        frontmatter = create_frontmatter(metadata)

        # Combine frontmatter + original content
        new_content = frontmatter + '\n\n' + content

        if not dry_run:
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(new_content)

        return True

    except Exception as e:
        print(f"Error processing {md_path.name}: {e}")
        return False


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

    print("="*70)
    print("Adding YAML Frontmatter to Library Documents")
    print("="*70)
    print()

    if dry_run:
        print("🔍 DRY-RUN MODE - No files will be modified\n")

    # Get all markdown files
    md_files = list(LIBRARY_PATH.glob('*.md'))
    total = len(md_files)

    if limit:
        md_files = md_files[:limit]
        print(f"Processing first {limit} of {total} files\n")
    else:
        print(f"Processing all {total} files\n")

    stats = {
        'processed': 0,
        'updated': 0,
        'skipped': 0,
        'errors': 0,
    }

    for idx, md_path in enumerate(sorted(md_files), 1):
        stats['processed'] += 1

        # Show sample output for first few files
        show_details = (idx <= 10) or (idx % 100 == 0)

        if show_details:
            print(f"[{idx:5d}/{len(md_files)}] {md_path.name[:60]}")

        was_updated = add_frontmatter_to_file(md_path, dry_run=dry_run)

        if was_updated:
            stats['updated'] += 1
            if show_details and not dry_run:
                # Show first 10 lines of updated file
                with open(md_path, 'r', encoding='utf-8') as f:
                    preview = '\n'.join(f.read().split('\n')[:12])
                    print(f"          Preview:\n{preview}\n")
        else:
            stats['skipped'] += 1
            if show_details:
                print(f"          ⏭️  Skipped (already has frontmatter)\n")

    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    print(f"Processed: {stats['processed']}")
    print(f"Updated: {stats['updated']}")
    print(f"Skipped: {stats['skipped']} (already had frontmatter)")
    print(f"Errors: {stats['errors']}")
    print(f"{'='*70}")

    if dry_run:
        print("\nDRY-RUN MODE - No files were actually modified")
        print("Run without --dry-run to apply changes")


if __name__ == '__main__':
    main()
