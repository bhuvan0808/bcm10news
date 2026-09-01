import type {
  ArticlePreviewRow,
  ArticleVideoRow,
  AuthorProfileRow,
  CategoryRow,
  ContentLanguage,
  Json,
  LocationRow,
  MediaRow,
  TagRow,
} from '../generated/database.types';

/**
 * Shapes returned by the query layer. These are what components consume —
 * deliberately narrower than the raw table rows.
 */

export type MediaSummary = Pick<
  MediaRow,
  | 'id'
  | 'storage_key'
  | 'bucket'
  | 'mime_type'
  | 'width'
  | 'height'
  | 'blur_data_url'
  | 'dominant_color'
  | 'alt_text'
  | 'alt_text_te'
  | 'caption'
  | 'caption_te'
  | 'credit'
  | 'copyright'
  | 'variants'
>;

export type CategorySummary = Pick<
  CategoryRow,
  'id' | 'slug' | 'name' | 'name_te' | 'color' | 'parent_id'
>;
export type LocationSummary = Pick<LocationRow, 'id' | 'slug' | 'name' | 'name_te' | 'kind'>;
export type TagSummary = Pick<TagRow, 'id' | 'slug' | 'name' | 'name_te'>;
export type VideoSummary = Pick<
  ArticleVideoRow,
  | 'id'
  | 'provider'
  | 'video_id'
  | 'original_url'
  | 'is_short'
  | 'title'
  | 'caption'
  | 'caption_te'
  | 'thumbnail_url'
  | 'duration_seconds'
  | 'position'
>;

/**
 * Postgres reports every column of a view as nullable, because it cannot prove
 * non-nullness through a join. `article_previews` does guarantee these: its
 * WHERE clause requires `status = 'published'` and `published_at <= now()`,
 * and the joins to categories and profiles are inner joins on NOT NULL foreign
 * keys.
 *
 * Narrowing here states that guarantee once, in the place it can be checked
 * against the view definition, instead of forcing a null check at forty call
 * sites that would never fire.
 */
type NonNullableFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};

export type ArticlePreview = NonNullableFields<
  ArticlePreviewRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'language'
  | 'author_id'
  | 'author_name'
  | 'category_id'
  | 'category_slug'
  | 'category_name'
  | 'published_at'
  | 'updated_at'
  | 'is_breaking'
  | 'is_exclusive'
  | 'is_premium'
  | 'is_featured'
  | 'is_sponsored'
  | 'noindex'
  | 'priority'
  | 'reading_time_minutes'
  | 'word_count'
  | 'view_count'
  | 'comment_count'
  | 'share_count'
>;

/** `author_profiles` filters on `slug is not null` and an active newsroom role. */
export type Author = NonNullableFields<
  AuthorProfileRow,
  'id' | 'slug' | 'name' | 'role' | 'article_count'
>;

export interface GalleryItem {
  id: string;
  role: string;
  position: number;
  caption: string | null;
  caption_te: string | null;
  media: MediaSummary | null;
}

export interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  title_te: string | null;
  subtitle: string | null;
  excerpt: string | null;
  language: ContentLanguage;
  body: Json;
  status: string;
  published_at: string | null;
  updated_at: string;
  first_published_at: string | null;
  author_id: string;
  byline_override: string | null;
  editor_id: string | null;
  category_id: string;
  location_id: string | null;
  is_breaking: boolean;
  is_exclusive: boolean;
  is_premium: boolean;
  is_featured: boolean;
  is_sponsored: boolean;
  allow_comments: boolean;
  preview_paragraphs: number;
  priority: number;
  reading_time_minutes: number;
  word_count: number;
  view_count: number;
  share_count: number;
  comment_count: number;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  noindex: boolean;
  featured_image_id: string | null;
  featured_video_id: string | null;

  category: CategorySummary | null;
  secondary_category: CategorySummary | null;
  location: LocationSummary | null;
  featured_image: MediaSummary | null;
  videos: VideoSummary[];
  gallery: GalleryItem[];
  article_tags: { tag: TagSummary | null }[];
}

/**
 * What the article page receives.
 *
 * `access` says why the body looks the way it does. When RLS withheld the row
 * because the reader lacks the entitlement, `article` is null and only
 * `preview` is present — that is the paywall, and it is a database outcome
 * rather than a UI decision.
 */
export type ArticleAccess = 'full' | 'paywalled' | 'not_found';

export interface ArticleResult {
  access: ArticleAccess;
  preview: ArticlePreview | null;
  article: ArticleDetail | null;
  author: Author | null;
  coauthors: Author[];
  tags: TagSummary[];
  /** Set when the requested slug is a retired one and should 301. */
  redirectToSlug: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}
