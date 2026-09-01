import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@bcm10/database/server';
import { formatPaise } from '@bcm10/validation';
import { ArticleCard } from '@/components/article-card';
import { ReaderSignIn } from './sign-in';
import { listMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = listMetadata({
  title: 'Your account',
  description: 'Manage your BCM10 News subscription, saved stories and alerts.',
  path: '/account',
  noindex: true,
});

/**
 * Reader account.
 *
 * Fully dynamic — everything on it is per-reader, so there is nothing here a
 * cache could safely hold.
 *
 * Signed out, this is the sign-in page rather than a redirect: readers reach
 * /account from a paywall, and bouncing them to a separate URL loses the
 * context of the story they were trying to read.
 */
export const dynamic = 'force-dynamic';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-sm py-10">
        <h1 className="text-2xl font-black tracking-tight text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Save stories, follow reporters and manage your subscription.
        </p>
        <ReaderSignIn returnTo={safeReturn(from)} className="mt-6" />
      </div>
    );
  }

  const [profileResult, subscriptionResult, savedResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('*, plan:subscription_plans(name, amount_paise, currency, interval)')
      .eq('profile_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle(),
    supabase
      .from('saved_articles')
      .select('article_id')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const profile = profileResult.data;
  const subscription = subscriptionResult.data as
    | (typeof subscriptionResult.data & {
        plan: { name: string; amount_paise: number; currency: string; interval: string } | null;
      })
    | null;

  const savedIds = (savedResult.data ?? []).map((row) => row.article_id);
  const { data: savedArticles } = savedIds.length
    ? await supabase.from('article_previews').select('*').in('id', savedIds)
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b-2 border-ink pb-4">
        <p className="kicker">Your account</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">
          {profile?.display_name || profile?.full_name || user.email}
        </h1>
        <p className="mt-1 text-sm text-ink-faint">{user.email}</p>
      </header>

      <section aria-labelledby="subscription-heading" className="mt-8">
        <h2 id="subscription-heading" className="text-lg font-bold text-ink">
          Subscription
        </h2>

        {subscription ? (
          <div className="mt-3 rounded-sm border border-rule bg-paper-raised p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">{subscription.plan?.name ?? 'Premium'}</p>
              <span
                className={`rounded-xs px-2 py-0.5 text-xs font-bold uppercase ${
                  subscription.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {subscription.status.replace(/_/g, ' ')}
              </span>
            </div>

            {subscription.plan ? (
              <p className="mt-1 text-sm text-ink-muted">
                {formatPaise(subscription.plan.amount_paise, subscription.plan.currency)} per{' '}
                {subscription.plan.interval === 'annual' ? 'year' : 'month'}
              </p>
            ) : null}

            {subscription.current_period_end ? (
              <p className="mt-2 text-sm text-ink-muted">
                {subscription.cancel_at_period_end ? 'Ends' : 'Renews'} on{' '}
                {formatDate(subscription.current_period_end)}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 rounded-sm border border-rule bg-paper-raised p-4">
            <p className="text-sm text-ink-muted">
              You are on the free plan. Premium stories and the subscriber briefing are not
              included.
            </p>
            <Link
              href="/subscribe"
              className="mt-3 inline-block rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              See plans
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="saved-heading" className="mt-10">
        <h2 id="saved-heading" className="text-lg font-bold text-ink">
          Saved stories
        </h2>

        {savedArticles?.length ? (
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            {savedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} variant="standard" />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-sm border border-dashed border-rule p-6 text-center text-sm text-ink-muted">
            Nothing saved yet. Use the save button on a story to keep it here.
          </p>
        )}
      </section>

      <section className="mt-10 border-t border-rule pt-6">
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="rounded-sm border border-rule-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-paper-sunk"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}

/** Only site-relative paths, so a crafted `from` cannot become an open redirect. */
function safeReturn(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/account';
  return value;
}
