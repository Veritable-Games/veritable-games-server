#!/usr/bin/env python3
"""
Detect Duplicates
Identifies duplicate documents using 3-layer strategy
"""

import sys
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Set
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

# Setup logging
LOG_DIR = Path('/home/user/projects/veritable-games/resources/logs')
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'duplicate_detection.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DuplicateDetector:
    """Detects duplicate documents using multiple strategies"""

    # Detection thresholds
    EXACT_MATCH_CONFIDENCE = 1.0
    FUZZY_MATCH_HIGH_CONFIDENCE = 0.95
    FUZZY_MATCH_MED_CONFIDENCE = 0.85
    FUZZY_MATCH_LOW_CONFIDENCE = 0.75
    SIMHASH_HIGH_CONFIDENCE = 0.90   # Distance 0-2 bits
    SIMHASH_MED_CONFIDENCE = 0.70    # Distance 3-6 bits

    # Levenshtein distance thresholds for string similarity
    FUZZY_MATCH_DISTANCE_THRESHOLD = 5

    def __init__(self, db_url: Optional[str] = None):
        """Initialize with database connection"""
        self.db_url = db_url or os.getenv('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable not set")
        self.conn = None
        self.processed_pairs = set()  # Track processed pairs to avoid duplicates

    def _connect(self):
        """Establish database connection"""
        if not self.conn:
            self.conn = psycopg2.connect(self.db_url)

    def _close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None

    def _hamming_distance(self, hash1: int, hash2: int) -> int:
        """Calculate Hamming distance between two hashes"""
        xor = hash1 ^ hash2
        distance = 0
        while xor:
            distance += xor & 1
            xor >>= 1
        return distance

    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein distance between two strings"""
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)

        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    def detect_exact_matches(self) -> int:
        """Layer 1: Detect exact content matches (confidence 1.0)"""
        logger.info("Starting Layer 1: Exact content matching")

        self._connect()
        try:
            cursor = self.conn.cursor()

            # Find documents with same normalized MD5
            cursor.execute("""
                WITH duplicates AS (
                    SELECT
                        normalized_content_md5,
                        ARRAY_AGG(id ORDER BY id) as fingerprint_ids,
                        COUNT(*) as count,
                        'exact_match' as cluster_type,
                        1.0::DECIMAL(3,2) as confidence_score
                    FROM shared.document_fingerprints
                    WHERE normalized_content_md5 IS NOT NULL
                        AND normalized_content_md5 != ''
                    GROUP BY normalized_content_md5
                    HAVING COUNT(*) > 1
                )
                INSERT INTO shared.duplicate_clusters
                (cluster_type, confidence_score, review_status, created_at)
                SELECT cluster_type, confidence_score, 'pending', NOW()
                FROM duplicates
                RETURNING id
            """)

            cluster_ids = [row[0] for row in cursor.fetchall()]

            # Insert cluster documents
            if cluster_ids:
                cursor.execute("""
                    WITH duplicates AS (
                        SELECT
                            normalized_content_md5,
                            id as fingerprint_id
                        FROM shared.document_fingerprints
                        WHERE normalized_content_md5 IS NOT NULL
                            AND normalized_content_md5 != ''
                    ),
                    clusters AS (
                        SELECT
                            normalized_content_md5,
                            ARRAY_AGG(fingerprint_id ORDER BY fingerprint_id) as fingerprint_ids
                        FROM duplicates
                        GROUP BY normalized_content_md5
                        HAVING COUNT(*) > 1
                    )
                    SELECT cluster_id, fingerprint_id
                    FROM (
                        SELECT
                            ROW_NUMBER() OVER (PARTITION BY c.normalized_content_md5 ORDER BY d.id) as rn,
                            c.normalized_content_md5,
                            d.id as fingerprint_id
                        FROM clusters c, shared.document_fingerprints d
                        WHERE c.normalized_content_md5 = d.normalized_content_md5
                    ) sub,
                    shared.duplicate_clusters dc
                    WHERE dc.cluster_type = 'exact_match'
                        AND dc.confidence_score = 1.0
                """)

            self.conn.commit()
            logger.info(f"Found {len(cluster_ids)} exact match clusters")
            return len(cluster_ids)

        finally:
            self._close()

    def detect_fuzzy_matches(self) -> int:
        """Layer 2: Detect fuzzy title/author matches"""
        logger.info("Starting Layer 2: Fuzzy title/author matching")

        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Get all fingerprints
            cursor.execute("""
                SELECT id, source, source_id, slug, title_normalized, title_soundex,
                       author_soundex, word_count
                FROM shared.document_fingerprints
                ORDER BY id
            """)

            fingerprints = cursor.fetchall()
            logger.info(f"Checking {len(fingerprints)} documents for fuzzy matches")

            created_clusters = 0
            processed = set()

            for i, fp1 in enumerate(fingerprints):
                if fp1['id'] in processed:
                    continue

                matches = []
                for fp2 in fingerprints[i+1:]:
                    if fp2['id'] in processed:
                        continue

                    # Same source? Skip (would be in exact match already)
                    if fp1['source'] == fp2['source']:
                        continue

                    # Calculate similarity
                    title_distance = self._levenshtein_distance(
                        fp1['title_normalized'],
                        fp2['title_normalized']
                    )

                    # Check if titles are similar
                    if title_distance <= self.FUZZY_MATCH_DISTANCE_THRESHOLD:
                        # Check soundex match for extra confirmation
                        soundex_match = (fp1['title_soundex'] == fp2['title_soundex'])

                        if soundex_match or title_distance <= 3:
                            confidence = self.FUZZY_MATCH_HIGH_CONFIDENCE
                        else:
                            confidence = self.FUZZY_MATCH_MED_CONFIDENCE

                        matches.append((fp2['id'], confidence))
                        processed.add(fp2['id'])

                # Create cluster if matches found
                if matches:
                    cursor.execute("""
                        INSERT INTO shared.duplicate_clusters
                        (cluster_type, confidence_score, review_status, created_at)
                        VALUES (%s, %s, %s, NOW())
                        RETURNING id
                    """, ('fuzzy_match', self.FUZZY_MATCH_MED_CONFIDENCE, 'pending'))

                    cluster_id = cursor.fetchone()[0]

                    # Add documents to cluster
                    cursor.execute("""
                        INSERT INTO shared.cluster_documents
                        (cluster_id, fingerprint_id)
                        VALUES (%s, %s)
                    """, (cluster_id, fp1['id']))

                    for fp2_id, _ in matches:
                        cursor.execute("""
                            INSERT INTO shared.cluster_documents
                            (cluster_id, fingerprint_id)
                            VALUES (%s, %s)
                        """, (cluster_id, fp2_id))

                    created_clusters += 1

                processed.add(fp1['id'])

                if (i + 1) % 100 == 0:
                    self.conn.commit()
                    logger.info(f"Checked {i + 1}/{len(fingerprints)} documents")

            self.conn.commit()
            logger.info(f"Found {created_clusters} fuzzy match clusters")
            return created_clusters

        finally:
            self._close()

    def detect_near_duplicates(self) -> int:
        """Layer 3: Detect near-duplicates using SimHash"""
        logger.info("Starting Layer 3: Near-duplicate detection (SimHash)")

        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Get all fingerprints with SimHash
            cursor.execute("""
                SELECT id, source, source_id, slug, simhash_64bit, word_count
                FROM shared.document_fingerprints
                WHERE simhash_64bit IS NOT NULL
                    AND simhash_64bit != 0
                ORDER BY id
            """)

            fingerprints = cursor.fetchall()
            logger.info(f"Checking {len(fingerprints)} documents for near-duplicates")

            created_clusters = 0
            processed = set()

            for i, fp1 in enumerate(fingerprints):
                if fp1['id'] in processed:
                    continue

                matches = []
                for fp2 in fingerprints[i+1:]:
                    if fp2['id'] in processed:
                        continue

                    # Same source? Skip
                    if fp1['source'] == fp2['source']:
                        continue

                    # Calculate Hamming distance
                    distance = self._hamming_distance(
                        fp1['simhash_64bit'],
                        fp2['simhash_64bit']
                    )

                    # Near-duplicate if distance <= 6 bits (similarity > 90%)
                    if distance <= 6:
                        if distance <= 2:
                            confidence = self.SIMHASH_HIGH_CONFIDENCE
                        else:
                            confidence = self.SIMHASH_MED_CONFIDENCE

                        matches.append((fp2['id'], confidence, distance))
                        processed.add(fp2['id'])

                # Create cluster if matches found
                if matches:
                    # Use highest confidence for cluster
                    max_confidence = max(c[1] for c in matches)

                    cursor.execute("""
                        INSERT INTO shared.duplicate_clusters
                        (cluster_type, confidence_score, review_status, created_at)
                        VALUES (%s, %s, %s, NOW())
                        RETURNING id
                    """, ('near_duplicate', max_confidence, 'pending'))

                    cluster_id = cursor.fetchone()[0]

                    # Add documents to cluster
                    cursor.execute("""
                        INSERT INTO shared.cluster_documents
                        (cluster_id, fingerprint_id)
                        VALUES (%s, %s)
                    """, (cluster_id, fp1['id']))

                    for fp2_id, _, _ in matches:
                        cursor.execute("""
                            INSERT INTO shared.cluster_documents
                            (cluster_id, fingerprint_id)
                            VALUES (%s, %s)
                        """, (cluster_id, fp2_id))

                    created_clusters += 1

                processed.add(fp1['id'])

                if (i + 1) % 100 == 0:
                    self.conn.commit()
                    logger.info(f"Checked {i + 1}/{len(fingerprints)} documents")

            self.conn.commit()
            logger.info(f"Found {created_clusters} near-duplicate clusters")
            return created_clusters

        finally:
            self._close()

    def detect_all(self) -> Dict[str, int]:
        """Run all detection layers"""
        logger.info("Starting duplicate detection (all layers)")

        results = {
            'exact_matches': self.detect_exact_matches(),
            'fuzzy_matches': self.detect_fuzzy_matches(),
            'near_duplicates': self.detect_near_duplicates()
        }

        total = sum(results.values())
        logger.info(f"\nDuplicate Detection Summary:")
        logger.info(f"  Exact Matches: {results['exact_matches']}")
        logger.info(f"  Fuzzy Matches: {results['fuzzy_matches']}")
        logger.info(f"  Near Duplicates: {results['near_duplicates']}")
        logger.info(f"  Total Clusters: {total}")

        return results


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Detect duplicate documents')
    parser.add_argument('--layer', action='append', choices=['exact', 'fuzzy', 'simhash'],
                       help='Detection layers to run (default: all)')

    args = parser.parse_args()
    layers = args.layer or ['exact', 'fuzzy', 'simhash']

    try:
        detector = DuplicateDetector()

        if 'exact' in layers:
            detector.detect_exact_matches()
        if 'fuzzy' in layers:
            detector.detect_fuzzy_matches()
        if 'simhash' in layers:
            detector.detect_near_duplicates()

        logger.info("Duplicate detection complete")

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
