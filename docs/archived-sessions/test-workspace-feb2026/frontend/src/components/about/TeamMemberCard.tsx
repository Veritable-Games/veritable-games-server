'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchJSON } from '@/lib/utils/csrf';
import { EditableText } from './EditableText';

interface TeamMember {
  id: number;
  user_id: number;
  title: string | null;
  tags: string[];
  display_order: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface TeamMemberCardProps {
  member: TeamMember;
  canEdit: boolean;
  onUpdate: () => void;
}

export function TeamMemberCard({ member, canEdit, onUpdate }: TeamMemberCardProps) {
  const [title, setTitle] = useState(member.title || '');
  const [tags, setTags] = useState<string[]>(member.tags || []);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  const displayName = member.display_name || member.username;
  const avatarUrl =
    member.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1f2937&color=fff&size=96`;

  // Handle delete key for selected tag
  useEffect(() => {
    if (!canEdit || !selectedTag) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleRemoveTag(selectedTag);
        setSelectedTag(null);
      } else if (e.key === 'Escape') {
        setSelectedTag(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, selectedTag]);

  const handleTitleSave = async (newTitle: string) => {
    await fetchJSON('/api/about/team-members', {
      method: 'PUT',
      body: { id: member.id, title: newTitle },
    });
    onUpdate();
  };

  const handleAddTag = async () => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag || tags.includes(trimmedTag)) {
      setNewTag('');
      setIsAddingTag(false);
      return;
    }

    const newTags = [...tags, trimmedTag];
    setTags(newTags);
    setNewTag('');
    setIsAddingTag(false);

    try {
      await fetchJSON('/api/about/team-members', {
        method: 'PUT',
        body: { id: member.id, tags: newTags },
      });
      onUpdate();
    } catch {
      setTags(tags); // Revert on error
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    setTags(newTags);

    try {
      await fetchJSON('/api/about/team-members', {
        method: 'PUT',
        body: { id: member.id, tags: newTags },
      });
      onUpdate();
    } catch {
      setTags(tags); // Revert on error
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    if (canEdit && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setSelectedTag(selectedTag === tag ? null : tag);
    }
  };

  return (
    <div className="rounded border border-gray-700 bg-gray-900/70 p-4">
      <div className="mb-3 flex items-center">
        <Link href={`/profile/${member.username}`} className="mr-3 flex-shrink-0">
          <img src={avatarUrl} alt={displayName} className="h-12 w-12 rounded-full" />
        </Link>
        <div>
          <Link
            href={`/profile/${member.username}`}
            className="text-lg font-bold text-white hover:text-blue-400"
          >
            {displayName}
          </Link>
          <EditableText
            value={title}
            onChange={setTitle}
            onSave={handleTitleSave}
            canEdit={canEdit}
            className="text-sm font-medium text-gray-400"
            placeholder={canEdit ? 'Ctrl+click to add title' : ''}
            as="p"
          />
        </div>
      </div>

      {member.bio && <p className="mb-3 text-sm leading-relaxed text-gray-300">{member.bio}</p>}

      <div className="flex flex-wrap gap-1">
        {tags.map((tag, index) => (
          <span
            key={index}
            onClick={e => handleTagClick(e, tag)}
            className={`rounded border px-2 py-0.5 font-mono text-xs ${
              selectedTag === tag
                ? 'border-blue-500 bg-blue-900/50 text-blue-300'
                : 'border-gray-600 bg-gray-800 text-gray-400'
            } ${canEdit ? 'cursor-pointer' : ''}`}
            title={canEdit ? 'Ctrl+click to select, then Delete to remove' : undefined}
          >
            {tag}
          </span>
        ))}

        {canEdit && (
          <>
            {isAddingTag ? (
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  } else if (e.key === 'Escape') {
                    setNewTag('');
                    setIsAddingTag(false);
                  }
                }}
                onBlur={handleAddTag}
                autoFocus
                placeholder="Tag"
                className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                style={{ width: '60px' }}
              />
            ) : (
              <span
                onClick={() => setIsAddingTag(true)}
                className="cursor-pointer rounded border border-gray-600 bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-500 hover:text-gray-400"
              >
                +
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
