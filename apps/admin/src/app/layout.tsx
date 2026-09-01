import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Telugu, Noto_Serif_Telugu, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ['telugu'],
  variable: '--font-noto-sans-telugu',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});
const notoSerifTelugu = Noto_Serif_Telugu({
  subsets: ['telugu'],
  variable: '--font-noto-serif-telugu',
  display: 'swap',
  weight: ['400', '600'],
});

export const metadata: Metadata = {
  title: { default: 'BCM10 Newsroom', template: '%s — BCM10 Newsroom' },
  description: 'Editorial production system for BCM10 News.',
  // Belt and braces with the X-Robots-Tag header in next.config: the newsroom
  // must never appear in a search index.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Reporters file from phones; the layout must not fight a pinch-zoom.
  maximumScale: 5,
};

/**
 * Root layout.
 *
 * Deliberately thin: it establishes fonts and the page background and nothing
 * else. The signed-in chrome lives in the (newsroom) route group, so sign-in
 * and the no-access page render without a sidebar for an account that has no
 * business seeing one.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansTelugu.variable} ${sourceSerif.variable} ${notoSerifTelugu.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-paper antialiased">{children}</body>
    </html>
  );
}
