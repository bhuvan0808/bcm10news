import { notFound } from 'next/navigation';
import { createClient } from '@bcm10/database/server';
import { getAllCategories, getArticleTimeline, getNewsroomArticle } from '@bcm10/database';
import { contentDoc, EMPTY_DOC, type ContentDoc } from '@bcm10/validation';
import { ArticleForm, type ArticleFormData } from '@/components/article-form';
import { ReviewPanel } from '@/components/review-panel';
import { StoryTimeline } from '@/components/story-timeline';
import { requireNewsroomUser } from '@/lib/auth';
import { ADMIN } from '@/lib/site';

export const metadata = { title: 'Edit story' };

/**
 * Edit a story.
 *
 * The read goes through RLS, so a reporter opening another reporter's draft id
 * gets nothing back and lands on a 404 — the same response as a story that
 * does not exist, which is deliberate: a different error would confirm that
 * the story is real.
 */
export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireNewsroomUser(`/articles/${id}`);
  const supabase = await createClient();

  const article = (await getNewsroomArticle(supabase, id)) as ArticleRecord | null;
  if (!article) notFound();

  const [categories, locations, timeline] = await Promise.all([
    getAllCategories(supabase).catch(() => []),
    supabase
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => data ?? []),
    getArticleTimeline(supabase, id).catch(() => ({ history: [], reviews: [] })),
  ]);

  const initial: ArticleFormData = {
    id: article.id,
    status: article.status,
    title: article.title,
    titleTe: article.title_te ?? '',
    subtitle: article.subtitle ?? '',
    excerpt: article.excerpt ?? '',
    slug: article.slug,
    language: article.language,
    body: parseBody(article.body),
    categoryId: article.category_id,
    secondaryCategoryId: article.secondary_category_id ?? '',
    locationId: article.location_id ?? '',
    featuredImage: article.featured_image
      ? {
          mediaId: article.featured_image.id,
          storageKey: article.featured_image.storage_key,
          url: `${ADMIN.mediaBaseUrl}/${article.featured_image.storage_key}`,
          width: article.featured_image.width ?? 0,
          height: article.featured_image.height ?? 0,
          blurDataUrl: article.featured_image.blur_data_url,
          alt: article.featured_image.alt_text ?? '',
        }
      : null,
    videoUrls: (article.videos ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((video) => video.original_url),
    tagNames: (article.article_tags ?? [])
      .map((row) => row.tag?.name)
      .filter((name): name is string => Boolean(name)),
    isBreaking: article.is_breaking,
    isExclusive: article.is_exclusive,
    isPremium: article.is_premium,
    isFeatured: article.is_featured,
    isSponsored: article.is_sponsored,
    allowComments: article.allow_comments,
    previewParagraphs: article.preview_paragraphs,
    seoTitle: article.seo_title ?? '',
    seoDescription: article.seo_description ?? '',
    scheduledFor: article.scheduled_for,
    updatedAt: article.updated_at,
  };

  const openNotes = timeline.reviews.filter(
    (review) => review.action === 'changes_requested' && !review.resolved_at
  );

  return (
    <div className="space-y-6">
      {/* Editor notes come first. A reporter opening a returned story must see
          why it came back before they see the form. */}
      {openNotes.length > 0 ? (
        <section className="border-status-changes/40 bg-status-changes/5 mx-auto max-w-(--container-page) rounded-sm border p-4">
          <h2 className="text-status-changes text-sm font-bold">Editor notes</h2>
          <ul className="mt-2 space-y-2">
            {openNotes.map((note) => (
              <li key={note.id} className="text-sm text-ink">
                {note.comment}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {session.isEditorial ? (
        <div className="mx-auto max-w-(--container-page)">
          <ReviewPanel
            articleId={article.id}
            status={article.status}
            canPublish={session.canPublish}
          />
        </div>
      ) : null}

      <ArticleForm
        initial={initial}
        categories={categories}
        locations={locations}
        canPublish={session.canPublish}
        isEditorial={session.isEditorial}
      />

      <div className="mx-auto max-w-(--container-page)">
        <StoryTimeline history={timeline.history} reviews={timeline.reviews} />
      </div>
    </div>
  );
}

/** Validates the stored tree before it reaches the editor. */
function parseBody(raw: unknown): ContentDoc {
  const parsed = contentDoc.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_DOC;
}

interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  title_te: string | null;
  subtitle: string | null;
  excerpt: string | null;
  language: 'te' | 'en';
  body: unknown;
  status: ArticleFormData['status'];
  category_id: string;
  secondary_category_id: string | null;
  location_id: string | null;
  is_breaking: boolean;
  is_exclusive: boolean;
  is_premium: boolean;
  is_featured: boolean;
  is_sponsored: boolean;
  allow_comments: boolean;
  preview_paragraphs: number;
  seo_title: string | null;
  seo_description: string | null;
  scheduled_for: string | null;
  updated_at: string;
  featured_image: {
    id: string;
    storage_key: string;
    width: number | null;
    height: number | null;
    blur_data_url: string | null;
    alt_text: string | null;
  } | null;
  videos: { id: string; original_url: string; position: number }[] | null;
  article_tags: { tag: { name: string } | null }[] | null;
}
