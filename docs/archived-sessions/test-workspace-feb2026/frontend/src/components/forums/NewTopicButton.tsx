'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import type { ForumCategory } from '@/lib/forums/types';

interface User {
  id: number;
  username: string;
  display_name: string;
}

interface NewTopicButtonProps {
  categories?: ForumCategory[];
  defaultCategoryId?: string;
  categoryId?: string;
}

export function NewTopicButton({ categories, defaultCategoryId, categoryId }: NewTopicButtonProps) {
  const { user } = useAuth();

  const handleClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      alert('Please log in to create a new topic');
      return;
    }
  };

  const targetCategoryId = categoryId || defaultCategoryId;
  const createUrl = targetCategoryId
    ? `/forums/create?category=${targetCategoryId}`
    : '/forums/create';

  return (
    <Link
      href={createUrl}
      onClick={handleClick}
      className="flex h-8 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300"
    >
      Create
    </Link>
  );
}
