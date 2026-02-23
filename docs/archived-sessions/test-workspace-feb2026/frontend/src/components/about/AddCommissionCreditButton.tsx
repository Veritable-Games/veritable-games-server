'use client';

import { useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fetchJSON } from '@/lib/utils/csrf';

interface AddCommissionCreditButtonProps {
  onAdded: () => void;
  inline?: boolean;
}

export function AddCommissionCreditButton({
  onAdded,
  inline = false,
}: AddCommissionCreditButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !clientName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await fetchJSON('/api/about/commission-credits', {
        method: 'POST',
        body: {
          project_name: projectName,
          client_name: clientName,
        },
      });

      onAdded();
      setIsAdding(false);
      setProjectName('');
      setClientName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add commission credit');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdding) {
    // Inline style matches the commission credit cards
    if (inline) {
      return (
        <button
          onClick={() => setIsAdding(true)}
          className="border-l-2 border-dashed border-gray-600 py-2 pl-4 text-gray-500 hover:border-gray-400 hover:text-gray-300"
        >
          <span className="flex items-center gap-1">
            <PlusIcon className="h-4 w-4" />
            Add Credit
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={() => setIsAdding(true)}
        className="flex items-center gap-2 rounded border border-dashed border-gray-600 bg-gray-900/50 p-4 hover:border-blue-600"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800">
          <PlusIcon className="h-5 w-5 text-blue-400" />
        </div>
        <span className="font-medium text-gray-300">Add Commission Credit</span>
      </button>
    );
  }

  // Inline form
  if (inline) {
    return (
      <div className="border-l-2 border-blue-500 py-2 pl-4">
        {error && <div className="mb-2 text-xs text-red-400">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="Project Name"
            required
            disabled={isLoading}
            autoFocus
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setIsAdding(false);
                setError(null);
              }
            }}
          />
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Client Name"
            required
            disabled={isLoading}
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setIsAdding(false);
                setError(null);
              }
            }}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading || !projectName.trim() || !clientName.trim()}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setError(null);
              }}
              disabled={isLoading}
              className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-700 bg-gray-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-white">Add Commission Credit</h3>
        <button
          onClick={() => {
            setIsAdding(false);
            setError(null);
          }}
          disabled={isLoading}
          className="text-gray-400 hover:text-white"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-700 bg-red-900/20 p-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          placeholder="Project Name *"
          required
          disabled={isLoading}
          className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none disabled:opacity-50"
        />
        <input
          type="text"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="Client Name *"
          required
          disabled={isLoading}
          className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || !projectName.trim() || !clientName.trim()}
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setError(null);
            }}
            disabled={isLoading}
            className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
