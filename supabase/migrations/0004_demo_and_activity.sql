-- Demo school (read-only) and activity log.

-- ---------------------------------------------------------------------------
-- Demo: a school flagged is_demo can be read by its members but never changed.
-- Restrictive policies are ANDed with every existing policy, so no role can write there.
-- ---------------------------------------------------------------------------
alter table schools add column is_demo boolean not null default false;

create function private.is_demo(p_school_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.is_demo from public.schools s where s.id = p_school_id), false);
$$;
grant execute on function private.is_demo(bigint) to authenticated;

create policy "demo is read-only" on schools as restrictive for update to authenticated using (not private.is_demo(id));

do $$
declare t text;
begin
  foreach t in array array['school_members','teachers','courses','groups','students','group_students','enrollments','payments','attendance','student_documents','student_notes'] loop
    execute format('create policy "demo read-only insert" on %I as restrictive for insert to authenticated with check (not private.is_demo(school_id))', t);
    execute format('create policy "demo read-only update" on %I as restrictive for update to authenticated using (not private.is_demo(school_id))', t);
    execute format('create policy "demo read-only delete" on %I as restrictive for delete to authenticated using (not private.is_demo(school_id))', t);
  end loop;
end $$;

create policy "demo documents read-only insert" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'student-documents' or not private.is_demo(private.path_school_id(name)));
create policy "demo documents read-only delete" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'student-documents' or not private.is_demo(private.path_school_id(name)));

-- ---------------------------------------------------------------------------
-- Activity log: who recorded, changed or deleted payments, enrollments, students and accesses.
-- Written only by triggers (running as owner); nobody can insert, edit or delete entries from the app.
-- No foreign key to schools on purpose: entries must survive the deletions they describe.
-- ---------------------------------------------------------------------------
create table activity_log (
  id bigint generated always as identity primary key,
  school_id bigint not null,
  at timestamptz not null default now(),
  actor uuid,          -- null when done by the platform (service role, SQL editor)
  actor_name text,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_row jsonb,
  new_row jsonb
);
create index on activity_log (school_id, at desc);

alter table activity_log enable row level security;
create policy "director reads activity" on activity_log for select to authenticated
  using (private.has_role(school_id, '{director}'));

create function private.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_school bigint := coalesce(new.school_id, old.school_id);
  name text;
begin
  if tg_op = 'UPDATE' and to_jsonb(new) = to_jsonb(old) then return null; end if;
  select coalesce(m.full_name, m.email) into name from public.school_members m
  where m.school_id = row_school and m.user_id = auth.uid();
  insert into public.activity_log (school_id, actor, actor_name, table_name, action, old_row, new_row)
  values (row_school, auth.uid(), name, tg_table_name, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['payments','enrollments','students','school_members'] loop
    execute format('create trigger log_activity after insert or update or delete on %I for each row execute function private.log_activity()', t);
  end loop;
end $$;
