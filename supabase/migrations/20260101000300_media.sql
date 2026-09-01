-- =============================================================================
-- BCM10 News — 0300 media library
-- =============================================================================
-- Bytes live in Cloudflare R2 (or Supabase Storage in local dev). Postgres holds
-- only the metadata and is the authority on who may see an asset.
-- =============================================================================

create table public.media (
  id uuid primary key default extensions.gen_random_uuid(),
  kind public.media_kind not null default 'image',

  -- Storage coordinates. storage_key is immutable once written so public URLs
  -- can be cached with a long max-age.
  bucket text not null default 'bcm10-media',
  storage_key text not null,
  driver text not null default 'r2',
  checksum text,

  mime_type text not null,
  size_bytes bigint not null,
  width int,
  height int,
  duration_seconds numeric(10, 3),

  -- Low-quality placeholder rendered while the real image loads.
  blur_data_url text,
  dominant_color text,

  -- Editorial metadata
  title text,
  alt_text text,
  alt_text_te text,
  caption text,
  caption_te text,
  credit text,
  copyright text,
  source text,
  photographer_id uuid references public.profiles (id) on delete set null,
  captured_at timestamptz,

  -- Derivatives: [{ label, width, height, format, key, size_bytes }]
  variants jsonb not null default '[]'::jsonb,

  uploaded_by uuid references public.profiles (id) on delete set null,
  usage_count int not null default 0,
  is_archived boolean not null default false,

  -- Flipped on by sync_media_visibility() when the asset first appears on a
  -- published article, an avatar or the site logo. The public SELECT policy
  -- reads this flag rather than running an EXISTS against articles per row,
  -- which keeps an unpublished scoop's caption out of the anon API.
  is_public boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint media_storage_key_unique unique (bucket, storage_key),
  constraint media_size_positive check (size_bytes > 0),
  constraint media_size_limit check (size_bytes <= 52428800), -- 50 MB hard ceiling
  constraint media_variants_is_array check (jsonb_typeof(variants) = 'array'),
  constraint media_dimensions_sane check (
    (width is null and height is null) or (width > 0 and height > 0)
  )
);

create index media_kind_created_idx on public.media (kind, created_at desc) where not is_archived;
create index media_public_idx on public.media (created_at desc) where is_public and not is_archived;
create index media_uploader_idx on public.media (uploaded_by, created_at desc);
create index media_photographer_idx on public.media (photographer_id) where photographer_id is not null;
create index media_search_idx on public.media
  using gin ((coalesce(title, '') || ' ' || coalesce(alt_text, '') || ' ' || coalesce(caption, '')) extensions.gin_trgm_ops);

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

comment on column public.media.variants is
  'Delivery derivatives generated after upload. Ordered smallest-first; the srcset builder reads this array directly.';

-- Now that media exists, close the loop on the avatar reference.
alter table public.profiles
  add constraint profiles_avatar_media_fk
  foreign key (avatar_media_id) references public.media (id) on delete set null;

-- -----------------------------------------------------------------------------
-- upload_tickets — a signed upload that has been handed out but not yet
-- confirmed. Lets the server reconcile abandoned uploads and enforce quotas
-- without trusting the browser to report what it did.
-- -----------------------------------------------------------------------------
create table public.upload_tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  bucket text not null,
  storage_key text not null,
  mime_type text not null,
  max_size_bytes bigint not null,
  kind public.media_kind not null default 'image',
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint upload_tickets_key_unique unique (bucket, storage_key)
);

create index upload_tickets_pending_idx on public.upload_tickets (expires_at)
  where consumed_at is null;
