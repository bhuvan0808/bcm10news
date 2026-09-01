/**
 * Shared PostgREST select strings.
 *
 * Kept in one place because an over-broad select is how a private column
 * escapes: `select('*')` on a table that later gains a sensitive field will
 * start returning it silently. Naming columns means new columns are opt-in.
 */

export const MEDIA_FIELDS = `
  id, storage_key, bucket, mime_type, width, height, blur_data_url, dominant_color,
  alt_text, alt_text_te, caption, caption_te, credit, copyright, variants
`;

export const CATEGORY_FIELDS = `
  id, slug, name, name_te, color, parent_id
`;

export const LOCATION_FIELDS = `
  id, slug, name, name_te, kind
`;

export const TAG_FIELDS = `
  id, slug, name, name_te
`;

export const VIDEO_FIELDS = `
  id, provider, video_id, original_url, is_short, title, caption, caption_te,
  thumbnail_url, duration_seconds, position
`;

/**
 * The full article, as the article page needs it.
 *
 * `article_videos` is disambiguated by constraint name on purpose. Two foreign
 * keys join these tables — article_videos.article_id for the list, and
 * articles.featured_video_id for the lead video — so an unqualified embed is
 * rejected with PGRST201 and takes the whole query with it.
 *
 * The author is NOT joined here. profiles is not readable by anon (it holds
 * email and phone), so bylines come from the author_profiles view in a
 * separate, equally cacheable read.
 */
export const ARTICLE_DETAIL_SELECT = `
  id, slug, title, title_te, subtitle, excerpt, language, body, status,
  published_at, updated_at, first_published_at,
  author_id, byline_override, editor_id, category_id, location_id,
  is_breaking, is_exclusive, is_premium, is_featured, is_sponsored,
  allow_comments, preview_paragraphs, priority,
  reading_time_minutes, word_count, view_count, share_count, comment_count,
  seo_title, seo_description, canonical_url, noindex,
  featured_image_id, featured_video_id,
  category:categories!articles_category_id_fkey(${CATEGORY_FIELDS}),
  secondary_category:categories!articles_secondary_category_id_fkey(${CATEGORY_FIELDS}),
  location:locations!articles_location_id_fkey(${LOCATION_FIELDS}),
  featured_image:media!articles_featured_image_id_fkey(${MEDIA_FIELDS}),
  videos:article_videos!article_videos_article_id_fkey(${VIDEO_FIELDS}),
  gallery:article_media(id, role, position, caption, caption_te, media(${MEDIA_FIELDS})),
  article_tags(tag:tags(${TAG_FIELDS}))
`;

/**
 * Everything the card components render.
 *
 * @embedBase article_previews
 */
export const PREVIEW_SELECT = `
  id, slug, title, title_te, subtitle, excerpt, language, published_at, updated_at,
  author_id, author_slug, author_name, author_name_te, byline_override,
  category_id, category_slug, category_name, category_name_te,
  location_slug, location_name, location_name_te,
  is_breaking, is_exclusive, is_premium, is_featured, is_sponsored, priority,
  reading_time_minutes, view_count, comment_count,
  featured_image_id, featured_image_key, featured_image_alt, featured_image_alt_te,
  featured_image_width, featured_image_height, featured_image_blur, featured_image_variants
`;

export const AUTHOR_SELECT = `
  id, slug, name, name_te, bio, bio_te, designation, social_links, role, avatar_key, article_count
`;
