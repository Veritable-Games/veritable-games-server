'use client';

import React from 'react';
import Link from 'next/link';
import { WikiInfobox, WikiTemplate, WikiTemplateField } from '@/lib/wiki/types';
import { logger } from '@/lib/utils/logger';

interface InfoboxRendererProps {
  infobox: WikiInfobox;
  template: WikiTemplate;
  fields: WikiTemplateField[];
  className?: string;
}

interface InfoboxFieldProps {
  field: WikiTemplateField;
  value: any;
}

// Individual field renderer based on field type
function InfoboxField({ field, value }: InfoboxFieldProps) {
  if (!value && !field.is_required) return null;

  const renderValue = () => {
    switch (field.field_type) {
      case 'text':
        return <span className="text-gray-200">{value || 'N/A'}</span>;

      case 'textarea':
        return (
          <div className="text-sm leading-relaxed text-gray-200">
            {value
              ? value.split('\n').map((line: string, idx: number) => (
                  <React.Fragment key={idx}>
                    {line}
                    {idx < value.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))
              : 'N/A'}
          </div>
        );

      case 'url':
        return value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="text-gray-200">N/A</span>
        );

      case 'image':
        return value ? (
          <div className="w-full">
            <img
              src={value}
              alt={field.field_label}
              className="h-auto w-full rounded border border-gray-600"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded border border-gray-600 bg-gray-800">
            <span className="text-sm text-gray-500">No image</span>
          </div>
        );

      case 'date':
        return (
          <span className="text-gray-200">
            {value ? new Date(value).toLocaleDateString() : 'N/A'}
          </span>
        );

      case 'list':
        if (!value || !Array.isArray(value)) return <span className="text-gray-200">N/A</span>;
        return (
          <ul className="space-y-1 text-sm text-gray-200">
            {value.map((item: string, idx: number) => (
              <li key={idx} className="flex items-start">
                <span className="mr-1 text-gray-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );

      case 'boolean':
        return (
          <span className={`text-sm font-medium ${value ? 'text-green-400' : 'text-red-400'}`}>
            {value ? 'Yes' : 'No'}
          </span>
        );

      case 'number':
        return <span className="text-gray-200">{value || 'N/A'}</span>;

      default:
        return <span className="text-gray-200">{String(value) || 'N/A'}</span>;
    }
  };

  return (
    <div className="border-b border-gray-700/50 py-2 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-col space-y-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {field.field_label}
          {field.is_required && <span className="ml-1 text-red-400">*</span>}
        </dt>
        <dd className="text-sm">{renderValue()}</dd>
      </div>
    </div>
  );
}

export function InfoboxRenderer({
  infobox,
  template,
  fields,
  className = '',
}: InfoboxRendererProps) {
  // Use parsed data if available, otherwise parse JSON data
  let parsedData: Record<string, any> = {};
  try {
    if (infobox.parsed_data) {
      parsedData = infobox.parsed_data;
    } else {
      parsedData = typeof infobox.data === 'string' ? JSON.parse(infobox.data) : infobox.data;
    }
  } catch (error) {
    logger.error('Failed to parse infobox data', { error, infoboxId: infobox.id });
    return null;
  }

  // Sort fields by display order
  const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order);

  // Determine position classes for Wikipedia-style floating
  const getPositionClasses = () => {
    switch (infobox.position) {
      case 'top-right':
        return 'float-right clear-right w-80 ml-4 mb-4 mt-0';
      case 'top-left':
        return 'float-left clear-left w-80 mr-4 mb-4 mt-0';
      case 'bottom-right':
        return 'float-right clear-right w-80 ml-4 mt-4';
      case 'bottom-left':
        return 'float-left clear-left w-80 mr-4 mt-4';
      case 'inline':
      default:
        return 'w-full max-w-md mx-auto my-4 clear-both';
    }
  };

  return (
    <div className={`${getPositionClasses()} ${className}`}>
      <div className="overflow-hidden rounded-lg border border-gray-600 bg-gray-900/80 shadow-lg">
        {/* Header */}
        <div className="border-b border-gray-600 bg-gray-800/80 px-4 py-3">
          <h3 className="text-lg font-semibold text-white">{template.name}</h3>
          {template.description && (
            <p className="mt-1 text-xs text-gray-400">{template.description}</p>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <dl className="space-y-0">
            {sortedFields.map(field => (
              <InfoboxField
                key={field.field_name}
                field={field}
                value={parsedData[field.field_name]}
              />
            ))}
          </dl>
        </div>

        {/* Footer with template info */}
        <div className="border-t border-gray-700/50 bg-gray-800/40 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Template: {template.name}</span>
            <span className="text-gray-600">•</span>
            <span>{template.type}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading state component
export function InfoboxSkeleton({ position = 'top-right' }: { position?: string }) {
  const getPositionClasses = () => {
    const baseClasses = 'w-full';

    switch (position) {
      case 'top-right':
        return `${baseClasses} md:float-right md:clear-right md:w-80 md:ml-4 md:mb-4`;
      case 'top-left':
        return `${baseClasses} md:float-left md:clear-left md:w-80 md:mr-4 md:mb-4`;
      case 'bottom-right':
        return `${baseClasses} md:float-right md:clear-right md:w-80 md:ml-4 md:mt-4`;
      case 'bottom-left':
        return `${baseClasses} md:float-left md:clear-left md:w-80 md:mr-4 md:mt-4`;
      case 'inline':
      default:
        return `${baseClasses} max-w-md mx-auto my-4`;
    }
  };

  return (
    <div className={getPositionClasses()}>
      <div className="animate-pulse overflow-hidden rounded-lg border border-gray-600 bg-gray-900/80 shadow-lg">
        <div className="border-b border-gray-600 bg-gray-800/80 px-4 py-3">
          <div className="mb-1 h-5 w-32 rounded bg-gray-700"></div>
          <div className="h-3 w-24 rounded bg-gray-700"></div>
        </div>
        <div className="space-y-3 p-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="border-b border-gray-700/50 pb-2">
              <div className="mb-1 h-3 w-20 rounded bg-gray-700"></div>
              <div className="h-4 w-full rounded bg-gray-700"></div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-700/50 bg-gray-800/40 px-4 py-2">
          <div className="h-3 w-24 rounded bg-gray-700"></div>
        </div>
      </div>
    </div>
  );
}

export default InfoboxRenderer;
