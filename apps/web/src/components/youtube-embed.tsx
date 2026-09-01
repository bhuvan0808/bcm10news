'use client';

import { useState } from 'react';
import { youtubeEmbedUrl, youtubeThumbnail } from '@bcm10/validation';
import { cn } from '@bcm10/ui';

/**
 * Lazy YouTube embed ("facade" pattern).
 *
 * The real iframe is not mounted until the reader presses play. This matters
 * a lot on an article page: YouTube's embed pulls roughly a megabyte of
 * JavaScript and sets third-party cookies, and on a story with three videos
 * that is three megabytes a reader pays for before the first paragraph
 * renders. Until then this is one thumbnail and a button.
 *
 * The poster comes from i.ytimg.com and the player from youtube-nocookie.com,
 * so nothing is set until there is an actual intent to watch.
 */
export function YouTubeEmbed({
  videoId,
  title,
  isShort = false,
  start = null,
  className,
}: {
  videoId: string;
  title: string;
  isShort?: boolean;
  start?: number | null;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-sm bg-black',
        // Shorts are portrait; forcing them into 16:9 pillarboxes them badly.
        isShort ? 'mx-auto aspect-[9/16] max-w-sm' : 'aspect-video',
        className
      )}
    >
      {playing ? (
        <iframe
          src={youtubeEmbedUrl(videoId, { autoplay: true, start })}
          title={title}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 size-full cursor-pointer"
          aria-label={`Play video: ${title}`}
        >
          {/* Plain <img>: this is a third-party poster on a fixed URL, so the
              Next.js optimizer would add a hop without adding value. */}
          <img
            src={youtubeThumbnail(videoId, isShort ? 'hq' : 'maxres')}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />

          <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />

          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-brand/95 shadow-lg transition-transform group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 size-7 fill-white" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>

          {title ? (
            <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3 text-left text-sm font-semibold text-white">
              {title}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}
