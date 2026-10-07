-- Écoles de soutien: the same app for the "cours" that prepare pupils for the BEM and the BAC.
--
-- What changes for them:
--   * a school is a 'formation' (a course with one price) or a 'soutien' (subjects paid every month),
--     chosen once, on the order form, and copied onto the school when the order is approved;
--   * a monthly enrollment owes monthly_fee for every "month" it has started, and a month is
--     sessions_per_month sessions (4 by default) counted from the pupil's first session in the group,
--     not a calendar month. Month 1 is owed at enrollment, which is when Algerian schools collect it;
--   * a payment can say which month it settles (month_no), so a receipt reads "Maths 3AS — mois 3";
--   * pupils have a level, a filière and a parent to call; groups and subjects have a level;
--   * a teacher can be on a fixed monthly salary instead of an hourly rate.
-- Every new column defaults to today's behaviour, so formation schools see no difference.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table schools
  add column kind text not null default 'formation' check (kind in ('formation', 'soutien')),
  add column sessions_per_month integer not null default 4 check (sessions_per_month between 1 and 31);

alter table courses
  add column billing text not null default 'total' check (billing in ('total', 'monthly')),
  add column level text check (length(level) <= 40);

alter table groups add column level text check (length(level) <= 40);

alter table students
  add column level text check (length(level) <= 40),
  add column filiere text check (length(filiere) <= 60),
  add column parent_name text check (length(parent_name) <= 120),
  add column parent_phone text check (length(parent_phone) <= 30);

-- monthly_fee set = billed by the month; null = the enrollment's total, as before.
-- ends_on: the last day a monthly enrollment is billed for (set when it is finished or dropped).
alter table enrollments
  add column monthly_fee integer check (monthly_fee >= 0),
  add column ends_on date;

alter table payments add column month_no integer check (month_no > 0);

-- Null = paid by the hour (hourly_rate). Set = this amount every month the teacher has a group running.
alter table teachers add column monthly_salary integer check (monthly_salary >= 0);

-- ---------------------------------------------------------------------------
-- Write rights. 0005 grants UPDATE column by column, so a new column is read-only until named here.
-- schools.kind is not on the list: it comes from the order, the director does not switch it.
-- ---------------------------------------------------------------------------
grant update (sessions_per_month) on schools to authenticated;
grant update (billing, level) on courses to authenticated;
grant update (level) on groups to authenticated;
grant update (level, filiere, parent_name, parent_phone) on students to authenticated;
grant update (monthly_fee, ends_on) on enrollments to authenticated;
grant update (month_no) on payments to authenticated;
grant update (monthly_salary) on teachers to authenticated;
-- teachers has column-level SELECT (0006): monthly_salary stays out of it and is read through teacher_pay.

-- ---------------------------------------------------------------------------
-- Pay stays between the teacher and the director: same view, one more column at the end.
-- ---------------------------------------------------------------------------
-- security_invoker stays off, as 0010 set it: the view must read a column its callers cannot.
create or replace view public.teacher_pay with (security_invoker = false) as
  select t.id as teacher_id, t.school_id, t.hourly_rate, t.monthly_salary
  from public.teachers t
  where private.has_role(t.school_id, '{director}') or t.id = private.my_teacher_id(t.school_id);

-- ---------------------------------------------------------------------------
-- Only the director changes what an enrollment costs (0005): the monthly fee is a price too.
-- ---------------------------------------------------------------------------
create or replace function private.guard_enrollment_total()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.total is distinct from old.total or new.monthly_fee is distinct from old.monthly_fee)
     and auth.uid() is not null and not private.has_role(new.school_id, '{director}') then
    raise exception 'Seul le directeur peut modifier le montant d''une inscription.' using errcode = '42501';
  end if;
  return new;
end $$;

-- A monthly enrollment stops being billed the day it is finished or dropped.
create function private.close_monthly_enrollment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.monthly_fee is not null and new.ends_on is null
     and new.status in ('Terminé', 'Abandonné') and old.status is distinct from new.status then
    new.ends_on := current_date;
  end if;
  return new;
end $$;
create trigger close_monthly_enrollment before update on enrollments
  for each row execute function private.close_monthly_enrollment();

-- ---------------------------------------------------------------------------
-- How many months a monthly enrollment owes: one at enrollment, then one more every
-- sessions_per_month sessions of its group, counted from the pupil's first session (present or late)
-- and up to ends_on. A session is a date on which the group's attendance was taken.
-- Runs as the caller, like the view that uses it: the office reads attendance anyway.
-- ---------------------------------------------------------------------------
create function private.months_due(p_group_id bigint, p_student_id bigint, p_ends_on date, p_per_month integer)
returns integer language sql stable set search_path = '' as $$
  select greatest(1, ceil(count(distinct a.session_date)::numeric / p_per_month)::integer)
  from public.attendance a
  where a.group_id = p_group_id
    and a.session_date >= coalesce(
      (select min(f.session_date) from public.attendance f
        where f.group_id = p_group_id and f.student_id = p_student_id and f.status in ('P', 'L')),
      'infinity'::date)
    and (p_ends_on is null or a.session_date <= p_ends_on);
$$;
grant execute on function private.months_due(bigint, bigint, date, integer) to authenticated;

-- Same columns as before, in the same order (every page reads them), plus months_due at the end.
-- For a monthly enrollment "total" is what is owed so far, so balances, the unpaid list and the
-- payment form need no change to understand it.
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

-- ---------------------------------------------------------------------------
-- Enrolling: one more argument, the monthly fee. The first payment then settles month 1.
-- Dropped and recreated rather than overloaded: two versions would make named calls ambiguous.
-- ---------------------------------------------------------------------------
drop function public.create_enrollment(bigint, bigint, bigint, bigint, date, integer, text, integer, text);
create function public.create_enrollment(
  p_school_id bigint, p_student_id bigint, p_course_id bigint, p_group_id bigint,
  p_enrolled_on date, p_total integer, p_notes text, p_first_payment integer, p_method text,
  p_monthly_fee integer default null
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_id bigint;
begin
  insert into public.enrollments (school_id, student_id, course_id, group_id, enrolled_on, status, total, notes, monthly_fee)
  values (p_school_id, p_student_id, p_course_id, p_group_id, coalesce(p_enrolled_on, current_date), 'Inscrit',
          case when p_monthly_fee is null then p_total else 0 end, nullif(trim(p_notes), ''), p_monthly_fee)
  returning id into v_id;
  if p_group_id is not null then
    insert into public.group_students (school_id, group_id, student_id) values (p_school_id, p_group_id, p_student_id)
    on conflict do nothing;
  end if;
  if coalesce(p_first_payment, 0) > 0 then
    insert into public.payments (school_id, enrollment_id, amount, paid_on, method, month_no)
    values (p_school_id, v_id, p_first_payment, coalesce(p_enrolled_on, current_date), p_method,
            case when p_monthly_fee is not null then 1 end);
  end if;
  return v_id;
end;
$$;
revoke execute on function public.create_enrollment(bigint, bigint, bigint, bigint, date, integer, text, integer, text, integer) from public, anon;
grant execute on function public.create_enrollment(bigint, bigint, bigint, bigint, date, integer, text, integer, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Activity log (0012): the new non-identifying columns keep their values. parent_name and
-- parent_phone are identity, so like the pupil's own name they only leave their column name.
-- ---------------------------------------------------------------------------
create or replace function private.log_columns(p_table text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_table
    when 'students'       then array['id','school_id','stage','staff','source','last_contact','created_at','level','filiere']
    when 'school_members' then array['school_id','user_id','role','teacher_id','created_at']
    when 'enrollments'    then array['id','school_id','student_id','course_id','group_id','enrolled_on','status','total','created_at','monthly_fee','ends_on']
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- The order form says what kind of school it is; the approved school starts as that kind.
-- Same function as 0016, plus kind.
-- ---------------------------------------------------------------------------
create or replace function public.approve_order(p_order_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare o public.orders; new_school bigint;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable.'; end if;
  if o.school_id is not null then return o.school_id; end if;
  if o.user_id is null then
    -- Only an account that has confirmed this address may claim the order (0014).
    select u.id into o.user_id from auth.users u
     where lower(u.email) = o.email and u.email_confirmed_at is not null;
    if o.user_id is null then raise exception 'Cette commande n''a pas de compte confirmé : le directeur doit créer son compte avec ''%'' et cliquer le lien de confirmation.', o.email; end if;
    update public.orders set user_id = o.user_id where id = p_order_id;
  end if;

  insert into public.schools (name, slug, currency, billing, paid_until, kind)
  values (o.school_name, private.school_slug(o.school_name), 'DA', o.billing,
          current_date + case when o.billing = 'yearly' then interval '1 year' else interval '1 month' end,
          case when o.school_type ilike '%soutien%' then 'soutien' else 'formation' end)
  returning id into new_school;

  insert into public.school_members (school_id, user_id, role, full_name, email)
  values (new_school, o.user_id, 'director', o.director_name, o.email);

  update public.orders set school_id = new_school, status = 'payé', paid_at = coalesce(paid_at, now()) where id = p_order_id;
  return new_school;
end $$;
