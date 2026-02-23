import './globals.css';
import '@/styles/preferences.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import MainLayout from '@/components/layouts/MainLayout';

// Font preload links to prevent FOUT (Flash of Unstyled Text)
const fontPreloads = [
  { href: '/fonts/34688578316.ttf', type: 'font/ttf' }, // Kalinga normal
  { href: '/fonts/41956811750.ttf', type: 'font/ttf' }, // Kalinga bold
];

export const metadata: Metadata = {
  title: {
    template: '%s | Veritable Games',
    default: 'Veritable Games',
  },
  description: 'For all in love and justice. Works against the discriminating man.',
  icons: {
    icon: [
      { url: '/favicon.svg?v=3', type: 'image/svg+xml' }, // SVG for modern browsers - crisp at any size
      { url: '/favicon-48x48.png?v=3', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-32x32.png?v=3', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=3', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=3',
    apple: '/apple-touch-icon.png?v=3',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preload fonts to prevent FOUT (Flash of Unstyled Text) */}
        {fontPreloads.map(font => (
          <link
            key={font.href}
            rel="preload"
            href={font.href}
            as="font"
            type={font.type}
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body className="h-full bg-background text-foreground">
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
