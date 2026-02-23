#!/usr/bin/env python3
"""
Metadata Audit CLI Tool
Manages the metadata audit workflow with database persistence and resumability
"""

import sys
import os
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

# Add parent directory to path to import issue_detectors
sys.path.insert(0, os.path.dirname(__file__))
from issue_detectors import IssueDetector, categorize_by_priority, get_priority_counts

# Setup logging
LOG_DIR = Path('/home/user/projects/veritable-games/resources/logs')
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'metadata_audit.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class MetadataAudit:
    """Manages metadata audit workflow"""

    def __init__(self, db_url: Optional[str] = None):
        """Initialize audit with database connection"""
        self.db_url = db_url or os.getenv('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable not set")
        self.conn = None
        self.detector = IssueDetector()
        self.progress_file = Path('/home/user/projects/veritable-games/resources/logs/audit_progress.json')
        self.progress = self._load_progress()

    def _connect(self):
        """Establish database connection"""
        if not self.conn:
            self.conn = psycopg2.connect(self.db_url)

    def _close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None

    def _load_progress(self) -> Dict[str, Any]:
        """Load progress from checkpoint file"""
        if self.progress_file.exists():
            try:
                with open(self.progress_file) as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load progress: {e}")
        return {
            'initialized': False,
            'total_documents': 0,
            'processed': 0,
            'pending': 0,
            'reviewed': 0,
            'fixed': 0,
            'skipped': 0,
            'last_updated': None
        }

    def _save_progress(self):
        """Save progress to checkpoint file"""
        self.progress['last_updated'] = datetime.now().isoformat()
        with open(self.progress_file, 'w') as f:
            json.dump(self.progress, f, indent=2)
        logger.info(f"Progress saved: {self.progress}")

    def init(self, schema: str = 'library'):
        """Initialize audit system - scan documents and populate audit table"""
        logger.info(f"Initializing metadata audit for schema: {schema}")

        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Determine table and ID mapping
            if schema == 'library':
                table = 'library.library_documents'
                id_col = 'id'
                title_col = 'title'
                author_col = 'author'
                date_col = 'publication_date'
                content_col = 'content'
            elif schema == 'anarchist':
                table = 'anarchist.documents'
                id_col = 'id'
                title_col = 'title'
                author_col = 'author'
                date_col = 'publication_date'
                content_col = 'content'
            else:
                raise ValueError(f"Unknown schema: {schema}")

            # Get all documents
            cursor.execute(f"""
                SELECT {id_col} as id, {title_col} as title, {author_col} as author,
                       {date_col} as publication_date, {content_col} as content,
                       slug
                FROM {table}
                WHERE {id_col} IS NOT NULL
                ORDER BY {id_col}
            """)

            documents = cursor.fetchall()
            logger.info(f"Found {len(documents)} documents in {schema} schema")

            # Clear existing audit data for this schema
            cursor.execute(f"""
                DELETE FROM library.metadata_audit_log
                WHERE schema_name = %s
            """, (schema,))
            self.conn.commit()
            logger.info(f"Cleared previous audit data for {schema}")

            # Process each document
            scores = []
            for i, doc in enumerate(documents):
                doc_dict = dict(doc)
                result = self.detector.analyze(doc_dict)

                scores.append(result['quality_score'])

                # Insert audit record
                cursor.execute("""
                    INSERT INTO library.metadata_audit_log
                    (schema_name, document_id, document_slug, audit_status, quality_score,
                     issues_detected, issues_count, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (schema_name, document_id) DO UPDATE SET
                    quality_score = EXCLUDED.quality_score,
                    issues_detected = EXCLUDED.issues_detected,
                    issues_count = EXCLUDED.issues_count
                """, (
                    schema,
                    doc['id'],
                    doc['slug'],
                    'pending',
                    result['quality_score'],
                    json.dumps(result['issues']),
                    result['issue_count']
                ))

                if (i + 1) % 100 == 0:
                    self.conn.commit()
                    logger.info(f"Processed {i + 1}/{len(documents)} documents")

            self.conn.commit()
            logger.info(f"Completed processing all {len(documents)} documents")

            # Calculate statistics
            priority_counts = get_priority_counts(scores)
            avg_score = sum(scores) / len(scores) if scores else 0

            logger.info(f"\nAudit Statistics:")
            logger.info(f"  Total Documents: {len(documents)}")
            logger.info(f"  Average Quality Score: {avg_score:.1f}")
            logger.info(f"  CRITICAL (0-39): {priority_counts['CRITICAL']}")
            logger.info(f"  POOR (40-59): {priority_counts['POOR']}")
            logger.info(f"  GOOD (60-79): {priority_counts['GOOD']}")
            logger.info(f"  EXCELLENT (80-100): {priority_counts['EXCELLENT']}")

            # Update progress
            self.progress['initialized'] = True
            self.progress['total_documents'] = len(documents)
            self.progress['pending'] = len(documents)
            self.progress['last_schema'] = schema
            self._save_progress()

        finally:
            self._close()

    def next(self, count: int = 10, max_score: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get next batch of documents to review"""
        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            query = """
                SELECT id, schema_name, document_slug, quality_score, issues_detected, issues_count
                FROM library.metadata_audit_log
                WHERE audit_status = 'pending'
            """
            params = []

            if max_score is not None:
                query += " AND quality_score <= %s"
                params.append(max_score)

            query += f" ORDER BY quality_score ASC, issues_count DESC LIMIT %s"
            params.append(count)

            cursor.execute(query, params)
            documents = cursor.fetchall()

            # Mark as in_review
            if documents:
                ids = [d['id'] for d in documents]
                cursor.execute(f"""
                    UPDATE library.metadata_audit_log
                    SET audit_status = 'in_review'
                    WHERE id = ANY(%s)
                """, (ids,))
                self.conn.commit()

            return [dict(d) for d in documents]

        finally:
            self._close()

    def mark_fixed(self, audit_id: int, notes: Optional[str] = None):
        """Mark document as fixed"""
        self._connect()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE library.metadata_audit_log
                SET audit_status = 'fixed', audited_at = NOW(), notes = %s
                WHERE id = %s
            """, (notes, audit_id))
            self.conn.commit()
            logger.info(f"Marked audit {audit_id} as fixed")
        finally:
            self._close()

    def mark_reviewed(self, audit_id: int, notes: Optional[str] = None):
        """Mark document as reviewed (no changes needed)"""
        self._connect()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE library.metadata_audit_log
                SET audit_status = 'reviewed', audited_at = NOW(), notes = %s
                WHERE id = %s
            """, (notes, audit_id))
            self.conn.commit()
            logger.info(f"Marked audit {audit_id} as reviewed")
        finally:
            self._close()

    def mark_skipped(self, audit_id: int, reason: Optional[str] = None):
        """Mark document as skipped"""
        self._connect()
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE library.metadata_audit_log
                SET audit_status = 'skipped', audited_at = NOW(), notes = %s
                WHERE id = %s
            """, (reason, audit_id))
            self.conn.commit()
            logger.info(f"Marked audit {audit_id} as skipped")
        finally:
            self._close()

    def status(self):
        """Get audit status"""
        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            cursor.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN audit_status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN audit_status = 'in_review' THEN 1 END) as in_review,
                    COUNT(CASE WHEN audit_status = 'reviewed' THEN 1 END) as reviewed,
                    COUNT(CASE WHEN audit_status = 'fixed' THEN 1 END) as fixed,
                    COUNT(CASE WHEN audit_status = 'skipped' THEN 1 END) as skipped,
                    AVG(quality_score) as avg_score,
                    MIN(quality_score) as min_score,
                    MAX(quality_score) as max_score
                FROM library.metadata_audit_log
            """)

            result = cursor.fetchone()

            print("\n=== Audit Status ===")
            print(f"Total Documents: {result['total']}")
            print(f"Pending: {result['pending']}")
            print(f"In Review: {result['in_review']}")
            print(f"Reviewed: {result['reviewed']}")
            print(f"Fixed: {result['fixed']}")
            print(f"Skipped: {result['skipped']}")
            print(f"\nQuality Scores:")
            print(f"  Average: {result['avg_score']:.1f}")
            print(f"  Min: {result['min_score']}")
            print(f"  Max: {result['max_score']}")

            # Priority distribution
            cursor.execute("""
                SELECT
                    COUNT(CASE WHEN quality_score <= 39 THEN 1 END) as critical,
                    COUNT(CASE WHEN quality_score BETWEEN 40 AND 59 THEN 1 END) as poor,
                    COUNT(CASE WHEN quality_score BETWEEN 60 AND 79 THEN 1 END) as good,
                    COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as excellent
                FROM library.metadata_audit_log
            """)

            dist = cursor.fetchone()
            print(f"\nPriority Distribution:")
            print(f"  CRITICAL (0-39): {dist['critical']}")
            print(f"  POOR (40-59): {dist['poor']}")
            print(f"  GOOD (60-79): {dist['good']}")
            print(f"  EXCELLENT (80-100): {dist['excellent']}")

        finally:
            self._close()

    def finalize_round(self, round_name: str, notes: Optional[str] = None):
        """Save checkpoint for this round"""
        self._connect()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)

            # Get statistics
            cursor.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN audit_status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN audit_status = 'reviewed' THEN 1 END) as reviewed,
                    COUNT(CASE WHEN audit_status = 'fixed' THEN 1 END) as fixed,
                    COUNT(CASE WHEN audit_status = 'skipped' THEN 1 END) as skipped,
                    AVG(quality_score)::DECIMAL(5,2) as avg_score
                FROM library.metadata_audit_log
            """)

            stats = cursor.fetchone()

            # Create checkpoint
            cursor.execute("""
                INSERT INTO library.audit_checkpoints
                (round_number, round_name, total_documents, pending_count, reviewed_count,
                 fixed_count, skipped_count, average_quality_score, created_at, notes)
                VALUES (
                    (SELECT COALESCE(MAX(round_number), 0) + 1 FROM library.audit_checkpoints),
                    %s, %s, %s, %s, %s, %s, %s, NOW(), %s
                )
            """, (
                round_name,
                stats['total'],
                stats['pending'],
                stats['reviewed'],
                stats['fixed'],
                stats['skipped'],
                stats['avg_score'],
                notes
            ))

            self.conn.commit()
            logger.info(f"Checkpoint saved: {round_name}")
            print(f"Round '{round_name}' finalized and saved as checkpoint")

        finally:
            self._close()


def main():
    """Command-line interface"""
    parser = argparse.ArgumentParser(description='Metadata Audit CLI')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Init command
    init_parser = subparsers.add_parser('init', help='Initialize audit')
    init_parser.add_argument('--schema', default='library', help='Schema to audit')

    # Next command
    next_parser = subparsers.add_parser('next', help='Get next batch to review')
    next_parser.add_argument('--count', type=int, default=10, help='Number of documents')
    next_parser.add_argument('--max-score', type=int, help='Max quality score')

    # Mark commands
    fixed_parser = subparsers.add_parser('mark-fixed', help='Mark document as fixed')
    fixed_parser.add_argument('audit_id', type=int, help='Audit record ID')
    fixed_parser.add_argument('--notes', help='Notes about the fix')

    reviewed_parser = subparsers.add_parser('mark-reviewed', help='Mark document as reviewed')
    reviewed_parser.add_argument('audit_id', type=int, help='Audit record ID')
    reviewed_parser.add_argument('--notes', help='Reviewer notes')

    skipped_parser = subparsers.add_parser('mark-skipped', help='Mark document as skipped')
    skipped_parser.add_argument('audit_id', type=int, help='Audit record ID')
    skipped_parser.add_argument('--reason', help='Reason for skipping')

    # Status command
    subparsers.add_parser('status', help='Show audit status')

    # Finalize command
    finalize_parser = subparsers.add_parser('finalize-round', help='Finalize audit round')
    finalize_parser.add_argument('--name', required=True, help='Round name')
    finalize_parser.add_argument('--notes', help='Notes about this round')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    try:
        audit = MetadataAudit()

        if args.command == 'init':
            audit.init(schema=args.schema)
        elif args.command == 'next':
            docs = audit.next(count=args.count, max_score=args.max_score)
            print(f"\n=== Next {len(docs)} Documents ===")
            for doc in docs:
                print(f"\nID: {doc['id']} ({doc['schema_name']}.{doc['document_slug']})")
                print(f"  Quality Score: {doc['quality_score']}")
                print(f"  Issues: {doc['issues_count']}")
                if doc['issues_detected']:
                    issues = json.loads(doc['issues_detected'])
                    for issue in issues:
                        print(f"    - [{issue['severity']}] {issue['type']}: {issue['message']}")
        elif args.command == 'mark-fixed':
            audit.mark_fixed(args.audit_id, notes=args.notes)
        elif args.command == 'mark-reviewed':
            audit.mark_reviewed(args.audit_id, notes=args.notes)
        elif args.command == 'mark-skipped':
            audit.mark_skipped(args.audit_id, reason=args.reason)
        elif args.command == 'status':
            audit.status()
        elif args.command == 'finalize-round':
            audit.finalize_round(args.name, notes=args.notes)

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
