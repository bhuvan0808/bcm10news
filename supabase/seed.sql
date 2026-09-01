-- =============================================================================
-- BCM10 News — seed data
-- =============================================================================
-- Idempotent by design: this runs against the hosted project via
-- `supabase db push --include-seed` and must be safe to re-run.
-- It seeds structure (sections, datelines, plans), never editorial content.
-- =============================================================================

-- --- Categories --------------------------------------------------------------
insert into public.categories (slug, name, name_te, position, show_in_nav, show_on_homepage, color)
values
  ('latest-news',    'Latest News',    'తాజా వార్తలు',      10,  true,  false, '#c62828'),
  ('andhra-pradesh', 'Andhra Pradesh', 'ఆంధ్రప్రదేశ్',       20,  true,  true,  '#1565c0'),
  ('telangana',      'Telangana',      'తెలంగాణ',           30,  true,  true,  '#ad1457'),
  ('national',       'National',       'జాతీయం',            40,  true,  true,  '#2e7d32'),
  ('international',  'International',  'అంతర్జాతీయం',        50,  true,  true,  '#00695c'),
  ('politics',       'Politics',       'రాజకీయాలు',          60,  true,  true,  '#6a1b9a'),
  ('business',       'Business',       'వ్యాపారం',           70,  true,  true,  '#ef6c00'),
  ('sports',         'Sports',         'క్రీడలు',            80,  true,  true,  '#0277bd'),
  ('cinema',         'Cinema',         'సినిమా',            90,  true,  true,  '#d81b60'),
  ('technology',     'Technology',     'టెక్నాలజీ',          100, true,  true,  '#4527a0'),
  ('lifestyle',      'Lifestyle',      'లైఫ్‌స్టైల్',         110, true,  true,  '#00838f'),
  ('education',      'Education',      'విద్య',             120, true,  true,  '#558b2f'),
  ('opinion',        'Opinion',        'అభిప్రాయం',          130, true,  false, '#37474f'),
  ('photos',         'Photos',         'ఫొటోలు',            140, true,  true,  '#5d4037'),
  ('videos',         'Videos',         'వీడియోలు',          150, true,  true,  '#b71c1c')
on conflict (slug) do update
  set name = excluded.name,
      name_te = excluded.name_te,
      position = excluded.position,
      color = excluded.color;

-- Sub-sections under the two state desks.
insert into public.categories (slug, name, name_te, parent_id, position, show_in_nav)
select v.slug, v.name, v.name_te, p.id, v.position, false
from (values
  ('ap-amaravati',  'Amaravati',   'అమరావతి',    21),
  ('ap-visakhapatnam', 'Visakhapatnam', 'విశాఖపట్నం', 22),
  ('ap-vijayawada', 'Vijayawada',  'విజయవాడ',    23)
) as v(slug, name, name_te, position)
cross join lateral (select id from public.categories where slug = 'andhra-pradesh') p
on conflict (slug) do nothing;

insert into public.categories (slug, name, name_te, parent_id, position, show_in_nav)
select v.slug, v.name, v.name_te, p.id, v.position, false
from (values
  ('ts-hyderabad', 'Hyderabad', 'హైదరాబాద్', 31),
  ('ts-warangal',  'Warangal',  'వరంగల్',    32)
) as v(slug, name, name_te, position)
cross join lateral (select id from public.categories where slug = 'telangana') p
on conflict (slug) do nothing;

-- --- Locations ---------------------------------------------------------------
insert into public.locations (slug, name, name_te, kind)
values
  ('india',          'India',          'భారత్',        'country'),
  ('andhra-pradesh', 'Andhra Pradesh', 'ఆంధ్రప్రదేశ్',  'state'),
  ('telangana',      'Telangana',      'తెలంగాణ',      'state')
on conflict (slug) do nothing;

insert into public.locations (slug, name, name_te, kind, parent_id)
select v.slug, v.name, v.name_te, 'city', p.id
from (values
  ('hyderabad',     'Hyderabad',     'హైదరాబాద్',   'telangana'),
  ('warangal',      'Warangal',      'వరంగల్',      'telangana'),
  ('nizamabad',     'Nizamabad',     'నిజామాబాద్',  'telangana'),
  ('amaravati',     'Amaravati',     'అమరావతి',     'andhra-pradesh'),
  ('visakhapatnam', 'Visakhapatnam', 'విశాఖపట్నం',  'andhra-pradesh'),
  ('vijayawada',    'Vijayawada',    'విజయవాడ',     'andhra-pradesh'),
  ('tirupati',      'Tirupati',      'తిరుపతి',     'andhra-pradesh'),
  ('guntur',        'Guntur',        'గుంటూరు',      'andhra-pradesh'),
  ('new-delhi',     'New Delhi',     'న్యూఢిల్లీ',   'india')
) as v(slug, name, name_te, parent_slug)
join public.locations p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- --- Homepage layout ---------------------------------------------------------
insert into public.homepage_sections (key, title, title_te, layout, source, category_id, item_limit, position)
select v.key, v.title, v.title_te, v.layout, v.source, c.id, v.item_limit, v.position
from (values
  ('hero',          'Top Stories',    'ముఖ్యాంశాలు',   'hero',     'latest',        null,             5,  10),
  ('latest',        'Latest News',    'తాజా వార్తలు',   'list',     'latest',        null,             10, 20),
  ('andhra',        'Andhra Pradesh', 'ఆంధ్రప్రదేశ్',    'grid',     'category',      'andhra-pradesh', 6,  30),
  ('telangana',     'Telangana',      'తెలంగాణ',        'grid',     'category',      'telangana',      6,  40),
  ('national',      'National',       'జాతీయం',         'grid',     'category',      'national',       6,  50),
  ('international', 'World',          'అంతర్జాతీయం',     'grid',     'category',      'international',  4,  60),
  ('business',      'Business',       'వ్యాపారం',        'grid',     'category',      'business',       4,  70),
  ('sports',        'Sports',         'క్రీడలు',         'grid',     'category',      'sports',         6,  80),
  ('cinema',        'Cinema',         'సినిమా',         'carousel', 'category',      'cinema',         8,  90),
  ('technology',    'Technology',     'టెక్నాలజీ',       'grid',     'category',      'technology',     4,  100),
  ('videos',        'Videos',         'వీడియోలు',       'video',    'videos',        null,             6,  110),
  ('photos',        'Photo Stories',  'ఫొటో కథనాలు',    'gallery',  'photos',        null,             6,  120),
  ('most-read',     'Most Read',      'ఎక్కువగా చదివినవి', 'compact', 'most_read',    null,             8,  130),
  ('editors-picks', 'Editor''s Picks', 'ఎడిటర్ ఎంపిక',  'list',     'editors_picks', null,             5,  140)
) as v(key, title, title_te, layout, source, category_slug, item_limit, position)
left join public.categories c on c.slug = v.category_slug
on conflict (key) do update
  set title = excluded.title,
      title_te = excluded.title_te,
      layout = excluded.layout,
      source = excluded.source,
      item_limit = excluded.item_limit,
      position = excluded.position;

-- --- Subscription plans ------------------------------------------------------
-- Amounts are illustrative starting points and are editable from the admin.
insert into public.subscription_plans
  (code, name, name_te, description, audience, interval, amount_paise, entitlements, position, is_public)
values
  ('free', 'Free', 'ఉచితం', 'Full access to all free reporting.',
   'reader', 'monthly', 0, '{}', 10, true),
  ('premium_monthly', 'Premium Monthly', 'ప్రీమియం నెలవారీ',
   'Premium stories, ad-light reading and the subscriber newsletter.',
   'reader', 'monthly', 9900, '{premium_content,ad_light,newsletter_premium}', 20, true),
  ('premium_annual', 'Premium Annual', 'ప్రీమియం వార్షికం',
   'Twelve months of premium access, billed once.',
   'reader', 'annual', 99900, '{premium_content,ad_light,newsletter_premium}', 30, true)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      entitlements = excluded.entitlements;

insert into public.subscription_plans
  (code, name, description, audience, interval, amount_paise, entitlements, license_quota, position, is_public)
values
  ('license_100', 'Business — 100 articles/month',
   'Licensed access to 100 articles each month for your organisation.',
   'business', 'monthly', 1500000, '{content_license,premium_content}', 100, 40, true),
  ('license_500', 'Business — 500 articles/month',
   'Licensed access to 500 articles each month for your organisation.',
   'business', 'monthly', 5000000, '{content_license,premium_content}', 500, 50, true),
  ('license_unlimited', 'Business — Unlimited',
   'Unlimited licensed access plus API distribution.',
   'business', 'annual', 90000000, '{content_license,premium_content,api_access}', null, 60, true)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      entitlements = excluded.entitlements,
      license_quota = excluded.license_quota;

-- --- Site settings -----------------------------------------------------------
update public.site_settings
   set site_name = 'BCM10 News',
       tagline = 'News that reaches the ground',
       tagline_te = 'నేలమీది వార్తలు',
       contact_email = 'contact@bcm10news.in',
       newsletter_enabled = true
 where id;

-- --- Starter tags ------------------------------------------------------------
insert into public.tags (slug, name, name_te)
values
  ('breaking', 'Breaking', 'బ్రేకింగ్'),
  ('elections', 'Elections', 'ఎన్నికలు'),
  ('cricket', 'Cricket', 'క్రికెట్'),
  ('tollywood', 'Tollywood', 'టాలీవుడ్'),
  ('weather', 'Weather', 'వాతావరణం'),
  ('agriculture', 'Agriculture', 'వ్యవసాయం')
on conflict (slug) do nothing;
