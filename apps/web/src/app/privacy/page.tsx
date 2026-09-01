import type { Metadata } from 'next';
import { listMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata: Metadata = listMetadata({
  title: 'Privacy policy',
  description: 'How BCM10 News collects, uses and protects your information.',
  path: '/privacy',
});

/**
 * Privacy policy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DRAFT. This describes what the platform as built actually does — which
 * services receive data, what is stored, and for how long — so it is an
 * accurate starting point rather than boilerplate.
 *
 * It has not been reviewed by a lawyer. Before launch it must be checked
 * against India's Digital Personal Data Protection Act 2023, including the
 * consent-notice and grievance-officer requirements, and a named grievance
 * officer must be added below.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function PrivacyPage() {
  return (
    <article className="prose-article mx-auto max-w-(--container-prose)">
      <h1 className="text-3xl font-black tracking-tight text-ink">Privacy policy</h1>
      <p className="text-sm text-ink-faint">Last updated: 1 September 2026</p>

      <p>
        This policy explains what {SITE.name} collects when you read the site, what we do with it,
        and the choices you have.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>When you just read.</strong> We record which stories are opened and how far they are
        read. This is stored against a rotating daily hash of your IP address and browser, not
        against your identity — yesterday&rsquo;s hash cannot be linked to today&rsquo;s. We use it
        to work out which reporting people actually read.
      </p>
      <p>
        <strong>When you create an account.</strong> Your email address and name, supplied either
        directly or by Google if you sign in that way.
      </p>
      <p>
        <strong>When you subscribe.</strong> Billing details are handled by Razorpay, our payment
        processor. We never see or store your card number. We keep a record of what you paid and
        when, which we are required to retain for tax purposes.
      </p>
      <p>
        <strong>When you sign up for the newsletter.</strong> Your email address and which
        newsletters you asked for.
      </p>

      <h2>Who else receives data</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — hosts our database and handles sign-in.
        </li>
        <li>
          <strong>Vercel and Cloudflare</strong> — serve the site and its images.
        </li>
        <li>
          <strong>PostHog</strong> — product analytics: which stories are read and how far.
        </li>
        <li>
          <strong>Resend</strong> — sends email, including newsletters and account messages.
        </li>
        <li>
          <strong>Razorpay</strong> — processes payments.
        </li>
        <li>
          <strong>OneSignal</strong> — delivers browser notifications, if you opt in.
        </li>
        <li>
          <strong>Sentry</strong> — receives error reports when something breaks.
        </li>
        <li>
          <strong>YouTube</strong> — videos are embedded. We use the no-cookie player, so YouTube
          receives nothing until you press play.
        </li>
      </ul>
      <p>We do not sell your data, and we do not share it for advertising.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Unsubscribe from any newsletter using the link in its footer.</li>
        <li>Turn off notifications in your browser settings at any time.</li>
        <li>Ask us for a copy of your data, or ask us to delete your account.</li>
      </ul>

      <h2>How long we keep things</h2>
      <p>
        Account data is kept while your account is open and for 30 days afterwards. Payment records
        are kept for as long as tax law requires. Reading data is aggregated after 90 days and the
        individual records are discarded.
      </p>

      <h2>Contact</h2>
      <p>
        Write to <a href="mailto:privacy@bcm10news.in">privacy@bcm10news.in</a> with any question
        about this policy or to exercise any of the rights above.
      </p>
    </article>
  );
}
