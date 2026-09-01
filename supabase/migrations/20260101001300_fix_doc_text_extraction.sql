-- =============================================================================
-- BCM10 News — 1300 fix duplicated text extraction from article bodies
-- =============================================================================
-- extract_doc_text() used the JSONPath `$.**.text`, which runs in *lax* mode by
-- default. Lax mode auto-unwraps arrays, so every text node matched twice: once
-- reached through the `content` array itself and once through its elements.
--
--   before:  "Hello world Hello world"
--   after:   "Hello world"
--
-- The consequences were not cosmetic. body_text fed word_count and
-- reading_time_minutes, so both were roughly double, and the search vector
-- carried every term twice, which skews ts_rank against articles that happen to
-- have flatter markup.
--
-- `strict` disables the auto-unwrapping. Missing members are still simply "no
-- match" rather than an error, so documents without text nodes behave as before.
-- =============================================================================

create or replace function public.extract_doc_text(doc jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_parts text[] := '{}';
  v_txt text;
begin
  if doc is null then
    return '';
  end if;

  for v_txt in
    select t #>> '{}'
    -- `strict` is load-bearing: without it, lax-mode array unwrapping returns
    -- every text node twice.
    from jsonb_path_query(doc, 'strict $.**.text') as t
    where jsonb_typeof(t) = 'string'
  loop
    v_parts := v_parts || v_txt;
  end loop;

  return btrim(regexp_replace(array_to_string(v_parts, ' '), '\s+', ' ', 'g'));
end;
$$;

comment on function public.extract_doc_text is
  'Flattens every text node of a ProseMirror document. Uses strict JSONPath; lax mode double-counts through array unwrapping.';

-- Same defect, same fix. Duplicates were harmless inside an IN list, but the
-- two functions should not disagree about how to walk a document.
create or replace function public.sync_media_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    return null;
  end if;

  update public.media m
     set is_public = true
   where not m.is_public
     and (
       m.id = new.featured_image_id
       or m.id = new.og_image_id
       or m.id in (select am.media_id from public.article_media am where am.article_id = new.id)
       or m.id::text in (
         select t #>> '{}'
         from jsonb_path_query(new.body, 'strict $.**.attrs.mediaId') as t
         where jsonb_typeof(t) = 'string'
       )
     );

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Re-derive every existing article.
--
-- A no-op today because nothing is published yet, but this migration has to be
-- correct when it runs against a populated database later. Touching `body`
-- fires articles_derive_content, which recomputes body_text, word_count,
-- reading_time_minutes and search_vector from the corrected function.
-- -----------------------------------------------------------------------------
update public.articles set body = body;
