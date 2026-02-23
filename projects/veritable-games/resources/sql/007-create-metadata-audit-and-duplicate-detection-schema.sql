-- Migration: 007-create-metadata-audit-and-duplicate-detection-schema.sql
-- Purpose: Create tables for metadata audit system and duplicate detection
-- Created: February 23, 2026

-- ============================================================================
-- PART 1: METADATA AUDIT SYSTEM
-- ============================================================================

-- Create library schema if it doesn't exist (should exist but be safe)
CREATE SCHEMA IF NOT EXISTS library;

-- Metadata audit log table - tracks quality assessment and review status
CREATE TABLE IF NOT EXISTS library.metadata_audit_log (
    id SERIAL PRIMARY KEY,
    schema_name TEXT NOT NULL,                    -- 'library', 'anarchist', 'youtube', 'marxist'
    document_id INTEGER NOT NULL,
    document_slug TEXT NOT NULL,
    audit_status TEXT DEFAULT 'pending',          -- pending, in_review, reviewed, fixed, skipped
    quality_score INTEGER,                        -- 0-100 quality score
    issues_detected JSONB,                        -- JSON array of detected issues
    issues_count INTEGER DEFAULT 0,               -- Denormalized count for faster queries
    audited_by TEXT,                              -- User who performed the audit
    audited_at TIMESTAMP,
    notes TEXT,                                   -- Reviewer notes
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(schema_name, document_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_status ON library.metadata_audit_log(audit_status);
CREATE INDEX IF NOT EXISTS idx_quality_score ON library.metadata_audit_log(quality_score);
CREATE INDEX IF NOT EXISTS idx_schema_status ON library.metadata_audit_log(schema_name, audit_status);
CREATE INDEX IF NOT EXISTS idx_issues_count ON library.metadata_audit_log(issues_count);

-- ============================================================================
-- PART 2: DUPLICATE DETECTION SYSTEM
-- ============================================================================

-- Create shared schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS shared;

-- Document fingerprints table - stores hashes and signatures for duplicate detection
CREATE TABLE IF NOT EXISTS shared.document_fingerprints (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL,                        -- 'library', 'anarchist', 'youtube', 'marxist'
    source_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    content_md5 TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    normalized_content_md5 TEXT NOT NULL,        -- MD5 of normalized content
    title_normalized TEXT NOT NULL,
    title_soundex TEXT,                          -- Soundex hash of normalized title
    author_soundex TEXT,                         -- Soundex hash of author
    simhash_64bit BIGINT,                        -- 64-bit SimHash fingerprint
    word_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_content_md5 ON shared.document_fingerprints(content_md5);
CREATE INDEX IF NOT EXISTS idx_content_sha256 ON shared.document_fingerprints(content_sha256);
CREATE INDEX IF NOT EXISTS idx_normalized_md5 ON shared.document_fingerprints(normalized_content_md5);
CREATE INDEX IF NOT EXISTS idx_title_soundex ON shared.document_fingerprints(title_soundex);
CREATE INDEX IF NOT EXISTS idx_author_soundex ON shared.document_fingerprints(author_soundex);
CREATE INDEX IF NOT EXISTS idx_source ON shared.document_fingerprints(source);

-- Duplicate clusters table - groups of documents identified as duplicates
CREATE TABLE IF NOT EXISTS shared.duplicate_clusters (
    id SERIAL PRIMARY KEY,
    cluster_type TEXT NOT NULL,                  -- 'exact_match', 'fuzzy_match', 'near_duplicate'
    confidence_score DECIMAL(3,2) NOT NULL,     -- 0.00 to 1.00
    review_status TEXT DEFAULT 'pending',       -- 'pending', 'confirmed', 'false_positive', 'merged'
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    canonical_fingerprint_id INTEGER,           -- Which document to keep
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_type ON shared.duplicate_clusters(cluster_type);
CREATE INDEX IF NOT EXISTS idx_confidence_score ON shared.duplicate_clusters(confidence_score);
CREATE INDEX IF NOT EXISTS idx_review_status ON shared.duplicate_clusters(review_status);

-- Cluster documents junction table - documents in a duplicate cluster
CREATE TABLE IF NOT EXISTS shared.cluster_documents (
    cluster_id INTEGER NOT NULL REFERENCES shared.duplicate_clusters(id) ON DELETE CASCADE,
    fingerprint_id INTEGER NOT NULL REFERENCES shared.document_fingerprints(id) ON DELETE CASCADE,
    is_canonical BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (cluster_id, fingerprint_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_documents_cluster ON shared.cluster_documents(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_documents_fingerprint ON shared.cluster_documents(fingerprint_id);

-- ============================================================================
-- PART 3: CLEANUP TRACKING
-- ============================================================================

-- Add columns to library.library_documents for cleanup tracking
-- (This assumes the table exists; if not, it will fail and can be added manually)
ALTER TABLE library.library_documents
ADD COLUMN IF NOT EXISTS cleanup_tier INTEGER,      -- 1, 2, or 3 (null = not cleaned)
ADD COLUMN IF NOT EXISTS cleanup_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS cleanup_artifacts JSONB;   -- Track what was removed

-- Add indexes for cleanup operations
CREATE INDEX IF NOT EXISTS idx_cleanup_tier ON library.library_documents(cleanup_tier)
WHERE cleanup_date IS NULL;

-- ============================================================================
-- PART 4: AUDIT METADATA SNAPSHOT
-- ============================================================================

-- Store snapshots of audit rounds for version control and rollback
CREATE TABLE IF NOT EXISTS library.audit_checkpoints (
    id SERIAL PRIMARY KEY,
    round_number INTEGER NOT NULL,
    round_name TEXT NOT NULL,
    total_documents INTEGER,
    pending_count INTEGER,
    reviewed_count INTEGER,
    fixed_count INTEGER,
    skipped_count INTEGER,
    average_quality_score DECIMAL(5,2),
    checkpoint_data JSONB,                       -- Full checkpoint data as JSON
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_round_number ON library.audit_checkpoints(round_number);

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- METADATA AUDIT:
-- - library.metadata_audit_log: 1 row per document, tracks quality and review status

-- DUPLICATE DETECTION:
-- - shared.document_fingerprints: Hashes and signatures for each document
-- - shared.duplicate_clusters: Groups of identified duplicates
-- - shared.cluster_documents: Junction table linking documents to clusters

-- CLEANUP TRACKING:
-- - library.library_documents.cleanup_* columns: Track cleanup operations per document

-- AUDIT CHECKPOINTS:
-- - library.audit_checkpoints: Versioned snapshots of audit progress
