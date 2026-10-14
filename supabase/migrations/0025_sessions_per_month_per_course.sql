-- Sessions per month belongs to the course, not to the school.
--
-- 0019 put one sessions_per_month on schools: every monthly subject counted a "month" as the same
-- number of sessions. A school runs Maths twice a week and Philosophie once, so a month of Maths is
-- 8 sessions and a month of Philo 4. The value now lives on the course and is chosen when the
-- course is created; schools.sessions_per_month stays as the fallback for a course that has none,
-- so nothing already billed changes.

alter table courses add column sessions_per_month integer check (sessions_per_month between 1 and 31);
-- Every existing course keeps exactly what it was billed with until now.
update courses c set sessions_per_month = s.sessions_per_month from schools s where s.id = c.school_id;
grant update (sessions_per_month) on courses to authenticated;

-- 0023's view (0019's shape, restored after 0022 timed out), with the course's count in front of
-- the school's. Still one months_due call per enrolment, which 0024 made cheap; no CTE over every
-- school's rows. Same columns, same order.
create or replace view public.enrollment_balances with (security_invoker = true) as
select
  e.id as enrollment_id,
  e.school_id,
  e.student_id,
  e.course_id,
  b.total,
  coalesce(p.paid, 0)::integer as paid,
  greatest(b.total - coalesce(p.paid, 0), 0)::integer as balance,
  case when coalesce(p.paid, 0) >= b.total then 'Payé' else 'Partiel' end as payment_status,
  b.months_due
from public.enrollments e
join public.schools s on s.id = e.school_id
join public.courses c on c.id = e.course_id
cross join lateral (
  select m.months_due, coalesce(e.monthly_fee * m.months_due, e.total)::integer as total
  from (select case when e.monthly_fee is not null
                    then private.months_due(e.group_id, e.student_id, e.ends_on, coalesce(c.sessions_per_month, s.sessions_per_month)) end as months_due) m
) b
left join lateral (select sum(pay.amount) as paid from public.payments pay where pay.enrollment_id = e.id) p on true;
