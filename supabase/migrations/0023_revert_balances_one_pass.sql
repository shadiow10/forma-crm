-- Undo 0022. It timed out in production and the app would not load.
--
-- 0022 replaced enrollment_balances with a single-pass computation and was verified against the old
-- view row by row: 1431 enrolments, zero differences. The verification was sound. The measurement
-- was not — both were run as the table owner, where row security does not apply.
--
-- Under a real signed-in user it does. The view is security_invoker, so every table it reads is
-- filtered by policy, and 0022 built its months CTE over every enrolment and every attendance row
-- in the database before narrowing to one school. The policies were then evaluated across all of
-- it. 27 requests returned 500 with "canceling statement due to statement timeout".
--
-- The lesson, written down because it will happen again: measure a security_invoker view as
-- `set local role authenticated` with request.jwt.claims set, never as the owner. An EXPLAIN as
-- owner answers a different question than the one the app asks.
--
-- Restored exactly as 0019 defined it. The real cost was never the shape of this view -- it was
-- months_due re-checking row security on every attendance row it read, which 0024 fixes.

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
cross join lateral (
  select m.months_due, coalesce(e.monthly_fee * m.months_due, e.total)::integer as total
  from (select case when e.monthly_fee is not null
                    then private.months_due(e.group_id, e.student_id, e.ends_on, s.sessions_per_month) end as months_due) m
) b
left join lateral (select sum(pay.amount) as paid from public.payments pay where pay.enrollment_id = e.id) p on true;
