'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ArticleStatus, CategoryRow, LocationRow } from '@bcm10/database';
import {
  EMPTY_DOC,
  articleSlug,
  canTransition,
  deriveExcerpt,
  parseYouTubeUrl,
  slugify,
  type ContentDoc,
} from '@bcm10/validation';
import { Button, Field, Input, cn } from '@bcm10/ui';
import { RichTextEditor } from './editor/rich-text-editor';
import type { NewsroomImageAttributes } from './editor/extensions';
import { ImageUploader, type UploadedImage } from './image-uploader';
import { StatusBadge } from './status-badge';
import { createArticle, publishArticle, saveArticle, submitArticle } from '@/lib/actions/articles';
import { ADMIN, publicArticleUrl } from '@/lib/site';
import { formatRelative, isoToIstLocalInput, istLocalInputToIso } from '@/lib/format';

/**
 * The story form.
 *
 * This is the screen a reporter lives in, so the behaviours that matter are
 * the unglamorous ones:
 *
 *  • Autosave every few seconds once something changes, with a visible "saved"
 *    timestamp. A reporter should never wonder whether their work is safe.
 *  • A beforeunload guard while there are unsaved changes, because tabs get
 *    closed and phones run out of battery.
 *  • Actions gated by the same transition table the database enforces, so a
 *    button is absent rather than present-and-rejected.
 *  • The slug is derived from the headline until someone edits it by hand,
 *    after which it stops moving — a published URL must not change because an
 *    editor tightened the headline.
 */

export interface ArticleFormData {
  id?: string;
  status: ArticleStatus;
  title: string;
  titleTe: string;
  subtitle: string;
  excerpt: string;
  slug: string;
  language: 'te' | 'en';
  body: ContentDoc;
  categoryId: string;
  secondaryCategoryId: string;
  locationId: string;
  featuredImage: UploadedImage | null;
  videoUrls: string[];
  tagNames: string[];
  isBreaking: boolean;
  isExclusive: boolean;
  isPremium: boolean;
  isFeatured: boolean;
  isSponsored: boolean;
  allowComments: boolean;
  previewParagraphs: number;
  seoTitle: string;
  seoDescription: string;
  scheduledFor: string | null;
  updatedAt?: string;
}

interface Props {
  initial: ArticleFormData;
  categories: CategoryRow[];
  locations: LocationRow[];
  canPublish: boolean;
  isEditorial: boolean;
}

type SaveState =
  | { kind: 'clean'; at: string | null }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

const AUTOSAVE_DELAY_MS = 4000;

export function ArticleForm({ initial, categories, locations, canPublish, isEditorial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ArticleFormData>(initial);
  const [save, setSave] = useState<SaveState>({ kind: 'clean', at: initial.updatedAt ?? null });
  const [banner, setBanner] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // A reporter who has typed a slug owns it from then on.
  const slugTouched = useRef(Boolean(initial.slug) && initial.status !== 'draft');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the editor's insert callback so the shared uploader can drop an
  // image at the cursor once the upload finishes.
  const insertImageRef = useRef<((attributes: NewsroomImageAttributes) => void) | null>(null);

  const isNew = !form.id;
  const isPublished = form.status === 'published';

  const update = useCallback(
    <K extends keyof ArticleFormData>(key: K, value: ArticleFormData[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setSave({ kind: 'dirty' });
    },
    []
  );

  // Headline drives the slug until it is edited by hand.
  useEffect(() => {
    if (slugTouched.current || !form.title.trim()) return;
    setForm((current) => ({
      ...current,
      slug: articleSlug({ title: current.title, titleTe: current.titleTe }),
    }));
  }, [form.title, form.titleTe]);

  /* ---- Autosave -------------------------------------------------------- */

  const persist = useCallback(async (): Promise<boolean> => {
    if (!form.id) return false;

    setSave({ kind: 'saving' });

    const result = await saveArticle({
      id: form.id,
      title: form.title,
      titleTe: form.titleTe || undefined,
      subtitle: form.subtitle || undefined,
      excerpt: form.excerpt || undefined,
      slug: form.slug || undefined,
      language: form.language,
      body: form.body,
      categoryId: form.categoryId,
      secondaryCategoryId: form.secondaryCategoryId || null,
      locationId: form.locationId || null,
      featuredImageId: form.featuredImage?.mediaId ?? null,
      videoUrls: form.videoUrls.filter(Boolean),
      tagNames: form.tagNames,
      isBreaking: form.isBreaking,
      isExclusive: form.isExclusive,
      isPremium: form.isPremium,
      isFeatured: form.isFeatured,
      isSponsored: form.isSponsored,
      allowComments: form.allowComments,
      previewParagraphs: form.previewParagraphs,
      seoTitle: form.seoTitle || undefined,
      seoDescription: form.seoDescription || undefined,
    });

    if (!result.ok) {
      setSave({ kind: 'error', message: result.message ?? 'Could not save.' });
      return false;
    }

    setSave({ kind: 'clean', at: result.data?.savedAt ?? new Date().toISOString() });
    return true;
  }, [form]);

  useEffect(() => {
    if (save.kind !== 'dirty' || !form.id) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [save.kind, form.id, persist]);

  // Warn before losing work. The browser shows its own wording; the only thing
  // that matters is that preventDefault is called.
  useEffect(() => {
    if (save.kind !== 'dirty') return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [save.kind]);

  /* ---- Actions --------------------------------------------------------- */

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createArticle({
        title: form.title,
        titleTe: form.titleTe || undefined,
        subtitle: form.subtitle || undefined,
        excerpt: form.excerpt || deriveExcerpt(form.body),
        slug: form.slug || undefined,
        language: form.language,
        body: form.body,
        categoryId: form.categoryId,
        secondaryCategoryId: form.secondaryCategoryId || null,
        locationId: form.locationId || null,
        featuredImageId: form.featuredImage?.mediaId ?? null,
        videoUrls: form.videoUrls.filter(Boolean),
        tagNames: form.tagNames,
        isBreaking: form.isBreaking,
        isExclusive: form.isExclusive,
        isPremium: form.isPremium,
        isFeatured: form.isFeatured,
        isSponsored: form.isSponsored,
        allowComments: form.allowComments,
        previewParagraphs: form.previewParagraphs,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
      });

      // createArticle redirects on success, so reaching here means it failed.
      if (result && !result.ok)
        setBanner({ tone: 'error', message: result.message ?? 'Could not create the story.' });
    });
  };

  const handleSubmitForReview = () => {
    startTransition(async () => {
      // Flush pending edits first, or the desk reviews a stale draft.
      const saved = await persist();
      if (!saved) return;

      const result = await submitArticle({ id: form.id });
      if (result.ok) {
        setForm((current) => ({ ...current, status: 'submitted' }));
        setBanner({ tone: 'ok', message: result.message ?? 'Sent to the desk.' });
        router.refresh();
      } else {
        setBanner({ tone: 'error', message: result.message ?? 'Could not submit.' });
      }
    });
  };

  const handlePublish = (scheduledFor: string | null) => {
    startTransition(async () => {
      const saved = await persist();
      if (!saved) return;

      const result = await publishArticle({
        id: form.id,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      });

      if (result.ok) {
        setForm((current) => ({
          ...current,
          status: (result.data?.status as ArticleStatus) ?? 'published',
        }));
        setBanner({ tone: 'ok', message: result.message ?? 'Published.' });
        router.refresh();
      } else {
        setBanner({ tone: 'error', message: result.message ?? 'Could not publish.' });
      }
    });
  };

  /* ---- Derived --------------------------------------------------------- */

  const canSubmit = canTransition(form.status, 'submitted');
  const canPublishNow =
    canPublish && (canTransition(form.status, 'published') || form.status === 'approved');
  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  return (
    <div className="mx-auto max-w-(--container-page) pb-24">
      <StickyHeader
        status={form.status}
        save={save}
        isNew={isNew}
        pending={pending}
        slug={form.slug}
        canSubmit={canSubmit}
        canPublishNow={canPublishNow}
        isEditorial={isEditorial}
        onCreate={handleCreate}
        onSave={() => startTransition(() => void persist())}
        onSubmit={handleSubmitForReview}
        onPublish={handlePublish}
        scheduledFor={form.scheduledFor}
        onScheduleChange={(value) => update('scheduledFor', value)}
        titleFilled={form.title.trim().length >= 3}
        categoryFilled={Boolean(form.categoryId)}
      />

      {banner ? (
        <div
          role="status"
          className={cn(
            'mt-4 rounded-sm border p-3 text-sm',
            banner.tone === 'ok'
              ? 'border-status-published/30 bg-status-published/10 text-status-published'
              : 'border-brand/30 bg-brand-light text-brand'
          )}
        >
          {banner.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* ---- Story ---- */}
        <div className="space-y-4 lg:col-span-8">
          <Field label="Headline" htmlFor="title" required>
            <textarea
              id="title"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              rows={2}
              placeholder="What happened?"
              className="w-full resize-none rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-xl leading-snug font-bold text-ink"
            />
          </Field>

          <Field
            label="Telugu headline"
            htmlFor="titleTe"
            hint="Shown to readers on Telugu. Leave blank to use the English headline."
          >
            <textarea
              id="titleTe"
              lang="te"
              value={form.titleTe}
              onChange={(event) => update('titleTe', event.target.value)}
              rows={2}
              className="w-full resize-none rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-lg leading-relaxed font-bold text-ink"
            />
          </Field>

          <Field
            label="Standfirst"
            htmlFor="subtitle"
            hint="One line under the headline. Optional."
          >
            <Input
              id="subtitle"
              value={form.subtitle}
              onChange={(event) => update('subtitle', event.target.value)}
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Story</span>
            <RichTextEditor
              initialContent={initial.body ?? EMPTY_DOC}
              language={form.language}
              onChange={(doc) => update('body', doc)}
              onRequestImage={(insert) => {
                insertImageRef.current = insert;
                document.getElementById('body-image-uploader')?.querySelector('button')?.click();
              }}
            />
          </div>

          {/* The editor's image button routes here so one uploader serves both
              the body and the featured slot. */}
          <div id="body-image-uploader" className="hidden">
            <ImageUploader
              label="Insert image"
              onUploaded={(image) => {
                insertImageRef.current?.({
                  mediaId: image.mediaId,
                  storageKey: image.storageKey,
                  src: image.url,
                  width: image.width,
                  height: image.height,
                  blur: image.blurDataUrl ?? undefined,
                  alt: '',
                });
              }}
            />
          </div>

          <Field
            label="Summary"
            htmlFor="excerpt"
            hint="Used on cards, in search results and in the newsletter. Left blank, we take the first paragraph."
          >
            <textarea
              id="excerpt"
              value={form.excerpt}
              onChange={(event) => update('excerpt', event.target.value)}
              rows={3}
              maxLength={600}
              className="w-full resize-y rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-sm text-ink"
            />
          </Field>
        </div>

        {/* ---- Sidebar ---- */}
        <aside className="space-y-5 lg:col-span-4">
          <Panel title="Placement">
            <Field label="Section" htmlFor="category" required>
              <select
                id="category"
                value={form.categoryId}
                onChange={(event) => update('categoryId', event.target.value)}
                className="h-10 w-full rounded-sm border border-rule-strong bg-paper-raised px-2 text-sm"
              >
                <option value="">Choose a section…</option>
                {parentCategories.map((category) => (
                  <optgroup key={category.id} label={category.name}>
                    <option value={category.id}>{category.name}</option>
                    {categories
                      .filter((child) => child.parent_id === category.id)
                      .map((child) => (
                        <option key={child.id} value={child.id}>
                          &nbsp;&nbsp;{child.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field label="Dateline" htmlFor="location" hint="Where the story is filed from.">
              <select
                id="location"
                value={form.locationId}
                onChange={(event) => update('locationId', event.target.value)}
                className="h-10 w-full rounded-sm border border-rule-strong bg-paper-raised px-2 text-sm"
              >
                <option value="">None</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Language" htmlFor="language">
              <select
                id="language"
                value={form.language}
                onChange={(event) => update('language', event.target.value as 'te' | 'en')}
                className="h-10 w-full rounded-sm border border-rule-strong bg-paper-raised px-2 text-sm"
              >
                <option value="te">Telugu</option>
                <option value="en">English</option>
              </select>
            </Field>
          </Panel>

          <Panel title="Lead image">
            {form.featuredImage ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.featuredImage.url}
                  alt=""
                  className="aspect-3/2 w-full rounded-sm object-cover"
                />
                <Field
                  label="Alt text"
                  htmlFor="featured-alt"
                  hint="Describe the picture for readers who cannot see it."
                >
                  <Input
                    id="featured-alt"
                    value={form.featuredImage.alt}
                    onChange={(event) =>
                      update('featuredImage', { ...form.featuredImage!, alt: event.target.value })
                    }
                  />
                </Field>
                <Button variant="ghost" size="sm" onClick={() => update('featuredImage', null)}>
                  Remove image
                </Button>
              </div>
            ) : (
              <ImageUploader
                label="Upload lead image"
                onUploaded={(image) => update('featuredImage', image)}
              />
            )}
          </Panel>

          <Panel title="Video">
            <VideoList urls={form.videoUrls} onChange={(urls) => update('videoUrls', urls)} />
          </Panel>

          <Panel title="Topics">
            <TagInput values={form.tagNames} onChange={(tags) => update('tagNames', tags)} />
          </Panel>

          <Panel title="Flags">
            <div className="space-y-2">
              <Toggle
                label="Breaking news"
                hint="Shows in the ticker and can trigger an alert."
                checked={form.isBreaking}
                onChange={(value) => update('isBreaking', value)}
              />
              <Toggle
                label="Exclusive"
                checked={form.isExclusive}
                onChange={(value) => update('isExclusive', value)}
              />
              <Toggle
                label="Subscribers only"
                hint="Non-subscribers see the headline and summary."
                checked={form.isPremium}
                onChange={(value) => update('isPremium', value)}
              />
              {isEditorial ? (
                <Toggle
                  label="Feature on the front page"
                  checked={form.isFeatured}
                  onChange={(value) => update('isFeatured', value)}
                />
              ) : null}
              <Toggle
                label="Sponsored content"
                hint="Labelled to readers. Required by advertising rules."
                checked={form.isSponsored}
                onChange={(value) => update('isSponsored', value)}
              />
              <Toggle
                label="Allow comments"
                checked={form.allowComments}
                onChange={(value) => update('allowComments', value)}
              />
            </div>
          </Panel>

          <Panel title="URL and search">
            <Field
              label="URL slug"
              htmlFor="slug"
              hint={
                isPublished
                  ? 'Changing this redirects the old URL, but avoid it once a story has been shared.'
                  : 'Generated from the headline until you edit it.'
              }
            >
              <Input
                id="slug"
                value={form.slug}
                onChange={(event) => {
                  slugTouched.current = true;
                  update('slug', slugify(event.target.value));
                }}
              />
            </Field>

            {form.slug ? (
              <p className="-mt-1 text-xs break-all text-ink-faint">
                {ADMIN.publicSiteUrl}/news/{form.slug}
              </p>
            ) : null}

            <Field label="SEO title" htmlFor="seoTitle" hint="Defaults to the headline.">
              <Input
                id="seoTitle"
                value={form.seoTitle}
                onChange={(event) => update('seoTitle', event.target.value)}
                maxLength={120}
              />
            </Field>

            <Field
              label="Meta description"
              htmlFor="seoDescription"
              hint={`${form.seoDescription.length}/160 characters shown in search results.`}
            >
              <textarea
                id="seoDescription"
                value={form.seoDescription}
                onChange={(event) => update('seoDescription', event.target.value)}
                rows={3}
                maxLength={320}
                className="w-full resize-y rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 text-sm"
              />
            </Field>
          </Panel>

          {isPublished ? (
            <a
              href={publicArticleUrl(form.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-sm border border-rule px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-paper-sunk"
            >
              View on the site ↗
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function StickyHeader({
  status,
  save,
  isNew,
  pending,
  canSubmit,
  canPublishNow,
  isEditorial,
  onCreate,
  onSave,
  onSubmit,
  onPublish,
  scheduledFor,
  onScheduleChange,
  titleFilled,
  categoryFilled,
}: {
  status: ArticleStatus;
  save: SaveState;
  isNew: boolean;
  pending: boolean;
  slug: string;
  canSubmit: boolean;
  canPublishNow: boolean;
  isEditorial: boolean;
  onCreate: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onPublish: (scheduledFor: string | null) => void;
  scheduledFor: string | null;
  onScheduleChange: (value: string | null) => void;
  titleFilled: boolean;
  categoryFilled: boolean;
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const ready = titleFilled && categoryFilled;

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur-sm lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <SaveIndicator save={save} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isNew ? (
            <Button onClick={onCreate} loading={pending} disabled={!ready}>
              Create story
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onSave} loading={save.kind === 'saving'}>
                Save
              </Button>

              {canSubmit ? (
                <Button size="sm" onClick={onSubmit} loading={pending} disabled={!ready}>
                  Submit for review
                </Button>
              ) : null}

              {canPublishNow ? (
                <>
                  {isEditorial ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSchedule((value) => !value)}
                    >
                      Schedule
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => onPublish(null)}
                    loading={pending}
                    disabled={!ready}
                  >
                    {status === 'published' ? 'Update live story' : 'Publish now'}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showSchedule ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-sm border border-rule bg-paper-raised p-3">
          <Field label="Publish at (IST)" htmlFor="scheduledFor" className="flex-1">
            <input
              id="scheduledFor"
              type="datetime-local"
              value={isoToIstLocalInput(scheduledFor)}
              onChange={(event) => onScheduleChange(istLocalInputToIso(event.target.value))}
              className="h-10 w-full rounded-sm border border-rule-strong bg-paper-raised px-3 text-sm"
            />
          </Field>
          <Button
            size="md"
            onClick={() => onPublish(scheduledFor)}
            disabled={!scheduledFor}
            loading={pending}
          >
            Schedule it
          </Button>
        </div>
      ) : null}

      {!ready && !isNew ? (
        <p className="mt-2 text-xs text-ink-faint">
          A headline and a section are needed before this story can move on.
        </p>
      ) : null}
    </div>
  );
}

function SaveIndicator({ save }: { save: SaveState }) {
  if (save.kind === 'saving') {
    return <span className="text-xs text-ink-faint">Saving…</span>;
  }
  if (save.kind === 'dirty') {
    return <span className="text-status-changes text-xs">Unsaved changes</span>;
  }
  if (save.kind === 'error') {
    return (
      <span role="alert" className="text-xs font-medium text-brand">
        {save.message}
      </span>
    );
  }
  return (
    <span className="text-xs text-ink-faint">
      {save.at ? (
        <>
          Saved{' '}
          <time dateTime={save.at} suppressHydrationWarning>
            {formatRelative(save.at)}
          </time>
        </>
      ) : (
        'Not saved yet'
      )}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-rule bg-paper-raised p-4">
      <h2 className="mb-3 text-xs font-bold tracking-wider text-ink-muted uppercase">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded-xs accent-[var(--color-brand)]"
      />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
      </label>
    </div>
  );
}

/**
 * YouTube URLs.
 *
 * Validated as they are entered, with the extracted video id shown back — a
 * reporter who pasted the wrong thing finds out immediately rather than after
 * publication.
 */
function VideoList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const parsed = parseYouTubeUrl(draft);
    if (!parsed) {
      setError('That does not look like a YouTube link.');
      return;
    }
    if (urls.some((url) => parseYouTubeUrl(url)?.videoId === parsed.videoId)) {
      setError('That video is already attached.');
      return;
    }

    onChange([...urls, parsed.canonicalUrl]);
    setDraft('');
    setError(null);
  };

  return (
    <div className="space-y-2">
      {urls.map((url, index) => {
        const parsed = parseYouTubeUrl(url);
        return (
          <div
            key={`${url}-${index}`}
            className="flex items-center gap-2 rounded-sm bg-paper-sunk p-2"
          >
            {parsed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://i.ytimg.com/vi/${parsed.videoId}/default.jpg`}
                alt=""
                className="h-9 w-16 shrink-0 rounded-xs object-cover"
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{url}</span>
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, i) => i !== index))}
              className="shrink-0 text-xs font-semibold text-brand hover:underline"
            >
              Remove
            </button>
          </div>
        );
      })}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Paste a YouTube link"
          invalid={Boolean(error)}
        />
        <Button type="button" variant="outline" size="md" onClick={add} className="shrink-0">
          Add
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TagInput({ values, onChange }: { values: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const tag = draft.trim();
    if (!tag) return;
    if (values.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, tag]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      {values.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-sm bg-paper-sunk px-2 py-1 text-xs font-medium text-ink"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(values.filter((value) => value !== tag))}
                aria-label={`Remove ${tag}`}
                className="text-ink-faint hover:text-brand"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Comma as well as Enter: reporters type "elections, ap, 2026".
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="Add a topic and press Enter"
      />
    </div>
  );
}
