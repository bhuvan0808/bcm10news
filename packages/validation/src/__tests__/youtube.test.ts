import { describe, expect, it } from 'vitest';
import { parseYouTubeUrl, youtubeEmbedUrl, youtubeThumbnail } from '../youtube';

describe('parseYouTubeUrl', () => {
  it('reads the standard watch URL', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({
      videoId: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('reads the short youtu.be form', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({
      videoId: 'dQw4w9WgXcQ',
      isShort: false,
    });
  });

  it('reads Shorts and flags them, so the player can use a 9:16 frame', () => {
    expect(parseYouTubeUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toMatchObject({
      videoId: 'dQw4w9WgXcQ',
      isShort: true,
    });
  });

  it('reads embed and live URLs', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')?.videoId).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ')?.videoId).toBe('dQw4w9WgXcQ');
  });

  it('survives the tracking parameters a share link carries', () => {
    const parsed = parseYouTubeUrl(
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&si=abc123&list=PL123'
    );
    expect(parsed?.videoId).toBe('dQw4w9WgXcQ');
  });

  it('accepts a bare id, because reporters paste those', () => {
    expect(parseYouTubeUrl('dQw4w9WgXcQ')?.videoId).toBe('dQw4w9WgXcQ');
  });

  it('normalises the stored URL regardless of the form pasted', () => {
    expect(parseYouTubeUrl('youtu.be/dQw4w9WgXcQ')?.canonicalUrl).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
  });

  it('reads a start offset in both seconds and duration form', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=90')?.startSeconds).toBe(90);
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=1h2m3s')?.startSeconds).toBe(3723);
  });

  it('rejects hosts that only look like YouTube', () => {
    expect(parseYouTubeUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeUrl('https://vimeo.com/123456')).toBeNull();
  });

  it('rejects ids of the wrong length, so nothing malformed reaches an iframe', () => {
    expect(parseYouTubeUrl('https://youtu.be/short')).toBeNull();
    expect(parseYouTubeUrl('https://youtu.be/waaaaaaaaaaaaaytoolong')).toBeNull();
  });

  it('rejects javascript: and other non-http schemes', () => {
    expect(parseYouTubeUrl('javascript:alert(1)')).toBeNull();
    expect(parseYouTubeUrl('')).toBeNull();
  });
});

describe('youtubeEmbedUrl', () => {
  it('uses the no-cookie host', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('carries autoplay and start when asked', () => {
    const url = youtubeEmbedUrl('dQw4w9WgXcQ', { autoplay: true, start: 30 });
    expect(url).toContain('autoplay=1');
    expect(url).toContain('start=30');
  });
});

describe('youtubeThumbnail', () => {
  it('defaults to hqdefault, which exists for every video', () => {
    expect(youtubeThumbnail('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});
