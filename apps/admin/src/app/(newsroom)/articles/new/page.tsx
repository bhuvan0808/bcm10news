import { createClient } from '@bcm10/database/server';
import { getAllCategories } from '@bcm10/database';
import { EMPTY_DOC } from '@bcm10/validation';
import { ArticleForm } from '@/components/article-form';
import { requireNewsroomUser } from '@/lib/auth';

export const metadata = { title: 'New story' };

/**
 * New story.
 *
 * Nothing is written until the reporter presses "Create story". Creating an
 * empty draft row on page load would fill the newsroom queue with abandoned
 * blanks every time someone opened this page by accident.
 */
export default async function NewArticlePage() {
  const session = await requireNewsroomUser('/articles/new');
  const supabase = await createClient();

  const [categories, locations] = await Promise.all([
    getAllCategories(supabase).catch(() => []),
    supabase
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => data ?? []),
  ]);

  return (
    <ArticleForm
      initial={{
        status: 'draft',
        title: '',
        titleTe: '',
        subtitle: '',
        excerpt: '',
        slug: '',
        language: session.profile.preferred_language,
        body: EMPTY_DOC,
        categoryId: '',
        secondaryCategoryId: '',
        locationId: '',
        featuredImage: null,
        videoUrls: [],
        tagNames: [],
        isBreaking: false,
        isExclusive: false,
        isPremium: false,
        isFeatured: false,
        isSponsored: false,
        allowComments: true,
        previewParagraphs: 3,
        seoTitle: '',
        seoDescription: '',
        scheduledFor: null,
      }}
      categories={categories}
      locations={locations}
      canPublish={session.canPublish}
      isEditorial={session.isEditorial}
    />
  );
}
