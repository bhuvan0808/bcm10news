import {
  button,
  escapeHtml,
  heading,
  paragraph,
  renderLayout,
  type LayoutOptions,
} from '../render';
import type { SendEmailRequest } from '../types';

/**
 * Transactional message bodies.
 *
 * Each builder returns a complete SendEmailRequest, so callers supply data
 * rather than markup and every subject line lives in one reviewable place.
 */

export interface TemplateContext extends LayoutOptions {
  siteName: string;
  siteUrl: string;
}

export function welcomeEmail(
  ctx: TemplateContext,
  params: { to: string; name: string }
): SendEmailRequest {
  const html = renderLayout(
    heading(`Welcome to ${ctx.siteName}`) +
      paragraph(`Hello ${params.name}, thank you for joining us.`) +
      paragraph('You will now receive the stories that matter from Andhra Pradesh and Telangana.') +
      button('Read today’s news', ctx.siteUrl),
    { ...ctx, preheader: 'Your BCM10 News account is ready' }
  );

  return {
    to: { email: params.to, name: params.name },
    subject: `Welcome to ${ctx.siteName}`,
    html,
    template: 'welcome',
  };
}

export function storyAssignedEmail(
  ctx: TemplateContext,
  params: { to: string; reporterName: string; brief: string; dueAt?: string; link: string }
): SendEmailRequest {
  const quote = `<blockquote style="margin:0 0 14px;padding:12px 16px;background:#fafafa;border-left:3px solid #c62828;">${escapeHtml(params.brief)}</blockquote>`;

  const html = renderLayout(
    heading('You have a new assignment') +
      paragraph(`${params.reporterName}, the desk has assigned you a story.`) +
      quote +
      (params.dueAt ? paragraph(`Filing deadline: ${params.dueAt}`) : '') +
      button('Open the assignment', params.link),
    { ...ctx, preheader: params.brief.slice(0, 100) }
  );

  return {
    to: { email: params.to },
    subject: 'New assignment from the desk',
    html,
    template: 'story_assigned',
  };
}

export function storySubmittedEmail(
  ctx: TemplateContext,
  params: { to: string; title: string; reporterName: string; link: string }
): SendEmailRequest {
  const html = renderLayout(
    heading('A story is waiting for review') +
      paragraph(`${params.reporterName} submitted "${params.title}".`) +
      button('Review it', params.link),
    { ...ctx, preheader: `${params.reporterName} submitted ${params.title}` }
  );

  return {
    to: { email: params.to },
    subject: `Review: ${params.title}`,
    html,
    template: 'story_submitted',
  };
}

export function storyApprovedEmail(
  ctx: TemplateContext,
  params: { to: string; title: string; editorName: string; link: string }
): SendEmailRequest {
  const html = renderLayout(
    heading('Your story was approved') +
      paragraph(`${params.editorName} approved "${params.title}". It is queued to publish.`) +
      button('View the story', params.link),
    { ...ctx, preheader: `${params.title} was approved` }
  );

  return {
    to: { email: params.to },
    subject: `Approved: ${params.title}`,
    html,
    template: 'story_approved',
  };
}

export function changesRequestedEmail(
  ctx: TemplateContext,
  params: { to: string; title: string; editorName: string; comment: string; link: string }
): SendEmailRequest {
  const quote = `<blockquote style="margin:0 0 14px;padding:12px 16px;background:#fff8e1;border-left:3px solid #f59e0b;">${escapeHtml(params.comment)}</blockquote>`;

  const html = renderLayout(
    heading('An editor requested changes') +
      paragraph(`${params.editorName} sent "${params.title}" back with notes.`) +
      quote +
      button('Open and revise', params.link),
    { ...ctx, preheader: params.comment.slice(0, 100) }
  );

  return {
    to: { email: params.to },
    subject: `Changes requested: ${params.title}`,
    html,
    template: 'story_changes_requested',
  };
}

export function subscriptionConfirmedEmail(
  ctx: TemplateContext,
  params: { to: string; planName: string; amount: string; renewsOn?: string }
): SendEmailRequest {
  const html = renderLayout(
    heading('Your subscription is active') +
      paragraph(`Thank you for subscribing to ${params.planName}.`) +
      paragraph(`Amount paid: ${params.amount}`) +
      (params.renewsOn ? paragraph(`Renews on ${params.renewsOn}.`) : '') +
      button('Start reading', ctx.siteUrl),
    { ...ctx, preheader: `${params.planName} is now active` }
  );

  return {
    to: { email: params.to },
    subject: 'Your BCM10 News subscription is active',
    html,
    template: 'subscription_confirmed',
  };
}

export function paymentFailedEmail(
  ctx: TemplateContext,
  params: { to: string; planName: string; retryUrl: string; reason?: string }
): SendEmailRequest {
  const html = renderLayout(
    heading('We could not process your payment') +
      paragraph(`Your payment for ${params.planName} did not go through.`) +
      (params.reason ? paragraph(`Reason given by the bank: ${params.reason}`) : '') +
      paragraph('Your access continues until the end of the current period.') +
      button('Update payment method', params.retryUrl),
    { ...ctx, preheader: 'Action needed on your subscription' }
  );

  return {
    to: { email: params.to },
    subject: 'Payment failed — action needed',
    html,
    template: 'payment_failed',
  };
}

export function newsletterConfirmEmail(
  ctx: TemplateContext,
  params: { to: string; confirmUrl: string }
): SendEmailRequest {
  const html = renderLayout(
    heading('Confirm your subscription') +
      paragraph('Tap the button below to start receiving the BCM10 News digest.') +
      button('Confirm', params.confirmUrl) +
      paragraph('If you did not request this, you can ignore this message.'),
    { ...ctx, preheader: 'One tap to confirm your newsletter subscription' }
  );

  return {
    to: { email: params.to },
    subject: 'Confirm your BCM10 News subscription',
    html,
    template: 'newsletter_confirm',
  };
}

export interface DigestStory {
  title: string;
  excerpt: string | null;
  url: string;
  categoryName: string;
  imageUrl?: string | null;
}

function digestStoryBlock(story: DigestStory): string {
  const kicker = `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#c62828;font-weight:700;margin-bottom:4px;">${escapeHtml(story.categoryName)}</div>`;
  const link = `<a href="${escapeHtml(story.url)}" style="font-size:17px;font-weight:700;color:#18181b;text-decoration:none;line-height:1.35;">${escapeHtml(story.title)}</a>`;
  const excerpt = story.excerpt
    ? `<p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:1.55;">${escapeHtml(story.excerpt)}</p>`
    : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td>${kicker}${link}${excerpt}</td></tr></table>`;
}

export function dailyDigestEmail(
  ctx: TemplateContext,
  params: { to: string; stories: DigestStory[]; unsubscribeUrl: string; dateLabel: string }
): SendEmailRequest {
  const divider = '<hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 20px;">';
  const stories = params.stories.map(digestStoryBlock).join(divider);

  const html = renderLayout(heading(`Today’s briefing — ${params.dateLabel}`) + stories, {
    ...ctx,
    preheader: params.stories[0]?.title ?? 'Your daily briefing',
    unsubscribeUrl: params.unsubscribeUrl,
  });

  return {
    to: { email: params.to },
    subject: `BCM10 briefing — ${params.dateLabel}`,
    html,
    template: 'daily_digest',
    unsubscribeUrl: params.unsubscribeUrl,
  };
}

export function breakingNewsEmail(
  ctx: TemplateContext,
  params: { to: string; title: string; excerpt: string | null; url: string; unsubscribeUrl: string }
): SendEmailRequest {
  const badge = `<div style="display:inline-block;background:#c62828;color:#fff;font-size:11px;font-weight:800;letter-spacing:0.08em;padding:4px 10px;border-radius:3px;margin-bottom:12px;">BREAKING</div>`;

  const html = renderLayout(
    badge +
      heading(params.title) +
      (params.excerpt ? paragraph(params.excerpt) : '') +
      button('Read the full story', params.url),
    { ...ctx, preheader: params.title, unsubscribeUrl: params.unsubscribeUrl }
  );

  return {
    to: { email: params.to },
    subject: `Breaking: ${params.title}`,
    html,
    template: 'breaking_news',
    unsubscribeUrl: params.unsubscribeUrl,
  };
}
