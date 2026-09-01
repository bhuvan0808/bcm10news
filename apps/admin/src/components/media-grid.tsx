'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaRow } from '@bcm10/database';
import { Button, Field, Input } from '@bcm10/ui';
import { ImageUploader } from './image-uploader';
import { updateMedia } from '@/lib/actions/media';
import { ADMIN } from '@/lib/site';
import { formatRelative } from '@/lib/format';

/**
 * Media library grid.
 *
 * The detail panel exists mainly to nag about alt text. An image published
 * without it is inaccessible to screen-reader users and invisible to image
 * search, and the only moment anyone will realistically write it is here,
 * right after the upload.
 */
export function MediaGrid({
  items,
  page,
  perPage,
  total,
}: {
  items: MediaRow[];
  page: number;
  perPage: number;
  total: number;
}) {
  const [selected, setSelected] = useState<MediaRow | null>(null);
  const router = useRouter();
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <div className="mt-5">
        <ImageUploader
          label="Upload to the library"
          onUploaded={() => router.refresh()}
          className="max-w-sm"
        />
      </div>

      {items.length ? (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((media) => {
            const missingAlt = !media.alt_text?.trim();

            return (
              <li key={media.id}>
                <button
                  type="button"
                  onClick={() => setSelected(media)}
                  className="group block w-full text-left"
                >
                  <div className="relative aspect-square overflow-hidden rounded-sm bg-paper-sunk">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${ADMIN.mediaBaseUrl}/${media.storage_key}`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />

                    {missingAlt ? (
                      <span
                        className="absolute left-1 top-1 rounded-xs bg-brand px-1 py-0.5 text-[10px] font-bold uppercase text-white"
                        title="This image has no alt text"
                      >
                        No alt
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {media.title || media.alt_text || 'Untitled'}
                  </p>
                  <p className="truncate text-[11px] text-ink-faint">
                    {media.width}×{media.height} ·{' '}
                    <time dateTime={media.created_at} suppressHydrationWarning>
                      {formatRelative(media.created_at)}
                    </time>
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 rounded-sm border border-dashed border-rule p-12 text-center">
          <p className="font-semibold text-ink">Nothing in the library yet</p>
          <p className="mt-1 text-sm text-ink-muted">Upload a picture to get started.</p>
        </div>
      )}

      {lastPage > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex justify-center gap-2">
          {page > 1 ? (
            <Link
              href={`/media?page=${page - 1}`}
              className="rounded-sm border border-rule px-3 py-1.5 text-sm hover:bg-paper-sunk"
            >
              Previous
            </Link>
          ) : null}
          <span className="px-3 py-1.5 text-sm text-ink-muted">
            Page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link
              href={`/media?page=${page + 1}`}
              className="rounded-sm border border-rule px-3 py-1.5 text-sm hover:bg-paper-sunk"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}

      {selected ? <MediaDetail media={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function MediaDetail({ media, onClose }: { media: MediaRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    altText: media.alt_text ?? '',
    caption: media.caption ?? '',
    credit: media.credit ?? '',
    title: media.title ?? '',
  });
  const [message, setMessage] = useState<string | null>(null);

  const save = () => {
    startTransition(async () => {
      const result = await updateMedia({ id: media.id, ...form });
      setMessage(result.message ?? (result.ok ? 'Saved.' : 'Could not save.'));
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Image details"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm bg-paper-raised shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-rule px-4 py-3">
          <h2 className="text-sm font-bold text-ink">Image details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1.5 text-ink-muted hover:bg-paper-sunk"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${ADMIN.mediaBaseUrl}/${media.storage_key}`}
              alt={media.alt_text ?? ''}
              className="w-full rounded-sm object-contain"
            />
            <dl className="mt-3 space-y-1 text-xs text-ink-faint">
              <div className="flex justify-between">
                <dt>Dimensions</dt>
                <dd>
                  {media.width}×{media.height}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Size</dt>
                <dd>{Math.round(media.size_bytes / 1024)} KB</dd>
              </div>
              <div className="flex justify-between">
                <dt>Used in</dt>
                <dd>
                  {media.usage_count} {media.usage_count === 1 ? 'story' : 'stories'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3">
            <Field
              label="Alt text"
              htmlFor="media-alt"
              required
              hint="Describe what the picture shows, for readers who cannot see it."
              error={!form.altText.trim() ? 'Every published image needs alt text.' : null}
            >
              <Input
                id="media-alt"
                value={form.altText}
                onChange={(event) => setForm({ ...form, altText: event.target.value })}
                invalid={!form.altText.trim()}
              />
            </Field>

            <Field label="Caption" htmlFor="media-caption">
              <Input
                id="media-caption"
                value={form.caption}
                onChange={(event) => setForm({ ...form, caption: event.target.value })}
              />
            </Field>

            <Field label="Credit" htmlFor="media-credit" hint="Photographer or agency.">
              <Input
                id="media-credit"
                value={form.credit}
                onChange={(event) => setForm({ ...form, credit: event.target.value })}
              />
            </Field>

            <Field label="Internal title" htmlFor="media-title" hint="Only used for searching the library.">
              <Input
                id="media-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>

            {message ? (
              <p role="status" className="text-xs font-medium text-ink-muted">
                {message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-rule px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} loading={pending}>
            Save details
          </Button>
        </div>
      </div>
    </div>
  );
}
