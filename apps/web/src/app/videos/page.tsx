import type { Metadata } from 'next';
import { createPublicClient } from '@bcm10/database/server';
import { getVideoArticles } from '@bcm10/database';
import { ArticleCard } from '@/components/article-card';
import { listMetadata } from '@/lib/seo';

export const metadata: Metadata = listMetadata({
  title: 'Videos',
  description: 'Video reporting from BCM10 News across Andhra Pradesh and Telangana.',
  path: '/videos',
});

export const revalidate = 300;

/**
 * Video index.
 *
 * Cards rather than embedded players. Twenty YouTube iframes on one page would
 * pull tens of megabytes of player JavaScript before a reader picks anything;
 * the player is only mounted on the article page, and only after a press.
 */
export default async function VideosPage() {
  const articles = await getVideoArticles(createPublicClient(), { limit: 30 }).catch(() => []);

  return (
    <div>
      <header className="border-b-2 border-ink pb-3">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Videos</h1>
        <p className="mt-2 text-ink-muted">Reporting you can watch.</p>
      </header>

      {articles.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              variant="standard"
              priority={index === 0}
            />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-ink-muted">
          No video stories have been published yet.
        </p>
      )}
    </div>
  );
}
