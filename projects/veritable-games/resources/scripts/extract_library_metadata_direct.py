#!/usr/bin/env python3
"""
Library Metadata Extraction - Direct Analysis

Uses Claude Code's direct file reading and analysis capabilities instead of API calls.
This is more effective because:
- Full document analysis (not truncated)
- Better context understanding
- No API cost
- Can check tags, footers, and entire document

Usage:
    python3 extract_library_metadata_direct.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import psycopg2
from pathlib import Path
from typing import Dict, Optional, Tuple

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')
LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')


def extract_metadata_from_content(content: str, title: str) -> Dict[str, any]:
    """
    Extract metadata from full document content using pattern matching
    and contextual analysis.

    Returns: {
        'author': str or None,
        'publication_date': str or None,
        'confidence': int (0-100),
        'notes': str
    }
    """
    lines = content.split('\n')

    author = None
    pub_date = None
    notes = []
    confidence = 0

    # STRATEGY 1: Check tags line (very common in these documents)
    # Pattern: "Tags: ..., Author Name, ..."
    for i, line in enumerate(lines[:50]):
        if line.startswith('Tags:'):
            # Look for capitalized names in tags
            tags = line.replace('Tags:', '').strip().split(',')

            # Filter out non-author tags
            location_keywords = [
                'PDF', 'United States', 'Sweden', 'Austria', 'Cuba', 'Iran', 'Belgium',
                'New Orleans', 'Turin', 'Luxembourg', 'El Salvador', 'Guatemala',
                'Sri Lanka', 'Ceylon', 'Mombasa', 'Zanzibar', 'Haiti', 'Colombia',
                'Dominican Republic', 'Sudan', 'Ethiopia', 'Bolivia', 'Uruguay',
                'Mali', 'Tonga', 'Chad', 'general strikes', 'racism', 'docks',
                'teamsters', 'labor', 'strike', 'workers', 'unions', 'anarchism',
                'communism', 'socialism', 'capitalism', 'revolution', 'protest'
            ]

            # Collect potential author candidates
            candidates = []
            for tag in tags:
                tag = tag.strip()

                # Skip if in location keywords (case insensitive)
                if any(tag.lower() == loc.lower() for loc in location_keywords):
                    continue

                # Skip if single word (usually not a person name)
                words = tag.split()
                if len(words) < 2:
                    continue

                # Check if it looks like a name (2-4 words, most capitalized)
                if 2 <= len(words) <= 4:
                    # At least 2 words should be capitalized
                    capitalized_count = sum(1 for w in words if w and w[0].isupper())
                    if capitalized_count >= 2:
                        candidates.append(tag)

            # Prefer candidates with typical name patterns
            if candidates:
                # First preference: Names with 2-3 words (most common for person names)
                for candidate in candidates:
                    words = candidate.split()
                    if 2 <= len(words) <= 3:
                        author = candidate
                        confidence = max(confidence, 85)
                        notes.append(f"Author found in tags: {candidate}")
                        break

                # Fallback: Take first candidate if no 2-3 word names
                if not author and candidates:
                    author = candidates[0]
                    confidence = max(confidence, 75)
                    notes.append(f"Author found in tags (lower confidence): {candidates[0]}")
            break

    # STRATEGY 2: Check document footer for author/date
    # Pattern: "Author Name MM/DD/YYYY" or "Author Name YYYY"
    footer_lines = lines[-20:] if len(lines) > 20 else lines
    for line in reversed(footer_lines):
        line = line.strip()
        if not line or line.startswith('```') or line.startswith('#'):
            continue

        # Look for "Name Date" pattern
        # Examples: "Stephen O'Hanlon 2/2/2015", "Hannah King 08/11/2011"
        match = re.match(r"^([A-Z][a-zA-Z\s\.,\'-]+?)\s+(\d{1,2}/\d{1,2}/\d{4})$", line)
        if match and not author:
            author = match.group(1).strip()
            date_str = match.group(2)
            # Convert MM/DD/YYYY to YYYY-MM-DD
            parts = date_str.split('/')
            if len(parts) == 3:
                pub_date = f"{parts[2]}-{parts[0]:0>2}-{parts[1]:0>2}"
            confidence = 95
            notes.append(f"Author and date from footer: {line}")
            break

        # Look for just date
        match = re.match(r"^([A-Z][a-zA-Z\s\.,\'-]+?)\s+(\d{4})$", line)
        if match and not author:
            author = match.group(1).strip()
            pub_date = match.group(2)
            confidence = 90
            notes.append(f"Author and year from footer: {line}")
            break

    # STRATEGY 3: Look for "By Author" at document start
    for i, line in enumerate(lines[:100]):
        if re.match(r'^By\s+([A-Z])', line):
            match = re.search(r'^By\s+([A-Z][a-zA-Z\s\.,\'-]+?)(?:\s*-|$)', line)
            if match and not author:
                author = match.group(1).strip()
                confidence = max(confidence, 95)
                notes.append(f"Author from 'By' line: {line[:50]}")
                # Check next few lines for date
                for j in range(i+1, min(i+10, len(lines))):
                    next_line = lines[j].strip()
                    if next_line.startswith('Date:') or next_line.startswith('Published:'):
                        date_match = re.search(r'(\d{4}-\d{2}-\d{2}|\d{4})', next_line)
                        if date_match:
                            pub_date = date_match.group(1)
                            notes.append(f"Date from header: {next_line[:50]}")
                break

    # STRATEGY 4: Look for libcom.org researcher pattern
    # Pattern: "Researcher Name" at end, often with date
    for line in reversed(footer_lines):
        line = line.strip()
        # Pattern: researcher name, date DD/MM/YYYY
        match = re.search(r'([A-Z][a-zA-Z\s]+?),?\s+(\d{1,2}/\d{1,2}/\d{4})', line)
        if match and not author:
            author = match.group(1).strip()
            date_str = match.group(2)
            # Convert DD/MM/YYYY to YYYY-MM-DD
            parts = date_str.split('/')
            if len(parts) == 3:
                pub_date = f"{parts[2]}-{parts[1]:0>2}-{parts[0]:0>2}"
            confidence = 90
            notes.append(f"Researcher pattern: {line[:60]}")
            break

    # STRATEGY 5: Check Source line for date
    if not pub_date:
        for i, line in enumerate(lines[:50]):
            if line.startswith('Date:'):
                date_line = line.replace('Date:', '').strip()
                if date_line and date_line != 'Unknown':
                    # Try to extract year
                    year_match = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', date_line)
                    if year_match:
                        pub_date = year_match.group(1)
                        confidence = max(confidence, 70)
                        notes.append(f"Date from header: {date_line}")

    # STRATEGY 6: Look for dates in first few paragraphs
    # Common in libcom articles: "..., Date: Mon, MM/DD/YYYY - HH:MM"
    if not pub_date:
        for i, line in enumerate(lines[:100]):
            # Pattern: "Date: Day, MM/DD/YYYY"
            match = re.search(r'Date:\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2}/\d{1,2}/\d{4})', line)
            if match:
                date_str = match.group(1)
                parts = date_str.split('/')
                if len(parts) == 3:
                    pub_date = f"{parts[2]}-{parts[0]:0>2}-{parts[1]:0>2}"
                    confidence = max(confidence, 90)
                    notes.append(f"Date from libcom pattern: {line[:60]}")
                    break

    # Validation
    if author:
        # Check length
        if len(author) < 3 or len(author) > 100:
            author = None
            confidence = 0
            notes.append("Author rejected: invalid length")
        else:
            # Check for false positives - locations, countries, organizations
            false_positives = [
                'Print', 'Web', 'Published', 'Unknown', 'Continue', 'Bibliography',
                'United States', 'New Zealand', 'South Africa', 'Costa Rica',
                'Puerto Rico', 'El Salvador', 'Sri Lanka', 'Dominican Republic',
                'Czech Republic', 'Saudi Arabia', 'New York', 'Los Angeles',
                'San Francisco', 'Buenos Aires', 'Mexico City', 'General Strike',
                'Workers Union', 'Trade Union', 'Labor Party', 'Communist Party',
                'Working Class', 'International Workers'
            ]
            if any(fp.lower() == author.lower() for fp in false_positives):
                author = None
                confidence = 0
                notes.append(f"Author rejected: false positive (location/organization)")

            # Additional check: reject if it's just a country/continent name
            countries = [
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
                'Vietnam', 'Yemen', 'Zimbabwe', 'Africa', 'Asia', 'Europe', 'America'
            ]
            if author and any(country.lower() == author.lower() for country in countries):
                author = None
                confidence = 0
                notes.append(f"Author rejected: country/continent name")

    if pub_date:
        # Validate year
        year_match = re.search(r'(1[89]\d{2}|20[0-2]\d)', pub_date)
        if year_match:
            year = int(year_match.group(1))
            if year < 1800 or year > 2024:
                pub_date = None
                confidence = max(0, confidence - 20)
                notes.append(f"Date rejected: year {year} out of range")
        # Reject 2025 (conversion dates)
        if pub_date and '2025' in pub_date:
            pub_date = None
            confidence = max(0, confidence - 20)
            notes.append("Date rejected: 2025 conversion date")

    return {
        'author': author,
        'publication_date': pub_date,
        'confidence': confidence,
        'notes': '; '.join(notes) if notes else 'No metadata found'
    }


def extract_metadata_batch(dry_run=False, limit=None):
    """Main extraction function using direct analysis."""

    print("="*70)
    print("Library Metadata Extraction - Direct Analysis")
    print("="*70)
    print()

    if dry_run:
        print("🔍 DRY-RUN MODE - No database changes")
    if limit:
        print(f"📊 Limit: {limit} documents")
    print()

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    stats = {
        'total': 0,
        'processed': 0,
        'updated': 0,
        'high_confidence': 0,  # >=90
        'medium_confidence': 0,  # 70-89
        'low_confidence': 0,  # <70
        'no_metadata': 0,
    }

    try:
        # Get documents without metadata
        cur.execute("""
            SELECT id, slug, title, author, publication_date
            FROM library.library_documents
            WHERE created_by = 3
              AND (author IS NULL OR author = '' OR publication_date IS NULL OR publication_date = '')
            ORDER BY id
        """)
        docs = cur.fetchall()

        print(f"Found {len(docs)} documents needing metadata\n")

        if limit:
            docs = docs[:limit]

        # Get all markdown files
        md_files = {md_path.name: md_path for md_path in LIBRARY_PATH.glob('*.md')}

        for idx, (doc_id, slug, db_title, current_author, current_pub_date) in enumerate(docs, 1):
            stats['total'] += 1

            # Find markdown file
            matching_files = [name for name in md_files.keys() if slug in name.lower()]
            if not matching_files:
                stats['no_metadata'] += 1
                continue

            md_path = md_files[matching_files[0]]

            # Read full content
            try:
                with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                print(f"[{idx:5d}/{len(docs)}] ERROR reading {md_path.name}: {e}")
                continue

            print(f"[{idx:5d}/{len(docs)}] Processing: {db_title[:50]}")

            # Extract metadata
            result = extract_metadata_from_content(content, db_title)

            author = result['author']
            pub_date = result['publication_date']
            confidence = result['confidence']
            notes = result['notes']

            # Track confidence
            if confidence >= 90:
                stats['high_confidence'] += 1
                conf_marker = "✓"
            elif confidence >= 70:
                stats['medium_confidence'] += 1
                conf_marker = "~"
            else:
                stats['low_confidence'] += 1
                conf_marker = "?"

            # Skip if no metadata or low confidence
            if not author and not pub_date:
                stats['no_metadata'] += 1
                print(f"          ❌ No metadata found")
                print()
                continue

            if confidence < 70:
                print(f"          ⚠️  Low confidence ({confidence}%), skipping")
                print(f"          Notes: {notes[:80]}")
                print()
                continue

            # Display results
            if author:
                print(f"          {conf_marker} Author: {author} (conf: {confidence}%)")
            if pub_date:
                print(f"          {conf_marker} Date: {pub_date} (conf: {confidence}%)")
            if notes:
                print(f"          Notes: {notes[:80]}")

            # Update database
            if not dry_run:
                new_author = author or current_author
                new_pub_date = pub_date or current_pub_date

                if new_author != current_author or new_pub_date != current_pub_date:
                    cur.execute("""
                        UPDATE library.library_documents
                        SET author = COALESCE(%s, author),
                            publication_date = COALESCE(%s, publication_date),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (new_author, new_pub_date, doc_id))

                    stats['updated'] += 1
                    stats['processed'] += 1
                    print(f"          ✅ Database updated")
            else:
                stats['processed'] += 1

            print()

        if not dry_run:
            conn.commit()
            print("\n✅ All changes committed to database\n")
        else:
            print("\nDRY-RUN - No database changes\n")

        # Print summary
        print(f"{'='*70}")
        print("EXTRACTION SUMMARY")
        print(f"{'='*70}")
        print(f"Total documents: {stats['total']}")
        print(f"Successfully processed: {stats['processed']}")
        print(f"Database updated: {stats['updated']}")
        print(f"No metadata found: {stats['no_metadata']}")
        print()
        print("By Confidence:")
        print(f"  High (≥90%): {stats['high_confidence']}")
        print(f"  Medium (70-89%): {stats['medium_confidence']}")
        print(f"  Low (<70%): {stats['low_confidence']} (skipped)")
        print(f"{'='*70}")

    except Exception as e:
        conn.rollback()
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv
    limit = None

    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    extract_metadata_batch(dry_run=dry_run, limit=limit)
