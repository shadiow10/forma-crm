-- Three things before launch: stop order flooding, index the foreign keys the app joins on,
-- and stop one policy from re-reading auth.uid() for every row.

-- ---------------------------------------------------------------------------
-- 1. Orders: place_order is open to anyone, so bound it. Five per email per day and
--    twenty per hour in total is far above what a real buyer does and far below a script.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_school_name text, p_school_type text, p_wilaya text, p_director_name text,
  p_email text, p_phone text, p_plan text, p_billing text, p_notes text default null
) returns bigint language plpgsql security definer set search_path = '' as $$
declare new_id bigint; clean_email text := lower(trim(p_email));
begin
  if (select count(*) from public.orders o where o.email = clean_email and o.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de demandes pour cette adresse. Contactez-nous directement.' using errcode = '53400';
  end if;
  if (select count(*) from public.orders o where o.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Trop de demandes en ce moment. Réessayez dans quelques minutes.' using errcode = '53400';
  end if;

  insert into public.orders (school_name, school_type, wilaya, director_name, email, phone, plan, billing, notes, user_id)
  values (trim(p_school_name), nullif(trim(p_school_type), ''), trim(p_wilaya), trim(p_director_name),
          clean_email, regexp_replace(p_phone, '[^0-9]', '', 'g'), p_plan, p_billing, nullif(trim(p_notes), ''), auth.uid())
  returning id into new_id;
  return new_id;
end $$;
create index if not exists orders_email_created_idx on orders (email, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Foreign keys the app joins on, with no index behind them. Postgres reads the whole
--    table for each check today; it costs nothing to fix now and hurts once schools grow.
-- ---------------------------------------------------------------------------
create index if not exists attendance_school_group_idx on attendance (school_id, group_id);
create index if not exists enrollments_school_course_idx on enrollments (school_id, course_id);
create index if not exists enrollments_school_group_idx on enrollments (school_id, group_id);
create index if not exists group_students_school_group_idx on group_students (school_id, group_id);
create index if not exists group_students_school_student_idx on group_students (school_id, student_id);
create index if not exists groups_school_course_idx on groups (school_id, course_id);
create index if not exists orders_school_idx on orders (school_id);
create index if not exists orders_user_idx on orders (user_id);
create index if not exists school_members_school_teacher_idx on school_members (school_id, teacher_id);
create index if not exists student_notes_author_idx on student_notes (author_id);

-- ---------------------------------------------------------------------------
-- 3. "see own membership" called auth.uid() once per row. Wrapped in a select, Postgres
--    evaluates it once for the whole query.
-- ---------------------------------------------------------------------------
drop policy "see own membership" on school_members;
create policy "see own membership" on school_members for select to authenticated
  using (user_id = (select auth.uid()));
