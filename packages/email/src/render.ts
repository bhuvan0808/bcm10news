/**
 * Minimal HTML email rendering.
 *
 * Deliberately hand-written rather than component-based: email clients need
 * table layout and inline styles, and a React renderer buys little for the
 * dozen transactional messages here. Everything interpolated is escaped, since
 * a story headline can contain quotes and angle brackets.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutOptions {
  siteName: string;
  siteUrl: string;
  preheader?: string;
  unsubscribeUrl?: string;
  /** Telugu needs a font stack that will not fall back to tofu in Outlook. */
  language?: 'te' | 'en';
}

const FONT_STACK =
  "'Noto Sans Telugu', 'Gautami', 'Nirmala UI', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function renderLayout(content: string, options: LayoutOptions): string {
  const { siteName, siteUrl, preheader, unsubscribeUrl } = options;

  return `<!doctype html>
<html lang="${options.language ?? 'te'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(siteName)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT_STACK};">
${
  preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : ''
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;border-bottom:3px solid #c62828;">
          <a href="${escapeHtml(siteUrl)}" style="font-size:20px;font-weight:800;color:#c62828;text-decoration:none;letter-spacing:-0.02em;">
            ${escapeHtml(siteName)}
          </a>
        </td>
      </tr>
      <tr><td style="padding:24px;color:#18181b;font-size:15px;line-height:1.65;">
${content}
      </td></tr>
      <tr>
        <td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.6;">
          <p style="margin:0 0 8px;">&copy; ${new Date().getFullYear()} ${escapeHtml(siteName)}</p>
          ${
            unsubscribeUrl
              ? `<p style="margin:0;"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;">Unsubscribe</a></p>`
              : ''
          }
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr><td style="background:#c62828;border-radius:6px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">
      ${escapeHtml(label)}
    </a>
  </td></tr>
</table>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#18181b;">${escapeHtml(text)}</h1>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;">${escapeHtml(text)}</p>`;
}

/** Plain-text alternative. Spam filters treat an HTML-only message as a signal. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
