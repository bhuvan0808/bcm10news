/** @type {import('next').NextConfig} */

/**
 * Security headers.
 *
 * The CSP is the interesting one. `frame-src` is limited to YouTube so a
 * compromised article body cannot embed an arbitrary iframe, and `img-src`
 * allows the media domain plus YouTube thumbnails and nothing else.
 *
 * `'unsafe-inline'` remains on script-src because Next.js inlines its
 * bootstrap and hydration payloads. Tightening that requires nonce plumbing
 * through middleware; it is tracked in docs/security.md rather than left
 * silently loose.
 */
const mediaHost = process.env.NEXT_PUBLIC_MEDIA_URL ?? 'https://images.bcm10news.in';
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.onesignal.com ${posthogHost}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src \'self\' https://fonts.gstatic.com data:',
  `img-src 'self' data: blob: ${mediaHost} ${supabaseHost} https://i.ytimg.com https://img.youtube.com`,
  `connect-src 'self' ${supabaseHost} ${posthogHost} https://api.razorpay.com https://onesignal.com`,
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://api.razorpay.com https://checkout.razorpay.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  transpilePackages: [
    '@bcm10/analytics',
    '@bcm10/database',
    '@bcm10/email',
    '@bcm10/notifications',
    '@bcm10/payments',
    '@bcm10/storage',
    '@bcm10/ui',
    '@bcm10/validation',
  ],

  images: {
    // AVIF first: roughly 20% smaller than WebP at the same quality, which is
    // the difference that matters on a metered district connection.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200, 1600, 2048],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.bcm10news.in' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  experimental: {
    // Ship only the icons actually imported rather than the whole set.
    optimizePackageImports: ['lucide-react'],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Feeds and sitemaps are cheap to regenerate and safe to serve stale.
        source: '/:path(sitemap.xml|news-sitemap.xml|rss.xml)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1800' }],
      },
    ];
  },

  async redirects() {
    return [
      // Legacy Blogger URLs: /2024/05/some-post.html -> the search page, which
      // is a better landing than a 404 while the archive is migrated.
      {
        source: '/:year(\\d{4})/:month(\\d{2})/:slug.html',
        destination: '/search?q=:slug',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
