/**
 * Email seam.
 *
 * Article publishing never calls Resend directly. It calls `EmailService`,
 * which means a delivery outage degrades to a queued send rather than a failed
 * publish, and a provider change is one implementation.
 */

export type EmailTemplate =
  | 'welcome'
  | 'verify_email'
  | 'magic_link'
  | 'password_reset'
  | 'subscription_confirmed'
  | 'payment_receipt'
  | 'payment_failed'
  | 'subscription_expiring'
  | 'subscription_cancelled'
  | 'story_assigned'
  | 'story_submitted'
  | 'story_approved'
  | 'story_changes_requested'
  | 'story_published'
  | 'newsletter_confirm'
  | 'daily_digest'
  | 'breaking_news';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailRequest {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  template: EmailTemplate;
  replyTo?: string;
  /** Threaded into the Resend webhook payload so events can be correlated. */
  tags?: Record<string, string>;
  /** One-click unsubscribe header, required for bulk mail. */
  unsubscribeUrl?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId: string | null;
  error?: string;
  /** True when no provider is configured and the send was a no-op. */
  skipped?: boolean;
}

export interface EmailService {
  readonly enabled: boolean;
  send(request: SendEmailRequest): Promise<SendEmailResult>;
  sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResult[]>;
}
