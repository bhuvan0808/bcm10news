/** Admin-side constants. */
export const ADMIN = {
  name: 'BCM10 Newsroom',
  publicSiteUrl: (process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000').replace(
    /\/+$/,
    ''
  ),
  adminUrl: (process.env['NEXT_PUBLIC_ADMIN_URL'] ?? 'http://localhost:3001').replace(/\/+$/, ''),
  mediaBaseUrl: (process.env['NEXT_PUBLIC_MEDIA_URL'] ?? 'https://images.bcm10news.in').replace(
    /\/+$/,
    ''
  ),
} as const;

export function publicArticleUrl(slug: string): string {
  return `${ADMIN.publicSiteUrl}/news/${slug}`;
}

export function adminUrl(path: string): string {
  return `${ADMIN.adminUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
