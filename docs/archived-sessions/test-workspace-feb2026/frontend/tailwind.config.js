/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#ededed',
        gray: {
          850: '#1a202e', // Custom darker gray for forum tables
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-in-up': 'fadeInUp 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translate(-50%, -45%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(-50%, -50%)',
          },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            // Ensure block elements have proper styling
            ul: {
              listStyleType: 'disc',
              marginLeft: '0.5rem',
              marginTop: '1.25em',
              marginBottom: '1.25em',
              paddingLeft: '1.25em',
            },
            ol: {
              listStyleType: 'decimal',
              marginLeft: '0.5rem',
              marginTop: '1.25em',
              marginBottom: '1.25em',
              paddingLeft: '1.25em',
            },
            li: {
              display: 'list-item',
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            pre: {
              backgroundColor: '#1f2937',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #374151',
              overflow: 'auto',
            },
            code: {
              backgroundColor: '#374151',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            },
            blockquote: {
              borderLeftWidth: '4px',
              borderLeftColor: '#6b7280',
              paddingLeft: '1rem',
              fontStyle: 'italic',
              marginTop: '1.6em',
              marginBottom: '1.6em',
            },
            table: {
              width: '100%',
              tableLayout: 'auto',
              textAlign: 'left',
              marginTop: '2em',
              marginBottom: '2em',
            },
            'thead th': {
              borderBottomWidth: '1px',
              borderBottomColor: '#d1d5db',
              paddingBottom: '0.5rem',
            },
            'tbody td': {
              borderBottomWidth: '1px',
              borderBottomColor: '#e5e7eb',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
            },
          },
        },
        invert: {
          css: {
            // Dark theme specific overrides
            '--tw-prose-body': '#d1d5db',
            '--tw-prose-headings': '#ffffff',
            '--tw-prose-links': '#60a5fa',
            '--tw-prose-code': '#93c5fd',
            '--tw-prose-pre-code': '#d1d5db',
            '--tw-prose-pre-bg': '#1f2937',
            '--tw-prose-bullets': '#9ca3af',
            '--tw-prose-counters': '#9ca3af',
            '--tw-prose-quote-borders': '#374151',
            blockquote: {
              borderLeftColor: '#374151',
              color: '#d1d5db',
            },
            'thead th': {
              borderBottomColor: '#374151',
            },
            'tbody td': {
              borderBottomColor: '#4b5563',
            },
          },
        },
        sm: {
          css: {
            // Small prose size adjustments
            'ul, ol': {
              marginTop: '1.1428571em',
              marginBottom: '1.1428571em',
              paddingLeft: '1.2em',
            },
            li: {
              marginTop: '0.2857143em',
              marginBottom: '0.2857143em',
            },
          },
        },
      },
    },
  },
  // Single consistent dark theme - no darkMode switching
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/container-queries')],
  // Force inclusion of typography classes to prevent purging
  safelist: [
    // Critical background colors for dropdowns (kept only used ones)
    'bg-gray-900',
    'bg-gray-900/95',
    'bg-gray-800',
    'bg-gray-800/50',
    'bg-purple-900/50', // Actually used in LibraryDevPanel.tsx
    'backdrop-blur-sm',
    'prose',
    'prose-invert',
    'prose-sm',
    // Removed unused prose modifiers - they're not used dynamically
    // Block element classes that might get purged
    'prose-ul:list-disc',
    'prose-ul:ml-6',
    'prose-ol:list-decimal',
    'prose-ol:ml-6',
    'prose-li:mb-1',
    // Reply indentation classes
    'ml-6',
    'ml-12',
    'ml-16',
    'border-l-2',
    'border-gray-700',
    'pl-4',
  ],
};
