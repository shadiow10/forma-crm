-- Three fixes for the same underlying cost: row security being re-evaluated per row.
--
-- Measured on a test school of 600 pupils, 1365 enrolments and 16380 attendance rows, as a real
-- signed-in director (set local role authenticated), not as the table owner.

-- ---------------------------------------------------------------------------
-- 1. months_due ran as the caller, so every attendance row it read was re-checked against the
--    attendance policies -- which call teaches(), which calls my_teacher_id(). The function runs
--    once per enrolment, each reading several hundred rows: roughly two million policy evaluations
--    for one page load. The statement timed out and the app showed "Erreur de chargement".
--
--    has_role, teaches and my_teacher_id were already SECURITY DEFINER; months_due was the only
--    helper that was not, which looks like an oversight in 0019 rather than a decision.
--
--    Safe: it lives in the private schema and is unreachable from the API, it returns a count and
--    never a row, and the enrolment it is asked about has already passed the view's own policy
--    check. It stops re-asking a question that was answered before it was called.
--
--    enrollment_balances, 600 pupils: timed out -> 606 ms.
-- ---------------------------------------------------------------------------
create or replace function private.months_due(p_group_id bigint, p_student_id bigint, p_ends_on date, p_per_month integer)
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(1, ceil(count(distinct a.session_date)::numeric / p_per_month)::integer)
  from public.attendance a
  where a.group_id = p_group_id
    and a.session_date >= coalesce(
      (select min(f.session_date) from public.attendance f
        where f.group_id = p_group_id and f.student_id = p_student_id and f.status in ('P', 'L')),
      'infinity'::date)
    and (p_ends_on is null or a.session_date <= p_ends_on);
$$;

-- ---------------------------------------------------------------------------
-- 2. auth.uid() wrapped in a subselect. Postgres hoists `(select auth.uid())` into an InitPlan and
--    evaluates it once per query; called bare, it runs again for every row the policy tests. Same
--    answer either way -- the signed-in user does not change halfway through a query, and both
--    functions are already STABLE, which promises exactly that.
--
--    No policy is rewritten here, so no access rule changes.
-- ---------------------------------------------------------------------------
create or replace function private.has_role(p_school_id bigint, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.school_members m
    where m.school_id = p_school_id and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

create or replace function private.my_teacher_id(p_school_id bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select m.teacher_id from public.school_members m
  where m.school_id = p_school_id and m.user_id = (select auth.uid()) and m.role = 'teacher';
$$;

-- ---------------------------------------------------------------------------
-- 3. attendance_stats counts statuses per pupil per group. status was not in any index, so the
--    aggregate had to visit the table for it. With status on the end it reads from the index alone.
-- ---------------------------------------------------------------------------
create index if not exists attendance_stats_cover_idx
  on public.attendance (school_id, group_id, student_id, status);

-- ---------------------------------------------------------------------------
-- What this does NOT fix, measured after the above:
--   attendance_stats  1867 ms,  group_sessions  2580 ms  (600 pupils)
--
-- Both call has_role(school_id, ...) once per row with a different school_id each time, so the
-- answer cannot be reused. The fix is a set-based policy -- ask once which schools this user
-- belongs to, then test each row against that list:
--
--   using (school_id in (select m.school_id from public.school_members m
--                        where m.user_id = (select auth.uid()) and m.role = any ('{...}')))
--
-- That rewrites ~11 policies and must not be merged until rls.test.mjs passes in full. Deliberately
-- left out of this migration: these three cannot change anyone's access, and that one can.
--
-- It is also not urgent. The same three queries on a 25-pupil school: 9 ms, 53 ms, 47 ms. The cost
-- only appears at a scale no real school has yet.
-- ---------------------------------------------------------------------------
