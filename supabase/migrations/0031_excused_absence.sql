-- An excused absence: the student could not come for a good reason, and the school says so.
--
-- Until now a register had three marks (P present, L late, A absent) and a monthly subject counted
-- its months from the sessions the group held, whoever came: a missed session was used up either way.
-- 'E' (excusé) keeps the session for the student: it is not counted in their month, so their month
-- runs one session longer. An unexcused absence, or no mark at all, still counts as before. The
-- group still held the session, so the teacher's pay (group_sessions) does not change.
alter table attendance drop constraint attendance_status_check;
alter table attendance add constraint attendance_status_check check (status in ('P', 'A', 'L', 'E'));

-- 0024's months_due (security definer, unchanged otherwise), minus the sessions this student was excused from.
create or replace function private.months_due(p_group_id bigint, p_student_id bigint, p_ends_on date, p_per_month integer)
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(1, ceil(count(distinct a.session_date)::numeric / p_per_month)::integer)
  from public.attendance a
  where a.group_id = p_group_id
    and a.session_date >= coalesce(
      (select min(f.session_date) from public.attendance f
        where f.group_id = p_group_id and f.student_id = p_student_id and f.status in ('P', 'L')),
      'infinity'::date)
    and (p_ends_on is null or a.session_date <= p_ends_on)
    and not exists (select 1 from public.attendance x
      where x.group_id = p_group_id and x.student_id = p_student_id and x.session_date = a.session_date and x.status = 'E');
$$;

-- The attendance rate leaves excused sessions out: one more column, at the end.
create or replace view attendance_stats with (security_invoker = true) as
select
  school_id,
  group_id,
  student_id,
  count(*)::integer as sessions,
  (count(*) filter (where status = 'P'))::integer as present,
  (count(*) filter (where status = 'L'))::integer as late,
  (count(*) filter (where status = 'A'))::integer as absent,
  (count(*) filter (where status = 'E'))::integer as excused
from attendance
group by school_id, group_id, student_id;
