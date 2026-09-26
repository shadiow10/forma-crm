-- Two gaps between what this folder says and what the database actually does.

-- ---------------------------------------------------------------------------
-- 1. The auto-RLS guard existed only on the live project.
--
-- Someone created rls_auto_enable() and the ensure_rls event trigger directly on production. It
-- switches row security on for every new table in public, which is why no table has ever shipped
-- unprotected. But it was never written down here, so rebuilding this database from migrations
-- alone -- a new project, a restore, a staging copy -- produced a database WITHOUT that guard, and
-- nothing would have said so. The next table someone added would quietly be readable by anyone.
--
-- Reproduced from the live definition (owner postgres, ddl_command_end, CREATE TABLE tags).
-- ---------------------------------------------------------------------------
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (not in public)', cmd.object_identity;
    end if;
  end loop;
end $$;

-- A SECURITY DEFINER function should never be reachable from the API. It returns event_trigger, so
-- Postgres refuses to call it over REST anyway, but the default grants are the wrong shape (0017).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- ---------------------------------------------------------------------------
-- 2. Document paths: check the whole shape, not just the first segment.
--
-- path_school_id read the first path segment and stopped. '1/../2/evil.pdf' therefore answered
-- "school 1", and a director of school 1 could store an object whose key claims to sit under
-- school 2. Not a cross-tenant leak -- reading it back parses the same first segment, so school 2
-- still cannot see it -- but the stored key disagrees with any layer that resolves '..', and a
-- storage key that lies is not worth keeping.
--
-- Uploads are always <school>/<student>/<file>, so require exactly that. Anything else answers
-- null, and has_role(null) is false, so the policy refuses it.
-- ---------------------------------------------------------------------------
create or replace function private.path_school_id(p_name text)
returns bigint language sql immutable set search_path = '' as $$
  select case when p_name ~ '^[0-9]+/[0-9]+/[^/]+$'
              then split_part(p_name, '/', 1)::bigint end;
$$;
