'use client';

import { useState } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import { EditableText } from './EditableText';
import { logger } from '@/lib/utils/logger';

interface CommissionCredit {
  id: number;
  project_name: string;
  client_name: string;
  description: string | null;
  project_type: string | null;
  color: string | null;
}

interface CommissionCreditCardProps {
  credit: CommissionCredit;
  canEdit: boolean;
  onUpdate: () => void;
  onDelete: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Green', value: '#10B981' },
  { label: 'Gray', value: '#6B7280' },
];

const COLOR_MAP: Record<string, string> = {
  'Visual Design': '#3B82F6',
  'Concept Art': '#EF4444',
  '3D Art': '#06B6D4',
  '3D Modeling': '#06B6D4',
  'System Development': '#A855F7',
};

export function CommissionCreditCard({
  credit,
  canEdit,
  onUpdate,
  onDelete,
}: CommissionCreditCardProps) {
  const [projectName, setProjectName] = useState(credit.project_name);
  const [clientName, setClientName] = useState(credit.client_name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [color, setColor] = useState(
    credit.color || COLOR_MAP[credit.project_type || ''] || '#6B7280'
  );

  const handleSave = async (field: string, value: string) => {
    // If both fields are empty, delete the credit
    const newProjectName = field === 'project_name' ? value : projectName;
    const newClientName = field === 'client_name' ? value : clientName;

    if (!newProjectName.trim() && !newClientName.trim()) {
      try {
        await fetchJSON(`/api/about/commission-credits?id=${credit.id}`, {
          method: 'DELETE',
        });
        onDelete();
      } catch (error) {
        logger.error('Failed to delete:', error);
      }
      return;
    }

    await fetchJSON('/api/about/commission-credits', {
      method: 'PUT',
      body: { id: credit.id, [field]: value },
    });
    onUpdate();
  };

  const handleColorChange = async (newColor: string) => {
    setColor(newColor);
    setShowColorPicker(false);
    try {
      await fetchJSON('/api/about/commission-credits', {
        method: 'PUT',
        body: { id: credit.id, color: newColor },
      });
      onUpdate();
    } catch (error) {
      setColor(color); // Revert on error
    }
  };

  const handleBorderClick = (e: React.MouseEvent) => {
    if (canEdit && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowColorPicker(!showColorPicker);
    }
  };

  return (
    <div className="relative">
      <div
        className="border-l-2 py-2 pl-4"
        style={{ borderLeftColor: color }}
        onClick={handleBorderClick}
        title={canEdit ? 'Ctrl+click border to change color' : undefined}
      >
        <EditableText
          value={projectName}
          onChange={setProjectName}
          onSave={value => handleSave('project_name', value)}
          canEdit={canEdit}
          className="font-medium text-white"
          as="span"
        />
        <EditableText
          value={clientName}
          onChange={setClientName}
          onSave={value => handleSave('client_name', value)}
          canEdit={canEdit}
          className="text-sm text-gray-400"
          as="p"
        />
      </div>

      {/* Color picker dropdown */}
      {showColorPicker && (
        <div className="absolute left-0 top-full z-10 mt-1 rounded border border-gray-700 bg-gray-800 p-2 shadow-lg">
          <div className="flex gap-1">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleColorChange(opt.value)}
                className={`h-6 w-6 rounded border-2 ${color === opt.value ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: opt.value }}
                title={opt.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
