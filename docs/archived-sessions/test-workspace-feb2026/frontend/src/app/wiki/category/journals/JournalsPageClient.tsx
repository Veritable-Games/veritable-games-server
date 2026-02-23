'use client';

import { useSearchParams } from 'next/navigation';
import { JournalsLayout } from '@/components/journals/JournalsLayout';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';
import type { JournalCategory } from '@/stores/journals/types';

interface JournalData {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  created_at: string;
  updated_at: string;
  content: string;
  journal_category_id?: string;
  revision_timestamp?: string | null;
  is_archived?: boolean;
  is_deleted?: boolean;
}

interface JournalsPageClientProps {
  journals: JournalData[];
}

/**
 * Client wrapper for journals page with URL-based selection state
 * Reads ?selected=slug from URL to determine which journal to load
 */
export function JournalsPageClient({ journals }: JournalsPageClientProps) {
  // DEBUG: Log what we receive from server
  console.log('[JournalsPageClient] Received journals prop:', {
    count: journals.length,
    sample: journals[0] ? {
      id: journals[0].id,
      title: journals[0].title,
      journal_category_id: journals[0].journal_category_id,
    } : null,
  });

  const searchParams = useSearchParams();
  const selectedSlug = searchParams.get('selected');
  const [currentJournal, setCurrentJournal] = useState<JournalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<JournalCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      logger.info('[Journals] Starting categories fetch', { journalCount: journals.length });

      try {
        const response = await fetch('/api/journals/categories', {
          credentials: 'same-origin', // Ensure cookies are sent
        });

        logger.info('[Journals] Categories API response', {
          status: response.status,
          contentType: response.headers.get('content-type'),
        });

        if (response.ok) {
          const data = await response.json();
          logger.info('[Journals] Categories loaded successfully', {
            count: data.data?.length || 0,
          });
          setCategories(data.data || []);
        } else if (response.status === 401) {
          // Authentication error - user not logged in or session expired
          logger.warn('Not authenticated for categories. Journals will display in flat list.');
          // Keep categories empty, sidebar will show flat list fallback
        } else if (response.status === 402) {
          // Payment required (likely x402 bot detection)
          logger.warn('Payment required (x402 bot detection). This should not happen in browser.');
          // Treat as transient error, sidebar will show flat list fallback
        } else if (response.status === 403) {
          // Permission denied
          logger.error('Permission denied when fetching journal categories');
          // Keep categories empty, sidebar will show flat list fallback
        } else if (response.status >= 500) {
          // Server error - could implement retry logic here
          const errorData = await response.json().catch(() => ({ error: 'Server error' }));
          logger.error('Server error loading journal categories', {
            status: response.status,
            error: errorData,
          });
          // Keep categories empty, sidebar will show flat list fallback
        } else {
          // Other errors
          const errorData = await response.json().catch(() => ({ error: 'Could not parse error' }));
          logger.error('Categories API failed', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
        }
      } catch (error) {
        logger.error('Error loading journal categories', { error });
      } finally {
        logger.info('[Journals] Categories fetch complete', { count: categories.length });
        setCategoriesLoaded(true);
      }
    };

    fetchCategories();
  }, []);

  // Load journal content when selectedSlug changes
  useEffect(() => {
    if (!selectedSlug) {
      setCurrentJournal(null);
      return;
    }

    // Check if journal is already in initial server data
    const existing = journals.find(j => j.slug === selectedSlug);
    if (existing) {
      setCurrentJournal(existing);
      return;
    }

    // Otherwise fetch from API (handles new journals or deep links)
    const fetchJournal = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/journals/${selectedSlug}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentJournal(data.data);
        } else {
          logger.error('Failed to load journal', { slug: selectedSlug, status: response.status });
          setCurrentJournal(null);
        }
      } catch (error) {
        logger.error('Error loading journal', { slug: selectedSlug, error });
        setCurrentJournal(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJournal();
  }, [selectedSlug, journals]);

  const currentPage = currentJournal
    ? {
        slug: currentJournal.slug,
        title: currentJournal.title,
        content: currentJournal.content,
        isArchived: currentJournal.is_archived || false,
        isDeleted: currentJournal.is_deleted || false,
      }
    : undefined;

  return (
    <JournalsLayout
      journals={journals}
      categories={categories}
      currentPage={currentPage}
      isLoading={isLoading || !categoriesLoaded}
    />
  );
}
