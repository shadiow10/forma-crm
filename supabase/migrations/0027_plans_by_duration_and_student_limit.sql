-- Plans by duration, a student limit, and student packs sold as an add-on.
--
-- The three tiers (Essentiel / Pro / Établissement) become one offer sold for 1 month, 6 months or
-- a year: 10 000, 60 000 and 89 900 DA.
-- Every plan covers 500 students. A school that needs more buys a pack on top: +500 students for
-- 5 000 DA, +1 000 for 10 000 DA, beyond that on quote. The pack is its own line, not part of the
-- plan. Prices live in the site (Landing.tsx); orders keep no amount, as before (0007): the order
-- says what was chosen, the price follows from it, and nobody can send their own.

-- ---------------------------------------------------------------------------- Orders
alter table orders drop constraint if exists orders_plan_check;
alter table orders add constraint orders_plan_check check (plan in ('standard', 'essentiel', 'pro', 'etablissement')); -- old tiers kept for old rows
alter table orders drop constraint if exists orders_billing_check;
alter table orders add constraint orders_billing_check check (billing in ('monthly', 'semester', 'yearly'));
alter table orders
  add column extra_students integer not null default 0 check (extra_students in (0, 500, 1000)),
  add column extra_on_quote boolean not null default false;

-- Same function as 0009 (+0015 throttle), with the pack. Recreated rather than overloaded so a call
-- by name has one target; the new arguments default, so an old call still works.
drop function if exists public.place_order(text, text, text, text, text, text, text, text, text);
create function public.place_order(
  p_school_name text, p_school_type text, p_wilaya text, p_director_name text,
  p_email text, p_phone text, p_plan text, p_billing text, p_notes text default null,
  p_extra_students integer default 0, p_extra_on_quote boolean default false
) returns bigint language plpgsql security definer set search_path = '' as $$
declare new_id bigint; clean_email text := lower(trim(p_email));
begin
  -- 0015's bounds, unchanged: five per address per day, twenty per hour in all.
  if (select count(*) from public.orders o where o.email = clean_email and o.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de demandes pour cette adresse. Contactez-nous directement.' using errcode = '53400';
  end if;
  if (select count(*) from public.orders o where o.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Trop de demandes en ce moment. Réessayez dans quelques minutes.' using errcode = '53400';
  end if;
  insert into public.orders (school_name, school_type, wilaya, director_name, email, phone, plan, billing, notes, user_id,
                             extra_students, extra_on_quote)
  values (trim(p_school_name), nullif(trim(p_school_type), ''), trim(p_wilaya), trim(p_director_name),
          clean_email, regexp_replace(p_phone, '[^0-9]', '', 'g'), p_plan, p_billing, nullif(trim(p_notes), ''), auth.uid(),
          coalesce(p_extra_students, 0), coalesce(p_extra_on_quote, false))
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.place_order(text, text, text, text, text, text, text, text, text, integer, boolean) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, text, text, integer, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------- Schools
alter table schools drop constraint if exists schools_billing_check;
alter table schools add constraint schools_billing_check check (billing in ('monthly', 'semester', 'yearly'));
-- Null = no limit: the schools opened before plans had one, and the demo.
alter table schools add column student_limit integer check (student_limit > 0);
-- Not in 0005's update list on purpose: the limit is what was paid for, the director cannot raise it.

-- 0026's approve_order body (from 0019), plus the 6-month period and the limit.
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

  insert into public.schools (name, slug, currency, billing, paid_until, kind, student_limit)
  values (o.school_name, private.school_slug(o.school_name), 'DA', o.billing,
          current_date + case o.billing when 'yearly' then interval '1 year' when 'semester' then interval '6 months' else interval '1 month' end,
          case when o.school_type ilike '%soutien%' then 'soutien' else 'formation' end,
          500 + o.extra_students)   -- a pack on quote is added by hand once agreed
  returning id into new_school;

  insert into public.school_members (school_id, user_id, role, full_name, email)
  values (new_school, o.user_id, 'director', o.director_name, o.email);

  update public.orders set school_id = new_school, status = 'payé', paid_at = coalesce(paid_at, now()) where id = p_order_id;
  return new_school;
end $$;

-- The limit, enforced where every way of adding a student ends up (form, Excel import, API).
-- A row trigger sees the rows the same statement inserted before it, so an import that crosses the
-- limit stops at the limit and the whole import is refused with the message.
create function private.enforce_student_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cap integer;
begin
  select s.student_limit into cap from public.schools s where s.id = new.school_id;
  if cap is not null and (select count(*) from public.students st where st.school_id = new.school_id) >= cap then
    raise exception 'Limite de % étudiants atteinte.', cap using errcode = 'CL001';
  end if;
  return new;
end $$;
create trigger enforce_student_limit before insert on students
  for each row execute function private.enforce_student_limit();

-- ---------------------------------------------------------------------------- Student packs
-- A director asks for more room from inside the app; it is paid like an order, and setting the
-- request to 'payé' in the dashboard raises the school's limit.
create table student_packs (
  id bigint generated always as identity primary key,
  school_id bigint not null references schools(id) on delete cascade,
  pack integer check (pack in (500, 1000)),          -- null when on quote
  on_quote boolean not null default false,
  status text not null default 'nouveau' check (status in ('nouveau', 'payé', 'annulé')),
  requested_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (on_quote or pack is not null)
);
create index on student_packs (school_id);
alter table student_packs enable row level security;
create policy "director reads own packs" on student_packs for select to authenticated
  using (private.has_role(school_id, '{director}'));
create policy "director requests a pack" on student_packs for insert to authenticated
  with check (private.has_role(school_id, '{director}') and status = 'nouveau');
revoke all on student_packs from anon, authenticated;
grant select on student_packs to authenticated;
grant insert (school_id, pack, on_quote) on student_packs to authenticated;

create function private.grow_student_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.pack is not null then
    update public.schools set student_limit = coalesce(student_limit, 500) + new.pack where id = new.school_id;
  end if;
  return null;
end $$;
create trigger grow_student_limit after update of status on student_packs
  for each row when (new.status = 'payé' and old.status is distinct from 'payé')
  execute function private.grow_student_limit();
