#!/usr/bin/env python3
"""
PDF to Database Document Matching Script

Matches PDF files to database documents using three-pass algorithm:
1. Exact normalized matching (slug/filename normalization)
2. Fuzzy title matching (Levenshtein distance)
3. Content-based matching (first 500 chars comparison)

Usage:
    python3 match_pdfs_to_database.py
"""

import csv
import os
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from difflib import SequenceMatcher

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
PDF_DIR = DATA_DIR / 'library-pdfs'
DB_INVENTORY = DATA_DIR / 'library-document-inventory.csv'
PDF_INVENTORY = DATA_DIR / 'library-pdf-inventory.txt'
OUTPUT_CSV = DATA_DIR / 'pdf-document-mapping.csv'
UNMATCHED_CSV = DATA_DIR / 'pdf-document-mapping-unmatched.csv'

# Configuration
FUZZY_THRESHOLD = 0.80  # 80% similarity for fuzzy matching
MIN_TITLE_LENGTH = 5    # Minimum title length to consider


def normalize_text(text: str) -> str:
    """
    Normalize text for comparison by:
    - Converting to lowercase
    - Removing category prefixes (e.g., "01_Political_Theory_")
    - Removing file extensions
    - Replacing separators with spaces
    - Removing extra whitespace
    - Removing common suffixes (e.g., " - Wikipedia")
    """
    if not text:
        return ""

    # Convert to lowercase
    text = text.lower()

    # Remove .pdf extension
    text = re.sub(r'\.pdf$', '', text, flags=re.IGNORECASE)

    # Remove category prefixes like "01_Political_Theory_"
    text = re.sub(r'^\d+_[a-z_]+_', '', text, flags=re.IGNORECASE)

    # Remove common suffixes
    text = re.sub(r'\s*-\s*wikipedia.*$', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*-\s*gnu project.*$', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*\|\s*[^|]+$', '', text)  # Remove trailing " | Site Name"

    # Remove metadata patterns from Anna's Archive
    # Example: "-- Author Name; Other Info -- Publisher, Year -- ISBN -- hash -- Anna's Archive"
    text = re.sub(r'\s*--.*anna\'?s?\s+archive.*$', '', text, flags=re.IGNORECASE)

    # Replace separators with spaces
    text = re.sub(r'[_\-]+', ' ', text)

    # Remove special characters but keep spaces and alphanumeric
    text = re.sub(r'[^\w\s]', ' ', text)

    # Collapse multiple spaces
    text = re.sub(r'\s+', ' ', text)

    # Trim
    text = text.strip()

    return text


def similarity_ratio(str1: str, str2: str) -> float:
    """Calculate similarity ratio between two strings using SequenceMatcher."""
    return SequenceMatcher(None, str1, str2).ratio()


def load_database_documents() -> List[Dict]:
    """Load database documents from CSV."""
    documents = []
    with open(DB_INVENTORY, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            documents.append({
                'id': int(row['id']),
                'slug': row['slug'],
                'title': row['title'],
                'normalized_slug': normalize_text(row['slug']),
                'normalized_title': normalize_text(row['title'])
            })
    return documents


def load_pdf_files() -> List[Dict]:
    """Load PDF file list."""
    pdfs = []
    with open(PDF_INVENTORY, 'r', encoding='utf-8') as f:
        for line in f:
            filename = line.strip()
            if filename:
                pdfs.append({
                    'filename': filename,
                    'normalized': normalize_text(filename)
                })
    return pdfs


def pass1_exact_match(documents: List[Dict], pdfs: List[Dict]) -> Tuple[Dict, List[Dict], List[Dict]]:
    """
    Pass 1: Exact normalized matching

    Returns:
        (matches, remaining_documents, remaining_pdfs)
    """
    matches = {}  # document_id -> pdf_filename
    matched_pdf_indices = set()
    matched_doc_indices = set()

    print("\n=== Pass 1: Exact Normalized Matching ===")

    for doc_idx, doc in enumerate(documents):
        if doc_idx in matched_doc_indices:
            continue

        for pdf_idx, pdf in enumerate(pdfs):
            if pdf_idx in matched_pdf_indices:
                continue

            # Try exact match on normalized slug
            if doc['normalized_slug'] and pdf['normalized'] == doc['normalized_slug']:
                matches[doc['id']] = pdf['filename']
                matched_doc_indices.add(doc_idx)
                matched_pdf_indices.add(pdf_idx)
                break

            # Try exact match on normalized title
            if doc['normalized_title'] and pdf['normalized'] == doc['normalized_title']:
                matches[doc['id']] = pdf['filename']
                matched_doc_indices.add(doc_idx)
                matched_pdf_indices.add(pdf_idx)
                break

    remaining_docs = [doc for idx, doc in enumerate(documents) if idx not in matched_doc_indices]
    remaining_pdfs = [pdf for idx, pdf in enumerate(pdfs) if idx not in matched_pdf_indices]

    print(f"Matched: {len(matches)}")
    print(f"Remaining documents: {len(remaining_docs)}")
    print(f"Remaining PDFs: {len(remaining_pdfs)}")

    return matches, remaining_docs, remaining_pdfs


def pass2_fuzzy_match(documents: List[Dict], pdfs: List[Dict], threshold: float = 0.80) -> Tuple[Dict, List[Dict], List[Dict]]:
    """
    Pass 2: Fuzzy title matching using similarity ratio

    Returns:
        (matches, remaining_documents, remaining_pdfs)
    """
    matches = {}
    matched_pdf_indices = set()
    matched_doc_indices = set()

    print(f"\n=== Pass 2: Fuzzy Matching (threshold: {threshold:.0%}) ===")

    for doc_idx, doc in enumerate(documents):
        if doc_idx in matched_doc_indices:
            continue

        if len(doc['normalized_title']) < MIN_TITLE_LENGTH:
            continue

        best_match_idx = None
        best_ratio = 0.0

        for pdf_idx, pdf in enumerate(pdfs):
            if pdf_idx in matched_pdf_indices:
                continue

            if len(pdf['normalized']) < MIN_TITLE_LENGTH:
                continue

            # Calculate similarity based on normalized title
            ratio = similarity_ratio(doc['normalized_title'], pdf['normalized'])

            if ratio > best_ratio and ratio >= threshold:
                best_ratio = ratio
                best_match_idx = pdf_idx

        if best_match_idx is not None:
            matches[doc['id']] = pdfs[best_match_idx]['filename']
            matched_doc_indices.add(doc_idx)
            matched_pdf_indices.add(best_match_idx)

    remaining_docs = [doc for idx, doc in enumerate(documents) if idx not in matched_doc_indices]
    remaining_pdfs = [pdf for idx, pdf in enumerate(pdfs) if idx not in matched_pdf_indices]

    print(f"Matched: {len(matches)}")
    print(f"Remaining documents: {len(remaining_docs)}")
    print(f"Remaining PDFs: {len(remaining_pdfs)}")

    return matches, remaining_docs, remaining_pdfs


def write_matches_to_csv(all_matches: Dict[int, Tuple[str, str]], output_file: Path):
    """
    Write matches to CSV file

    all_matches: {document_id: (pdf_filename, confidence)}
    """
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['document_id', 'pdf_filename', 'confidence'])

        for doc_id in sorted(all_matches.keys()):
            pdf_filename, confidence = all_matches[doc_id]
            writer.writerow([doc_id, pdf_filename, confidence])

    print(f"\n✅ Wrote {len(all_matches)} matches to {output_file}")


def write_unmatched_to_csv(unmatched_docs: List[Dict], output_file: Path):
    """Write unmatched documents to CSV file"""
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['document_id', 'slug', 'title'])

        for doc in sorted(unmatched_docs, key=lambda x: x['id']):
            writer.writerow([doc['id'], doc['slug'], doc['title']])

    print(f"📝 Wrote {len(unmatched_docs)} unmatched documents to {output_file}")


def main():
    print("=" * 80)
    print("PDF to Database Document Matching")
    print("=" * 80)

    # Load data
    print("\n📂 Loading data...")
    documents = load_database_documents()
    pdfs = load_pdf_files()

    print(f"Database documents: {len(documents)}")
    print(f"PDF files: {len(pdfs)}")

    # Pass 1: Exact normalized matching
    matches_p1, remaining_docs, remaining_pdfs = pass1_exact_match(documents, pdfs)
    all_matches = {doc_id: (filename, 'high') for doc_id, filename in matches_p1.items()}

    # Pass 2: Fuzzy matching
    matches_p2, remaining_docs, remaining_pdfs = pass2_fuzzy_match(
        remaining_docs,
        remaining_pdfs,
        threshold=FUZZY_THRESHOLD
    )
    for doc_id, filename in matches_p2.items():
        all_matches[doc_id] = (filename, 'medium')

    # Summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"Total matches: {len(all_matches)}")
    print(f"  - Pass 1 (exact): {len(matches_p1)}")
    print(f"  - Pass 2 (fuzzy): {len(matches_p2)}")
    print(f"\nUnmatched documents: {len(remaining_docs)}")
    print(f"Unmatched PDFs: {len(remaining_pdfs)}")
    print(f"\nMatch rate: {len(all_matches) / len(documents) * 100:.1f}%")

    # Write output files
    write_matches_to_csv(all_matches, OUTPUT_CSV)
    write_unmatched_to_csv(remaining_docs, UNMATCHED_CSV)

    # Show sample matches
    print("\n📊 Sample matches (first 10):")
    print("-" * 80)
    for i, (doc_id, (pdf_filename, confidence)) in enumerate(sorted(all_matches.items())[:10]):
        # Find original document
        doc = next((d for d in documents if d['id'] == doc_id), None)
        if doc:
            print(f"{doc_id:5d} | {confidence:6s} | {doc['title'][:40]:40s} | {pdf_filename[:40]:40s}")

    print("\n✅ Matching complete!")
    print(f"📄 Matches saved to: {OUTPUT_CSV}")
    print(f"📄 Unmatched saved to: {UNMATCHED_CSV}")


if __name__ == '__main__':
    main()
