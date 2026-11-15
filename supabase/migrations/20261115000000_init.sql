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
    holo          boolean not null default true,
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
-- A API acessa com a service_role (bypassa RLS). Nenhum cliente anônimo lê o
-- banco direto: toda leitura passa pelo backend, que filtra o que é público.
alter table public.users enable row level security;
alter table public.cards enable row level security;

-- --- Funções -----------------------------------------------------------------
-- Contador de visualizações atômico (usado pela página pública /c/{slug}).
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

-- Consome 1 upload da cota do duelista (o limite de 5 é regra da aplicação).
create or replace function public.increment_user_uploads(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.users
       set uploads_used = uploads_used + 1
     where id = p_user_id;
$$;

revoke all on function public.increment_card_views(uuid) from public, anon, authenticated;
revoke all on function public.increment_user_uploads(uuid) from public, anon, authenticated;
grant execute on function public.increment_card_views(uuid) to service_role;
grant execute on function public.increment_user_uploads(uuid) to service_role;
