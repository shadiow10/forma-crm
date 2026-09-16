-- Display name shown in the app for each login.
alter table school_members add column full_name text;

-- Payments: the secretaire records and reads payments; only the director can change or delete them.
drop policy "office manages payments" on payments;
create policy "director manages payments" on payments for all to authenticated
  using (private.has_role(school_id, '{director}')) with check (private.has_role(school_id, '{director}'));
create policy "secretaire reads payments" on payments for select to authenticated
  using (private.has_role(school_id, '{secretaire}'));
create policy "secretaire records payments" on payments for insert to authenticated
  with check (private.has_role(school_id, '{secretaire}'));

-- Teachers take attendance for the groups they teach.
create function private.teaches(p_school_id bigint, p_group_id bigint, p_student_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.groups g
    join public.group_students gs on gs.group_id = g.id and gs.student_id = p_student_id
    where g.id = p_group_id and g.school_id = p_school_id
      and g.teacher_id = private.my_teacher_id(p_school_id)
  );
$$;
grant execute on function private.teaches(bigint, bigint, bigint) to authenticated;

create policy "teacher reads own attendance" on attendance for select to authenticated
  using (private.teaches(school_id, group_id, student_id));
create policy "teacher records own attendance" on attendance for insert to authenticated
  with check (private.teaches(school_id, group_id, student_id));
create policy "teacher corrects own attendance" on attendance for update to authenticated
  using (private.teaches(school_id, group_id, student_id)) with check (private.teaches(school_id, group_id, student_id));

-- A teacher sees only the names of students in their own groups (no phone, email or payments),
-- so they get this function instead of access to the students table.
create function public.group_roster(p_group_id bigint)
returns table (student_id bigint, full_name text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.full_name
  from public.groups g
  join public.group_students gs on gs.group_id = g.id
  join public.students s on s.id = gs.student_id and s.school_id = g.school_id
  where g.id = p_group_id
    and (g.teacher_id = private.my_teacher_id(g.school_id) or private.has_role(g.school_id, '{director,secretaire}'))
  order by s.full_name;
$$;
revoke execute on function public.group_roster(bigint) from public, anon;
grant execute on function public.group_roster(bigint) to authenticated;
