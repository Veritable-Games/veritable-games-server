#!/usr/bin/env node
/**
 * Gallery Database-Disk Audit Script
 *
 * Audits ALL gallery projects to find database-disk discrepancies.
 * For each project in both references and concept-art:
 * - Count files on disk (actual directory listing)
 * - Count DB records (total, active, soft-deleted)
 * - Calculate mismatch: files_on_disk - total_db_records
 * - Classify severity
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database and upload paths
const DB_PATH = path.join(__dirname, '../data/content.db');
const UPLOADS_BASE = path.join(__dirname, '../public/uploads');

// Initialize database
const db = new Database(DB_PATH, { readonly: true });

// Projects to check
const PROJECTS = [
  'autumn',
  'cosmic-knights',
  'dodec',
  'enact-dialogue-system',
  'noxii',
  'on-command',
  'project-coalesce',
];
const GALLERY_TYPES = ['references', 'concept-art'];

// Image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * Count files on disk for a project/gallery
 */
function countFilesOnDisk(projectSlug, galleryType) {
  const uploadPath = path.join(UPLOADS_BASE, galleryType, projectSlug);

  if (!fs.existsSync(uploadPath)) {
    return 0;
  }

  try {
    const files = fs.readdirSync(uploadPath);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return IMAGE_EXTENSIONS.includes(ext);
    });
    return imageFiles.length;
  } catch (error) {
    console.error(`Error reading directory ${uploadPath}:`, error.message);
    return 0;
  }
}

/**
 * Count database records for a project/gallery
 */
function countDatabaseRecords(projectSlug, galleryType) {
  try {
    // Total records (including soft-deleted)
    const totalRow = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM project_reference_images pri
      JOIN projects p ON pri.project_id = p.id
      WHERE p.slug = ? AND pri.gallery_type = ?
    `
      )
      .get(projectSlug, galleryType);

    // Active records only
    const activeRow = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM project_reference_images pri
      JOIN projects p ON pri.project_id = p.id
      WHERE p.slug = ? AND pri.gallery_type = ? AND pri.is_deleted = 0
    `
      )
      .get(projectSlug, galleryType);

    // Soft-deleted records
    const deletedRow = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM project_reference_images pri
      JOIN projects p ON pri.project_id = p.id
      WHERE p.slug = ? AND pri.gallery_type = ? AND pri.is_deleted = 1
    `
      )
      .get(projectSlug, galleryType);

    return {
      total: totalRow.count,
      active: activeRow.count,
      deleted: deletedRow.count,
    };
  } catch (error) {
    console.error(`Error querying database for ${projectSlug}/${galleryType}:`, error.message);
    return { total: 0, active: 0, deleted: 0 };
  }
}

/**
 * Classify severity based on orphan count
 */
function classifySeverity(orphanCount) {
  if (orphanCount === 0) return 'SYNCED';
  if (orphanCount < 10) return 'LOW';
  if (orphanCount < 50) return 'MEDIUM';
  if (orphanCount < 200) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Main audit function
 */
function auditGalleries() {
  console.log('='.repeat(100));
  console.log('GALLERY DATABASE-DISK AUDIT');
  console.log('='.repeat(100));
  console.log('');

  const results = [];

  // Audit each project and gallery type
  for (const galleryType of GALLERY_TYPES) {
    for (const projectSlug of PROJECTS) {
      const filesOnDisk = countFilesOnDisk(projectSlug, galleryType);
      const dbRecords = countDatabaseRecords(projectSlug, galleryType);
      const orphanCount = filesOnDisk - dbRecords.total;
      const severity = classifySeverity(orphanCount);

      results.push({
        project: projectSlug,
        gallery: galleryType,
        filesOnDisk,
        dbTotal: dbRecords.total,
        dbActive: dbRecords.active,
        dbDeleted: dbRecords.deleted,
        orphanCount,
        severity,
      });
    }
  }

  // Sort by severity (CRITICAL first, then HIGH, MEDIUM, LOW, SYNCED)
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, SYNCED: 4 };
  results.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    // Within same severity, sort by orphan count descending
    return b.orphanCount - a.orphanCount;
  });

  // Print results table
  console.log(
    'Project'.padEnd(25) +
      'Gallery'.padEnd(15) +
      'Disk'.padEnd(8) +
      'DB Total'.padEnd(10) +
      'DB Active'.padEnd(11) +
      'DB Deleted'.padEnd(12) +
      'Orphans'.padEnd(10) +
      'Severity'
  );
  console.log('-'.repeat(100));

  for (const result of results) {
    const projectDisplay = result.project.padEnd(25);
    const galleryDisplay = result.gallery.padEnd(15);
    const diskDisplay = String(result.filesOnDisk).padEnd(8);
    const totalDisplay = String(result.dbTotal).padEnd(10);
    const activeDisplay = String(result.dbActive).padEnd(11);
    const deletedDisplay = String(result.dbDeleted).padEnd(12);
    const orphanDisplay = String(result.orphanCount).padEnd(10);
    const severityDisplay = result.severity;

    console.log(
      projectDisplay +
        galleryDisplay +
        diskDisplay +
        totalDisplay +
        activeDisplay +
        deletedDisplay +
        orphanDisplay +
        severityDisplay
    );
  }

  console.log('');
  console.log('='.repeat(100));

  // Summary statistics
  const totalOrphans = results.reduce((sum, r) => sum + r.orphanCount, 0);
  const totalFilesOnDisk = results.reduce((sum, r) => sum + r.filesOnDisk, 0);
  const totalDbRecords = results.reduce((sum, r) => sum + r.dbTotal, 0);
  const criticalCount = results.filter(r => r.severity === 'CRITICAL').length;
  const highCount = results.filter(r => r.severity === 'HIGH').length;
  const mediumCount = results.filter(r => r.severity === 'MEDIUM').length;
  const lowCount = results.filter(r => r.severity === 'LOW').length;
  const syncedCount = results.filter(r => r.severity === 'SYNCED').length;

  console.log('SUMMARY:');
  console.log(`  Total Files on Disk: ${totalFilesOnDisk}`);
  console.log(`  Total DB Records: ${totalDbRecords}`);
  console.log(`  Total Orphaned Files: ${totalOrphans}`);
  console.log(`  Orphan Rate: ${((totalOrphans / totalFilesOnDisk) * 100).toFixed(1)}%`);
  console.log('');
  console.log('SEVERITY BREAKDOWN:');
  console.log(`  CRITICAL (>200 orphans): ${criticalCount} galleries`);
  console.log(`  HIGH (50-200 orphans): ${highCount} galleries`);
  console.log(`  MEDIUM (10-50 orphans): ${mediumCount} galleries`);
  console.log(`  LOW (<10 orphans): ${lowCount} galleries`);
  console.log(`  SYNCED (0 orphans): ${syncedCount} galleries`);
  console.log('');

  // Detailed breakdown for CRITICAL and HIGH severity
  const problemGalleries = results.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH');
  if (problemGalleries.length > 0) {
    console.log('PROBLEM GALLERIES (CRITICAL/HIGH):');
    for (const result of problemGalleries) {
      console.log(
        `  ${result.project}/${result.gallery}: ${result.orphanCount} orphans (${result.filesOnDisk} files, ${result.dbTotal} DB records)`
      );
    }
  }

  console.log('='.repeat(100));
}

// Run audit
try {
  auditGalleries();
} catch (error) {
  console.error('Audit failed:', error);
  process.exit(1);
} finally {
  db.close();
}
