-- How a teacher is paid is a choice, and there are three: by the hour, a fixed monthly salary, or an
-- amount per student taught. 0019 told the first two apart by whether monthly_salary was set; the
-- third needs its own rate, so the mode is now stored instead of guessed.
alter table teachers
  add column pay_mode text not null default 'hour' check (pay_mode in ('hour', 'month', 'student')),
  add column per_student_rate integer check (per_student_rate >= 0);
-- Teachers on a salary today stay on it.
update teachers set pay_mode = 'month' where monthly_salary is not null;
grant update (pay_mode, per_student_rate) on teachers to authenticated;
-- Like hourly_rate and monthly_salary, neither column is in teachers' column SELECT (0006): pay is
-- read through teacher_pay, by the director and the teacher concerned only. Two columns at the end.
create or replace view public.teacher_pay with (security_invoker = false) as
  select t.id as teacher_id, t.school_id, t.hourly_rate, t.monthly_salary, t.pay_mode, t.per_student_rate
  from public.teachers t
  where private.has_role(t.school_id, '{director}') or t.id = private.my_teacher_id(t.school_id);
