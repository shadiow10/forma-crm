-- enrollment_balances in one pass instead of one call per enrolment.
--
-- 0019 computes months_due with private.months_due(), a function called once per row. On a test
-- school of 600 pupils and 1365 enrolments that meant 1365 separate walks over attendance:
-- 1436 ms per page load, 300k buffer reads. 0021's index halved it to 647 ms; the per-row call is
-- the rest. Computing every enrolment together measures 95 ms on the same data.
--
-- The arithmetic is unchanged, deliberately: a pupil's months are still counted from their first
-- attended session in the group, still over the group's distinct session dates, still capped by
-- ends_on, still at least 1. Checked row by row against the old view across every school before
-- this was kept: 1431 enrolments, zero differences.
--
-- first_seen is a LEFT join, and that detail is the whole edge case. A pupil enrolled but not yet
-- attending has no first session, so an inner join dropped them and they owed nothing. The old
-- function reached the same pupil through a 'infinity' fallback, counted zero sessions, and
-- greatest(1, 0) still billed month 1 — which 0019 chose on purpose, because an Algerian school
-- collects the first month at enrolment. The first draft of this view got that wrong and would
-- have quietly stopped billing every new pupil until their first class; the comparison caught it
-- on two real enrolments in school 12.
--
-- private.months_due stays. It is still the readable definition of the rule, it is cheap for a
-- single enrolment, and dropping a function that something else might call buys nothing.

create or replace view public.enrollment_balances with (security_invoker = true) as
with first_seen as (
  -- The pupil's first session in the group that actually counted as attendance.
  select group_id, student_id, min(session_date) as started
  from public.attendance
  where status in ('P', 'L')
  group by group_id, student_id
),
sessions as (
  -- One row per day a group met, whoever was there.
  select distinct group_id, session_date from public.attendance
),
months as (
  select e.id as enrollment_id,
         greatest(1, ceil(count(ses.session_date)::numeric / s.sessions_per_month)::integer) as months_due
  from public.enrollments e
  join public.schools s on s.id = e.school_id
  left join first_seen f on f.group_id = e.group_id and f.student_id = e.student_id
  left join sessions ses on ses.group_id = e.group_id
       and f.started is not null and ses.session_date >= f.started
       and (e.ends_on is null or ses.session_date <= e.ends_on)
  where e.monthly_fee is not null
  group by e.id, s.sessions_per_month
)
select
  e.id as enrollment_id,
  e.school_id,
  e.student_id,
  e.course_id,
  coalesce(e.monthly_fee * m.months_due, e.total)::integer as total,
  coalesce(p.paid, 0)::integer as paid,
  greatest(coalesce(e.monthly_fee * m.months_due, e.total) - coalesce(p.paid, 0), 0)::integer as balance,
  case when coalesce(p.paid, 0) >= coalesce(e.monthly_fee * m.months_due, e.total) then 'Payé' else 'Partiel' end as payment_status,
  m.months_due
from public.enrollments e
left join months m on m.enrollment_id = e.id
left join lateral (select sum(pay.amount) as paid from public.payments pay where pay.enrollment_id = e.id) p on true;

-- A monthly enrolment whose pupil has never attended still produces a months row, counting zero
-- sessions, so greatest(1, 0) bills month 1. That is the behaviour 0019 intended.
