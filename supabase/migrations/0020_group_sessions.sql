-- The days a group actually met, so teacher pay can follow cancellations.
--
-- Student billing already counts real sessions: months_due (0019) reads attendance. Teacher pay did
-- not -- it multiplied the timetable, weeklyHours × 52/12, so a cancelled session still earned its
-- hours. The two disagreed, and the gap showed the day a school called off a week of classes:
-- nobody was billed, every teacher was still paid. finance.ts carried a ponytail: note saying
-- "count attendance dates per group if pay must follow cancellations". This is that.
--
-- One row per group per day it met, not per pupil, so a 20-group school adds a few hundred rows
-- rather than thousands. security_invoker keeps attendance's own rules: a teacher sees the days of
-- the groups they teach, the office sees the school, another school sees nothing.

create view public.group_sessions with (security_invoker = true) as
  select distinct school_id, group_id, session_date
  from public.attendance;

revoke all on public.group_sessions from anon;
grant select on public.group_sessions to authenticated;

-- A session exists because a register was taken for it. That is the whole mechanism, and it cuts
-- both ways: a school that stops taking registers stops paying its hourly teachers. Worth saying
-- to a director out loud -- the habit is what makes the numbers right.
