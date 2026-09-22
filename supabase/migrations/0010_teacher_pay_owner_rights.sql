-- teacher_pay exists to show hourly pay to the people allowed to see it, without giving anyone
-- direct access to the teachers.hourly_rate column. That only works if the view runs with its
-- owner's rights: with security_invoker on, the view hits the very restriction it exists to lift,
-- and every page load fails with "permission denied for table teachers".
--
-- Bypassing row security here is safe: the view's own WHERE clause does the filtering — a director
-- of that school, or the teacher reading their own row, and nobody else.
alter view public.teacher_pay set (security_invoker = false);
grant select on public.teacher_pay to authenticated;
