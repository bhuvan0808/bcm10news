import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@bcm10/database/server';
import { formatPaise } from '@bcm10/validation';
import type { SubscriptionPlanRow } from '@bcm10/database';
import { listMetadata } from '@/lib/seo';

export const metadata: Metadata = listMetadata({
  title: 'Subscribe',
  description:
    'Support independent reporting from Andhra Pradesh and Telangana. Premium stories, the subscriber briefing and an ad-light read.',
  path: '/subscribe',
});

export const revalidate = 3600;

/**
 * Subscription plans.
 *
 * Prices come from the database, never from code — the spec is explicit about
 * that, and it is right: a price change should be an editor's afternoon, not a
 * deploy. Amounts are integer paise and are formatted for display only here.
 *
 * The page renders whether or not Razorpay is configured. Until it is, the
 * call to action is an enquiry rather than a checkout, so the newsroom can
 * publish this page before the payment account exists.
 */
export default async function SubscribePage() {
  const supabase = createPublicClient();

  const { data } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('position');

  const plans = (data ?? []) as SubscriptionPlanRow[];
  const readerPlans = plans.filter((plan) => plan.audience === 'reader');
  const businessPlans = plans.filter((plan) => plan.audience === 'business');

  const paymentsLive = Boolean(process.env['NEXT_PUBLIC_RAZORPAY_KEY_ID']);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="text-center">
        <p className="kicker">Subscribe</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Journalism costs money to produce
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          BCM10 keeps reporters in the districts, not just in the studio. A subscription pays for
          that work directly.
        </p>
      </header>

      {readerPlans.length ? (
        <section aria-labelledby="reader-plans" className="mt-10">
          <h2 id="reader-plans" className="sr-only">
            Reader plans
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {readerPlans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                highlighted={index === 1}
                paymentsLive={paymentsLive}
              />
            ))}
          </div>
        </section>
      ) : null}

      {businessPlans.length ? (
        <section aria-labelledby="business-plans" className="mt-14">
          <div className="border-b-2 border-ink pb-2">
            <h2 id="business-plans" className="text-xl font-black tracking-tight text-ink">
              For businesses and newsrooms
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Licensed access to BCM10 reporting for your organisation, with usage tracking and
              invoicing.
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {businessPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} paymentsLive={paymentsLive} business />
            ))}
          </div>
        </section>
      ) : null}

      {!plans.length ? (
        <p className="mt-10 rounded-sm border border-rule bg-paper-raised p-8 text-center text-ink-muted">
          Subscription plans are being finalised. Check back shortly.
        </p>
      ) : null}

      <section className="mt-14 rounded-sm border border-rule bg-paper-raised p-6">
        <h2 className="text-lg font-bold text-ink">Questions</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-ink">Can I cancel?</dt>
            <dd className="mt-1 text-ink-muted">
              Yes, at any time. Access continues until the end of the period you have paid for.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Which payment methods work?</dt>
            <dd className="mt-1 text-ink-muted">
              UPI, cards, net banking and wallets, through Razorpay.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Is most of the site still free?</dt>
            <dd className="mt-1 text-ink-muted">
              Yes. Breaking news and daily reporting stay free to read. A subscription unlocks
              premium investigations and analysis.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  highlighted = false,
  business = false,
  paymentsLive,
}: {
  plan: SubscriptionPlanRow;
  highlighted?: boolean;
  business?: boolean;
  paymentsLive: boolean;
}) {
  const isFree = plan.amount_paise === 0;
  const period = { monthly: 'month', annual: 'year', quarterly: 'quarter', one_time: 'once' }[
    plan.interval
  ];

  return (
    <div
      className={`flex flex-col rounded-sm border p-5 ${
        highlighted
          ? 'border-brand bg-brand-light/30 ring-1 ring-brand'
          : 'border-rule bg-paper-raised'
      }`}
    >
      {highlighted ? (
        <span className="mb-2 self-start rounded-xs bg-brand px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
          Most popular
        </span>
      ) : null}

      <h3 className="text-base font-bold text-ink">{plan.name}</h3>

      <p className="mt-2">
        <span className="text-3xl font-black tracking-tight text-ink">
          {isFree ? 'Free' : formatPaise(plan.amount_paise, plan.currency)}
        </span>
        {!isFree ? <span className="text-sm text-ink-faint"> / {period}</span> : null}
      </p>

      {plan.description ? (
        <p className="mt-2 flex-1 text-sm text-ink-muted">{plan.description}</p>
      ) : (
        <div className="flex-1" />
      )}

      {plan.license_quota ? (
        <p className="mt-2 text-sm font-medium text-ink">
          {plan.license_quota.toLocaleString('en-IN')} article licences each period
        </p>
      ) : null}

      <div className="mt-5">
        {isFree ? (
          <Link
            href="/account"
            className="block rounded-sm border border-rule-strong px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-paper-sunk"
          >
            Create a free account
          </Link>
        ) : paymentsLive && !business ? (
          <Link
            href={`/subscribe/checkout?plan=${plan.code}`}
            className={`block rounded-sm px-4 py-2.5 text-center text-sm font-semibold ${
              highlighted
                ? 'bg-brand text-white hover:bg-brand-dark'
                : 'border border-rule-strong text-ink hover:bg-paper-sunk'
            }`}
          >
            Subscribe
          </Link>
        ) : (
          // Before Razorpay is live, and for every B2B plan, the next step is
          // a conversation rather than a checkout.
          <Link
            href={`/contact?plan=${plan.code}`}
            className="block rounded-sm border border-rule-strong px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-paper-sunk"
          >
            {business ? 'Talk to us' : 'Register interest'}
          </Link>
        )}
      </div>
    </div>
  );
}
