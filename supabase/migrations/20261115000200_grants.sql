-- =============================================================================
-- GRANTs para a service_role
-- A API acessa o Postgres com a service_role (bypassa RLS), mas ainda precisa
-- de privilégio de tabela. Projetos Supabase novos nem sempre herdam o GRANT
-- padrão, e sem isso o PostgREST responde 403 "permission denied for table".
-- =============================================================================

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

grant execute on function public.increment_card_views(uuid) to service_role;
grant execute on function public.sync_user_uploads(uuid) to service_role;
