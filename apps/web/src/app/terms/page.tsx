import type { Metadata } from 'next';
import { listMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata: Metadata = listMetadata({
  title: 'Terms of use',
  description: 'The terms on which BCM10 News is provided.',
  path: '/terms',
});

/**
 * Terms of use.
 *
 * DRAFT — accurate to how the platform behaves, but not legally reviewed.
 * The subscription, refund and content-licensing clauses in particular need a
 * lawyer's eye before launch, and the refund window below is a placeholder
 * pending a commercial decision.
 */
export default function TermsPage() {
  return (
    <article className="prose-article mx-auto max-w-(--container-prose)">
      <h1 className="text-3xl font-black tracking-tight text-ink">Terms of use</h1>
      <p className="text-sm text-ink-faint">Last updated: 1 September 2026</p>

      <p>
        These terms govern your use of {SITE.name}. By reading the site or creating an account, you
        accept them.
      </p>

      <h2>Using the site</h2>
      <p>
        You may read, link to and share our stories. You may not republish them in full, scrape the
        site at scale, or use our content to train a machine-learning model without a written
        licence. Business licensing is available — see <a href="/subscribe">subscriptions</a>.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for what happens under your account. Tell us promptly if you think
        someone else has access to it. We may suspend an account that is used to abuse the service
        or other readers.
      </p>

      <h2>Subscriptions and payment</h2>
      <ul>
        <li>Prices are shown before you pay and include applicable taxes.</li>
        <li>Subscriptions renew automatically until cancelled.</li>
        <li>
          You can cancel at any time. Access continues to the end of the period you have already
          paid for.
        </li>
        <li>
          Refunds are considered within 7 days of a charge where the service has not been
          substantially used.
        </li>
      </ul>

      <h2>Comments</h2>
      <p>
        Where comments are open, keep them civil and lawful. We moderate, and we remove abuse,
        defamation and anything that breaks Indian law. Comments are your own; publishing one does
        not make it ours.
      </p>

      <h2>Corrections</h2>
      <p>
        We correct errors. If you believe a story is wrong, write to{' '}
        <a href="mailto:corrections@bcm10news.in">corrections@bcm10news.in</a>. Substantive
        corrections are noted on the story itself.
      </p>

      <h2>Copyright</h2>
      <p>
        All content on this site is the property of {SITE.name} or its licensors and is protected by
        copyright.
      </p>

      <h2>Liability</h2>
      <p>
        The site is provided as is. We work to keep it accurate and available, but we do not
        guarantee either. Nothing here is professional, legal or financial advice.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of Andhra Pradesh have
        jurisdiction over any dispute arising from them.
      </p>
    </article>
  );
}
