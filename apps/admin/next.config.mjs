/** @type {import('next').NextConfig} */

/**
 * The newsroom CMS.
 *
 * Locked down harder than the public site: it is never indexed, never framed,
 * and referrers are not leaked to third parties. Everything here is behind
 * authentication, so there is no reason for a crawler or an embedder to reach
 * any of it.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  transpilePackages: [
    '@bcm10/analytics',
    '@bcm10/database',
    '@bcm10/email',
    '@bcm10/notifications',
    '@bcm10/storage',
    '@bcm10/ui',
    '@bcm10/validation',
  ],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.bcm10news.in' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
