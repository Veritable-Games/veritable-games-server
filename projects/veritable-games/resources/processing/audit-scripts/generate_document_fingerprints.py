#!/usr/bin/env python3
"""
Generate Document Fingerprints
Creates MD5, SHA256, and SimHash fingerprints for all documents
"""

import sys
import os
import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
from pathlib import Path

try:
    from datasketch import MinHash
except ImportError:
    print("ERROR: datasketch not installed. Install with: pip install datasketch")
    sys.exit(1)

# Setup logging
LOG_DIR = Path('/home/user/projects/veritable-games/resources/logs')
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'fingerprint_generation.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class FingerprintGenerator:
    """Generates document fingerprints for duplicate detection"""

    def __init__(self, db_url: Optional[str] = None):
        """Initialize with database connection"""
        self.db_url = db_url or os.getenv('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable not set")
        self.conn = None

    def _connect(self):
        """Establish database connection"""
        if not self.conn:
            self.conn = psycopg2.connect(self.db_url)

    def _close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None

    def _calculate_hashes(self, content: str) -> Dict[str, str]:
        """Calculate MD5 and SHA256 hashes"""
        if not content:
            return {
                'md5': '',
                'sha256': '',
                'normalized_md5': ''
            }

        # Original hashes
        md5 = hashlib.md5(content.encode()).hexdigest()
        sha256 = hashlib.sha256(content.encode()).hexdigest()

        # Normalized hash (whitespace-insensitive)
        normalized = ' '.join(content.split()).lower()
        normalized_md5 = hashlib.md5(normalized.encode()).hexdigest()

        return {
            'md5': md5,
            'sha256': sha256,
            'normalized_md5': normalized_md5
        }

    def _soundex(self, text: str) -> str:
        """Generate Soundex hash of text (simple implementation)"""
        if not text:
            return ''

        text = text.upper().strip()
        if not text:
            return ''

        # Keep first letter
        soundex = text[0]

        # Mapping for consonants
        mapping = {
            'B': '1', 'F': '1', 'P': '1', 'V': '1',
            'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
            'D': '3', 'T': '3',
            'L': '4',
            'M': '5', 'N': '5',
            'R': '6'
        }

        prev_code = mapping.get(text[0], '0')

        # Process remaining letters
        for char in text[1:]:
            code = mapping.get(char, '0')
            if code != '0' and code != prev_code:
                soundex += code
                if len(soundex) == 4:
                    break
            prev_code = code

        # Pad with zeros to length 4
        soundex = (soundex + '000')[:4]
        return soundex

    def _simhash(self, content: str) -> int:
        """Generate 64-bit SimHash fingerprint"""
        if not content:
            return 0

        # Simple SimHash implementation using MinHash
        try:
            m = MinHash(num_perm=64)
            # Split content into shingles (words)
            words = content.lower().split()
            for word in words:
                m.update(word.encode())
            # Return first 64 bits (use hashdigest)
            digest = m.hashdigest()
            # Convert to integer
            return int(digest, 16) & ((1 << 64) - 1)
        except Exception as e:
            logger.warning(f"SimHash calculation failed: {e}")
            return 0

    def _normalize_title(self, title: str) -> str:
        """Normalize title for comparison"""
        if not title:
            return ''
        return ' '.join(title.lower().split())

    def generate_fingerprints(self, source: str, batch_size: int = 1000):
        """Generate fingerprints for all documents in a source"""
        logger.info(f"Starting fingerprint generation for {source}")

        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Map source to table
            source_map = {
                'library': ('library.library_documents', 'id', 'title', 'author', 'content', 'slug'),
                'anarchist': ('anarchist.documents', 'id', 'title', 'author', 'content', 'slug'),
                'youtube': ('youtube.transcripts', 'id', 'title', 'channel', 'text', 'slug'),
                'marxist': ('marxist.documents', 'id', 'title', 'author', 'content', 'slug'),
            }

            if source not in source_map:
                raise ValueError(f"Unknown source: {source}")

            table, id_col, title_col, author_col, content_col, slug_col = source_map[source]

            # Get all documents
            cursor.execute(f"""
                SELECT {id_col} as id, {title_col} as title, {author_col} as author,
                       {content_col} as content, {slug_col} as slug
                FROM {table}
                WHERE {id_col} IS NOT NULL
                ORDER BY {id_col}
            """)

            documents = cursor.fetchall()
            logger.info(f"Found {len(documents)} documents in {source}")

            # Clear existing fingerprints for this source
            cursor.execute("""
                DELETE FROM shared.document_fingerprints
                WHERE source = %s
            """, (source,))
            self.conn.commit()
            logger.info(f"Cleared previous fingerprints for {source}")

            # Process in batches
            fingerprints = []
            for i, doc in enumerate(documents):
                doc_dict = dict(doc)
                content = doc_dict.get('content', '')
                title = doc_dict.get('title', '')
                author = doc_dict.get('author', '')

                # Calculate hashes
                hashes = self._calculate_hashes(content)

                # Calculate fingerprints
                title_normalized = self._normalize_title(title)
                title_soundex = self._soundex(title)
                author_soundex = self._soundex(author)
                simhash = self._simhash(content)
                word_count = len(content.split()) if content else 0

                fingerprints.append((
                    source,
                    doc_dict['id'],
                    doc_dict['slug'],
                    hashes['md5'],
                    hashes['sha256'],
                    hashes['normalized_md5'],
                    title_normalized,
                    title_soundex,
                    author_soundex,
                    simhash,
                    word_count
                ))

                # Batch insert
                if len(fingerprints) >= batch_size:
                    self._insert_fingerprints(fingerprints)
                    fingerprints = []
                    logger.info(f"Processed {i + 1}/{len(documents)} documents")

            # Insert remaining
            if fingerprints:
                self._insert_fingerprints(fingerprints)
                logger.info(f"Completed {len(documents)} documents")

            logger.info(f"Fingerprint generation complete for {source}")

        finally:
            self._close()

    def _insert_fingerprints(self, fingerprints: List[tuple]):
        """Insert batch of fingerprints"""
        self._connect()
        try:
            cursor = self.conn.cursor()
            execute_batch(
                cursor,
                """
                INSERT INTO shared.document_fingerprints
                (source, source_id, slug, content_md5, content_sha256,
                 normalized_content_md5, title_normalized, title_soundex,
                 author_soundex, simhash_64bit, word_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (source, source_id) DO UPDATE SET
                content_md5 = EXCLUDED.content_md5,
                content_sha256 = EXCLUDED.content_sha256,
                updated_at = NOW()
                """,
                fingerprints
            )
            self.conn.commit()
        finally:
            self._close()

    def generate_all(self, batch_size: int = 1000):
        """Generate fingerprints for all sources"""
        sources = ['library', 'anarchist', 'youtube', 'marxist']
        for source in sources:
            try:
                self.generate_fingerprints(source, batch_size)
            except Exception as e:
                logger.error(f"Error generating fingerprints for {source}: {e}", exc_info=True)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate document fingerprints')
    parser.add_argument('--source', choices=['library', 'anarchist', 'youtube', 'marxist', 'all'],
                       default='all', help='Source to fingerprint')
    parser.add_argument('--batch-size', type=int, default=1000, help='Batch size for insertion')

    args = parser.parse_args()

    try:
        gen = FingerprintGenerator()
        if args.source == 'all':
            gen.generate_all(batch_size=args.batch_size)
        else:
            gen.generate_fingerprints(args.source, batch_size=args.batch_size)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
