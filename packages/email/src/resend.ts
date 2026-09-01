import { Resend } from 'resend';
import { htmlToText } from './render';
import type { EmailService, SendEmailRequest, SendEmailResult } from './types';

/**
 * Resend implementation.
 *
 * Never throws. A publish must not fail because a notification email did —
 * the story is the product, the email is a side effect. Failures come back as
 * `{ ok: false }` for the caller to log and, if it matters, retry.
 */
export class ResendEmailService implements EmailService {
  readonly enabled = true;
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly defaultReplyTo?: string
  ) {
    this.client = new Resend(apiKey);
  }

  async send(request: SendEmailRequest): Promise<SendEmailResult> {
    try {
      const recipients = Array.isArray(request.to) ? request.to : [request.to];

      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: recipients.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
        subject: request.subject,
        html: request.html,
        text: request.text ?? htmlToText(request.html),
        replyTo: request.replyTo ?? this.defaultReplyTo,
        tags: [
          { name: 'template', value: request.template },
          ...Object.entries(request.tags ?? {}).map(([name, value]) => ({
            name,
            // Resend tag values allow only ASCII letters, digits, _ and -.
            value: value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 250),
          })),
        ],
        headers: request.unsubscribeUrl
          ? {
              'List-Unsubscribe': `<${request.unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            }
          : undefined,
      });

      if (error) return { ok: false, messageId: null, error: error.message };
      return { ok: true, messageId: data?.id ?? null };
    } catch (cause) {
      return {
        ok: false,
        messageId: null,
        error: cause instanceof Error ? cause.message : 'Unknown email error',
      };
    }
  }

  /**
   * Resend's batch endpoint caps at 100 messages, so larger sends are chunked.
   * Used by the digest and breaking-news mailers.
   */
  async sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResult[]> {
    const results: SendEmailResult[] = [];

    for (let i = 0; i < requests.length; i += 100) {
      const chunk = requests.slice(i, i + 100);
      try {
        const { data, error } = await this.client.batch.send(
          chunk.map((request) => {
            const recipients = Array.isArray(request.to) ? request.to : [request.to];
            return {
              from: this.from,
              to: recipients.map((r) => r.email),
              subject: request.subject,
              html: request.html,
              text: request.text ?? htmlToText(request.html),
              headers: request.unsubscribeUrl
                ? {
                    'List-Unsubscribe': `<${request.unsubscribeUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                  }
                : undefined,
            };
          })
        );

        if (error) {
          results.push(...chunk.map(() => ({ ok: false, messageId: null, error: error.message })));
        } else {
          const ids = data?.data ?? [];
          results.push(
            ...chunk.map((_, index) => ({ ok: true, messageId: ids[index]?.id ?? null }))
          );
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unknown batch email error';
        results.push(...chunk.map(() => ({ ok: false, messageId: null, error: message })));
      }
    }

    return results;
  }
}

/**
 * Stand-in used when RESEND_API_KEY is absent.
 *
 * The platform must run end to end before every vendor account exists. This
 * logs what would have been sent and reports `skipped`, so a developer sees
 * the message without a key and the caller can tell "not sent" from "failed".
 */
export class NoopEmailService implements EmailService {
  readonly enabled = false;

  async send(request: SendEmailRequest): Promise<SendEmailResult> {
    const to = Array.isArray(request.to) ? request.to : [request.to];
    console.info(
      `[email:noop] ${request.template} -> ${to.map((r) => r.email).join(', ')}: ${request.subject}`
    );
    return { ok: true, messageId: null, skipped: true };
  }

  async sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResult[]> {
    return Promise.all(requests.map((request) => this.send(request)));
  }
}

export function createEmailService(env: NodeJS.ProcessEnv = process.env): EmailService {
  const apiKey = env['RESEND_API_KEY'];
  if (!apiKey) return new NoopEmailService();

  return new ResendEmailService(
    apiKey,
    env['RESEND_FROM_EMAIL'] ?? 'BCM10 News <news@bcm10news.in>',
    env['RESEND_REPLY_TO']
  );
}
