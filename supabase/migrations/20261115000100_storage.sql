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

-- Leitura pública das artes (necessário para o <img> da carta e o Open Graph)
drop policy if exists "card-images leitura publica" on storage.objects;
create policy "card-images leitura publica"
    on storage.objects
    for select
    using (bucket_id = 'card-images');

-- Escrita/remoção: apenas service_role (backend). Nenhuma policy de insert
-- para anon/authenticated é criada de propósito.
