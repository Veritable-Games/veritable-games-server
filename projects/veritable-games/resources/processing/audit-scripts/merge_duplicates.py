#!/usr/bin/env python3
"""
Merge Duplicates
Safely merges identified duplicate documents while preserving tags
"""

import sys
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

# Setup logging
LOG_DIR = Path('/home/user/projects/veritable-games/resources/logs')
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'duplicate_merge.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DuplicateMerger:
    """Safely merges duplicate documents while preserving tags"""

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

    def get_cluster_info(self, cluster_id: int) -> Dict:
        """Get information about a duplicate cluster"""
        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Get cluster info
            cursor.execute("""
                SELECT dc.id, dc.cluster_type, dc.confidence_score, dc.review_status,
                       COUNT(cd.fingerprint_id) as document_count
                FROM shared.duplicate_clusters dc
                LEFT JOIN shared.cluster_documents cd ON dc.id = cd.cluster_id
                WHERE dc.id = %s
                GROUP BY dc.id
            """, (cluster_id,))

            cluster = cursor.fetchone()
            if not cluster:
                return None

            # Get documents in cluster
            cursor.execute("""
                SELECT cd.fingerprint_id, df.source, df.source_id, df.slug,
                       df.title_normalized, df.word_count
                FROM shared.cluster_documents cd
                JOIN shared.document_fingerprints df ON cd.fingerprint_id = df.id
                WHERE cd.cluster_id = %s
                ORDER BY df.word_count DESC
            """, (cluster_id,))

            documents = [dict(d) for d in cursor.fetchall()]

            return {
                'cluster': dict(cluster),
                'documents': documents
            }

        finally:
            self._close()

    def count_tags(self, source: str, source_id: int) -> int:
        """Count tags associated with a document"""
        self._connect()
        try:
            cursor = self.conn.cursor()

            cursor.execute("""
                SELECT COUNT(*) FROM shared.document_tags
                WHERE source = %s AND source_id = %s
            """, (source, source_id))

            count = cursor.fetchone()[0]
            return count

        finally:
            self._close()

    def merge_cluster(self, cluster_id: int, keep_fingerprint_id: int,
                     remove_fingerprint_ids: List[int], notes: Optional[str] = None) -> Dict:
        """
        Merge a duplicate cluster

        Args:
            cluster_id: ID of the cluster to merge
            keep_fingerprint_id: ID of fingerprint to keep
            remove_fingerprint_ids: IDs of fingerprints to remove
            notes: Merge notes

        Returns:
            Merge result with stats
        """
        logger.info(f"Starting merge of cluster {cluster_id}")

        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Verify fingerprints exist
            cursor.execute("""
                SELECT id, source, source_id FROM shared.document_fingerprints
                WHERE id IN %s
            """, (tuple(remove_fingerprint_ids + [keep_fingerprint_id]),))

            fingerprints = {row['id']: (row['source'], row['source_id']) for row in cursor.fetchall()}

            if len(fingerprints) != len(remove_fingerprint_ids) + 1:
                raise ValueError("Not all fingerprints found")

            # Get tag counts before merge
            keep_source, keep_source_id = fingerprints[keep_fingerprint_id]
            tag_counts_before = {}

            for fp_id in [keep_fingerprint_id] + remove_fingerprint_ids:
                source, source_id = fingerprints[fp_id]
                count = self.count_tags(source, source_id)
                tag_counts_before[fp_id] = (source, source_id, count)

            # Merge tags from removed documents to kept document
            for fp_id in remove_fingerprint_ids:
                remove_source, remove_source_id = fingerprints[fp_id]

                logger.info(f"Copying tags from {remove_source}:{remove_source_id} to {keep_source}:{keep_source_id}")

                # Copy tags (if table exists and has tags)
                try:
                    cursor.execute("""
                        INSERT INTO shared.document_tags (source, source_id, tag_id)
                        SELECT %s, %s, tag_id FROM shared.document_tags
                        WHERE source = %s AND source_id = %s
                        ON CONFLICT (source, source_id, tag_id) DO NOTHING
                    """, (keep_source, keep_source_id, remove_source, remove_source_id))
                except psycopg2.Error as e:
                    logger.warning(f"Could not copy tags (table may not exist): {e}")

            self.conn.commit()

            # Delete removed documents from appropriate tables
            for fp_id in remove_fingerprint_ids:
                remove_source, remove_source_id = fingerprints[fp_id]

                logger.info(f"Deleting {remove_source}:{remove_source_id}")

                # Delete from source table
                if remove_source == 'library':
                    cursor.execute("DELETE FROM library.library_documents WHERE id = %s", (remove_source_id,))
                elif remove_source == 'anarchist':
                    cursor.execute("DELETE FROM anarchist.documents WHERE id = %s", (remove_source_id,))
                elif remove_source == 'youtube':
                    cursor.execute("DELETE FROM youtube.transcripts WHERE id = %s", (remove_source_id,))
                elif remove_source == 'marxist':
                    cursor.execute("DELETE FROM marxist.documents WHERE id = %s", (remove_source_id,))

                # Delete from fingerprints
                cursor.execute("DELETE FROM shared.document_fingerprints WHERE id = %s", (fp_id,))

            self.conn.commit()

            # Update cluster status
            cursor.execute("""
                UPDATE shared.duplicate_clusters
                SET review_status = 'merged', canonical_fingerprint_id = %s,
                    reviewed_at = NOW()
                WHERE id = %s
            """, (keep_fingerprint_id, cluster_id))

            self.conn.commit()

            # Get tag counts after merge
            tag_counts_after = {}
            tag_counts_after[keep_fingerprint_id] = self.count_tags(keep_source, keep_source_id)

            # Calculate result
            total_tags_removed = sum(c[2] for c in tag_counts_before.values() if c[1] != keep_source_id or c[2] != keep_source_id)
            tags_preserved = tag_counts_after.get(keep_fingerprint_id, 0)

            result = {
                'cluster_id': cluster_id,
                'status': 'merged',
                'keep': {
                    'fingerprint_id': keep_fingerprint_id,
                    'source': keep_source,
                    'source_id': keep_source_id,
                    'tags_before': tag_counts_before[keep_fingerprint_id][2],
                    'tags_after': tags_preserved
                },
                'removed': [
                    {
                        'fingerprint_id': fp_id,
                        'source': fingerprints[fp_id][0],
                        'source_id': fingerprints[fp_id][1],
                        'tags': tag_counts_before[fp_id][2]
                    }
                    for fp_id in remove_fingerprint_ids
                ],
                'merge_notes': notes,
                'timestamp': datetime.now().isoformat()
            }

            logger.info(f"Merge complete for cluster {cluster_id}")
            logger.info(f"  Kept: {keep_source}:{keep_source_id}")
            logger.info(f"  Removed: {len(remove_fingerprint_ids)} documents")
            logger.info(f"  Tags preserved: {tags_preserved}")

            return result

        except Exception as e:
            self.conn.rollback()
            logger.error(f"Merge failed for cluster {cluster_id}: {e}", exc_info=True)
            raise

        finally:
            self._close()

    def auto_merge_high_confidence(self, confidence_threshold: float = 0.95) -> Dict:
        """Auto-merge high-confidence duplicate clusters"""
        logger.info(f"Starting auto-merge for confidence >= {confidence_threshold}")

        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Get high-confidence pending clusters
            cursor.execute("""
                SELECT id FROM shared.duplicate_clusters
                WHERE review_status = 'pending'
                    AND confidence_score >= %s
                ORDER BY confidence_score DESC
            """, (confidence_threshold,))

            clusters = [row['id'] for row in cursor.fetchall()]
            logger.info(f"Found {len(clusters)} high-confidence clusters for auto-merge")

            results = []
            for cluster_id in clusters:
                try:
                    info = self.get_cluster_info(cluster_id)
                    if not info or len(info['documents']) < 2:
                        continue

                    # Keep document with most content
                    keep = info['documents'][0]
                    remove_ids = [d['fingerprint_id'] for d in info['documents'][1:]]

                    result = self.merge_cluster(
                        cluster_id,
                        keep['fingerprint_id'],
                        remove_ids,
                        notes=f"Auto-merged (confidence: {info['cluster']['confidence_score']})"
                    )

                    results.append(result)

                except Exception as e:
                    logger.error(f"Failed to merge cluster {cluster_id}: {e}")

            logger.info(f"Auto-merged {len(results)} clusters")
            return {
                'merged_count': len(results),
                'results': results
            }

        finally:
            self._close()


def main():
    """CLI interface"""
    import argparse

    parser = argparse.ArgumentParser(description='Merge duplicate documents')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Info command
    info_parser = subparsers.add_parser('info', help='Show cluster info')
    info_parser.add_argument('cluster_id', type=int, help='Cluster ID')

    # Merge command
    merge_parser = subparsers.add_parser('merge', help='Merge cluster')
    merge_parser.add_argument('cluster_id', type=int, help='Cluster ID')
    merge_parser.add_argument('--keep', type=int, required=True, help='Fingerprint ID to keep')
    merge_parser.add_argument('--remove', type=int, nargs='+', required=True, help='Fingerprint IDs to remove')
    merge_parser.add_argument('--notes', help='Merge notes')

    # Auto-merge command
    auto_parser = subparsers.add_parser('auto-merge', help='Auto-merge high-confidence clusters')
    auto_parser.add_argument('--confidence', type=float, default=0.95, help='Confidence threshold')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    try:
        merger = DuplicateMerger()

        if args.command == 'info':
            info = merger.get_cluster_info(args.cluster_id)
            if info:
                print(f"\n=== Cluster {args.cluster_id} ===")
                print(f"Type: {info['cluster']['cluster_type']}")
                print(f"Confidence: {info['cluster']['confidence_score']}")
                print(f"Documents: {info['cluster']['document_count']}")
                print(f"\nDocuments:")
                for doc in info['documents']:
                    print(f"  FP {doc['fingerprint_id']}: {doc['source']}:{doc['source_id']}")
                    print(f"    Title: {doc['title_normalized']}")
                    print(f"    Words: {doc['word_count']}")
            else:
                print(f"Cluster {args.cluster_id} not found")

        elif args.command == 'merge':
            result = merger.merge_cluster(
                args.cluster_id,
                args.keep,
                args.remove,
                notes=args.notes
            )
            print(f"\nMerge complete: {result['status']}")
            print(f"Kept: {result['keep']['source']}:{result['keep']['source_id']}")
            print(f"Removed: {len(result['removed'])} documents")

        elif args.command == 'auto-merge':
            result = merger.auto_merge_high_confidence(args.confidence)
            print(f"\nAuto-merged {result['merged_count']} clusters")

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
