-- Personal details stop entering the activity log.
--
-- The log stores whole rows, so deleting a student left their name, phone, email, address and date
-- of birth in activity_log for good, and every correction to a fiche added another copy of the old
-- values. A school cannot honour an erasure request while that is true.
--
-- Purging the log was the wrong fix: payment history is exactly what the log exists to protect, and
-- accounting records generally have to be kept for years. So the rule is per column instead.
-- A column on the list keeps its value; a column off the list contributes only its NAME to
-- activity_log.changed when it actually changes. Money keeps its before and after; people do not.

alter table activity_log add column changed text[];
comment on column activity_log.changed is
  'Names of the columns that changed but whose values are not kept (see private.log_columns).';

-- Null means "keep every column": the table holds no personal data.
--   payments        amounts, methods, dates          -> kept in full
--   enrollments     amounts and status, but notes is free text a secretary typed -> notes dropped
--   students        almost entirely identity         -> only the non-identifying columns
--   school_members  role must stay auditable; name and email are identity
create function private.log_columns(p_table text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_table
    when 'students'       then array['id','school_id','stage','staff','source','last_contact','created_at']
    when 'school_members' then array['school_id','user_id','role','teacher_id','created_at']
    when 'enrollments'    then array['id','school_id','student_id','course_id','group_id','enrolled_on','status','total','created_at']
    else null
  end;
$$;

create or replace function private.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_school bigint := coalesce(new.school_id, old.school_id);
  name text;
  allow text[] := private.log_columns(tg_table_name);
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  touched text[] := null;
begin
  -- Compared on the whole rows, before anything is dropped, so a change to a column we do not
  -- keep the value of is still an event worth logging.
  if tg_op = 'UPDATE' and to_jsonb(new) = to_jsonb(old) then return null; end if;
  select coalesce(m.full_name, m.email) into name from public.school_members m
  where m.school_id = row_school and m.user_id = auth.uid();

  if allow is not null then
    -- On an update: the columns whose value actually moved. On an insert or a delete: the columns
    -- that held something. A column that was empty all along is not worth naming.
    -- to_jsonb renders a SQL NULL as jsonb 'null', so emptiness is a typeof test, not "is null".
    select coalesce(array_agg(k order by k), '{}')
      into touched
      from jsonb_object_keys(coalesce(old_j, new_j)) as k
     where not (k = any (allow))
       and case
             when old_j is null then jsonb_typeof(new_j -> k) <> 'null'
             when new_j is null then jsonb_typeof(old_j -> k) <> 'null'
             else (old_j -> k) is distinct from (new_j -> k)
           end;
    if old_j is not null then
      old_j := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(old_j) as e(k, v) where k = any (allow));
    end if;
    if new_j is not null then
      new_j := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(new_j) as e(k, v) where k = any (allow));
    end if;
  end if;

  insert into public.activity_log (school_id, actor, actor_name, table_name, action, old_row, new_row, changed)
  values (row_school, auth.uid(), name, tg_table_name, tg_op, old_j, new_j, touched);
  return null;
end $$;

-- actor_name is still the actor's own name, which is staff data the director may see and is needed
-- for the log to mean anything. Only the SUBJECT rows are narrowed here.
