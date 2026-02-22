# Markdown Editor Integration for Forums
**Created:** October 12, 2025
**Purpose:** Integration guide for using existing markdown editors in forums

---

## Executive Summary

**GREAT NEWS:** You already have a **production-ready markdown editor** used across wiki and library! No need to build from scratch - just integrate the existing `MarkdownEditor` component.

---

## Current Markdown Editor Architecture

### 🎯 Primary Editor: MarkdownEditor.tsx
**Location:** `/frontend/src/components/editor/MarkdownEditor.tsx`
**Lines of Code:** 588
**Used By:** Wiki, Library

**Features:**
- ✅ Full markdown toolbar (bold, italic, link, code, etc.)
- ✅ Preview mode (side-by-side or toggle)
- ✅ Fullscreen mode
- ✅ Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+S)
- ✅ Wiki links support: `[[Page Name]]` → auto-links to wiki
- ✅ Library links: `[[library:Document Name]]` → links to library
- ✅ Infobox templates (10 types: character, enemy, item, weapon, armor, location, quest, skill, faction, vehicle)
- ✅ Slash commands: Type `/` for quick insertion
- ✅ Heading dropdowns (H1-H6)
- ✅ List support (bullet, numbered, task lists)
- ✅ Table insertion
- ✅ Horizontal rules
- ✅ Quote blocks
- ✅ Built-in markdown → HTML converter
- ✅ DOMPurify sanitization
- ✅ Character/line counter
- ✅ F1 for shortcuts help
- ✅ Mobile-responsive with touch targets

**Props Interface:**
```typescript
interface MarkdownEditorProps {
  initialContent?: string;
  placeholder?: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  height?: string;
  readOnly?: boolean;
  showPreview?: boolean;
  showToolbar?: boolean;
  className?: string;
  onAddInfobox?: () => void;
}
```

### 🔄 Alternative: HybridMarkdownEditor.tsx
**Location:** `/frontend/src/components/editor/HybridMarkdownEditor.tsx`
**Lines of Code:** 430
**Used By:** Reply forms (potentially)

**Features:**
- ✅ Write/Preview tabs (cleaner than side-by-side)
- ✅ Built-in submit button
- ✅ Simpler toolbar
- ✅ Character counter
- ✅ Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K)
- ✅ Mobile-friendly

**Props Interface:**
```typescript
interface HybridMarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}
```

### 🚀 Workspace: RichTextEditor.tsx (Tiptap)
**Location:** `/frontend/src/components/workspace/RichTextEditor.tsx`
**Lines of Code:** 88
**Used By:** Project workspace (WYSIWYG needs)

**Features:**
- ✅ Tiptap-based rich text (NOT markdown)
- ✅ WYSIWYG editing
- ✅ Color and alignment support

**Not recommended for forums** (markdown is better for community content)

---

## Current Usage Patterns

### Wiki Pages
**Edit Page:** `/app/wiki/[slug]/edit/page.tsx`

```typescript
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';

export default function WikiEditPage() {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    tags: '',
    summary: '',
  });

  return (
    <MarkdownEditor
      initialContent={formData.content}
      onChange={(content) => setFormData({ ...formData, content })}
      onSave={handleSave}
      height="600px"
      showPreview={true}
      showToolbar={true}
      placeholder="Enter wiki content in Markdown..."
    />
  );
}
```

### Library Documents
**Edit Page:** `/app/library/[slug]/edit/page.tsx`

```typescript
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';

export default function LibraryEditPage() {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'library',
    tags: '',
  });

  return (
    <MarkdownEditor
      initialContent={formData.content}
      onChange={(content) => setFormData({ ...formData, content })}
      onSave={handleSave}
      height="600px"
      showPreview={true}
      showToolbar={true}
      placeholder="Enter library content..."
    />
  );
}
```

---

## Forum Integration Strategy

### Recommendation: Use MarkdownEditor for Topics, HybridMarkdownEditor for Replies

**Why?**
1. **Topics need full features** - Infoboxes, wiki links, complex formatting
2. **Replies need simplicity** - Quick formatting, submit button, tab-based preview
3. **Consistency** - Same editor as wiki/library for topics
4. **Mobile-friendly** - Both have responsive designs

---

## Implementation Plan

### ✅ Step 1: Replace TopicEditor.tsx Content Editor

**Current State:** Basic `<textarea>` in TopicEditor.tsx (line 100+)

**New Implementation:**

```typescript
// /src/components/forums/TopicEditor.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'; // Import existing editor
import { fetchJSON } from '@/lib/utils/csrf';
import toast from '@/lib/utils/toast';

interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
}

interface TopicEditorProps {
  categoryId?: number;
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  onClose: () => void;
  onSuccess: (topicId: number) => void;
}

export default function TopicEditor({
  categoryId,
  initialTitle = '',
  initialContent = '',
  initialTags = [],
  onClose,
  onSuccess,
}: TopicEditorProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(categoryId || null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetchJSON('/api/forums/categories');
      if (response.success && response.data) {
        setCategories(response.data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && tags.length < 10) {
      const newTag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async () => {
    // Check if user is logged in
    if (!user) {
      toast.error('You must be logged in to create a topic');
      return;
    }

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }

    if (!selectedCategory) {
      toast.error('Please select a category');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchJSON('/api/forums/topics', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category_id: selectedCategory,
          tags: tags,
        }),
      });

      if (response.success && response.data?.topic) {
        toast.success('Topic created successfully!');
        onSuccess(response.data.topic.id);
      } else {
        throw new Error(response.error || 'Failed to create topic');
      }
    } catch (error: any) {
      console.error('Error creating topic:', error);
      toast.error(error.message || 'Failed to create topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Create New Topic</h2>

      {/* Title Input */}
      <div className="mb-6">
        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter topic title (3-200 characters)"
          maxLength={200}
        />
      </div>

      {/* Category Selection */}
      <div className="mb-6">
        <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
          Category
        </label>
        <select
          id="category"
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(Number(e.target.value))}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Markdown Editor */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Content
        </label>
        <MarkdownEditor
          initialContent={content}
          onChange={setContent}
          onSave={handleSubmit}
          height="400px"
          showPreview={true}
          showToolbar={true}
          placeholder="Write your topic content in Markdown... Use [[wiki links]] to reference wiki pages!"
          className="rounded-lg overflow-hidden"
        />
      </div>

      {/* Tags */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Tags (optional, max 10)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter a tag and press Enter"
            disabled={tags.length >= 10}
          />
          <button
            onClick={handleAddTag}
            disabled={tags.length >= 10}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Add Tag
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-sm"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Topic'}
        </button>
      </div>
    </div>
  );
}
```

### ✅ Step 2: Use HybridMarkdownEditor for Reply Forms

**Location:** `/src/components/forums/ReplyForm.tsx` (create if doesn't exist)

```typescript
// /src/components/forums/ReplyForm.tsx
'use client';

import React, { useState } from 'react';
import { HybridMarkdownEditor } from '@/components/editor/HybridMarkdownEditor';
import { fetchJSON } from '@/lib/utils/csrf';
import toast from '@/lib/utils/toast';

interface ReplyFormProps {
  topicId: number;
  parentId?: number | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ReplyForm({
  topicId,
  parentId = null,
  onSuccess,
  onCancel,
}: ReplyFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Reply content is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchJSON('/api/forums/replies', {
        method: 'POST',
        body: JSON.stringify({
          topic_id: topicId,
          parent_id: parentId,
          content: content.trim(),
        }),
      });

      if (response.success) {
        toast.success('Reply posted successfully!');
        setContent('');
        onSuccess?.();
      } else {
        throw new Error(response.error || 'Failed to post reply');
      }
    } catch (error: any) {
      console.error('Error posting reply:', error);
      toast.error(error.message || 'Failed to post reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <HybridMarkdownEditor
        content={content}
        onChange={setContent}
        placeholder={parentId ? 'Write your reply...' : 'Write your comment...'}
        rows={6}
        autoFocus={true}
        onSubmit={handleSubmit}
        submitLabel={isSubmitting ? 'Posting...' : 'Post Reply'}
        submitDisabled={isSubmitting || !content.trim()}
      />
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 px-4 py-2 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
```

---

## Feature Comparison

| Feature | MarkdownEditor | HybridMarkdownEditor | Recommendation |
|---------|----------------|----------------------|----------------|
| **Full Toolbar** | ✅ | ✅ (Simplified) | Topics: Full, Replies: Simple |
| **Preview Mode** | ✅ Side-by-side | ✅ Tab-based | Topics: Side-by-side, Replies: Tabs |
| **Fullscreen** | ✅ | ❌ | Topics only |
| **Wiki Links** | ✅ `[[wiki]]` | ❌ | Topics only (can add if needed) |
| **Infoboxes** | ✅ 10 types | ❌ | Topics only |
| **Slash Commands** | ✅ | ❌ | Topics only |
| **Submit Button** | ❌ | ✅ Built-in | Replies: Built-in better |
| **Mobile Touch Targets** | ✅ 44px | ✅ Compact | Both optimized |
| **Character Counter** | ✅ | ✅ | Both |
| **Keyboard Shortcuts** | ✅ | ✅ | Both |
| **Height Control** | ✅ Prop | ✅ Rows prop | Both |
| **Read-only Mode** | ✅ | ✅ Disabled | Both |

---

## Benefits of This Approach

### ✅ Consistency
- Same editor used across wiki, library, and forums
- Users already familiar with the interface
- Unified experience

### ✅ Feature-Rich
- Wiki links automatically work: `[[Character Name]]` → links to wiki
- Library links: `[[library:Document]]` → links to library
- Infoboxes for game data (character stats, item info, etc.)
- Full markdown support

### ✅ Zero Development Time
- No need to build from scratch
- Already tested and working
- Already integrated with sanitization (DOMPurify)

### ✅ Mobile-Optimized
- Touch-friendly buttons (44px on mobile)
- Responsive toolbar
- Works on all screen sizes

### ✅ Accessibility
- Keyboard shortcuts
- ARIA labels
- Screen reader friendly

---

## Integration Checklist

### Phase 1: Topic Editor (2 hours)
- [x] Analyze existing MarkdownEditor
- [ ] Replace TopicEditor.tsx content textarea with MarkdownEditor
- [ ] Test topic creation with markdown
- [ ] Test wiki links in forum topics
- [ ] Test preview mode
- [ ] Test fullscreen mode
- [ ] Test mobile responsiveness

### Phase 2: Reply Forms (1 hour)
- [ ] Create ReplyForm.tsx with HybridMarkdownEditor
- [ ] Integrate into ReplyList.tsx
- [ ] Test reply creation
- [ ] Test nested reply formatting
- [ ] Test optimistic UI with markdown

### Phase 3: Edit Functionality (1 hour)
- [ ] Add inline editing for topics (use MarkdownEditor)
- [ ] Add inline editing for replies (use HybridMarkdownEditor)
- [ ] Test edit + optimistic updates
- [ ] Test markdown preservation during edits

---

## Code Quality Notes

### ✅ Sanitization Already Handled
Both editors use DOMPurify for XSS protection:
```typescript
// MarkdownEditor.tsx line 472
dangerouslySetInnerHTML={{
  __html: ContentSanitizer.sanitizeHtml(renderedContent, 'safe')
}}
```

### ✅ CSRF Protection Already Integrated
Both use `fetchJSON` from `/lib/utils/csrf.ts`:
```typescript
import { fetchJSON } from '@/lib/utils/csrf';

const response = await fetchJSON('/api/forums/topics', {
  method: 'POST',
  body: JSON.stringify({ ... }),
});
```

### ✅ Mobile-First Design
Toolbar adapts to screen size:
```typescript
// MarkdownEditorToolbar.tsx line 32-42
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth <= 640);
  };
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);
```

---

## Next Steps

1. **Update TopicEditor.tsx** - Replace textarea with MarkdownEditor
2. **Create ReplyForm.tsx** - Use HybridMarkdownEditor
3. **Test Integration** - Verify all features work
4. **Deploy** - Forums will have professional markdown editing!

---

## Additional Features to Consider

### Wiki Links in Forums (Already Supported!)
When users type `[[Character Name]]` in a forum post, it automatically creates a link to the wiki page. This is perfect for game wikis where forum discussions reference game content.

**Example:**
```markdown
I think [[Raven]] is the best character for stealth missions.
Check out the [[Weapons#Silenced Pistol]] guide.
```

Renders as clickable links to wiki pages!

### Future Enhancements (Optional)
1. **@Mentions** - Add user mention support: `@username`
2. **Image Upload** - Add image upload button to toolbar
3. **Emoji Picker** - Add emoji selector
4. **Code Syntax Highlighting** - Add language-specific highlighting
5. **Auto-save Drafts** - Save to localStorage during typing

---

**Document Version:** 1.0
**Created:** October 12, 2025
**Ready for Implementation:** Yes
**Estimated Integration Time:** 4 hours total
