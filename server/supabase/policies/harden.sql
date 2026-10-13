-- Re-applied after every migration run (idempotent).
-- The API uses a server-side connection; browser roles (anon/authenticated) get NO direct access
-- to AI Bajan tables or functions. RLS is enabled with no policies, i.e. deny-by-default for any
-- role that does not bypass RLS. Only website_with_rag_* objects in {{schema}} are touched.
do $$
declare
  t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = '{{schema}}' and c.relkind = 'r' and c.relname like 'website\_with\_rag\_%'
  loop
    execute format('alter table %I.%I enable row level security', '{{schema}}', t.relname);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table %I.%I from anon', '{{schema}}', t.relname);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table %I.%I from authenticated', '{{schema}}', t.relname);
    end if;
  end loop;
  for t in
    select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = '{{schema}}' and p.proname like 'website\_with\_rag\_%'
  loop
    execute format('revoke all on function %s from public', t.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', t.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', t.sig);
    end if;
  end loop;
end $$;
