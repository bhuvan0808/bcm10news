import { z } from 'zod';

/**
 * YouTube URL handling.
 *
 * Reporters paste a normal YouTube link; they never paste iframe HTML. Parsing
 * happens here (and again server-side before the row is written) so that the
 * only thing that ever reaches an iframe `src` is an 11-character id that has
 * been matched against a strict pattern.
 */

/** A YouTube video id is exactly 11 characters of the URL-safe alphabet. */
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const youtubeVideoId = z.string().regex(YOUTUBE_ID_PATTERN, 'Not a valid YouTube video id');

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export interface ParsedYouTubeUrl {
  videoId: string;
  /** Shorts are rendered in a 9:16 frame rather than 16:9. */
  isShort: boolean;
  /** Normalised watch URL, stored as `original_url`. */
  canonicalUrl: string;
  /** Start offset in seconds, if the pasted link carried one. */
  startSeconds: number | null;
}

/**
 * Extracts a video id from any of the link shapes a reporter is likely to
 * paste. Returns null rather than throwing so callers can show a field-level
 * message.
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  // A bare id pasted on its own is accepted too — it happens constantly.
  if (YOUTUBE_ID_PATTERN.test(trimmed)) {
    return {
      videoId: trimmed,
      isShort: false,
      canonicalUrl: `https://www.youtube.com/watch?v=${trimmed}`,
      startSeconds: null,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  let videoId: string | null = null;
  let isShort = false;

  const segments = url.pathname.split('/').filter(Boolean);

  if (host.endsWith('youtu.be')) {
    // https://youtu.be/VIDEO_ID
    videoId = segments[0] ?? null;
  } else if (segments[0] === 'shorts') {
    // https://youtube.com/shorts/VIDEO_ID
    videoId = segments[1] ?? null;
    isShort = true;
  } else if (segments[0] === 'embed' || segments[0] === 'v' || segments[0] === 'live') {
    videoId = segments[1] ?? null;
  } else {
    // https://youtube.com/watch?v=VIDEO_ID
    videoId = url.searchParams.get('v');
  }

  if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) return null;

  return {
    videoId,
    isShort,
    canonicalUrl: isShort
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`,
    startSeconds: parseStart(url.searchParams.get('t') ?? url.searchParams.get('start')),
  };
}

function parseStart(raw: string | null): number | null {
  if (!raw) return null;

  // Plain seconds: "90"
  if (/^\d+$/.test(raw)) return Number(raw);

  // Duration form: "1h2m3s"
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (!match) return null;

  const [, h, m, s] = match;
  const seconds = Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return seconds > 0 ? seconds : null;
}

/**
 * Zod schema that accepts a pasted URL and produces the parsed shape, so a
 * form can bind straight to it.
 */
export const youtubeUrl = z
  .string()
  .trim()
  .min(1, 'Paste a YouTube link')
  .transform((value, ctx) => {
    const parsed = parseYouTubeUrl(value);
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'That does not look like a YouTube link',
      });
      return z.NEVER;
    }
    return parsed;
  });

/** Poster frame. `hqdefault` exists for every video; `maxresdefault` does not. */
export function youtubeThumbnail(
  videoId: string,
  quality: 'default' | 'mq' | 'hq' | 'sd' | 'maxres' = 'hq'
): string {
  const file = {
    default: 'default',
    mq: 'mqdefault',
    hq: 'hqdefault',
    sd: 'sddefault',
    maxres: 'maxresdefault',
  }[quality];
  return `https://i.ytimg.com/vi/${videoId}/${file}.jpg`;
}

/**
 * Privacy-enhanced embed URL. `youtube-nocookie.com` avoids setting tracking
 * cookies until the viewer actually plays the video.
 */
export function youtubeEmbedUrl(
  videoId: string,
  options: { autoplay?: boolean; start?: number | null } = {}
): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  if (options.autoplay) params.set('autoplay', '1');
  if (options.start) params.set('start', String(options.start));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
