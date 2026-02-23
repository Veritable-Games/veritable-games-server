'use client';

import React, { useState, useEffect } from 'react';
import { InfoboxRenderer } from './InfoboxRenderer';
import { logger } from '@/lib/utils/logger';
import type { WikiTemplate, WikiTemplateField, WikiInfobox } from '@/lib/wiki/types';
import {
  XMarkIcon,
  DocumentTextIcon,
  PhotoIcon,
  LinkIcon,
  CalendarIcon,
  ListBulletIcon,
  CheckIcon,
  HashtagIcon,
  CubeIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

/**
 * Extended WikiTemplateField with placeholder support
 * (placeholder may be returned from API but not in canonical type)
 */
interface WikiTemplateFieldWithPlaceholder extends WikiTemplateField {
  placeholder?: string | null;
}

interface InfoboxEditorProps {
  pageId: number;
  pageSlug: string;
  existingInfobox?: WikiInfobox;
  onSave?: (infobox: WikiInfobox) => void;
  onCancel?: () => void;
  className?: string;
}

export function InfoboxEditor({
  pageId,
  pageSlug,
  existingInfobox,
  onSave,
  onCancel,
  className = '',
}: InfoboxEditorProps) {
  const [templates, setTemplates] = useState<WikiTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WikiTemplate | null>(null);
  const [templateFields, setTemplateFields] = useState<WikiTemplateFieldWithPlaceholder[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [position, setPosition] = useState<WikiInfobox['position']>(
    existingInfobox?.position || 'top-right'
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available templates
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/wiki/templates?type=infobox');
        if (!response.ok) throw new Error('Failed to fetch templates');

        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (err) {
        logger.error('Error fetching templates', { error: err });
        throw new Error('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Load existing infobox data
  useEffect(() => {
    if (existingInfobox && templates.length > 0) {
      const template = templates.find(t => t.id === existingInfobox.template_id);
      if (template) {
        setSelectedTemplate(template);
        const parsedData =
          typeof existingInfobox.data === 'string'
            ? JSON.parse(existingInfobox.data)
            : existingInfobox.data;
        setFormData(parsedData);
        setPosition(existingInfobox.position);
      }
    }
  }, [existingInfobox, templates]);

  // Fetch template fields when template is selected
  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateFields([]);
      return;
    }

    const fetchFields = async () => {
      try {
        const response = await fetch(`/api/wiki/templates/${selectedTemplate.id}`);
        if (!response.ok) throw new Error('Failed to fetch template fields');

        const data = await response.json();
        setTemplateFields(data.fields || []);

        // Initialize form data with default values
        const initialData: Record<string, any> = {};
        data.fields?.forEach((field: WikiTemplateField) => {
          if (field.default_value) {
            initialData[field.field_name] = field.default_value;
          } else {
            // Set appropriate empty values based on type
            switch (field.field_type) {
              case 'list':
                initialData[field.field_name] = [];
                break;
              case 'boolean':
                initialData[field.field_name] = false;
                break;
              case 'number':
                initialData[field.field_name] = 0;
                break;
              default:
                initialData[field.field_name] = '';
            }
          }
        });

        if (!existingInfobox) {
          setFormData(initialData);
        }
      } catch (err) {
        logger.error('Error fetching template fields', { error: err });
        throw new Error('Failed to load template fields');
      }
    };

    fetchFields();
  }, [selectedTemplate, existingInfobox]);

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // Handle list field operations
  const handleListAdd = (fieldName: string, value: string) => {
    if (!value.trim()) return;

    setFormData(prev => ({
      ...prev,
      [fieldName]: [...(prev[fieldName] || []), value.trim()],
    }));
  };

  const handleListRemove = (fieldName: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).filter((_: any, i: number) => i !== index),
    }));
  };

  // Validate required fields
  const validateForm = (): boolean => {
    for (const field of templateFields) {
      if (field.is_required) {
        const value = formData[field.field_name];
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        ) {
          throw new Error(`${field.field_label} is required`);
          return false;
        }
      }
    }
    return true;
  };

  // Save infobox
  const handleSave = async () => {
    if (!selectedTemplate) {
      throw new Error('Please select a template');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const infoboxData: Partial<WikiInfobox> = {
        page_id: pageId,
        template_id: selectedTemplate.id,
        data: JSON.stringify(formData),
        position,
      };

      let response;
      if (existingInfobox?.id) {
        // Update existing infobox
        response = await fetch(`/api/wiki/infoboxes/${existingInfobox.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(infoboxData),
        });
      } else {
        // Create new infobox
        response = await fetch('/api/wiki/infoboxes', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(infoboxData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save infobox');
      }

      const savedInfobox = await response.json();

      if (onSave) {
        onSave(savedInfobox.infobox || savedInfobox);
      }

      // Reset form if creating new
      if (!existingInfobox) {
        setSelectedTemplate(null);
        setFormData({});
        setPosition('top-right');
      }
    } catch (err) {
      logger.error('Error saving infobox', { error: err });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Render field input based on type
  const renderFieldInput = (field: WikiTemplateFieldWithPlaceholder) => {
    const value = formData[field.field_name];
    const commonClasses =
      'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={e => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || ''}
            className={commonClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={e => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || ''}
            rows={4}
            className={commonClasses + ' resize-vertical'}
          />
        );

      case 'url':
        return (
          <input
            type="url"
            value={value || ''}
            onChange={e => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || 'https://example.com'}
            className={commonClasses}
          />
        );

      case 'image':
        return (
          <input
            type="url"
            value={value || ''}
            onChange={e => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || 'Image URL'}
            className={commonClasses}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={e => handleFieldChange(field.field_name, e.target.value)}
            className={commonClasses}
          />
        );

      case 'list':
        return (
          <div className="space-y-2">
            {(value || []).map((item: string, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white">
                  {item}
                </span>
                <button
                  type="button"
                  onClick={() => handleListRemove(field.field_name, index)}
                  className="rounded-md p-2 text-red-400 transition-colors hover:bg-gray-800 hover:text-red-300"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={field.placeholder || 'Add item'}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.target as HTMLInputElement;
                    handleListAdd(field.field_name, input.value);
                    input.value = '';
                  }
                }}
                className={commonClasses}
              />
              <button
                type="button"
                onClick={e => {
                  const input = e.currentTarget.previousSibling as HTMLInputElement;
                  handleListAdd(field.field_name, input.value);
                  input.value = '';
                }}
                className="rounded-md p-2 text-blue-400 transition-colors hover:bg-gray-800 hover:text-blue-300"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case 'boolean':
        return (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={value || false}
              onChange={e => handleFieldChange(field.field_name, e.target.checked)}
              className="h-5 w-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-white">{field.placeholder || 'Check if yes'}</span>
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || 0}
            onChange={e => handleFieldChange(field.field_name, parseInt(e.target.value) || 0)}
            placeholder={field.placeholder || ''}
            className={commonClasses}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={e => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || ''}
            className={commonClasses}
          />
        );
    }
  };

  // Get field icon
  const getFieldIcon = (type: WikiTemplateField['field_type']) => {
    switch (type) {
      case 'text':
        return <DocumentTextIcon className="h-4 w-4" />;
      case 'textarea':
        return <DocumentTextIcon className="h-4 w-4" />;
      case 'url':
        return <LinkIcon className="h-4 w-4" />;
      case 'image':
        return <PhotoIcon className="h-4 w-4" />;
      case 'date':
        return <CalendarIcon className="h-4 w-4" />;
      case 'list':
        return <ListBulletIcon className="h-4 w-4" />;
      case 'boolean':
        return <CheckIcon className="h-4 w-4" />;
      case 'number':
        return <HashtagIcon className="h-4 w-4" />;
      default:
        return <CubeIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-700 bg-gray-900 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-32 rounded bg-gray-800"></div>
          <div className="space-y-4">
            <div className="h-10 rounded bg-gray-800"></div>
            <div className="h-32 rounded bg-gray-800"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-700 bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {existingInfobox ? 'Edit Infobox' : 'Add Infobox'}
          </h3>
          {onCancel && (
            <button onClick={onCancel} className="text-gray-400 transition-colors hover:text-white">
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Template Selection */}
        {!existingInfobox && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Select Template</label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={e => {
                const template = templates.find(t => t.id === parseInt(e.target.value));
                setSelectedTemplate(template || null);
              }}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.description && ` - ${template.description}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Position Selection */}
        {selectedTemplate && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Position</label>
            <select
              value={position}
              onChange={e => setPosition(e.target.value as WikiInfobox['position'])}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="top-right">Top Right (Default)</option>
              <option value="top-left">Top Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="inline">Inline (Full Width)</option>
            </select>
          </div>
        )}

        {/* Template Fields */}
        {selectedTemplate && templateFields.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-300">Fields</h4>
            {templateFields
              .sort((a, b) => a.display_order - b.display_order)
              .map(field => (
                <div key={field.id}>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    <span className="flex items-center gap-2">
                      {getFieldIcon(field.field_type)}
                      {field.field_label}
                      {field.is_required && <span className="text-red-400">*</span>}
                    </span>
                  </label>
                  {renderFieldInput(field)}
                </div>
              ))}
          </div>
        )}

        {/* Preview Toggle */}
        {selectedTemplate && templateFields.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-400 underline hover:text-blue-300"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
        )}

        {/* Preview */}
        {showPreview && selectedTemplate && templateFields.length > 0 && (
          <div className="rounded-lg border border-gray-700 bg-gray-950 p-4">
            <h4 className="mb-4 text-sm font-medium text-gray-300">Preview</h4>
            <InfoboxRenderer
              infobox={{
                id: existingInfobox?.id || 0,
                page_id: pageId,
                template_id: selectedTemplate.id,
                data: JSON.stringify(formData),
                parsed_data: formData,
                position,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }}
              template={selectedTemplate}
              fields={templateFields}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-700 px-6 py-4">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!selectedTemplate || saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : existingInfobox ? 'Update Infobox' : 'Add Infobox'}
        </button>
      </div>
    </div>
  );
}

export default InfoboxEditor;
