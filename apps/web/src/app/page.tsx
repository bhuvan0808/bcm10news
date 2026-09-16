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
   * This deliberately does not catch.
   *
   * It used to. The reasoning was that a database blip must not take the front
   * page down, and that Next would keep serving the last good render — but
   * catching produced the exact opposite. A caught error returns a *successful*
   * render of zero sections, ISR caches that, and the last good copy is gone.
   * Every subsequent revalidation re-caches it. The front page of a news site
   * then reads "No stories have been published yet" to every reader and to
   * Google, which is far worse than being briefly unavailable: it is
   * confidently wrong, and it outlives the outage that caused it.
   *
   * Letting it throw is what actually delivers the intended behaviour. ISR
   * keeps serving the previously cached page when a background regeneration
   * fails, and retries on the next revalidate. The empty state below is then
   * what it claims to be — a genuinely empty newsroom, not a symptom.
   *
   * Observed in production: with Supabase paused, the homepage served the
   * empty state while a published article existed.
   *
   * The one exception is `next build`. CI builds with placeholder credentials
   * and no database by design — a build must not need production secrets, or
   * it cannot run on a fork's pull request — so throwing there would fail
   * every CI run rather than surface anything. A build-time fallback is also
   * far narrower than the runtime one: it can only produce an empty page on a
   * fresh deploy, and the 60-second revalidate replaces it as soon as the
   * first read succeeds.
   */
  const sections = await cachedHomepage().catch((error) => {
    if (process.env['NEXT_PHASE'] === 'phase-production-build') {
      console.warn('Homepage prerendered without a database; will fill in on first revalidate.');
      return [];
    }
    throw error;
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
