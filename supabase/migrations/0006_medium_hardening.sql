-- A school always keeps a director, teacher pay stays between the teacher and the director,
-- and a removed login can be invited again.

-- ---------------------------------------------------------------------------
-- Last director: a director can remove or demote anyone but the last director of the school,
-- which would leave nobody able to manage users, teachers or payments.
-- ---------------------------------------------------------------------------
-- security definer: the check runs as owner. As the caller it would be blind, because someone
-- who just deleted their own director row can no longer see the school or its members.
create function private.keep_one_director()
returns trigger language plpgsql security definer set search_path = '' as $$
declare school bigint := coalesce(old.school_id, new.school_id);
begin
  if not exists (select 1 from public.school_members m where m.school_id = school and m.role = 'director')
     and exists (select 1 from public.schools s where s.id = school) then
    raise exception 'Une école doit garder au moins un directeur.' using errcode = '42501';
  end if;
  return null;
end $$;

-- A constraint trigger runs at the end of the statement, so swapping directors in one
-- transaction (promote the new one, demote the old one) still works.
create constraint trigger keep_one_director after update or delete on school_members
  deferrable initially deferred for each row execute function private.keep_one_director();

-- ---------------------------------------------------------------------------
-- Teacher pay: the secretaire assigns teachers to groups but has no reason to see what they earn.
-- Column rights cannot tell roles apart (both are "authenticated"), so hourly_rate is read through
-- a view that filters by role instead. The view runs as its owner on purpose: that is what lets it
-- read a column the caller cannot select directly.
-- ---------------------------------------------------------------------------
-- A table-wide select grant covers every column, so it has to go before the column list is given back.
revoke select on teachers from anon, authenticated;
grant select (id, school_id, full_name, subject, phone, email, contract, color, created_at) on teachers to authenticated;

create view teacher_pay as
  select t.id as teacher_id, t.school_id, t.hourly_rate
  from teachers t
  where private.has_role(t.school_id, '{director}') or t.id = private.my_teacher_id(t.school_id);
revoke all on teacher_pay from anon;
grant select on teacher_pay to authenticated;

-- ---------------------------------------------------------------------------
-- Re-inviting someone whose access was removed: their login still exists, so a fresh invitation
-- fails with "account already exists". This tells the invite function the id of an account that
-- belongs to no school at all, so it can attach it again. Service role only: it reads auth.users.
-- ---------------------------------------------------------------------------
create function public.orphan_user_id(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  where lower(u.email) = lower(p_email)
    and not exists (select 1 from public.school_members m where m.user_id = u.id);
$$;
revoke execute on function public.orphan_user_id(text) from public, anon, authenticated;
grant execute on function public.orphan_user_id(text) to service_role;
