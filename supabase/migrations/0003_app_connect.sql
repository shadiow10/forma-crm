-- Columns and objects the connected app needs.

-- School contact details, edited by the director in Paramètres.
alter table schools add column phone text, add column email text, add column address text;

-- Login email shown in Paramètres → Utilisateurs (auth.users is not readable from the browser).
alter table school_members add column email text;
update school_members m set email = u.email from auth.users u where u.id = m.user_id and m.email is null;

-- Groups get an end time; the planning grid is drawn from start/end.
alter table groups add column end_time time;
update groups set end_time = start_time + interval '2 hours' where end_time is null and start_time is not null;
alter table groups add constraint groups_time_order check (end_time is null or start_time is null or end_time > start_time);

-- Attendance totals per student and group, computed in the database so the app
-- never has to download every attendance row. Same access rules as attendance.
create view attendance_stats with (security_invoker = true) as
select
  school_id,
  group_id,
  student_id,
  count(*)::integer as sessions,
  (count(*) filter (where status = 'P'))::integer as present,
  (count(*) filter (where status = 'L'))::integer as late,
  (count(*) filter (where status = 'A'))::integer as absent
from attendance
group by school_id, group_id, student_id;

-- Student documents (ID card, diplomas…) in private storage.
-- File path: <school_id>/<student_id>/<file name>. Only the director and secretaire of that school can touch them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-documents', 'student-documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create function private.path_school_id(p_name text)
returns bigint language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9]+$' then split_part(p_name, '/', 1)::bigint end;
$$;
grant execute on function private.path_school_id(text) to authenticated;

create policy "office reads student documents" on storage.objects for select to authenticated
  using (bucket_id = 'student-documents' and private.has_role(private.path_school_id(name), '{director,secretaire}'));
create policy "office uploads student documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-documents' and private.has_role(private.path_school_id(name), '{director,secretaire}'));
create policy "office deletes student documents" on storage.objects for delete to authenticated
  using (bucket_id = 'student-documents' and private.has_role(private.path_school_id(name), '{director,secretaire}'));

-- Deleting a student or an enrollment also deletes its payments (cascade), so only the director
-- may do it; otherwise the secretaire could erase payments indirectly.
drop policy "office manages students" on students;
create policy "office reads students" on students for select to authenticated using (private.has_role(school_id, '{director,secretaire}'));
create policy "office adds students" on students for insert to authenticated with check (private.has_role(school_id, '{director,secretaire}'));
create policy "office edits students" on students for update to authenticated
  using (private.has_role(school_id, '{director,secretaire}')) with check (private.has_role(school_id, '{director,secretaire}'));
create policy "director deletes students" on students for delete to authenticated using (private.has_role(school_id, '{director}'));

drop policy "office manages enrollments" on enrollments;
create policy "office reads enrollments" on enrollments for select to authenticated using (private.has_role(school_id, '{director,secretaire}'));
create policy "office adds enrollments" on enrollments for insert to authenticated with check (private.has_role(school_id, '{director,secretaire}'));
create policy "office edits enrollments" on enrollments for update to authenticated
  using (private.has_role(school_id, '{director,secretaire}')) with check (private.has_role(school_id, '{director,secretaire}'));
create policy "director deletes enrollments" on enrollments for delete to authenticated using (private.has_role(school_id, '{director}'));

-- Creates an enrollment, adds the student to the group and records the first payment in one transaction.
-- Runs with the caller's rights, so the policies above still apply.
create function public.create_enrollment(
  p_school_id bigint, p_student_id bigint, p_course_id bigint, p_group_id bigint,
  p_enrolled_on date, p_total integer, p_notes text, p_first_payment integer, p_method text
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint;
begin
  insert into public.enrollments (school_id, student_id, course_id, group_id, enrolled_on, status, total, notes)
  values (p_school_id, p_student_id, p_course_id, p_group_id, coalesce(p_enrolled_on, current_date), 'Inscrit', p_total, nullif(trim(p_notes), ''))
  returning id into v_id;
  if p_group_id is not null then
    insert into public.group_students (school_id, group_id, student_id) values (p_school_id, p_group_id, p_student_id)
    on conflict do nothing;
  end if;
  if coalesce(p_first_payment, 0) > 0 then
    insert into public.payments (school_id, enrollment_id, amount, paid_on, method)
    values (p_school_id, v_id, p_first_payment, coalesce(p_enrolled_on, current_date), p_method);
  end if;
  return v_id;
end;
$$;
revoke execute on function public.create_enrollment(bigint, bigint, bigint, bigint, date, integer, text, integer, text) from public, anon;
grant execute on function public.create_enrollment(bigint, bigint, bigint, bigint, date, integer, text, integer, text) to authenticated;
