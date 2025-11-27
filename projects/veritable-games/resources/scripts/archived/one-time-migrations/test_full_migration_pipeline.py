#!/usr/bin/env python3
"""
Test Full Migration Pipeline
Runs all 3 phases on sample data to validate the complete workflow.

Phases:
1. Artifact cleanup
2. Structure detection
3. Quality assessment

This script tests the COMPLETE workflow on 20 sample documents (NOT 10)
to ensure all phases work correctly in sequence before running on production data.
"""

import psycopg2
import json
import sys
from datetime import datetime
from pathlib import Path

# Import our migration scripts
import cleanup_pdf_artifacts
import detect_document_structure
import assess_document_quality

# Configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres'
}

OUTPUT_DIR = '/home/user/projects/veritable-games/resources/logs/migration/test-run'
SAMPLE_SIZE = 20


def select_test_documents(conn):
    """
    Select 20 diverse test documents:
    - 5 heavily polluted (most page markers)
    - 5 with ligature issues
    - 5 short documents
    - 5 long documents (potential books)
    """

    cur = conn.cursor()

    print("Selecting diverse test sample...")

    test_ids = []

    # 1. Most polluted documents (5)
    query_polluted = """
        SELECT id
        FROM library.library_documents
        WHERE content IS NOT NULL
        ORDER BY (LENGTH(content) - LENGTH(REPLACE(content, '\f', ''))) DESC
        LIMIT 5
    """
    cur.execute(query_polluted)
    test_ids.extend([row[0] for row in cur.fetchall()])
    print(f"  ✓ Selected 5 heavily polluted documents")

    # 2. Documents with ligature issues (5)
    query_ligatures = """
        SELECT id
        FROM library.library_documents
        WHERE content IS NOT NULL
          AND (content LIKE '%ﬁ%' OR content LIKE '%ﬂ%')
        LIMIT 5
    """
    cur.execute(query_ligatures)
    ligature_ids = [row[0] for row in cur.fetchall()]
    # Filter out duplicates
    for doc_id in ligature_ids:
        if doc_id not in test_ids:
            test_ids.append(doc_id)
    print(f"  ✓ Selected {len([i for i in ligature_ids if i not in test_ids])} documents with ligatures")

    # 3. Short documents (5)
    query_short = """
        SELECT id
        FROM library.library_documents
        WHERE content IS NOT NULL
          AND LENGTH(content) < 5000
        ORDER BY RANDOM()
        LIMIT 10
    """
    cur.execute(query_short)
    short_ids = [row[0] for row in cur.fetchall()]
    for doc_id in short_ids:
        if doc_id not in test_ids and len(test_ids) < 15:
            test_ids.append(doc_id)
    print(f"  ✓ Selected {len([i for i in short_ids if i not in test_ids])} short documents")

    # 4. Long documents (potential books) (5)
    query_long = """
        SELECT id
        FROM library.library_documents
        WHERE content IS NOT NULL
          AND LENGTH(content) > 100000
        ORDER BY RANDOM()
        LIMIT 10
    """
    cur.execute(query_long)
    long_ids = [row[0] for row in cur.fetchall()]
    for doc_id in long_ids:
        if doc_id not in test_ids and len(test_ids) < 20:
            test_ids.append(doc_id)
    print(f"  ✓ Selected {len([i for i in long_ids if i not in test_ids])} long documents")

    cur.close()

    print(f"\nTotal test documents selected: {len(test_ids)}")
    return test_ids


def create_test_copy(conn, test_ids):
    """
    Create a temporary table with test documents for safe testing.
    Returns: temp table name
    """

    cur = conn.cursor()

    temp_table = 'library_documents_test'

    print(f"\nCreating test copy: library.{temp_table}...")

    # Drop if exists
    cur.execute(f"DROP TABLE IF EXISTS library.{temp_table}")

    # Create copy with same structure
    cur.execute(f"""
        CREATE TABLE library.{temp_table} AS
        SELECT *
        FROM library.library_documents
        WHERE id IN ({','.join(map(str, test_ids))})
    """)

    count = cur.rowcount
    print(f"  ✓ Copied {count} documents to test table")

    conn.commit()
    cur.close()

    return temp_table


def run_phase1_test(conn, temp_table):
    """Run Phase 1: Artifact cleanup on test data"""

    print(f"\n{'='*80}")
    print("PHASE 1: ARTIFACT CLEANUP (TEST)")
    print(f"{'='*80}\n")

    cur = conn.cursor()

    # Fetch test documents
    cur.execute(f"""
        SELECT id, slug, title, content
        FROM library.{temp_table}
        ORDER BY id
    """)

    columns = [desc[0] for desc in cur.description]
    documents = [dict(zip(columns, row)) for row in cur.fetchall()]

    print(f"Processing {len(documents)} test documents...")

    results = []
    for doc in documents:
        cleaned_content, changes = cleanup_pdf_artifacts.clean_content(doc['content'], doc['id'])

        # Update test table
        cur.execute(f"""
            UPDATE library.{temp_table}
            SET content = %s
            WHERE id = %s
        """, (cleaned_content, doc['id']))

        results.append({
            'doc_id': doc['id'],
            'slug': doc['slug'],
            'title': doc['title'],
            'changes': changes,
        })

    conn.commit()
    cur.close()

    # Print summary
    changed = [r for r in results if r['changes']['changed']]
    unchanged = [r for r in results if not r['changes']['changed']]

    print(f"\n  ✓ Cleanup complete:")
    print(f"    - Documents changed: {len(changed)}")
    print(f"    - Documents unchanged: {len(unchanged)}")

    if changed:
        avg_reduction = sum(r['changes']['reduction_pct'] for r in changed) / len(changed)
        print(f"    - Average reduction: {avg_reduction:.1f}%")

    return results


def run_phase2_test(conn, temp_table):
    """Run Phase 2: Structure detection on test data"""

    print(f"\n{'='*80}")
    print("PHASE 2: STRUCTURE DETECTION (TEST)")
    print(f"{'='*80}\n")

    cur = conn.cursor()

    # Fetch test documents (with cleaned content)
    cur.execute(f"""
        SELECT id, slug, title, content, document_type
        FROM library.{temp_table}
        ORDER BY id
    """)

    columns = [desc[0] for desc in cur.description]
    documents = [dict(zip(columns, row)) for row in cur.fetchall()]

    print(f"Analyzing {len(documents)} test documents...")

    results = []
    for doc in documents:
        # Detect chapters
        chapters = detect_document_structure.detect_chapters(doc['content'])

        # Classify document type
        detected_type, type_confidence, type_reasoning = detect_document_structure.classify_document_type(
            doc['content'], chapters
        )

        # Analyze header hierarchy
        header_hierarchy = detect_document_structure.analyze_header_hierarchy(doc['content'])

        # Generate TOC
        toc = detect_document_structure.extract_table_of_contents(chapters)

        results.append({
            'doc_id': doc['id'],
            'slug': doc['slug'],
            'title': doc['title'],
            'original_type': doc['document_type'],
            'detected_type': detected_type,
            'type_confidence': type_confidence,
            'type_reasoning': type_reasoning,
            'chapter_count': len(chapters),
            'chapters': chapters,
            'header_hierarchy': header_hierarchy,
            'table_of_contents': toc,
        })

    cur.close()

    # Print summary
    with_chapters = [r for r in results if r['chapter_count'] > 0]

    print(f"\n  ✓ Structure detection complete:")
    print(f"    - Documents with chapters: {len(with_chapters)}")
    print(f"    - Total chapters detected: {sum(r['chapter_count'] for r in results)}")

    if with_chapters:
        avg_chapters = sum(r['chapter_count'] for r in with_chapters) / len(with_chapters)
        print(f"    - Average chapters per doc: {avg_chapters:.1f}")

    # Type breakdown
    from collections import defaultdict
    type_counts = defaultdict(int)
    for r in results:
        type_counts[r['detected_type']] += 1

    print(f"\n  Type breakdown:")
    for doc_type, count in sorted(type_counts.items()):
        print(f"    - {doc_type}: {count}")

    return results


def run_phase3_test(conn, temp_table):
    """Run Phase 3: Quality assessment on test data"""

    print(f"\n{'='*80}")
    print("PHASE 3: QUALITY ASSESSMENT (TEST)")
    print(f"{'='*80}\n")

    cur = conn.cursor()

    # Fetch test documents (with cleaned content)
    cur.execute(f"""
        SELECT id, slug, title, author, publication_date, description,
               abstract, content, document_type
        FROM library.{temp_table}
        ORDER BY id
    """)

    columns = [desc[0] for desc in cur.description]
    documents = [dict(zip(columns, row)) for row in cur.fetchall()]

    print(f"Assessing {len(documents)} test documents...")

    results = []
    for doc in documents:
        quality_assessment = assess_document_quality.assess_document_quality(doc)

        results.append({
            'doc_id': doc['id'],
            'slug': doc['slug'],
            'title': doc['title'],
            'quality': quality_assessment,
        })

    cur.close()

    # Print summary
    from collections import defaultdict
    action_counts = defaultdict(int)
    for r in results:
        action_counts[r['quality']['action']] += 1

    avg_score = sum(r['quality']['overall_score'] for r in results) / len(results)

    print(f"\n  ✓ Quality assessment complete:")
    print(f"    - Average quality score: {avg_score:.1f}/100")
    print(f"\n  Action breakdown:")

    action_labels = {
        'auto_migrate': 'Auto-migrate (no review)',
        'flag_review': 'Flag for review (minor)',
        'priority_review': 'Priority review (major)',
        'block': 'Block migration (critical)',
    }

    for action, count in sorted(action_counts.items()):
        print(f"    - {action_labels.get(action, action)}: {count}")

    return results


def save_test_report(phase1_results, phase2_results, phase3_results):
    """Save comprehensive test report"""

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_file = Path(OUTPUT_DIR) / f"full_pipeline_test_{timestamp}.json"

    report = {
        'timestamp': datetime.now().isoformat(),
        'test_size': len(phase1_results),
        'phase1_cleanup': phase1_results,
        'phase2_structure': phase2_results,
        'phase3_quality': phase3_results,
    }

    # Ensure directory exists
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*80}")
    print(f"FULL REPORT SAVED: {report_file}")
    print(f"{'='*80}\n")

    return report_file


def cleanup_test_table(conn, temp_table):
    """Drop test table"""

    print(f"\nCleaning up test table: library.{temp_table}...")

    cur = conn.cursor()
    cur.execute(f"DROP TABLE IF EXISTS library.{temp_table}")
    conn.commit()
    cur.close()

    print(f"  ✓ Test table dropped")


def main():
    """Run full migration pipeline test"""

    print(f"\n{'='*80}")
    print("FULL MIGRATION PIPELINE TEST")
    print(f"Testing all 3 phases on {SAMPLE_SIZE} sample documents")
    print(f"{'='*80}\n")

    # Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)

    try:
        # Step 1: Select diverse test sample
        test_ids = select_test_documents(conn)

        # Step 2: Create test copy
        temp_table = create_test_copy(conn, test_ids)

        # Step 3: Run Phase 1 (Cleanup)
        phase1_results = run_phase1_test(conn, temp_table)

        # Step 4: Run Phase 2 (Structure)
        phase2_results = run_phase2_test(conn, temp_table)

        # Step 5: Run Phase 3 (Quality)
        phase3_results = run_phase3_test(conn, temp_table)

        # Step 6: Save comprehensive report
        report_file = save_test_report(phase1_results, phase2_results, phase3_results)

        # Step 7: Cleanup test table
        cleanup_test_table(conn, temp_table)

        # Final summary
        print(f"\n{'='*80}")
        print("TEST PIPELINE COMPLETE")
        print(f"{'='*80}\n")

        print("✅ All 3 phases executed successfully")
        print(f"✅ Test report: {report_file}")
        print("\n📋 NEXT STEPS:")
        print("   1. Review test report for any issues")
        print("   2. If tests pass, proceed to production migration")
        print("   3. Run Phase 1-3 on full dataset (3,859 documents)")
        print("   4. Then execute file-based migration (Phase 4)\n")

        return True

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

        # Try to cleanup on error
        try:
            cleanup_test_table(conn, 'library_documents_test')
        except:
            pass

        return False

    finally:
        conn.close()


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
