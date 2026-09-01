import type { Metadata } from 'next';
import { createPublicClient } from '@bcm10/database/server';
import { getSiteSettings } from '@bcm10/database';
import { listMetadata } from '@/lib/seo';

export const metadata: Metadata = listMetadata({
  title: 'Contact us',
  description: 'How to reach the BCM10 News newsroom, business desk and support team.',
  path: '/contact',
});

export const revalidate = 3600;

const DESKS = [
  {
    title: 'News desk',
    email: 'news@bcm10news.in',
    description: 'Tips, press releases and story suggestions.',
  },
  {
    title: 'Corrections',
    email: 'corrections@bcm10news.in',
    description: 'Something we published is wrong. Include the story link.',
  },
  {
    title: 'Business and licensing',
    email: 'business@bcm10news.in',
    description: 'Advertising, content licensing and partnerships.',
  },
  {
    title: 'Subscriptions',
    email: 'support@bcm10news.in',
    description: 'Billing, access and account questions.',
  },
];

/**
 * Contact.
 *
 * Deliberately a list of email addresses rather than a contact form. A form
 * needs spam handling, a queue and someone watching it; an address a reporter
 * already reads gets a faster answer, and a tip that arrives by email keeps
 * the sender's own copy.
 */
export default async function ContactPage() {
  const settings = await getSiteSettings(createPublicClient()).catch(() => null);

  return (
    <div className="mx-auto max-w-(--container-prose)">
      <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Contact us</h1>
      <p className="mt-3 text-ink-muted">
        Pick the desk closest to what you need — it will reach the right person faster.
      </p>

      <ul className="mt-8 space-y-3">
        {DESKS.map((desk) => (
          <li key={desk.email} className="rounded-sm border border-rule bg-paper-raised p-4">
            <h2 className="font-bold text-ink">{desk.title}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{desk.description}</p>
            <a
              href={`mailto:${desk.email}`}
              className="mt-2 inline-block font-medium text-brand hover:underline"
            >
              {desk.email}
            </a>
          </li>
        ))}
      </ul>

      {settings?.office_address || settings?.contact_phone ? (
        <section className="mt-10 rounded-sm border border-rule bg-paper-raised p-4">
          <h2 className="font-bold text-ink">Office</h2>
          {settings.office_address ? (
            <address className="mt-1 text-sm whitespace-pre-line text-ink-muted not-italic">
              {settings.office_address}
            </address>
          ) : null}
          {settings.contact_phone ? (
            <a
              href={`tel:${settings.contact_phone}`}
              className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
            >
              {settings.contact_phone}
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
