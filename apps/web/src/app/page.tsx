import type { Metadata } from 'next';
import { SectionBlock } from '@/components/section-block';
import { NewsletterForm } from '@/components/newsletter-form';
import { JsonLd } from '@/components/json-ld';
import { cachedHomepage } from '@/lib/data';
import { collectionSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';

/**
 * Homepage.
 *
 * Statically rendered and revalidated on a timer, with on-demand invalidation
 * on publish doing the real work. A reader hits a cached HTML document at the
 * edge; Supabase is not touched on the request path at all.
 *
 * The whole page is assembled from `homepage_sections`, so the front page can
 * be re-ordered by an editor rather than by a deploy.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  /*
   * A database blip must not take the front page down. Next.js keeps serving
   * the last good static render, and the 60-second revalidate means the real
   * homepage returns as soon as the read succeeds again — so falling back to
   * the empty state here is a last resort, not the normal path.
   */
  const sections = await cachedHomepage().catch((error) => {
    console.error('Homepage query failed', error);
    return [];
  });

  if (!sections.length) return <EmptyState />;

  const leadArticles = sections[0]?.articles ?? [];

  return (
    <>
      <JsonLd
        data={collectionSchema({ name: `${SITE.name} — Latest`, path: '/', items: leadArticles })}
      />

      <h1 className="sr-only">{SITE.name} — latest news from Andhra Pradesh and Telangana</h1>

      {sections.map((section, index) => (
        <SectionBlock
          key={section.key}
          section={section}
          locale={SITE.defaultLocale}
          // Only the very first image is the LCP element. Marking more than one
          // priority makes every one of them arrive later.
          priority={index === 0}
        />
      ))}

      <section className="mt-14 rounded-sm border border-rule bg-paper-raised p-6 sm:p-8">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="text-2xl font-black tracking-tight text-ink">Get the morning briefing</h2>
          <p className="mt-2 text-sm text-ink-muted">
            The stories shaping Andhra Pradesh and Telangana, in your inbox before you start the
            day.
          </p>
          <NewsletterForm source="homepage" className="mx-auto mt-5 max-w-md" />
        </div>
      </section>
    </>
  );
}

/**
 * Shown before the first story is published. A newsroom's first day should not
 * look like a broken deployment.
 */
function EmptyState() {
  return (
    <div className="py-20 text-center">
      <p className="kicker">BCM10 News</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">
        The presses are warming up
      </h1>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        No stories have been published yet. Once the newsroom files its first report, it will appear
        here.
      </p>
    </div>
  );
}
