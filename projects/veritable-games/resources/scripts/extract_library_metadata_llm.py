#!/usr/bin/env python3
"""
Library Metadata Extraction - LLM Phase (Phase 2A)

Uses Claude API to extract author and publication date metadata from library documents
using contextual understanding and intelligent inference.

Phase 2A: Lightweight extraction (first 1000 words)
- Target: 3,353 documents without metadata
- Expected success: 75-85%
- Cost: ~$21 for full run
- Time: ~2 hours automated processing

Usage:
    # Pilot test (50 documents)
    python3 extract_library_metadata_llm.py --pilot --dry-run
    python3 extract_library_metadata_llm.py --pilot

    # Full extraction
    python3 extract_library_metadata_llm.py --confidence-threshold 70

    # Resume from checkpoint
    python3 extract_library_metadata_llm.py --resume checkpoints/batch_3.json

Options:
    --pilot: Process only first 50 documents for testing
    --dry-run: Show what would be extracted without updating database
    --confidence-threshold N: Minimum confidence to accept (default: 70)
    --batch-size N: Documents per batch (default: 50)
    --resume FILE: Resume from checkpoint file
    --limit N: Process only N documents total
"""

import os
import sys
import json
import re
import time
import psycopg2
from pathlib import Path
from typing import Dict, Optional, List, Tuple
from datetime import datetime
import anthropic

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')
LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')
CHECKPOINT_DIR = Path('/home/user/projects/veritable-games/resources/scripts/checkpoints')
CHECKPOINT_DIR.mkdir(exist_ok=True)

# API Configuration
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
if not ANTHROPIC_API_KEY:
    print("ERROR: ANTHROPIC_API_KEY environment variable not set")
    print("Set it with: export ANTHROPIC_API_KEY='your-key-here'")
    sys.exit(1)

# Constants
BATCH_SIZE = 50
CONFIDENCE_THRESHOLD = 70
MAX_CONTENT_WORDS = 1000  # Phase 2A lightweight extraction
HAIKU_MODEL = "claude-3-5-haiku-20241022"


class LLMMetadataExtractor:
    """LLM-based metadata extraction using Claude API."""

    def __init__(self, confidence_threshold=70):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.confidence_threshold = confidence_threshold
        self.stats = {
            'total': 0,
            'processed': 0,
            'updated': 0,
            'high_confidence': 0,
            'medium_confidence': 0,
            'low_confidence': 0,
            'skipped_low_confidence': 0,
            'api_errors': 0,
            'total_tokens': 0,
            'total_cost': 0.0,
        }

    def truncate_content(self, content: str, max_words: int = MAX_CONTENT_WORDS) -> str:
        """Truncate content to first N words for lightweight extraction."""
        words = content.split()
        if len(words) <= max_words:
            return content
        return ' '.join(words[:max_words]) + '\n\n[Content truncated for analysis...]'

    def extract_metadata_llm(self, content: str, title: str) -> Optional[Dict]:
        """
        Use Claude API to extract metadata from document content.

        Returns dict with:
        {
            'author': str or None,
            'author_type': 'individual|collective|organizational|corporate|interview|unknown',
            'publication_date': str or None,
            'publication_date_precision': 'exact|year|decade|approximate|unknown',
            'confidence_author': 0-100,
            'confidence_date': 0-100,
            'notes': str,
            'special_circumstances': [...]
        }
        """
        # Truncate content for Phase 2A
        truncated_content = self.truncate_content(content, MAX_CONTENT_WORDS)

        prompt = f"""You are analyzing a political theory/radical literature document to extract bibliographic metadata.

**Document Title**: {title}

**Document Content** (first {MAX_CONTENT_WORDS} words):
{truncated_content}

---

Extract the following metadata from this document:

1. **Author**: Who wrote or created this document?
   - Look for explicit bylines ("By [Author]", "Author:", etc.)
   - Check document headers, footers, signatures
   - Look for contextual clues (first-person references, self-attribution)
   - Consider organizational/collective authorship
   - If clearly stated as anonymous or unsigned, note that
   - If truly unknown, return null

2. **Publication Date**: When was this originally published/written?
   - Look for explicit dates ("Published:", "Date:", copyright notices)
   - Check for contextual clues (event references, "last year", "recently")
   - Look for historical context that narrows timeframe
   - Distinguish between original publication and reprints/translations
   - Ignore PDF conversion dates
   - If truly unknown, return null

**Return your analysis as JSON**:
```json
{{
  "author": "string or null",
  "author_type": "individual|collective|organizational|corporate|interview|unknown",
  "publication_date": "YYYY or YYYY-MM or YYYY-MM-DD or null",
  "publication_date_precision": "exact|year|decade|approximate|unknown",
  "confidence_author": 0-100,
  "confidence_date": 0-100,
  "notes": "brief context about how you determined these values",
  "special_circumstances": ["translation", "pseudonym", "anonymous", "collective", etc]
}}
```

**Confidence Guidelines**:
- 90-100: Explicitly stated, unambiguous
- 70-89: Strong contextual evidence, high probability
- 50-69: Moderate evidence, reasonable inference
- 0-49: Weak evidence, speculative

**Important**:
- Only return metadata you can support with evidence from the text
- Be conservative with confidence scores
- Note any ambiguity in the "notes" field
- For dates, prefer year-only over full dates if precision unclear
- Distinguish between document author and quoted/referenced authors"""

        try:
            # Call Claude API
            response = self.client.messages.create(
                model=HAIKU_MODEL,
                max_tokens=1024,
                temperature=0,  # Deterministic for metadata extraction
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            # Track usage
            self.stats['total_tokens'] += response.usage.input_tokens + response.usage.output_tokens
            # Haiku pricing: $0.25 per MTok input, $1.25 per MTok output
            cost = (response.usage.input_tokens * 0.25 / 1_000_000) + \
                   (response.usage.output_tokens * 1.25 / 1_000_000)
            self.stats['total_cost'] += cost

            # Parse response
            response_text = response.content[0].text

            # Extract JSON from response (may have markdown code fences)
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON without code fences
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    print(f"ERROR: Could not extract JSON from response: {response_text[:200]}")
                    self.stats['api_errors'] += 1
                    return None

            # Parse JSON
            try:
                metadata = json.loads(json_str)
            except json.JSONDecodeError as e:
                print(f"ERROR: Invalid JSON in response: {e}")
                print(f"Response: {json_str[:200]}")
                self.stats['api_errors'] += 1
                return None

            # Validate required fields
            required_fields = ['author', 'publication_date', 'confidence_author', 'confidence_date']
            for field in required_fields:
                if field not in metadata:
                    print(f"ERROR: Missing required field '{field}' in response")
                    self.stats['api_errors'] += 1
                    return None

            return metadata

        except anthropic.APIError as e:
            print(f"API Error: {e}")
            self.stats['api_errors'] += 1
            return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            self.stats['api_errors'] += 1
            return None

    def validate_metadata(self, metadata: Dict) -> Tuple[bool, str]:
        """
        Validate extracted metadata meets quality standards.

        Returns (is_valid, reason)
        """
        author = metadata.get('author')
        pub_date = metadata.get('publication_date')
        conf_author = metadata.get('confidence_author', 0)
        conf_date = metadata.get('confidence_date', 0)

        # Must have at least one piece of metadata
        if not author and not pub_date:
            return False, "No metadata extracted"

        # Check confidence thresholds
        if author and conf_author < self.confidence_threshold:
            if not pub_date or conf_date < self.confidence_threshold:
                return False, f"Author confidence {conf_author} below threshold {self.confidence_threshold}"

        if pub_date and conf_date < self.confidence_threshold:
            if not author or conf_author < self.confidence_threshold:
                return False, f"Date confidence {conf_date} below threshold {self.confidence_threshold}"

        # Validate date format if present
        if pub_date:
            # Should be YYYY, YYYY-MM, or YYYY-MM-DD
            if not re.match(r'^\d{4}(-\d{2})?(-\d{2})?$', str(pub_date)):
                return False, f"Invalid date format: {pub_date}"

            # Extract year
            year_match = re.match(r'^(\d{4})', str(pub_date))
            if year_match:
                year = int(year_match.group(1))
                if year < 1800 or year > 2024:
                    return False, f"Year {year} out of valid range (1800-2024)"

        # Validate author name if present
        if author:
            author_str = str(author)
            # Basic sanity checks
            if len(author_str) < 3:
                return False, f"Author name too short: {author_str}"
            if len(author_str) > 200:
                return False, f"Author name too long: {author_str}"
            # Check for common false positives
            false_positives = ['unknown', 'anonymous', 'n/a', 'none', 'null']
            if author_str.lower() in false_positives and conf_author < 90:
                return False, f"Suspicious author name: {author_str}"

        return True, "Valid"

    def save_checkpoint(self, batch_num: int, processed_ids: List[int], results: List[Dict]):
        """Save checkpoint after each batch for resumability."""
        checkpoint_file = CHECKPOINT_DIR / f"batch_{batch_num:04d}.json"
        checkpoint_data = {
            'batch_num': batch_num,
            'timestamp': datetime.now().isoformat(),
            'processed_ids': processed_ids,
            'results': results,
            'stats': self.stats.copy()
        }
        with open(checkpoint_file, 'w') as f:
            json.dump(checkpoint_data, f, indent=2)
        return checkpoint_file


def load_checkpoint(checkpoint_file: Path) -> Optional[Dict]:
    """Load checkpoint to resume processing."""
    if not checkpoint_file.exists():
        return None
    try:
        with open(checkpoint_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading checkpoint: {e}")
        return None


def get_processed_ids_from_checkpoints() -> set:
    """Get all document IDs already processed from checkpoints."""
    processed_ids = set()
    for checkpoint_file in sorted(CHECKPOINT_DIR.glob("batch_*.json")):
        checkpoint = load_checkpoint(checkpoint_file)
        if checkpoint:
            processed_ids.update(checkpoint.get('processed_ids', []))
    return processed_ids


def extract_metadata_llm_batch(dry_run=False, pilot=False, confidence_threshold=70,
                                batch_size=50, limit=None, resume_file=None):
    """Main LLM extraction function with batch processing."""

    print("="*70)
    print("Library Metadata Extraction - LLM Phase 2A")
    print("="*70)
    print()

    if pilot:
        print("🧪 PILOT MODE - Processing first 50 documents")
    if dry_run:
        print("🔍 DRY-RUN MODE - No database changes will be made")
    if limit:
        print(f"📊 Limit: {limit} documents")
    print(f"✓ Confidence threshold: {confidence_threshold}")
    print(f"✓ Batch size: {batch_size}")
    print(f"✓ Max content: {MAX_CONTENT_WORDS} words (Phase 2A lightweight)")
    print()

    # Initialize extractor
    extractor = LLMMetadataExtractor(confidence_threshold=confidence_threshold)

    # Resume handling
    processed_ids = set()
    start_batch = 0
    if resume_file:
        checkpoint = load_checkpoint(Path(resume_file))
        if checkpoint:
            processed_ids = set(checkpoint.get('processed_ids', []))
            start_batch = checkpoint.get('batch_num', 0) + 1
            print(f"📂 Resuming from checkpoint: {resume_file}")
            print(f"   Already processed: {len(processed_ids)} documents")
            print(f"   Starting from batch: {start_batch}")
            print()
    else:
        # Get already processed from all checkpoints
        processed_ids = get_processed_ids_from_checkpoints()
        if processed_ids:
            print(f"📂 Found existing checkpoints: {len(processed_ids)} documents already processed")
            print()

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Get documents without metadata (excluding already processed)
        if processed_ids:
            cur.execute("""
                SELECT id, slug, title, author, publication_date
                FROM library.library_documents
                WHERE created_by = 3
                  AND (author IS NULL OR author = '' OR publication_date IS NULL OR publication_date = '')
                  AND id NOT IN %s
                ORDER BY id
            """, (tuple(processed_ids),))
        else:
            cur.execute("""
                SELECT id, slug, title, author, publication_date
                FROM library.library_documents
                WHERE created_by = 3
                  AND (author IS NULL OR author = '' OR publication_date IS NULL OR publication_date = '')
                ORDER BY id
            """)

        docs_to_process = cur.fetchall()

        print(f"Found {len(docs_to_process)} documents needing metadata")
        if processed_ids:
            print(f"(Excluding {len(processed_ids)} already processed)")
        print()

        # Apply limits
        if pilot:
            docs_to_process = docs_to_process[:50]
        elif limit:
            docs_to_process = docs_to_process[:limit]

        # Get all markdown files for lookup
        md_files = {md_path.name: md_path for md_path in LIBRARY_PATH.glob('*.md')}

        # Process in batches
        total_docs = len(docs_to_process)
        batch_results = []
        batch_processed_ids = []

        for idx, (doc_id, slug, db_title, current_author, current_pub_date) in enumerate(docs_to_process, 1):
            extractor.stats['total'] += 1

            # Find markdown file
            matching_files = [name for name in md_files.keys() if slug in name.lower()]
            if not matching_files:
                print(f"[{idx:5d}/{total_docs}] SKIP: No markdown file for '{db_title[:50]}'")
                continue

            md_path = md_files[matching_files[0]]

            # Read content
            try:
                with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                print(f"[{idx:5d}/{total_docs}] ERROR reading {md_path.name}: {e}")
                continue

            print(f"[{idx:5d}/{total_docs}] Processing: {db_title[:50]}")
            print(f"          File: {md_path.name[:60]}")

            # Extract metadata using LLM
            metadata = extractor.extract_metadata_llm(content, db_title)

            if not metadata:
                print(f"          ❌ LLM extraction failed")
                continue

            # Validate metadata
            is_valid, reason = extractor.validate_metadata(metadata)

            if not is_valid:
                print(f"          ⚠️  Validation failed: {reason}")
                extractor.stats['skipped_low_confidence'] += 1
                continue

            # Track confidence
            conf_author = metadata.get('confidence_author', 0)
            conf_date = metadata.get('confidence_date', 0)
            avg_conf = (conf_author + conf_date) / 2

            if avg_conf >= 90:
                extractor.stats['high_confidence'] += 1
                conf_marker = "✓"
            elif avg_conf >= 70:
                extractor.stats['medium_confidence'] += 1
                conf_marker = "~"
            else:
                extractor.stats['low_confidence'] += 1
                conf_marker = "?"

            # Display results
            author = metadata.get('author')
            pub_date = metadata.get('publication_date')

            print(f"          {conf_marker} Author: {author or '(none)'} (conf: {conf_author}%)")
            print(f"          {conf_marker} Date: {pub_date or '(none)'} (conf: {conf_date}%)")
            if metadata.get('notes'):
                print(f"          Notes: {metadata['notes'][:80]}")

            # Update database (if not dry-run)
            if not dry_run:
                # Only update if we have new data and meets confidence threshold
                new_author = author if (author and conf_author >= confidence_threshold) else current_author
                new_pub_date = pub_date if (pub_date and conf_date >= confidence_threshold) else current_pub_date

                if new_author != current_author or new_pub_date != current_pub_date:
                    cur.execute("""
                        UPDATE library.library_documents
                        SET author = COALESCE(%s, author),
                            publication_date = COALESCE(%s, publication_date),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (new_author, new_pub_date, doc_id))

                    extractor.stats['updated'] += 1
                    print(f"          ✓ Database updated")

            extractor.stats['processed'] += 1

            # Store for checkpoint
            batch_results.append({
                'doc_id': doc_id,
                'title': db_title,
                'metadata': metadata,
                'validation': {'valid': is_valid, 'reason': reason}
            })
            batch_processed_ids.append(doc_id)

            # Save checkpoint after each batch
            if len(batch_processed_ids) >= batch_size:
                batch_num = start_batch + (idx // batch_size)
                checkpoint_file = extractor.save_checkpoint(batch_num, batch_processed_ids, batch_results)
                print(f"\n          💾 Checkpoint saved: {checkpoint_file.name}")
                print(f"          Progress: {idx}/{total_docs} ({idx*100//total_docs}%)")
                print(f"          Cost so far: ${extractor.stats['total_cost']:.4f}")
                print()

                # Commit database changes
                if not dry_run:
                    conn.commit()

                # Reset batch
                batch_results = []
                batch_processed_ids = []

                # Rate limiting (Anthropic allows 50 req/min for Haiku)
                time.sleep(1)

            print()

        # Save final checkpoint if partial batch remains
        if batch_processed_ids:
            batch_num = start_batch + (total_docs // batch_size)
            checkpoint_file = extractor.save_checkpoint(batch_num, batch_processed_ids, batch_results)
            print(f"💾 Final checkpoint saved: {checkpoint_file.name}\n")

        # Final commit
        if not dry_run:
            conn.commit()
            print("✓ All changes committed to database\n")
        else:
            print("DRY-RUN - No database changes made\n")

        # Print summary
        print(f"{'='*70}")
        print("EXTRACTION SUMMARY")
        print(f"{'='*70}")
        print(f"Total documents: {extractor.stats['total']}")
        print(f"Successfully processed: {extractor.stats['processed']}")
        print(f"Database updated: {extractor.stats['updated']}")
        print(f"API errors: {extractor.stats['api_errors']}")
        print(f"Skipped (low confidence): {extractor.stats['skipped_low_confidence']}")
        print()
        print("By Confidence:")
        print(f"  High (90-100%): {extractor.stats['high_confidence']}")
        print(f"  Medium (70-89%): {extractor.stats['medium_confidence']}")
        print(f"  Low (<70%): {extractor.stats['low_confidence']}")
        print()
        print("API Usage:")
        print(f"  Total tokens: {extractor.stats['total_tokens']:,}")
        print(f"  Total cost: ${extractor.stats['total_cost']:.4f}")
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
    import argparse

    parser = argparse.ArgumentParser(description='LLM-based library metadata extraction')
    parser.add_argument('--pilot', action='store_true', help='Process only first 50 documents')
    parser.add_argument('--dry-run', action='store_true', help='Show results without updating database')
    parser.add_argument('--confidence-threshold', type=int, default=70, help='Minimum confidence (default: 70)')
    parser.add_argument('--batch-size', type=int, default=50, help='Documents per batch (default: 50)')
    parser.add_argument('--limit', type=int, help='Process only N documents')
    parser.add_argument('--resume', type=str, help='Resume from checkpoint file')

    args = parser.parse_args()

    extract_metadata_llm_batch(
        dry_run=args.dry_run,
        pilot=args.pilot,
        confidence_threshold=args.confidence_threshold,
        batch_size=args.batch_size,
        limit=args.limit,
        resume_file=args.resume
    )
