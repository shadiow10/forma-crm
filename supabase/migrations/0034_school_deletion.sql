-- A school can delete itself: its director asks, and 30 days later everything is gone.
--
-- Asking (request_school_deletion) needs the director's role and the school's exact name; the app
-- also makes them re-enter their password first. From that moment the school is read-only for
-- everyone (is_frozen) and the director can cancel. After 30 days a daily job (pg_cron, 03:00)
-- calls the Edge Function "purge-schools", which removes the school's files from storage (only the
-- storage service may delete files), erases everything in the database, and deletes the logins of
-- its staff. The school's orders stay for the accounts, with the personal details wiped.

alter table schools add column delete_after date,          -- set: deletion scheduled for that day
                    add column delete_requested_by uuid;
-- Not in the update list (0005): only the two functions below change them.

-- Read-only while a deletion is scheduled, on top of 0033's rule.
create or replace function private.is_frozen(p_school_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.is_demo or s.delete_after is not null or (s.paid_until is not null
       and current_date > s.paid_until + case when s.billing = 'trial' then 3 else 15 end)
     from public.schools s where s.id = p_school_id),
    false);
$$;

create function public.request_school_deletion(p_school_id bigint, p_confirm_name text)
returns date language plpgsql security definer set search_path = '' as $$
declare v_name text; v_when date := current_date + 30;
begin
  if not private.has_role(p_school_id, '{director}') then
    raise exception 'Seul le directeur peut supprimer l''école.' using errcode = '42501';
  end if;
  select name into v_name from public.schools where id = p_school_id and not is_demo;
  if v_name is null or lower(trim(p_confirm_name)) <> lower(trim(v_name)) then
    raise exception 'Le nom saisi ne correspond pas au nom de l''école.' using errcode = 'CL005';
  end if;
  update public.schools set delete_after = v_when, delete_requested_by = auth.uid() where id = p_school_id;
  return v_when;
end $$;
revoke execute on function public.request_school_deletion(bigint, text) from public, anon;
grant execute on function public.request_school_deletion(bigint, text) to authenticated;

create function public.cancel_school_deletion(p_school_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role(p_school_id, '{director}') then
    raise exception 'Seul le directeur peut annuler la suppression.' using errcode = '42501';
  end if;
  update public.schools set delete_after = null, delete_requested_by = null where id = p_school_id;
end $$;
revoke execute on function public.cancel_school_deletion(bigint) from public, anon;
grant execute on function public.cancel_school_deletion(bigint) to authenticated;

-- Orders outlive their school (accounts, taxes). A renewal order used to go with it (0033).
alter table orders drop constraint orders_renews_school_id_fkey;
alter table orders add constraint orders_renews_school_id_fkey foreign key (renews_school_id) references schools(id) on delete set null;

-- ---------------------------------------------------------------------------- For purge-schools only
-- The schools whose day has come.
create function public.due_school_deletions()
returns setof bigint language sql stable security definer set search_path = '' as $$
  select id from public.schools where delete_after is not null and delete_after <= current_date;
$$;

-- A school's files, for the function to remove through the storage service.
create function public.school_files(p_school_id bigint)
returns setof text language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o where o.bucket_id = 'student-documents' and o.name like p_school_id::text || '/%';
$$;

-- Everything in the database, in one go; returns the logins left without a school, for the
-- function to delete through the auth service.
create function public.purge_school(p_school_id bigint)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare v_users uuid[];
begin
  if not exists (select 1 from public.schools where id = p_school_id and delete_after is not null and delete_after <= current_date) then
    raise exception 'École % : aucune suppression due.', p_school_id;
  end if;
  select coalesce(array_agg(user_id), '{}') into v_users from public.school_members where school_id = p_school_id;
  -- Kept for the accounts: what was bought and when; erased: who.
  update public.orders set director_name = 'Supprimé', email = 'supprime-' || id || '@classtra.invalid',
         -- A placeholder unique per order: 0033 allows one trial per phone number.
         phone = '05' || lpad((id % 100000000)::text, 8, '0'), user_id = null, notes = null
   where school_id = p_school_id or renews_school_id = p_school_id or user_id = any (v_users);
  -- The school and all it holds, then the two tables that only name it (no foreign key). The
  -- activity log last: the deletions themselves are logged by its triggers on the way out.
  delete from public.schools where id = p_school_id;
  delete from public.invite_attempts where school_id = p_school_id;
  delete from public.activity_log where school_id = p_school_id;
  return query select u from unnest(v_users) u
    where not exists (select 1 from public.school_members m where m.user_id = u);
end $$;

revoke execute on function public.due_school_deletions() from public, anon, authenticated;
revoke execute on function public.school_files(bigint) from public, anon, authenticated;
revoke execute on function public.purge_school(bigint) from public, anon, authenticated;
grant execute on function public.due_school_deletions() to service_role;
grant execute on function public.school_files(bigint) to service_role;
grant execute on function public.purge_school(bigint) to service_role;

-- ---------------------------------------------------------------------------- The daily job
-- Calls purge-schools when a school is due, with the same address/secret pattern as 0026. Without
-- settings (a test database, a project not set up) it does nothing.
create function private.request_purge()
returns void language plpgsql security definer set search_path = '' as $$
declare hook_url text; hook_secret text;
begin
  select value into hook_url from private.app_settings where key = 'purge_hook_url';
  select value into hook_secret from private.app_settings where key = 'order_hook_secret';
  if hook_url is null or hook_secret is null then return; end if;
  if not exists (select 1 from public.due_school_deletions()) then return; end if;
  perform net.http_post(url := hook_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', hook_secret),
    body := '{}'::jsonb);
end $$;

-- pg_cron exists on Supabase; the in-memory test database has none and does not need it.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-deleted-schools', '0 3 * * *', 'select private.request_purge()');
exception when others then
  raise notice 'pg_cron unavailable here: deletions are not scheduled.';
end $$;
