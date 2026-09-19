-- Read-only demo school for the "Essayer la démo" button on the landing page.
-- Run once in the Supabase SQL editor, AFTER migration 0004 and AFTER creating the login
-- demo@formaplus.test in Authentication → Users (tick "Auto Confirm User").
-- It copies the sample school (id 1, from seed.sql) into a new school flagged is_demo.

do $$
declare
  s bigint;
  o bigint := 1000000; -- ponytail: fixed id offset for the copy; fine until a table passes a million rows
begin
  if exists (select 1 from schools where slug = 'demo') then
    raise notice 'Demo school already exists, nothing copied.';
  else
    insert into schools (name, slug, currency, phone, email, address, is_demo)
    values ('Institut Démo', 'demo', 'DA', '023 00 00 00', 'contact@demo.dz', 'Hydra, Alger', true)
    returning id into s;

    insert into courses (school_id, id, name, short_name, duration, price, color)
      select s, id + o, name, short_name, duration, price, color from courses where school_id = 1;
    insert into teachers (school_id, id, full_name, subject, phone, email, hourly_rate, contract, color)
      select s, id + o, full_name, subject, phone, email, hourly_rate, contract, color from teachers where school_id = 1;
    insert into groups (school_id, id, name, course_id, teacher_id, room, days, start_time, end_time, capacity, status, color)
      select s, id + o, name, course_id + o, teacher_id + o, room, days, start_time, end_time, capacity, status, color from groups where school_id = 1;
    insert into students (school_id, id, full_name, phone, email, address, dob, source, created_at)
      select s, id + o, full_name, phone, email, address, dob, source, created_at from students where school_id = 1;
    insert into group_students (school_id, group_id, student_id)
      select s, group_id + o, student_id + o from group_students where school_id = 1;
    insert into enrollments (school_id, id, student_id, course_id, group_id, enrolled_on, status, total, notes)
      select s, id + o, student_id + o, course_id + o, group_id + o, enrolled_on, status, total, notes from enrollments where school_id = 1;
    insert into payments (school_id, enrollment_id, amount, paid_on, method)
      select s, enrollment_id + o, amount, paid_on, method from payments where school_id = 1;
    insert into attendance (school_id, group_id, student_id, session_date, status)
      select s, group_id + o, student_id + o, session_date, status from attendance where school_id = 1;
  end if;

  -- The demo login sees everything, as a director; the database refuses every change.
  insert into school_members (school_id, user_id, role, full_name, email)
  select sc.id, u.id, 'director', 'Visiteur de la démo', u.email
  from schools sc, auth.users u
  where sc.slug = 'demo' and u.email = 'demo@formaplus.test'
  on conflict do nothing;
end $$;

-- The demo password is public, so nobody may change the demo login's password or email.
-- To change it yourself later: drop trigger protect_demo_login on auth.users; then recreate it.
create or replace function private.protect_demo_login()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.email = 'demo@formaplus.test'
     and (new.encrypted_password is distinct from old.encrypted_password or new.email is distinct from old.email) then
    raise exception 'Le compte de démonstration ne peut pas être modifié.';
  end if;
  return new;
end $$;
drop trigger if exists protect_demo_login on auth.users;
create trigger protect_demo_login before update on auth.users
  for each row execute function private.protect_demo_login();
