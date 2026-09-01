import Link from 'next/link';
import { createAdminClient } from '@bcm10/database/admin';

export const metadata = {
  title: 'Confirm your subscription',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Double opt-in confirmation.
 *
 * Uses the service-role client because `newsletter_subscribers` is not
 * readable or writable by an anonymous caller — the token in the URL is the
 * only credential, and it is single-use: confirming clears it, so a forwarded
 * link cannot be replayed.
 */
export default async function ConfirmNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) return <Result ok={false} message="That confirmation link is incomplete." />;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .update({
      is_confirmed: true,
      confirmed_at: new Date().toISOString(),
      confirmation_token: null,
      unsubscribed_at: null,
    })
    .eq('confirmation_token', token)
    .select('email')
    .maybeSingle();

  if (error) {
    console.error('Newsletter confirmation failed', error.message);
    return <Result ok={false} message="Something went wrong. Please try the link again." />;
  }

  if (!data) {
    // Either already used or invalid. The wording covers both without
    // revealing which, so the endpoint cannot be used to probe for tokens.
    return (
      <Result
        ok={false}
        message="That link has already been used, or it has expired. If you are already subscribed, there is nothing more to do."
      />
    );
  }

  return <Result ok message={`You are subscribed. The briefing will arrive at ${data.email}.`} />;
}

function Result({ ok, message }: { ok: boolean; message: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="kicker">Newsletter</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-ink">
        {ok ? 'You are all set' : 'We could not confirm that'}
      </h1>
      <p className="mt-3 text-ink-muted">{message}</p>

      <Link
        href="/"
        className="mt-6 inline-block rounded-sm bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Read today&rsquo;s news
      </Link>
    </div>
  );
}
