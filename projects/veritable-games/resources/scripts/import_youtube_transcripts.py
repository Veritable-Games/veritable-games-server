#!/usr/bin/env python3
"""
Import YouTube Transcripts to PostgreSQL database.

Parses 65,391 YouTube transcripts from markdown files and imports them into
the youtube schema with unified tag support.

Usage:
    python3 import_youtube_transcripts.py \
      --source-dir /path/to/transcripts.OLD \
      --database postgresql://user:pass@host/db \
      --batch-size 1000 \
      --log-file logs/youtube-import-20260220.log

Data Source:
    /home/user/projects/veritable-games/resources/data/transcripts.OLD/
    - 65,391 markdown files organized by channel
    - Format: {Channel Name}/videos/{VideoID}.{Language}.md
    - Content: Title line + plain text transcript (no frontmatter)
"""

import os
import sys
import re
import argparse
import logging
from pathlib import Path
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_batch
import unicodedata

# ============================================================================
# CONFIGURATION
# ============================================================================

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/veritable_games?sslmode=disable')

YOUTUBE_TAG_PATTERNS = {
    'science': [r'\b(?:science|scientific|research|experiment|hypothesis)\b'],
    'space': [r'\b(?:space|astronomy|cosmos|universe|planetary|celestial)\b'],
    'technology': [r'\b(?:technology|tech|engineering|computational|algorithm|software)\b'],
    'futurism': [r'\b(?:future|prediction|forecast|projections?|centuries?|years?|millennia)\b'],
    'physics': [r'\b(?:physics|quantum|gravity|relativity|photons?|particles?|waves?)\b'],
    'biology': [r'\b(?:biology|evolution|genetic|biological|organisms?|species)\b'],
    'astronomy': [r'\b(?:astronomy|astronomers?|star|stellar|galaxies?|nebulae?)\b'],
    'history': [r'\b(?:history|historical|ancient|medieval|modern|century|decades?)\b'],
    'philosophy': [r'\b(?:philosophy|philosophical|ethics|morality|consciousness|sentience)\b'],
    'mathematics': [r'\b(?:mathematics|mathematical|geometry|calculus|numbers?|equations?)\b'],
    'megastructures': [r'\b(?:megastructure|dyson|sphere|ring|megaproject|construction)\b'],
    'colonization': [r'\b(?:colonization?|colonists?|settle|settlement|terraformation|terraform)\b'],
    'intelligence': [r'\b(?:intelligence|intelligent|ai|artificial|agi|superintelligence)\b'],
    'civilization': [r'\b(?:civilization|civilizational|society|societal|culture|cultural)\b'],
}

CHANNEL_TAGS = {
    'Isaac Arthur': ['futurism', 'space', 'megastructures', 'colonization', 'science'],
    'Kurzgesagt': ['science', 'education', 'animation', 'biology', 'space'],
    'CrashCourse': ['education', 'history', 'science', 'philosophy'],
    'Vsauce': ['science', 'physics', 'mathematics', 'philosophy'],
    'TED-Ed': ['education', 'science', 'history', 'philosophy'],
}

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_file):
    """Configure logging to file and console."""
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def sanitize_slug(text: str, max_length: int = 200) -> str:
    """Create URL-safe slug from text."""
    # Normalize unicode
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')

    # Convert to lowercase and replace spaces with hyphens
    text = re.sub(r'[^\w\s-]', '', text).strip()
    text = re.sub(r'[-\s]+', '-', text).lower()

    # Trim to max length
    if len(text) > max_length:
        text = text[:max_length].rstrip('-')

    return text or 'untitled'

def extract_channel_from_path(file_path: Path) -> str:
    """Extract channel name from directory structure."""
    parts = file_path.parts

    # Structure: Channel Name/videos/VideoID.en.md
    if 'videos' in parts:
        videos_idx = parts.index('videos')
        if videos_idx > 0:
            return parts[videos_idx - 1]

    return 'Unknown'

def extract_video_id_from_filename(filename: str) -> str:
    """Extract video ID from filename (format: ID.lang.md)."""
    # Remove extension: ID.lang.md -> ID.lang
    name = filename.rsplit('.md', 1)[0]
    # Remove language: ID.lang -> ID
    video_id = name.rsplit('.', 1)[0]
    return video_id

def extract_language_from_filename(filename: str) -> str:
    """Extract language code from filename (format: ID.lang.md)."""
    # Remove extension: ID.lang.md -> ID.lang
    name = filename.rsplit('.md', 1)[0]
    # Get language: ID.lang -> lang
    parts = name.rsplit('.', 1)
    return parts[1] if len(parts) > 1 else 'en'

def extract_title_from_content(content: str) -> str:
    """Extract title from transcript content (first line or heading)."""
    lines = content.strip().split('\n')
    for line in lines:
        if line.strip():
            # Remove markdown formatting
            title = re.sub(r'^#+\s*', '', line).strip()
            return title[:200] if len(title) > 200 else title
    return 'Untitled Transcript'

def extract_tags_from_content(content: str, channel_name: str = '') -> list:
    """Extract tags from content using pattern matching."""
    tags = set()

    # Add channel-based tags
    for channel, channel_tags in CHANNEL_TAGS.items():
        if channel.lower() in channel_name.lower():
            tags.update(channel_tags)
            break

    # Add content-based tags
    content_lower = content.lower()
    for tag, patterns in YOUTUBE_TAG_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, content_lower):
                tags.add(tag)
                break

    # Always add generic tags
    tags.add('education')
    if channel_name:
        tags.add(sanitize_slug(channel_name))

    return sorted(list(tags))

# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

def get_or_create_tags(conn, tags: list) -> dict:
    """Get or create tags in shared.tags, return mapping of tag_name -> tag_id."""
    if not tags:
        return {}

    try:
        cur = conn.cursor()
        tag_map = {}

        for tag_name in tags:
            # Try to find existing tag
            cur.execute(
                "SELECT id FROM shared.tags WHERE name = %s",
                (tag_name,)
            )
            result = cur.fetchone()

            if result:
                tag_map[tag_name] = result[0]
            else:
                # Create new tag
                cur.execute(
                    "INSERT INTO shared.tags (name, description, created_at) VALUES (%s, %s, NOW()) RETURNING id",
                    (tag_name, f"YouTube content tag: {tag_name}")
                )
                tag_map[tag_name] = cur.fetchone()[0]

        conn.commit()
        return tag_map
    except Exception as e:
        logging.error(f"Error creating tags: {e}")
        conn.rollback()
        return {}

def insert_transcripts_batch(conn, transcripts: list) -> int:
    """Insert a batch of transcripts, return count of inserted records."""
    if not transcripts:
        return 0

    try:
        cur = conn.cursor()

        insert_query = """
            INSERT INTO youtube.transcripts
            (slug, title, channel_name, video_id, upload_date, language, content, source_url, category, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
        """

        rows = []
        for t in transcripts:
            rows.append((
                t['slug'],
                t['title'],
                t['channel_name'],
                t['video_id'],
                t['upload_date'],
                t['language'],
                t['content'],
                t['source_url'],
                t['category'],
                t['notes']
            ))

        # Use execute_batch for better performance
        cur.executemany(
            insert_query.replace('RETURNING id', ''),
            rows
        )

        # Count inserted
        count = cur.rowcount
        conn.commit()
        logging.info(f"Inserted {count} transcripts in batch")
        return count
    except Exception as e:
        logging.error(f"Error inserting transcripts batch: {e}")
        conn.rollback()
        return 0

def associate_tags_batch(conn, transcript_data: list) -> int:
    """Associate tags with transcripts in batch."""
    if not transcript_data:
        return 0

    try:
        cur = conn.cursor()
        associations = []

        for t in transcript_data:
            # Get transcript ID by slug
            cur.execute(
                "SELECT id FROM youtube.transcripts WHERE slug = %s",
                (t['slug'],)
            )
            result = cur.fetchone()
            if not result:
                continue

            transcript_id = result[0]
            tags = t.get('tags', [])

            for tag_name in tags:
                # Get tag ID
                cur.execute(
                    "SELECT id FROM shared.tags WHERE name = %s",
                    (tag_name,)
                )
                tag_result = cur.fetchone()
                if tag_result:
                    associations.append((transcript_id, tag_result[0]))

        # Batch insert associations
        if associations:
            cur.executemany(
                "INSERT INTO youtube.transcript_tags (transcript_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                associations
            )
            count = cur.rowcount
            conn.commit()
            logging.info(f"Created {count} tag associations")
            return count

        return 0
    except Exception as e:
        logging.error(f"Error associating tags: {e}")
        conn.rollback()
        return 0

# ============================================================================
# IMPORT FUNCTIONS
# ============================================================================

def import_youtube_transcripts(source_dir: str, database_url: str, batch_size: int = 1000):
    """Import YouTube transcripts from source directory to database."""
    source_path = Path(source_dir)

    if not source_path.exists():
        logging.error(f"Source directory does not exist: {source_path}")
        return False

    # Connect to database
    try:
        conn = psycopg2.connect(database_url)
        logging.info(f"Connected to database: {database_url}")
    except Exception as e:
        logging.error(f"Failed to connect to database: {e}")
        return False

    # Find all transcript files
    transcript_files = list(source_path.rglob('*.md'))
    total_files = len(transcript_files)
    logging.info(f"Found {total_files} transcript files in {source_path}")

    if total_files == 0:
        logging.warning("No transcript files found!")
        conn.close()
        return False

    # Process transcripts
    transcripts_batch = []
    tag_data = []
    processed = 0
    skipped = 0

    for idx, file_path in enumerate(transcript_files, 1):
        try:
            # Read file
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            if not content.strip():
                skipped += 1
                continue

            # Extract metadata
            channel_name = extract_channel_from_path(file_path)
            video_id = extract_video_id_from_filename(file_path.name)
            language = extract_language_from_filename(file_path.name)
            title = extract_title_from_content(content)
            tags = extract_tags_from_content(content, channel_name)

            slug = f"{sanitize_slug(channel_name)}-{sanitize_slug(video_id)}"

            # Construct YouTube URL
            source_url = f"https://www.youtube.com/watch?v={video_id}"

            transcript = {
                'slug': slug,
                'title': title,
                'channel_name': channel_name,
                'video_id': video_id,
                'upload_date': None,  # Upload date not available from transcript files
                'language': language,
                'content': content,
                'source_url': source_url,
                'category': 'transcript',
                'notes': f"{len(content)} characters, {len(content.split())} words",
                'tags': tags
            }

            transcripts_batch.append(transcript)
            tag_data.append(tags)

            # Log progress
            if idx % 1000 == 0:
                logging.info(f"Processed {idx}/{total_files} transcripts ({processed} inserted, {skipped} skipped)")

            # Insert batch when size reached
            if len(transcripts_batch) >= batch_size:
                inserted = insert_transcripts_batch(conn, transcripts_batch)
                processed += inserted

                # Associate tags
                associated = associate_tags_batch(conn, transcripts_batch)

                transcripts_batch = []
                tag_data = []

        except Exception as e:
            logging.error(f"Error processing {file_path}: {e}")
            skipped += 1
            continue

    # Insert remaining batch
    if transcripts_batch:
        inserted = insert_transcripts_batch(conn, transcripts_batch)
        processed += inserted
        associated = associate_tags_batch(conn, transcripts_batch)

    # Final statistics
    logging.info(f"\n{'='*60}")
    logging.info(f"IMPORT COMPLETE")
    logging.info(f"{'='*60}")
    logging.info(f"Total files processed: {processed}")
    logging.info(f"Skipped: {skipped}")
    logging.info(f"Failed: {total_files - processed - skipped}")

    # Verify
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM youtube.transcripts")
        total_transcripts = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM youtube.transcript_tags")
        total_tags = cur.fetchone()[0]

        logging.info(f"Database verification:")
        logging.info(f"  Total transcripts in database: {total_transcripts}")
        logging.info(f"  Total tag associations: {total_tags}")
    except Exception as e:
        logging.error(f"Error verifying: {e}")

    conn.close()
    logging.info(f"Disconnected from database")
    return True

# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Import YouTube transcripts to PostgreSQL database'
    )
    parser.add_argument(
        '--source-dir',
        default='/home/user/projects/veritable-games/resources/data/transcripts.OLD',
        help='Source directory containing transcript files'
    )
    parser.add_argument(
        '--database',
        default=DATABASE_URL,
        help='PostgreSQL database URL'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=1000,
        help='Batch size for imports'
    )
    parser.add_argument(
        '--log-file',
        default=f'/home/user/projects/veritable-games/resources/logs/youtube-import-{datetime.now().strftime("%Y%m%d")}.log',
        help='Log file path'
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.log_file)

    logging.info(f"Starting YouTube transcript import")
    logging.info(f"Source directory: {args.source_dir}")
    logging.info(f"Database: {args.database}")
    logging.info(f"Batch size: {args.batch_size}")
    logging.info(f"Log file: {args.log_file}")

    # Run import
    success = import_youtube_transcripts(
        args.source_dir,
        args.database,
        args.batch_size
    )

    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
