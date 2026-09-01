import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@bcm10/database/server';
import { AUTHOR_SELECT, type Author } from '@bcm10/database';
import { JsonLd } from '@/components/json-ld';
import { listMetadata, organizationSchema } from '@/lib/seo';
import { SITE, authorPath } from '@/lib/site';

export const metadata: Metadata = listMetadata({
  title: 'About us',
  description: 'Who we are, how we report, and how to reach the BCM10 News newsroom.',
  path: '/about',
});

export const revalidate = 3600;

/**
 * About.
 *
 * Also serves a practical purpose: an about page naming the newsroom and its
 * reporters is one of the signals Google News weighs when deciding whether a
 * site is a real publisher. The masthead is generated from the profiles table
 * rather than hand-maintained, so it cannot drift out of date.
 */
export default async function AboutPage() {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from('author_profiles')
    .select(AUTHOR_SELECT)
    .order('article_count', { ascending: false })
    .limit(30);

  const staff = (data ?? []) as Author[];

  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', ...organizationSchema() }} />

      <div className="mx-auto max-w-(--container-prose)">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
          About {SITE.name}
        </h1>

        <div className="prose-article mt-6">
          <p>
            {SITE.name} reports from Andhra Pradesh and Telangana — politics, business, sport and
            cinema — in Telugu and English.
          </p>
          <p>
            We keep reporters in the districts rather than only in the studio, because the stories
            that matter most to our readers rarely start in a press conference.
          </p>

          <h2>How we work</h2>
          <p>
            Every story is written by a named reporter and read by an editor before it is published.
            When we get something wrong we correct it on the story itself and say what changed.
          </p>
          <p>
            Sponsored content is labelled. Our subscriptions and our reporting are kept separate:
            paying does not buy influence over what we cover.
          </p>

          <h2>Contact</h2>
          <p>
            News desk: <a href="mailto:news@bcm10news.in">news@bcm10news.in</a>
            <br />
            Corrections: <a href="mailto:corrections@bcm10news.in">corrections@bcm10news.in</a>
            <br />
            Advertising and licensing:{' '}
            <a href="mailto:business@bcm10news.in">business@bcm10news.in</a>
          </p>
        </div>

        {staff.length ? (
          <section aria-labelledby="masthead" className="mt-12">
            <h2
              id="masthead"
              className="border-b-2 border-ink pb-2 text-xl font-black tracking-tight"
            >
              The newsroom
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {staff.map((person) => (
                <li key={person.id}>
                  <Link
                    href={authorPath(person.slug)}
                    className="block rounded-sm border border-rule bg-paper-raised p-3 hover:border-rule-strong"
                  >
                    <p className="font-semibold text-ink">{person.name}</p>
                    {person.designation ? (
                      <p className="text-xs text-ink-muted">{person.designation}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink-faint">
                      {person.article_count} {person.article_count === 1 ? 'story' : 'stories'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
