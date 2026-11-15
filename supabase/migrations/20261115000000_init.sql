-- =============================================================================
-- YGO Card Maker — schema principal (Supabase / Postgres)
-- Aplicar com: supabase db push   (ou cole no SQL Editor do dashboard)
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.cards (
    id            uuid primary key default gen_random_uuid(),
    slug          text not null unique,
    owner_hash    text not null,
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

create index if not exists cards_owner_hash_idx on public.cards (owner_hash);
create index if not exists cards_public_created_idx
    on public.cards (created_at desc)
    where is_public;

-- --- Row Level Security ------------------------------------------------------
-- A API acessa com a service_role (bypassa RLS). Nenhum cliente anônimo lê o
-- banco direto: toda leitura passa pelo backend, que filtra o que é público.
alter table public.cards enable row level security;

-- --- Views -------------------------------------------------------------------
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

revoke all on function public.increment_card_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_card_views(uuid) to service_role;
