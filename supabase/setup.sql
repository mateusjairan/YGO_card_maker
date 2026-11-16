-- =============================================================================
-- YGO Card Maker — setup completo (cole este arquivo no SQL Editor do Supabase)
-- Equivale a rodar, nesta ordem:
--   supabase/migrations/20261115000000_init.sql
--   supabase/migrations/20261115000100_storage.sql
-- É idempotente: pode rodar mais de uma vez.
-- =============================================================================

-- =============================================================================
-- YGO Card Maker — schema principal (Supabase / Postgres)
-- Aplicar com: supabase db push   (ou cole no SQL Editor do dashboard)
-- =============================================================================

create extension if not exists pgcrypto;

-- --- duelistas (login por e-mail) --------------------------------------------
create table if not exists public.users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null unique,
    password_hash text not null,
    uploads_used  integer not null default 0 check (uploads_used >= 0),
    created_at    timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx on public.users (lower(email));

-- --- cartas ------------------------------------------------------------------
create table if not exists public.cards (
    id            uuid primary key default gen_random_uuid(),
    slug          text not null unique,
    user_id       uuid not null references public.users (id) on delete cascade,
    name          text not null,
    kind          text not null check (kind in ('monster', 'spell', 'trap')),
    description   text not null default '',
    monster_kind  text,
    spell_kind    text,
    trap_kind     text,
    attribute     text check (attribute in ('light', 'dark', 'earth', 'water', 'fire', 'wind', 'divine')),
    race          text,
    archetype     text,
    level         smallint,
    atk           integer check (atk is null or atk between 0 and 5000),
    defense       integer check (defense is null or defense between 0 and 5000),
    image_url     text,
    image_path    text,
    rarity        text not null default 'secret'
                  check (rarity in ('common', 'rare', 'super', 'ultra', 'secret',
                                    'prismatic', 'ultimate', 'ghost', 'starlight')),
    is_public     boolean not null default true,
    views         integer not null default 0,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),

    constraint monster_requires_attribute check (kind <> 'monster' or attribute is not null),
    constraint monster_requires_level check (kind <> 'monster' or level is not null),
    constraint link_has_no_defense check (monster_kind is distinct from 'link' or defense is null)
);

create index if not exists cards_user_id_idx on public.cards (user_id);
create index if not exists cards_public_created_idx
    on public.cards (created_at desc)
    where is_public;

-- --- Row Level Security ------------------------------------------------------
alter table public.users enable row level security;
alter table public.cards enable row level security;

-- --- Funções -----------------------------------------------------------------
create or replace function public.increment_card_views(p_card_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.cards
       set views = views + 1
     where id = p_card_id;
$$;

drop function if exists public.increment_user_uploads(uuid);

create or replace function public.sync_user_uploads(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.users u
       set uploads_used = (
           select count(*)
             from public.cards c
            where c.user_id = u.id
              and c.image_path is not null
              and c.image_path <> ''
       )
     where u.id = p_user_id;
$$;

revoke all on function public.increment_card_views(uuid) from public, anon, authenticated;
revoke all on function public.sync_user_uploads(uuid) from public, anon, authenticated;
grant execute on function public.increment_card_views(uuid) to service_role;
grant execute on function public.sync_user_uploads(uuid) to service_role;

-- =============================================================================
-- Bucket público de artes das cartas + política de leitura
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'card-images',
    'card-images',
    true,
    6291456, -- 6 MB
    array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "card-images leitura publica" on storage.objects;
create policy "card-images leitura publica"
    on storage.objects
    for select
    using (bucket_id = 'card-images');
