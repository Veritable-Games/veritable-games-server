'use client';

/**
 * Editable Donation Page Header
 * Ctrl+click to edit title and description
 */

import { useState } from 'react';

export function DonatePageHeader() {
  const [title, setTitle] = useState('Support Veritable Games');
  const [description, setDescription] = useState(
    'Help fund independent game development and community growth.'
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  const handleTitleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setIsEditingTitle(true);
    }
  };

  const handleDescClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setIsEditingDesc(true);
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
  };

  const handleDescBlur = () => {
    setIsEditingDesc(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditingTitle(false);
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleDescKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditingDesc(false);
    } else if (e.key === 'Escape') {
      setIsEditingDesc(false);
    }
  };

  return (
    <div className="mb-8 text-center">
      {isEditingTitle ? (
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
          className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-center text-3xl font-bold text-white focus:border-blue-600 focus:outline-none"
        />
      ) : (
        <h1
          onClick={handleTitleClick}
          className="mb-2 cursor-text text-3xl font-bold text-white transition-colors hover:text-gray-300"
          title="Ctrl+click to edit"
        >
          {title}
        </h1>
      )}

      {isEditingDesc ? (
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={handleDescBlur}
          onKeyDown={handleDescKeyDown}
          autoFocus
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-center text-gray-400 focus:border-blue-600 focus:outline-none"
        />
      ) : (
        <p
          onClick={handleDescClick}
          className="cursor-text text-gray-400 transition-colors hover:text-gray-300"
          title="Ctrl+click to edit"
        >
          {description}
        </p>
      )}
    </div>
  );
}
