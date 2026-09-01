import type { Metadata } from 'next';
import { createPublicClient } from '@bcm10/database/server';
import { PREVIEW_SELECT, type ArticlePreview } from '@bcm10/database';
import { ArticleCard } from '@/components/article-card';
import { listMetadata } from '@/lib/seo';

export const metadata: Metadata = listMetadata({
  title: 'Photo stories',
  description: 'Photojournalism from BCM10 News across Andhra Pradesh and Telangana.',
  path: '/photos',
});

export const revalidate = 300;

export default async function PhotosPage() {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from('article_previews')
    .select(PREVIEW_SELECT)
    .not('featured_image_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(36);

  const articles = (data ?? []) as ArticlePreview[];

  return (
    <div>
      <header className="border-b-2 border-ink pb-3">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Photo stories</h1>
        <p className="mt-2 text-ink-muted">The week in pictures.</p>
      </header>

      {articles.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              variant="standard"
              showCategory={false}
              priority={index === 0}
            />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-ink-muted">
          No photo stories have been published yet.
        </p>
      )}
    </div>
  );
}
