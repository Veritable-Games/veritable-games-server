#!/usr/bin/env python3
"""
Tag Translation Generator for Veritable Games
==============================================

Generates AI-powered translations for tags across all languages in the anarchist
library archive, creating bidirectional mappings in the shared.tag_translations table.

Architecture:
- Queries tags with their primary languages from document associations
- Uses Claude API for high-quality translation
- Matches translations to existing tags with fuzzy matching
- Populates tag_translations table with confidence scores

Usage:
  # Generate translations and save to CSV only (review before DB insertion)
  python3 generate_tag_translations.py --csv-output translations.csv --csv-only --language en

  # Generate translations and save to both CSV and database
  python3 generate_tag_translations.py --csv-output translations.csv --language en

  # Import existing CSV into database
  python3 generate_tag_translations.py --import-csv translations.csv

  # Dry run (no database changes)
  python3 generate_tag_translations.py --dry-run --batch-size 50 --language en

Requirements:
  pip3 install anthropic psycopg2-binary python-Levenshtein
  export ANTHROPIC_API_KEY="your-api-key-here"
"""

import os
import sys
import psycopg2
import csv
import json
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import argparse
import time

# Try to import Claude API
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    print("Warning: anthropic package not installed. Install with: pip3 install anthropic")
    HAS_ANTHROPIC = False

# Try to import Levenshtein for fuzzy matching
try:
    import Levenshtein
    HAS_LEVENSHTEIN = True
except ImportError:
    print("Warning: python-Levenshtein not installed. Using exact match only.")
    print("Install with: pip3 install python-Levenshtein")
    HAS_LEVENSHTEIN = False

# Database configuration
DB_CONFIG = {
    'host': 'veritable-games-postgres',
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres',
    'port': 5432
}

# Supported languages (ISO 639-1 codes)
LANGUAGE_NAMES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'pt': 'Portuguese', 'ru': 'Russian', 'it': 'Italian', 'pl': 'Polish',
    'nl': 'Dutch', 'sv': 'Swedish', 'da': 'Danish', 'no': 'Norwegian',
    'fi': 'Finnish', 'tr': 'Turkish', 'ar': 'Arabic', 'he': 'Hebrew',
    'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean', 'hi': 'Hindi',
    'el': 'Greek', 'ro': 'Romanian', 'cs': 'Czech', 'hu': 'Hungarian',
    'sr': 'Serbian', 'hr': 'Croatian', 'sea': 'Southeast Asian'
}


class TagTranslationGenerator:
    """Generates AI-powered tag translations and populates the database."""

    def __init__(self, dry_run: bool = False, batch_size: int = 50,
                 csv_output: Optional[str] = None, csv_only: bool = False):
        self.dry_run = dry_run
        self.batch_size = batch_size
        self.csv_output = csv_output
        self.csv_only = csv_only
        self.conn = None
        self.cursor = None
        self.client = None
        self.csv_file = None
        self.csv_writer = None

        # Statistics
        self.stats = {
            'total_tags': 0,
            'translations_generated': 0,
            'translations_matched': 0,
            'translations_inserted': 0,
            'translations_written_csv': 0,
            'api_calls': 0,
            'errors': 0
        }

    def connect_db(self):
        """Connect to PostgreSQL database."""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.cursor = self.conn.cursor()
            print(f"✅ Connected to PostgreSQL at {DB_CONFIG['host']}")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)

    def init_claude_client(self):
        """Initialize Claude API client."""
        if not HAS_ANTHROPIC:
            print("❌ Claude API not available (anthropic package not installed)")
            return False

        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            print("❌ ANTHROPIC_API_KEY environment variable not set")
            print("   Set with: export ANTHROPIC_API_KEY='your-key-here'")
            return False

        try:
            self.client = anthropic.Anthropic(api_key=api_key)
            print("✅ Claude API client initialized")
            return True
        except Exception as e:
            print(f"❌ Claude API initialization failed: {e}")
            return False

    def open_csv(self):
        """Open CSV file for writing translations."""
        if not self.csv_output:
            return

        try:
            self.csv_file = open(self.csv_output, 'w', newline='', encoding='utf-8')
            self.csv_writer = csv.writer(self.csv_file)

            # Write header
            self.csv_writer.writerow([
                'source_tag_id',
                'source_tag_name',
                'source_language',
                'target_tag_id',
                'target_tag_name',
                'target_language',
                'confidence_score',
                'translation_method'
            ])

            print(f"✅ Opened CSV file for writing: {self.csv_output}")
        except Exception as e:
            print(f"❌ Failed to open CSV file: {e}")
            sys.exit(1)

    def close_csv(self):
        """Close CSV file."""
        if self.csv_file:
            self.csv_file.close()
            print(f"✅ Closed CSV file: {self.csv_output}")
            print(f"   Total translations written: {self.stats['translations_written_csv']}")

    def get_tag_name(self, tag_id: int) -> str:
        """Get tag name from tag ID."""
        try:
            self.cursor.execute("SELECT name FROM shared.tags WHERE id = %s", (tag_id,))
            result = self.cursor.fetchone()
            return result[0] if result else f"unknown_{tag_id}"
        except Exception as e:
            print(f"   ⚠️  Failed to fetch tag name for ID {tag_id}: {e}")
            return f"unknown_{tag_id}"

    def get_tags_by_language(self, language: Optional[str] = None) -> Dict[str, List[Tuple]]:
        """
        Get all tags grouped by their primary language (language with most document associations).

        Returns:
            Dict mapping language code to list of (tag_id, tag_name, document_count) tuples
        """
        print("\n📊 Querying tags by language...")

        where_clause = "WHERE d.language = %s" if language else ""
        params = [language] if language else []

        query = f"""
        SELECT
            d.language,
            t.id,
            t.name,
            COUNT(DISTINCT dt.document_id) as doc_count
        FROM shared.tags t
        JOIN anarchist.document_tags dt ON t.id = dt.tag_id
        JOIN anarchist.documents d ON dt.document_id = d.id
        {where_clause}
        GROUP BY d.language, t.id, t.name
        ORDER BY d.language, doc_count DESC, t.name
        """

        self.cursor.execute(query, params)
        results = self.cursor.fetchall()

        # Group by language
        tags_by_language = defaultdict(list)
        for lang, tag_id, tag_name, doc_count in results:
            tags_by_language[lang].append((tag_id, tag_name, doc_count))

        self.stats['total_tags'] = sum(len(tags) for tags in tags_by_language.values())

        print(f"✅ Found {self.stats['total_tags']} tag-language associations across {len(tags_by_language)} languages")
        for lang, tags in sorted(tags_by_language.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
            print(f"   {LANGUAGE_NAMES.get(lang, lang)}: {len(tags)} tags")

        return dict(tags_by_language)

    def translate_tag_batch(self, tags: List[str], source_lang: str, target_languages: List[str]) -> Dict[str, List[Dict]]:
        """
        Translate a batch of tags using Claude API.

        Args:
            tags: List of tag names to translate
            source_lang: Source language code (e.g., 'en')
            target_languages: List of target language codes

        Returns:
            Dict mapping tag name to list of translations:
            {
                "anarchism": [
                    {"language": "es", "translation": "anarquismo", "confidence": 0.95},
                    {"language": "fr", "translation": "anarchisme", "confidence": 0.95},
                    ...
                ]
            }
        """
        if not self.client:
            return {}

        source_lang_name = LANGUAGE_NAMES.get(source_lang, source_lang)
        target_lang_names = [LANGUAGE_NAMES.get(lang, lang) for lang in target_languages]

        prompt = f"""You are a professional translator specializing in political and philosophical terminology.

Translate the following {source_lang_name} tags into {', '.join(target_lang_names)}.

IMPORTANT RULES:
1. Use standard terminology from anarchist/socialist/political literature
2. Preserve conceptual meaning, not just literal translation
3. Return ONLY valid JSON (no markdown, no explanations)
4. Include confidence score (0.0-1.0) for each translation
5. Use lowercase for all translations
6. If a tag is a proper noun or untranslatable, use the original

Tags to translate:
{json.dumps(tags, indent=2)}

Return JSON format:
{{
  "tag_name": [
    {{"language": "es", "translation": "translated_tag", "confidence": 0.95}},
    {{"language": "fr", "translation": "translated_tag", "confidence": 0.90}}
  ]
}}"""

        try:
            print(f"   🤖 Calling Claude API for {len(tags)} tags ({source_lang_name} → {len(target_languages)} languages)...")
            self.stats['api_calls'] += 1

            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4000,
                temperature=0.3,  # Lower temperature for more consistent translations
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            # Extract JSON from response
            response_text = response.content[0].text

            # Try to parse JSON (handle potential markdown wrapping)
            if '```json' in response_text:
                json_start = response_text.find('```json') + 7
                json_end = response_text.find('```', json_start)
                response_text = response_text[json_start:json_end].strip()
            elif '```' in response_text:
                json_start = response_text.find('```') + 3
                json_end = response_text.find('```', json_start)
                response_text = response_text[json_start:json_end].strip()

            translations = json.loads(response_text)
            self.stats['translations_generated'] += sum(len(trans) for trans in translations.values())

            return translations

        except Exception as e:
            print(f"   ❌ Claude API error: {e}")
            self.stats['errors'] += 1
            return {}

    def find_matching_tag(self, translation: str, language: str, all_tags: Dict[str, List[Tuple]]) -> Optional[Tuple[int, str, float]]:
        """
        Find a matching tag in the database for a given translation.

        Args:
            translation: Translated tag name to match
            language: Target language code
            all_tags: Dict of all tags by language

        Returns:
            Tuple of (tag_id, tag_name, similarity_score) or None if no match found
        """
        if language not in all_tags:
            return None

        translation_lower = translation.lower()

        # Try exact match first
        for tag_id, tag_name, _ in all_tags[language]:
            if tag_name.lower() == translation_lower:
                return (tag_id, tag_name, 1.0)

        # If fuzzy matching available, try that
        if HAS_LEVENSHTEIN:
            best_match = None
            best_ratio = 0.0

            for tag_id, tag_name, _ in all_tags[language]:
                ratio = Levenshtein.ratio(translation_lower, tag_name.lower())
                if ratio > best_ratio and ratio >= 0.85:  # 85% similarity threshold
                    best_ratio = ratio
                    best_match = (tag_id, tag_name, ratio)

            return best_match

        return None

    def insert_translation(self, source_tag_id: int, target_tag_id: int,
                          source_lang: str, target_lang: str, confidence: float,
                          source_tag_name: str = None, target_tag_name: str = None):
        """Insert a tag translation mapping into the database and/or CSV."""

        # Write to CSV if enabled
        if self.csv_writer:
            try:
                # Get tag names if not provided
                if not source_tag_name:
                    source_tag_name = self.get_tag_name(source_tag_id)
                if not target_tag_name:
                    target_tag_name = self.get_tag_name(target_tag_id)

                self.csv_writer.writerow([
                    source_tag_id,
                    source_tag_name,
                    source_lang,
                    target_tag_id,
                    target_tag_name,
                    target_lang,
                    f"{confidence:.2f}",
                    'ai'
                ])
                self.stats['translations_written_csv'] += 1
            except Exception as e:
                print(f"   ❌ CSV write error: {e}")
                self.stats['errors'] += 1

        # Skip database insertion if CSV-only mode
        if self.csv_only:
            return

        if self.dry_run:
            print(f"   [DRY RUN] Would insert: {source_tag_id} ({source_lang}) → {target_tag_id} ({target_lang}) [confidence: {confidence:.2f}]")
            return

        try:
            self.cursor.execute("""
                INSERT INTO shared.tag_translations
                (source_tag_id, target_tag_id, source_language, target_language, confidence_score, translation_method)
                VALUES (%s, %s, %s, %s, %s, 'ai')
                ON CONFLICT (source_tag_id, target_tag_id, source_language, target_language) DO NOTHING
            """, (source_tag_id, target_tag_id, source_lang, target_lang, confidence))

            self.stats['translations_inserted'] += 1

        except Exception as e:
            print(f"   ❌ Database insertion error: {e}")
            self.stats['errors'] += 1

    def process_language(self, source_lang: str, tags: List[Tuple], all_tags: Dict[str, List[Tuple]]):
        """Process all tags for a given source language."""
        print(f"\n🔄 Processing {LANGUAGE_NAMES.get(source_lang, source_lang)} tags...")

        # Get target languages (all languages except source)
        target_languages = [lang for lang in all_tags.keys() if lang != source_lang]

        if not target_languages:
            print(f"   ⚠️  No target languages available")
            return

        # Process tags in batches
        for i in range(0, len(tags), self.batch_size):
            batch = tags[i:i + self.batch_size]
            tag_names = [tag[1] for tag in batch]

            print(f"\n   Batch {i // self.batch_size + 1}/{(len(tags) + self.batch_size - 1) // self.batch_size}")
            print(f"   Tags: {', '.join(tag_names[:5])}{'...' if len(tag_names) > 5 else ''}")

            # Translate batch
            translations = self.translate_tag_batch(tag_names, source_lang, target_languages)

            if not translations:
                print(f"   ⚠️  No translations returned for batch")
                continue

            # Match translations to existing tags
            for tag_id, tag_name, _ in batch:
                if tag_name not in translations:
                    continue

                for trans_data in translations[tag_name]:
                    target_lang = trans_data['language']
                    translation = trans_data['translation']
                    confidence = trans_data.get('confidence', 0.8)

                    # Find matching tag in database
                    match = self.find_matching_tag(translation, target_lang, all_tags)

                    if match:
                        target_tag_id, target_tag_name, similarity = match
                        final_confidence = confidence * similarity

                        self.stats['translations_matched'] += 1

                        # Insert bidirectional mapping with tag names for CSV
                        self.insert_translation(tag_id, target_tag_id, source_lang, target_lang,
                                              final_confidence, tag_name, target_tag_name)
                        self.insert_translation(target_tag_id, tag_id, target_lang, source_lang,
                                              final_confidence, target_tag_name, tag_name)

            # Commit after each batch
            if not self.dry_run:
                self.conn.commit()

            # Rate limiting (respect Claude API limits)
            time.sleep(1)

    def import_csv(self, csv_file: str):
        """Import translations from CSV file into database."""
        print(f"\n📥 Importing translations from CSV: {csv_file}")

        if not os.path.exists(csv_file):
            print(f"❌ CSV file not found: {csv_file}")
            sys.exit(1)

        imported_count = 0
        error_count = 0

        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                for row in reader:
                    try:
                        source_tag_id = int(row['source_tag_id'])
                        target_tag_id = int(row['target_tag_id'])
                        source_language = row['source_language']
                        target_language = row['target_language']
                        confidence_score = float(row['confidence_score'])
                        translation_method = row.get('translation_method', 'ai')

                        # Insert into database (skip CSV writing)
                        if not self.dry_run:
                            self.cursor.execute("""
                                INSERT INTO shared.tag_translations
                                (source_tag_id, target_tag_id, source_language, target_language,
                                 confidence_score, translation_method)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                ON CONFLICT (source_tag_id, target_tag_id, source_language, target_language)
                                DO UPDATE SET
                                    confidence_score = EXCLUDED.confidence_score,
                                    translation_method = EXCLUDED.translation_method,
                                    updated_at = CURRENT_TIMESTAMP
                            """, (source_tag_id, target_tag_id, source_language, target_language,
                                  confidence_score, translation_method))

                            imported_count += 1

                            # Commit every 1000 rows
                            if imported_count % 1000 == 0:
                                self.conn.commit()
                                print(f"   ✅ Imported {imported_count} translations...")
                        else:
                            print(f"   [DRY RUN] Would import: {row['source_tag_name']} ({source_language}) → {row['target_tag_name']} ({target_language})")
                            imported_count += 1

                    except Exception as e:
                        print(f"   ⚠️  Error importing row: {e}")
                        print(f"      Row data: {row}")
                        error_count += 1

                # Final commit
                if not self.dry_run:
                    self.conn.commit()

            print(f"\n✅ Import complete:")
            print(f"   Imported: {imported_count}")
            print(f"   Errors: {error_count}")

        except Exception as e:
            print(f"❌ Failed to import CSV: {e}")
            sys.exit(1)

    def run(self, source_language: Optional[str] = None):
        """Main execution flow."""
        print("🚀 Tag Translation Generator")
        print("=" * 60)

        if self.dry_run:
            print("⚠️  DRY RUN MODE - No database changes will be made")

        if self.csv_only:
            print("📄 CSV-ONLY MODE - Will only generate CSV, no database insertion")

        # Connect to database
        self.connect_db()

        # Open CSV file if specified
        if self.csv_output:
            self.open_csv()

        # Initialize Claude API
        if not self.init_claude_client():
            print("\n❌ Cannot proceed without Claude API access")
            self.close_csv()
            sys.exit(1)

        # Get all tags by language
        all_tags = self.get_tags_by_language(source_language)

        if not all_tags:
            print("❌ No tags found in database")
            self.close_csv()
            sys.exit(1)

        # Process each language
        languages_to_process = [source_language] if source_language else sorted(all_tags.keys(), key=lambda x: len(all_tags[x]), reverse=True)

        for lang in languages_to_process:
            if lang not in all_tags:
                continue

            self.process_language(lang, all_tags[lang][:100], all_tags)  # Limit to top 100 tags per language for testing

        # Print final statistics
        self.print_statistics()

        # Close CSV file
        self.close_csv()

        # Close database connection
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()

    def print_statistics(self):
        """Print final execution statistics."""
        print("\n" + "=" * 60)
        print("📊 Translation Statistics")
        print("=" * 60)
        print(f"Total tags processed:       {self.stats['total_tags']}")
        print(f"Translations generated:     {self.stats['translations_generated']}")
        print(f"Translations matched:       {self.stats['translations_matched']}")
        if self.csv_output:
            print(f"Translations written to CSV: {self.stats['translations_written_csv']}")
        if not self.csv_only:
            print(f"Translations inserted to DB: {self.stats['translations_inserted']}")
        print(f"Claude API calls:           {self.stats['api_calls']}")
        print(f"Errors:                     {self.stats['errors']}")
        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Generate AI-powered tag translations',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate translations and save to CSV only (review before importing)
  python3 generate_tag_translations.py --csv-output translations.csv --csv-only --language en

  # Generate translations and save to both CSV and database
  python3 generate_tag_translations.py --csv-output translations.csv --language en

  # Import existing CSV into database
  python3 generate_tag_translations.py --import-csv translations.csv

  # Dry run (no changes)
  python3 generate_tag_translations.py --dry-run --language en
        """
    )

    # Generation options
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without modifying database')
    parser.add_argument('--batch-size', type=int, default=50, help='Number of tags to translate per API call')
    parser.add_argument('--language', type=str, help='Process only tags from this language (e.g., "en")')

    # CSV options
    parser.add_argument('--csv-output', type=str, help='Output CSV file path for generated translations')
    parser.add_argument('--csv-only', action='store_true', help='Only write to CSV, skip database insertion')
    parser.add_argument('--import-csv', type=str, help='Import translations from CSV file into database')

    args = parser.parse_args()

    # Handle CSV import mode
    if args.import_csv:
        generator = TagTranslationGenerator(dry_run=args.dry_run)
        generator.connect_db()
        generator.import_csv(args.import_csv)
        if generator.cursor:
            generator.cursor.close()
        if generator.conn:
            generator.conn.close()
        return

    # Handle translation generation mode
    generator = TagTranslationGenerator(
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        csv_output=args.csv_output,
        csv_only=args.csv_only
    )
    generator.run(source_language=args.language)


if __name__ == '__main__':
    main()
