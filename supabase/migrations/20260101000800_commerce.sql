-- =============================================================================
-- BCM10 News — 0800 subscriptions, payments, entitlements
-- =============================================================================
-- Money is provider-agnostic in this schema. Razorpay identifiers live in
-- dedicated *_provider_id columns and in payment_events; nothing else in the
-- application reads them, so a second processor is additive.
--
-- Access is never derived from a Razorpay response in the browser. The webhook
-- writes payments/subscriptions, and entitlements are recomputed from those.
-- =============================================================================

create table public.subscription_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_te text,
  description text,

  audience public.plan_audience not null default 'reader',
  interval public.plan_interval not null default 'monthly',

  -- Money in paise. Never floats.
  amount_paise int not null,
  currency text not null default 'INR',
  trial_days int not null default 0,

  -- What the plan grants. Read by grant_entitlements_for_subscription().
  entitlements public.entitlement_kind[] not null default '{}',
  -- B2B: how many article licences the plan includes per period. NULL = n/a.
  license_quota int,

  provider text not null default 'razorpay',
  provider_plan_id text,

  is_active boolean not null default true,
  is_public boolean not null default true,
  position int not null default 100,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscription_plans_amount_nonneg check (amount_paise >= 0),
  constraint subscription_plans_currency check (currency ~ '^[A-Z]{3}$'),
  constraint subscription_plans_code_format check (code ~ '^[a-z0-9_]+$'),
  constraint subscription_plans_quota_positive check (license_quota is null or license_quota > 0)
);

create index subscription_plans_public_idx on public.subscription_plans (audience, position)
  where is_active and is_public;

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

comment on column public.subscription_plans.amount_paise is
  'Integer paise. Prices are configured here, never hardcoded in frontend code.';

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,

  status public.subscription_status not null default 'incomplete',

  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  ended_at timestamptz,

  provider text not null default 'razorpay',
  provider_subscription_id text,
  provider_customer_id text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Exactly one owner: a person or an organization.
  constraint subscriptions_one_owner check (
    (profile_id is not null and organization_id is null)
    or (profile_id is null and organization_id is not null)
  ),
  constraint subscriptions_provider_id_unique unique (provider, provider_subscription_id)
);

create index subscriptions_profile_idx on public.subscriptions (profile_id, status);
create index subscriptions_org_idx on public.subscriptions (organization_id, status);
create index subscriptions_renewal_idx on public.subscriptions (current_period_end)
  where status in ('active', 'trialing', 'past_due');

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- One active subscription per reader. Upgrades supersede rather than stack.
create unique index subscriptions_one_active_per_profile
  on public.subscriptions (profile_id)
  where profile_id is not null and status in ('active', 'trialing', 'past_due');

-- -----------------------------------------------------------------------------
-- payments / invoices
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,

  status public.payment_status not null default 'created',
  amount_paise int not null,
  amount_refunded_paise int not null default 0,
  currency text not null default 'INR',

  method text,
  description text,
  failure_reason text,

  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  provider_signature text,

  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_amount_positive check (amount_paise >= 0),
  constraint payments_refund_bounded check (amount_refunded_paise between 0 and amount_paise),
  constraint payments_provider_payment_unique unique (provider, provider_payment_id)
);

create index payments_profile_idx on public.payments (profile_id, created_at desc);
create index payments_subscription_idx on public.payments (subscription_id, created_at desc);
create index payments_order_idx on public.payments (provider, provider_order_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  number text not null unique,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,

  amount_paise int not null,
  tax_paise int not null default 0,
  currency text not null default 'INR',
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz not null default now(),
  pdf_url text,
  billing_snapshot jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index invoices_profile_idx on public.invoices (profile_id, issued_at desc);
create index invoices_org_idx on public.invoices (organization_id, issued_at desc);

-- -----------------------------------------------------------------------------
-- payment_events — raw provider webhooks, stored before they are interpreted.
-- The unique constraint on provider_event_id makes webhook delivery idempotent.
-- -----------------------------------------------------------------------------
create table public.payment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null default 'razorpay',
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_verified boolean not null default false,
  processed_at timestamptz,
  process_error text,
  received_at timestamptz not null default now(),

  constraint payment_events_unique unique (provider, provider_event_id)
);

create index payment_events_unprocessed_idx on public.payment_events (received_at)
  where processed_at is null;

-- -----------------------------------------------------------------------------
-- entitlements — the single thing the server checks before serving premium
-- content. Derived from subscriptions; never written by client code.
-- -----------------------------------------------------------------------------
create table public.entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete cascade,

  kind public.entitlement_kind not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  source text not null default 'subscription',

  constraint entitlements_one_owner check (
    (profile_id is not null and organization_id is null)
    or (profile_id is null and organization_id is not null)
  )
);

create index entitlements_profile_lookup_idx on public.entitlements (profile_id, kind)
  where revoked_at is null;
create index entitlements_org_lookup_idx on public.entitlements (organization_id, kind)
  where revoked_at is null;
create index entitlements_subscription_idx on public.entitlements (subscription_id);

-- The authorization question the article page asks.
create or replace function public.has_entitlement(p_kind public.entitlement_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.kind = p_kind
      and e.revoked_at is null
      and (e.expires_at is null or e.expires_at > now())
      and (
        e.profile_id = (select auth.uid())
        or e.organization_id in (
          select m.organization_id from public.organization_members m
          where m.profile_id = (select auth.uid())
        )
      )
  );
$$;

comment on function public.has_entitlement is
  'Server-side access check for premium content. RLS on articles_premium_body depends on it.';

-- Recompute entitlements whenever a subscription changes state. Idempotent.
create or replace function public.sync_subscription_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kinds public.entitlement_kind[];
  v_kind public.entitlement_kind;
  v_active boolean;
begin
  select p.entitlements into v_kinds
  from public.subscription_plans p where p.id = new.plan_id;

  v_active := new.status in ('active', 'trialing');

  if not v_active then
    update public.entitlements
       set revoked_at = coalesce(revoked_at, now())
     where subscription_id = new.id and revoked_at is null;
    return null;
  end if;

  foreach v_kind in array coalesce(v_kinds, '{}') loop
    insert into public.entitlements (
      profile_id, organization_id, subscription_id, kind, expires_at
    )
    select new.profile_id, new.organization_id, new.id, v_kind, new.current_period_end
    where not exists (
      select 1 from public.entitlements e
      where e.subscription_id = new.id and e.kind = v_kind and e.revoked_at is null
    );

    update public.entitlements
       set expires_at = new.current_period_end
     where subscription_id = new.id and kind = v_kind and revoked_at is null;
  end loop;

  return null;
end;
$$;

create trigger subscriptions_sync_entitlements
  after insert or update of status, current_period_end, plan_id on public.subscriptions
  for each row execute function public.sync_subscription_entitlements();
