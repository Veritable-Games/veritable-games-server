# Linked Documents Implementation Plan

**Status**: Planning Phase
**Created**: 2025-11-08
**Feature**: Manual document linking system with drag-and-drop UI for translations and duplicates

---

## Overview

This document outlines the implementation plan for a **manual document linking system** that allows admins to group related documents (translations, duplicates, different editions) together. The system combines UI patterns from:
- **Gallery album system**: Drag-and-drop to combine documents
- **Wiki category management**: Ctrl+click multi-select for batch operations

---

## Design Decisions Summary

### Terminology
- **Feature Name**: Linked Documents
- **UI Label**: "Linked Documents" or "Document Links"
- **Database**: `linked_document_group_id` field

### Core Behaviors
1. **Exclusive Membership**: Each document can only belong to one linked group
2. **List Display**: Linked groups appear as a single item (like albums hide images)
3. **Display Priority**: Always show English version's metadata when available
4. **Sorting**: Sort by title field (English version if available in group)
5. **Permissions**: Admin-only for creating/managing links

### Visual Design
- **Badge**: Globe icon (🌐) with language codes (EN FR ES)
- **Language Code Order**: Fixed priority (EN first, then FR/ES/DE/RU/ZH/JA, then alphabetical)
- **Drag Feedback**: Gallery-style dashed blue outline on drop target
- **Language Switcher**: Dropdown in header area of document detail page
- **Dropdown Format**: Language only (e.g., "English", "French", "Spanish 1", "Spanish 2")

### Operations
- **Create Group**: Drag document onto another document
- **Add to Group**: Drag document onto existing linked group badge
- **Merge Groups**: Drag group onto another group (or document from one group onto another)
- **Collapse Group**: Ctrl+click group + Delete key (unlinks all, keeps documents)
- **Delete Documents**: Ctrl+click individual docs + Delete key (permanent delete)
- **Batch Collapse**: Select multiple groups + Delete (collapses all)

### Language Tags
- **Creation**: Auto-create on document import based on `language` field
- **Display**: Mixed with regular tags in filter panel
- **Styling**: No special styling (look like normal tags)
- **Purpose**: Filter documents by language + visual indicator

---

## Database Schema Changes

### Migration: Drop translation_group_id, Add linked_document_group_id

**File**: `frontend/migrations/004-add-linked-documents.sql`

```sql
-- Step 1: Drop old translation_group_id column from both collections
ALTER TABLE library_documents DROP COLUMN IF EXISTS translation_group_id;
ALTER TABLE anarchist_documents DROP COLUMN IF EXISTS translation_group_id;

-- Step 2: Add new linked_document_group_id to both tables
-- Use TEXT to support UUIDs or generated IDs
ALTER TABLE library_documents ADD COLUMN linked_document_group_id TEXT DEFAULT NULL;
ALTER TABLE anarchist_documents ADD COLUMN linked_document_group_id TEXT DEFAULT NULL;

-- Step 3: Create indexes for performance
CREATE INDEX idx_library_linked_group ON library_documents(linked_document_group_id);
CREATE INDEX idx_anarchist_linked_group ON anarchist_documents(linked_document_group_id);

-- Step 4: Create linked_document_groups metadata table
CREATE TABLE linked_document_groups (
  id TEXT PRIMARY KEY,                    -- Generated UUID or 'ldg_' + timestamp + random
  created_by INTEGER NOT NULL,            -- User ID who created the link
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Step 5: Add trigger to update updated_at on any document linking change
CREATE TRIGGER update_linked_groups_timestamp
AFTER UPDATE ON linked_document_groups
FOR EACH ROW
BEGIN
  UPDATE linked_document_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

**Group ID Generation Pattern**: `ldg_${Date.now()}_${randomString(8)}`

---

## TypeScript Types

### Update UnifiedDocument Type

**File**: `frontend/src/lib/documents/types.ts`

```typescript
export interface UnifiedDocument {
  // ... existing fields ...
  linked_document_group_id?: string | null;

  // Computed fields for linked documents
  linked_documents?: UnifiedDocument[];  // Other docs in same group
  linked_languages?: string[];            // Language codes in group (for badge)
}

export interface LinkedDocumentGroup {
  id: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  documents: UnifiedDocument[];  // All documents in this group
}
```

### Add Linked Document Service Types

**File**: `frontend/src/lib/documents/types.ts` (add to existing)

```typescript
export interface LinkDocumentsParams {
  documentIds: Array<string | number>;  // IDs of documents to link
  sources: Array<'library' | 'anarchist'>;  // Corresponding sources
}

export interface LinkedDocumentOperationResult {
  success: boolean;
  groupId?: string;
  documents?: UnifiedDocument[];
  error?: string;
}
```

---

## Service Layer Implementation

### UnifiedDocumentService Extensions

**File**: `frontend/src/lib/documents/service.ts`

Add the following methods to `UnifiedDocumentService` class:

```typescript
/**
 * Link multiple documents together in a group
 */
async linkDocuments(params: LinkDocumentsParams): Promise<LinkedDocumentOperationResult> {
  try {
    // 1. Generate group ID
    const groupId = `ldg_${Date.now()}_${this.generateRandomString(8)}`;

    // 2. Get current user ID (from session)
    const userId = await this.getCurrentUserId();

    // 3. Create group metadata
    await dbAdapter.query(
      `INSERT INTO linked_document_groups (id, created_by) VALUES ($1, $2)`,
      [groupId, userId]
    );

    // 4. Update each document with group ID
    for (let i = 0; i < params.documentIds.length; i++) {
      const docId = params.documentIds[i];
      const source = params.sources[i];

      if (source === 'library') {
        await libraryService.updateDocument(docId as number, {
          linked_document_group_id: groupId
        });
      } else {
        await anarchistService.updateDocument(docId as number, {
          linked_document_group_id: groupId
        });
      }
    }

    // 5. Fetch and return updated documents
    const documents = await this.getDocumentsByGroupId(groupId);

    // 6. Invalidate cache
    this.invalidateCache();

    return {
      success: true,
      groupId,
      documents
    };
  } catch (error) {
    console.error('[UnifiedDocumentService] linkDocuments error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Unlink all documents in a group (collapse the group)
 */
async unlinkGroup(groupId: string): Promise<LinkedDocumentOperationResult> {
  try {
    // 1. Set linked_document_group_id to NULL for all documents in group
    await dbAdapter.query(
      `UPDATE library_documents SET linked_document_group_id = NULL
       WHERE linked_document_group_id = $1`,
      [groupId]
    );

    await dbAdapter.query(
      `UPDATE anarchist_documents SET linked_document_group_id = NULL
       WHERE linked_document_group_id = $1`,
      [groupId]
    );

    // 2. Delete group metadata
    await dbAdapter.query(
      `DELETE FROM linked_document_groups WHERE id = $1`,
      [groupId]
    );

    // 3. Invalidate cache
    this.invalidateCache();

    return { success: true };
  } catch (error) {
    console.error('[UnifiedDocumentService] unlinkGroup error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Merge two or more groups together
 */
async mergeGroups(targetGroupId: string, sourceGroupIds: string[]): Promise<LinkedDocumentOperationResult> {
  try {
    // 1. Update all documents from source groups to target group
    for (const sourceGroupId of sourceGroupIds) {
      await dbAdapter.query(
        `UPDATE library_documents SET linked_document_group_id = $1
         WHERE linked_document_group_id = $2`,
        [targetGroupId, sourceGroupId]
      );

      await dbAdapter.query(
        `UPDATE anarchist_documents SET linked_document_group_id = $1
         WHERE linked_document_group_id = $2`,
        [targetGroupId, sourceGroupId]
      );

      // 2. Delete source group metadata
      await dbAdapter.query(
        `DELETE FROM linked_document_groups WHERE id = $1`,
        [sourceGroupId]
      );
    }

    // 3. Update target group timestamp
    await dbAdapter.query(
      `UPDATE linked_document_groups SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [targetGroupId]
    );

    // 4. Fetch merged documents
    const documents = await this.getDocumentsByGroupId(targetGroupId);

    // 5. Invalidate cache
    this.invalidateCache();

    return {
      success: true,
      groupId: targetGroupId,
      documents
    };
  } catch (error) {
    console.error('[UnifiedDocumentService] mergeGroups error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all documents in a linked group
 */
async getDocumentsByGroupId(groupId: string): Promise<UnifiedDocument[]> {
  // Query both collections for documents with this group ID
  const libraryDocs = await dbAdapter.query(
    `SELECT * FROM library_documents WHERE linked_document_group_id = $1`,
    [groupId]
  );

  const anarchistDocs = await dbAdapter.query(
    `SELECT * FROM anarchist_documents WHERE linked_document_group_id = $1`,
    [groupId]
  );

  // Normalize and combine
  const documents = [
    ...libraryDocs.rows.map(doc => ({ ...doc, source: 'library' as const })),
    ...anarchistDocs.rows.map(doc => ({ ...doc, source: 'anarchist' as const }))
  ];

  return documents;
}

/**
 * Get language codes for a linked group (for badge display)
 */
getLanguageCodesForGroup(documents: UnifiedDocument[]): string[] {
  // Extract unique languages
  const languages = new Set<string>();
  const languageCounts = new Map<string, number>();

  for (const doc of documents) {
    const lang = doc.language || 'en';
    languages.add(lang);
    languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
  }

  // Convert to uppercase codes and sort by priority
  const codes = Array.from(languages).map(lang => this.getLanguageCode(lang));

  return this.sortLanguageCodes(codes, languageCounts);
}

/**
 * Convert full language name to 2-letter code
 */
private getLanguageCode(language: string): string {
  const codeMap: Record<string, string> = {
    'english': 'EN',
    'french': 'FR',
    'spanish': 'ES',
    'german': 'DE',
    'russian': 'RU',
    'chinese': 'ZH',
    'japanese': 'JA',
    'italian': 'IT',
    'portuguese': 'PT',
    'polish': 'PL',
    'korean': 'KR',
    'dutch': 'NL',
    // ... add all 27+ languages
  };

  return codeMap[language.toLowerCase()] || language.substring(0, 2).toUpperCase();
}

/**
 * Sort language codes with fixed priority
 */
private sortLanguageCodes(codes: string[], counts: Map<string, number>): string[] {
  const priority = ['EN', 'FR', 'ES', 'DE', 'RU', 'ZH', 'JA'];

  const sorted = codes.sort((a, b) => {
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);

    // Both in priority list - sort by priority
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    // Only a in priority - a comes first
    if (aIndex !== -1) return -1;

    // Only b in priority - b comes first
    if (bIndex !== -1) return 1;

    // Neither in priority - alphabetical
    return a.localeCompare(b);
  });

  return sorted;
}

/**
 * Generate dropdown labels for language switcher
 */
getDropdownLabels(documents: UnifiedDocument[]): Array<{ id: string | number; source: string; label: string }> {
  // Group by language
  const byLanguage = new Map<string, UnifiedDocument[]>();

  for (const doc of documents) {
    const lang = doc.language || 'en';
    if (!byLanguage.has(lang)) {
      byLanguage.set(lang, []);
    }
    byLanguage.get(lang)!.push(doc);
  }

  // Generate labels
  const labels: Array<{ id: string | number; source: string; label: string }> = [];

  for (const [lang, docs] of byLanguage) {
    const langName = this.getLanguageName(lang);

    if (docs.length === 1) {
      // Single document for this language - just show language name
      labels.push({
        id: docs[0].id,
        source: docs[0].source || 'library',
        label: langName
      });
    } else {
      // Multiple documents for this language - number them
      docs.forEach((doc, index) => {
        labels.push({
          id: doc.id,
          source: doc.source || 'library',
          label: `${langName} ${index + 1}`
        });
      });
    }
  }

  // Sort by language priority
  const priority = ['English', 'French', 'Spanish', 'German', 'Russian', 'Chinese', 'Japanese'];
  labels.sort((a, b) => {
    const aLang = a.label.split(' ')[0];
    const bLang = b.label.split(' ')[0];

    const aIndex = priority.indexOf(aLang);
    const bIndex = priority.indexOf(bLang);

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return aLang.localeCompare(bLang);
  });

  return labels;
}

/**
 * Helper to convert language code to full name
 */
private getLanguageName(code: string): string {
  const nameMap: Record<string, string> = {
    'en': 'English',
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    // ... add all languages
  };

  return nameMap[code.toLowerCase()] || code.charAt(0).toUpperCase() + code.slice(1);
}
```

---

## API Routes

### 1. Link Documents

**File**: `frontend/src/app/api/documents/link/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { unifiedDocumentService } from '@/lib/documents/service';
import { getCurrentUser } from '@/lib/auth/session';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // 1. Check admin permission
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { documentIds, sources } = body;

    // 3. Validate input
    if (!Array.isArray(documentIds) || !Array.isArray(sources)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (documentIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Minimum 2 documents required' },
        { status: 400 }
      );
    }

    if (documentIds.length !== sources.length) {
      return NextResponse.json(
        { success: false, error: 'documentIds and sources must match' },
        { status: 400 }
      );
    }

    // 4. Link documents
    const result = await unifiedDocumentService.linkDocuments({
      documentIds,
      sources
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      groupId: result.groupId,
      documents: result.documents
    });

  } catch (error) {
    console.error('[API] Link documents error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});
```

### 2. Unlink Group (Collapse)

**File**: `frontend/src/app/api/documents/unlink/route.ts`

```typescript
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { groupIds } = body;  // Support batch collapse

    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid groupIds' },
        { status: 400 }
      );
    }

    // Unlink each group
    const results = await Promise.all(
      groupIds.map(groupId => unifiedDocumentService.unlinkGroup(groupId))
    );

    const failures = results.filter(r => !r.success);

    if (failures.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Failed to unlink ${failures.length} groups`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Unlinked ${groupIds.length} groups`
    });

  } catch (error) {
    console.error('[API] Unlink groups error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});
```

### 3. Merge Groups

**File**: `frontend/src/app/api/documents/merge/route.ts`

```typescript
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetGroupId, sourceGroupIds } = body;

    if (!targetGroupId || !Array.isArray(sourceGroupIds)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const result = await unifiedDocumentService.mergeGroups(
      targetGroupId,
      sourceGroupIds
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      groupId: result.groupId,
      documents: result.documents
    });

  } catch (error) {
    console.error('[API] Merge groups error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});
```

---

## Frontend Components

### 1. LinkedDocumentBadge Component

**File**: `frontend/src/components/documents/LinkedDocumentBadge.tsx`

```typescript
'use client';

import React from 'react';

interface LinkedDocumentBadgeProps {
  languageCodes: string[];  // ['EN', 'FR', 'ES']
}

export function LinkedDocumentBadge({ languageCodes }: LinkedDocumentBadgeProps) {
  if (languageCodes.length === 0) return null;

  return (
    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-blue-600/90 px-2 py-1 shadow-lg backdrop-blur-sm">
      {/* Globe icon */}
      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>

      {/* Language codes */}
      <span className="text-xs font-semibold text-white">
        {languageCodes.join(' ')}
      </span>
    </div>
  );
}
```

### 2. LanguageSwitcher Component (Enhanced)

**File**: `frontend/src/components/documents/LanguageSwitcher.tsx` (update existing)

Add support for dropdown labels with numbering:

```typescript
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface LanguageSwitcherProps {
  currentDocumentId: string | number;
  currentSource: 'library' | 'anarchist';
  availableVersions: Array<{
    id: string | number;
    source: 'library' | 'anarchist';
    label: string;  // e.g., "English", "French", "Spanish 1", "Spanish 2"
  }>;
}

export function LanguageSwitcher({
  currentDocumentId,
  currentSource,
  availableVersions
}: LanguageSwitcherProps) {
  const router = useRouter();

  if (availableVersions.length <= 1) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = availableVersions.find(v =>
      `${v.source}-${v.id}` === e.target.value
    );

    if (selected) {
      // Navigate to the selected document
      router.push(`/library/${selected.source}-${selected.id}`);
    }
  };

  const currentValue = `${currentSource}-${currentDocumentId}`;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-switcher" className="text-sm font-medium text-gray-400">
        Available in:
      </label>
      <select
        id="language-switcher"
        value={currentValue}
        onChange={handleChange}
        className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {availableVersions.map(version => (
          <option
            key={`${version.source}-${version.id}`}
            value={`${version.source}-${version.id}`}
          >
            {version.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 3. LibraryPageClient Component (Enhanced)

**File**: `frontend/src/app/library/LibraryPageClient.tsx`

Add drag-and-drop for linking, ctrl+click selection, and badge display:

```typescript
'use client';

import React, { useState, useCallback, useTransition } from 'react';
import { LinkedDocumentBadge } from '@/components/documents/LinkedDocumentBadge';
import { unifiedDocumentService } from '@/lib/documents/service';
import type { UnifiedDocument } from '@/lib/documents/types';

export default function LibraryPageClient({
  initialDocuments
}: {
  initialDocuments: UnifiedDocument[]
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Get display items (groups as single items, standalone docs)
  const displayItems = useCallback(() => {
    const grouped = new Map<string, UnifiedDocument[]>();
    const standalone: UnifiedDocument[] = [];

    // Group documents
    for (const doc of documents) {
      if (doc.linked_document_group_id) {
        if (!grouped.has(doc.linked_document_group_id)) {
          grouped.set(doc.linked_document_group_id, []);
        }
        grouped.get(doc.linked_document_group_id)!.push(doc);
      } else {
        standalone.push(doc);
      }
    }

    // Create display items
    const items: Array<UnifiedDocument | { type: 'group'; groupId: string; documents: UnifiedDocument[] }> = [];

    // Add groups (show English version or first doc)
    for (const [groupId, docs] of grouped) {
      const englishDoc = docs.find(d => d.language === 'en' || d.language === 'english');
      const displayDoc = englishDoc || docs[0];

      const languageCodes = unifiedDocumentService.getLanguageCodesForGroup(docs);

      items.push({
        type: 'group',
        groupId,
        documents: docs,
        ...displayDoc,  // Spread display document's fields
        linked_languages: languageCodes
      });
    }

    // Add standalone documents
    items.push(...standalone);

    return items;
  }, [documents]);

  // Drag handlers
  const handleDragStart = (id: string, isGroup: boolean) => {
    if (isGroup) {
      setDraggedGroupId(id);
    } else {
      setDraggedDocId(id);
    }
  };

  const handleDragOver = (targetId: string) => {
    setDropTargetId(targetId);
  };

  const handleDrop = async (targetId: string) => {
    setDropTargetId(null);

    // Case 1: Dragging document onto document (create new group)
    if (draggedDocId && !draggedGroupId) {
      await executeLinkDocuments([draggedDocId, targetId]);
    }

    // Case 2: Dragging document onto group (add to group) - handled by merge
    // Case 3: Dragging group onto group (merge groups)
    if (draggedGroupId) {
      const draggedItem = displayItems().find(item =>
        item.type === 'group' && item.groupId === draggedGroupId
      );
      const targetItem = displayItems().find(item =>
        item.type === 'group' && item.groupId === targetId
      );

      if (draggedItem && targetItem) {
        await executeMergeGroups(targetId, [draggedGroupId]);
      }
    }

    setDraggedDocId(null);
    setDraggedGroupId(null);
  };

  // Execute operations
  const executeLinkDocuments = async (docIds: string[]) => {
    startTransition(async () => {
      const response = await fetch('/api/documents/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: docIds,
          sources: docIds.map(() => 'library')  // TODO: track actual sources
        })
      });

      const result = await response.json();

      if (result.success) {
        // Refresh documents
        // TODO: Implement refresh logic
      }
    });
  };

  const executeMergeGroups = async (targetGroupId: string, sourceGroupIds: string[]) => {
    startTransition(async () => {
      const response = await fetch('/api/documents/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGroupId, sourceGroupIds })
      });

      const result = await response.json();

      if (result.success) {
        // Refresh documents
      }
    });
  };

  const executeCollapseGroups = async (groupIds: string[]) => {
    startTransition(async () => {
      const response = await fetch('/api/documents/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds })
      });

      const result = await response.json();

      if (result.success) {
        // Refresh documents
      }
    });
  };

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete') {
      if (selectedGroupIds.size > 0) {
        // Collapse groups
        executeCollapseGroups(Array.from(selectedGroupIds));
        setSelectedGroupIds(new Set());
      } else if (selectedDocIds.size > 0) {
        // Delete documents
        // TODO: Implement delete
      }
    }

    if (e.key === 'Escape') {
      setSelectedDocIds(new Set());
      setSelectedGroupIds(new Set());
    }
  }, [selectedDocIds, selectedGroupIds]);

  // Render
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {displayItems().map(item => (
        <DocumentCard
          key={item.type === 'group' ? item.groupId : item.id}
          item={item}
          isSelected={
            item.type === 'group'
              ? selectedGroupIds.has(item.groupId)
              : selectedDocIds.has(String(item.id))
          }
          onDragStart={() => handleDragStart(
            item.type === 'group' ? item.groupId : String(item.id),
            item.type === 'group'
          )}
          onDragOver={() => handleDragOver(
            item.type === 'group' ? item.groupId : String(item.id)
          )}
          onDrop={() => handleDrop(
            item.type === 'group' ? item.groupId : String(item.id)
          )}
          showDropZone={dropTargetId === (item.type === 'group' ? item.groupId : String(item.id))}
        />
      ))}
    </div>
  );
}
```

---

## Implementation Phases

### Phase 1: Database & Backend (Week 1)
1. Create and run migration `004-add-linked-documents.sql`
2. Update TypeScript types in `types.ts`
3. Implement service layer methods in `UnifiedDocumentService`
4. Create API routes: `/api/documents/link`, `/api/documents/unlink`, `/api/documents/merge`
5. Test API routes with Postman/curl

### Phase 2: Basic UI Components (Week 1-2)
1. Create `LinkedDocumentBadge` component
2. Update `LanguageSwitcher` component for dropdown labels
3. Update document card to show badge when linked
4. Test badge display and language switcher

### Phase 3: Drag-and-Drop (Week 2)
1. Add drag state management to `LibraryPageClient`
2. Implement drag event handlers
3. Add visual feedback (dashed blue outline)
4. Implement drop logic (create/merge/add to group)
5. Test all drag-and-drop scenarios

### Phase 4: Selection & Keyboard (Week 2)
1. Add ctrl+click selection state
2. Implement keyboard event handlers (Delete, Escape)
3. Add batch operations (collapse multiple groups)
4. Visual selection indicators

### Phase 5: Language Tags (Week 3)
1. Create script to auto-generate language tags from document.language field
2. Add language tags to tag filter panel
3. Test filtering by language tags
4. Ensure tags sync when documents imported

### Phase 6: Polish & Testing (Week 3)
1. Test all edge cases (merge groups, collapse, delete, re-link)
2. Performance testing with large groups
3. Accessibility (keyboard navigation, screen readers)
4. Documentation updates

### Phase 7: Anarchist Tag Import (Week 4)
1. Run anarchist tag categorization script
2. Import categorized tags to database
3. Test tag filtering across both collections

---

## Testing Checklist

### Database
- [ ] Migration runs successfully on fresh database
- [ ] Migration runs successfully on database with existing data
- [ ] Indexes created correctly
- [ ] Foreign keys work (cascade delete)
- [ ] Group ID generation is unique

### Service Layer
- [ ] Link 2 documents creates group
- [ ] Link 3+ documents creates group
- [ ] Unlink group removes all documents from group
- [ ] Merge groups combines all documents
- [ ] Language codes sorted correctly
- [ ] Dropdown labels generated correctly (with numbering)
- [ ] English version displayed when available
- [ ] Cache invalidation works

### API Routes
- [ ] Admin-only enforcement works
- [ ] Link API creates group
- [ ] Unlink API collapses group
- [ ] Merge API combines groups
- [ ] Batch collapse works
- [ ] Error handling returns proper status codes
- [ ] CSRF protection active

### UI Components
- [ ] Badge shows globe icon + language codes
- [ ] Language codes in correct order (EN first)
- [ ] Language switcher dropdown works
- [ ] Dropdown shows correct labels (English, Spanish 1, Spanish 2)
- [ ] Clicking group opens English version
- [ ] Drag visual feedback appears
- [ ] Drop creates/merges correctly
- [ ] Ctrl+click selection works
- [ ] Delete key collapses groups
- [ ] Delete key deletes individual docs
- [ ] Escape clears selection
- [ ] Batch operations work
- [ ] Loading states show during operations

### Edge Cases
- [ ] Linking already-linked documents merges groups
- [ ] Dragging group onto group merges
- [ ] Collapsing group unlinks all documents
- [ ] Deleting individual document from group removes from group
- [ ] Groups with no English version show correct fallback
- [ ] Multiple documents same language get numbered correctly
- [ ] Tag filtering works with linked documents
- [ ] Search works with linked documents
- [ ] Sorting works (by English title when available)

---

## Next Steps After Implementation

1. **Import anarchist tags with categorization** (existing todo item)
2. **User language preference** (future enhancement)
3. **Translation suggestions** (future: show "Similar documents in other languages")
4. **Bulk import tool** (for quickly linking large sets of known translations)
5. **Export/audit tool** (generate report of all linked groups for review)

---

## Notes & Considerations

- **Performance**: With 24,643 documents, grouping queries need to be efficient. Consider pagination and caching.
- **Migration Risk**: Dropping `translation_group_id` means any existing data is lost. If data exists, export first.
- **Source Tracking**: Documents from different sources (library vs anarchist vs marxists) can be linked together.
- **Future-Proofing**: Simple group ID approach is easier than junction table, but less flexible for metadata.
- **UI Consistency**: Using gallery album patterns ensures familiar UX for users already using the gallery feature.

---

**End of Implementation Plan**
