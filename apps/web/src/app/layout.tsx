import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Telugu, Noto_Serif_Telugu, Source_Serif_4 } from 'next/font/google';
import { AnalyticsProvider } from '@bcm10/analytics/client';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { BreakingTicker } from '@/components/breaking-ticker';
import { JsonLd } from '@/components/json-ld';
import { cachedBreaking, cachedNavigation, cachedSiteSettings } from '@/lib/data';
import { websiteSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';
import { formatDate } from '@/lib/format';
import './globals.css';

/**
 * Fonts.
 *
 * Four families, loaded through next/font so they are self-hosted, preloaded
 * and immune to the layout shift a webfont request normally causes. Each role
 * pairs a Latin face with a Telugu one and exposes them as CSS variables; the
 * stacks in globals.css put Latin first, and the browser substitutes per glyph
 * inside a mixed headline.
 *
 * `display: swap` everywhere: on a slow connection a reader should get the
 * headline in a fallback face immediately rather than staring at nothing.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ['telugu'],
  variable: '--font-noto-sans-telugu',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
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
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: `${SITE.name} — Telugu news from Andhra Pradesh and Telangana`,
    template: `%s | ${SITE.name}`,
  },
  description:
    'Breaking news, politics, business, sport and cinema from Andhra Pradesh and Telangana, in Telugu and English.',
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.origin }],
  publisher: SITE.name,
  formatDetection: { telephone: false },
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [{ url: '/rss.xml', title: `${SITE.name} — latest stories` }],
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: SITE.ogLocale,
    url: SITE.origin,
  },
  twitter: { card: 'summary_large_image', site: SITE.twitter },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The masthead red, so the browser chrome matches on mobile.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfbf9' },
    { media: '(prefers-color-scheme: dark)', color: '#131211' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /*
   * Chrome data is fetched in parallel and every piece is cached, so the
   * layout adds no per-request database work. A failure in any one of them
   * must not take down the site: a missing ticker is survivable, a blank page
   * is not.
   */
  const [navigation, settings, breaking] = await Promise.all([
    cachedNavigation().catch(() => []),
    cachedSiteSettings().catch(() => null),
    cachedBreaking(240).catch(() => []),
  ]);

  const locale = SITE.defaultLocale;

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoSansTelugu.variable} ${sourceSerif.variable} ${notoSerifTelugu.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-paper antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>

        <JsonLd data={websiteSchema()} />

        <AnalyticsProvider>
          <SiteHeader
            navigation={navigation}
            locale={locale}
            dateLabel={formatDate(new Date(), locale)}
          />

          {settings?.breaking_ticker_enabled !== false ? (
            <BreakingTicker articles={breaking} locale={locale} />
          ) : null}

          <main id="main" className="mx-auto max-w-(--container-page) px-4 py-6">
            {children}
          </main>

          <SiteFooter
            navigation={navigation}
            locale={locale}
            contactEmail={settings?.contact_email ?? null}
          />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
