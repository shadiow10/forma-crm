-- rls_auto_enable() is the event-trigger function that switches row security on for every new
-- table in public. It was created with the default grants, so PUBLIC, anon and authenticated all
-- held EXECUTE and it was reachable at /rest/v1/rpc/rls_auto_enable.
--
-- Not exploitable: the function returns event_trigger, which Postgres refuses to call outside an
-- event-trigger context, so a REST call errors rather than doing anything. But a SECURITY DEFINER
-- function exposed to anon is the wrong default, and Supabase's linter flags it (0028).
--
-- Revoking EXECUTE does not affect the auto-RLS behaviour: an event trigger fires as its owner,
-- not through the caller's EXECUTE privilege. Verified after applying — the trigger is still
-- enabled and every table in public still has row security on.

-- Guarded: rls_auto_enable() was created directly on the live project, not by a migration, so a
-- fresh replay of this folder has no such function and a bare REVOKE would abort the whole run.
-- (That drift is worth closing separately — see the note at the bottom of this file.)
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- DRIFT: the function and its event trigger live only in the production database. Rebuilding this
-- project from migrations alone would silently lose the "new tables get RLS automatically" guard.
-- Worth adding a migration that creates both, so the folder describes the database completely.
