-- A 15-day free trial, and ordering a plan from inside the app.
--
-- Trial: a director who has confirmed their email opens their school at once, with no payment and
-- without waiting for anyone: start_trial() creates it for 15 days (today included), 500 students,
-- and records a 'trial' order next to the real ones so every trial shows up in the dashboard. One
-- trial per email and per phone number. After the 15 days a trial gets 3 days of grace (not the 15
-- of a paid plan), then the school is read-only like any unpaid one: its data stays.
--
-- Renewal: until now a school could only be renewed by hand ("Contactez Classtra"), and approving an
-- order always opened a new school. A director now orders a plan for their own school from
-- Settings; setting that order to 'payé' extends the same school, data and all, and sends no
-- "your school is ready" email.

-- ---------------------------------------------------------------------------- Billing types
alter table orders drop constraint orders_billing_check;
alter table orders add constraint orders_billing_check check (billing in ('monthly', 'semester', 'yearly', 'trial'));
alter table schools drop constraint schools_billing_check;
alter table schools add constraint schools_billing_check check (billing in ('monthly', 'semester', 'yearly', 'trial'));

-- One trial per address and per phone, held by the database even if two requests race.
create unique index orders_one_trial_per_email on orders (email) where billing = 'trial';
create unique index orders_one_trial_per_phone on orders (phone) where billing = 'trial';

-- ---------------------------------------------------------------------------- Read-only after the end
-- 0016's rule, with a shorter grace for a trial.
create or replace function private.is_frozen(p_school_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.is_demo or (s.paid_until is not null
       and current_date > s.paid_until + case when s.billing = 'trial' then 3 else 15 end)
     from public.schools s where s.id = p_school_id),
    false);
$$;

-- ---------------------------------------------------------------------------- Starting a trial
create function public.start_trial(p_school_name text, p_school_type text, p_wilaya text, p_director_name text, p_phone text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_email text;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  new_order bigint;
  new_school bigint;
begin
  -- Only an address its owner has proved (0014): no trials on someone else's email.
  select lower(u.email) into v_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Confirmez votre adresse email avant de démarrer l''essai.' using errcode = '42501';
  end if;
  if exists (select 1 from public.school_members m where m.user_id = uid) then
    raise exception 'Ce compte a déjà une école.' using errcode = 'CL004';
  end if;
  if exists (select 1 from public.orders o where o.billing = 'trial' and (o.email = v_email or o.phone = v_phone)) then
    raise exception 'Un essai gratuit a déjà été utilisé avec cet email ou ce téléphone.' using errcode = 'CL003';
  end if;
  -- 0015's bound on all orders, trials included: twenty an hour.
  if (select count(*) from public.orders o where o.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Trop de demandes en ce moment. Réessayez dans quelques minutes.' using errcode = '53400';
  end if;

  -- Recorded as an order already paid: the trigger that opens schools fires on a status update,
  -- not on this insert, so the school is opened here and only here.
  insert into public.orders (school_name, school_type, wilaya, director_name, email, phone, plan, billing, user_id, status, paid_at)
  values (trim(p_school_name), nullif(trim(p_school_type), ''), trim(p_wilaya), trim(p_director_name), v_email, v_phone,
          'standard', 'trial', uid, 'payé', now())
  returning id into new_order;

  -- The director's mobile doubles as the school's phone until they change it in Settings.
  insert into public.schools (name, slug, currency, billing, paid_until, kind, student_limit, phone)
  values (trim(p_school_name), private.school_slug(trim(p_school_name)), 'DA', 'trial', current_date + 14,
          case when p_school_type ilike '%soutien%' then 'soutien' else 'formation' end, 500, v_phone)
  returning id into new_school;

  insert into public.school_members (school_id, user_id, role, full_name, email)
  values (new_school, uid, 'director', trim(p_director_name), v_email);

  update public.orders set school_id = new_school where id = new_order;
  return new_school;
exception when unique_violation then
  -- Two requests at once with the same email or phone: the second one lands here.
  raise exception 'Un essai gratuit a déjà été utilisé avec cet email ou ce téléphone.' using errcode = 'CL003';
end $$;
revoke execute on function public.start_trial(text, text, text, text, text) from public, anon;
grant execute on function public.start_trial(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------- Renewing from Settings
alter table orders add column renews_school_id bigint references schools(id) on delete cascade;

-- The director picks a plan; the order waits for payment like any other. A second request while
-- one is pending changes that one instead of piling up.
create function public.request_renewal(p_school_id bigint, p_billing text, p_phone text,
  p_extra_students integer default 0, p_extra_on_quote boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare me public.school_members; s public.schools; last public.orders; pending bigint;
begin
  if not private.has_role(p_school_id, '{director}') then
    raise exception 'Seul le directeur peut choisir une formule.' using errcode = '42501';
  end if;
  if p_billing not in ('monthly', 'semester', 'yearly') then
    raise exception 'Formule inconnue.' using errcode = '22023';
  end if;
  select * into me from public.school_members m where m.school_id = p_school_id and m.user_id = auth.uid();
  select * into s from public.schools where id = p_school_id;
  -- The school's first order still knows its type and wilaya.
  select * into last from public.orders o where o.school_id = p_school_id order by o.id limit 1;

  select o.id into pending from public.orders o
   where o.renews_school_id = p_school_id and o.status in ('nouveau', 'contacté') order by o.id desc limit 1;
  if pending is not null then
    update public.orders set billing = p_billing, phone = regexp_replace(p_phone, '[^0-9]', '', 'g'),
      extra_students = coalesce(p_extra_students, 0), extra_on_quote = coalesce(p_extra_on_quote, false)
     where id = pending;
    return pending;
  end if;

  insert into public.orders (school_name, school_type, wilaya, director_name, email, phone, plan, billing, user_id,
                             extra_students, extra_on_quote, renews_school_id)
  -- A school opened by hand has no first order: its wilaya is then "Non précisée".
  values (s.name, last.school_type, coalesce(last.wilaya, 'Non précisée'), coalesce(nullif(trim(me.full_name), ''), s.name),
          lower(coalesce(me.email, (select u.email from auth.users u where u.id = auth.uid()))),
          regexp_replace(p_phone, '[^0-9]', '', 'g'), 'standard', p_billing, auth.uid(),
          coalesce(p_extra_students, 0), coalesce(p_extra_on_quote, false), p_school_id)
  returning id into pending;
  return pending;
end $$;
revoke execute on function public.request_renewal(bigint, text, text, integer, boolean) from public, anon;
grant execute on function public.request_renewal(bigint, text, text, integer, boolean) to authenticated;

-- What Settings shows: the plan asked for and not paid yet, if any.
create function public.pending_renewal(p_school_id bigint)
returns table (billing text, extra_students integer, extra_on_quote boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.billing, o.extra_students, o.extra_on_quote, o.created_at from public.orders o
   where private.has_role(p_school_id, '{director}')
     and o.renews_school_id = p_school_id and o.status in ('nouveau', 'contacté')
   order by o.id desc limit 1;
$$;
revoke execute on function public.pending_renewal(bigint) from public, anon;
grant execute on function public.pending_renewal(bigint) to authenticated;

-- 0027's approve_order, with a renewal branch first: extend the school instead of opening one.
create or replace function public.approve_order(p_order_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare o public.orders; new_school bigint;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable.'; end if;
  if o.school_id is not null then return o.school_id; end if;

  if o.renews_school_id is not null then
    -- From the current end date if still running, from today if it had lapsed. A school opened
    -- before plans had a limit keeps having none; otherwise the plan's 500 plus any pack, never less
    -- than what it already had.
    update public.schools set billing = o.billing,
      paid_until = greatest(coalesce(paid_until, current_date), current_date)
        + case o.billing when 'yearly' then interval '1 year' when 'semester' then interval '6 months' else interval '1 month' end,
      student_limit = case when student_limit is null then null else greatest(student_limit, 500 + o.extra_students) end
     where id = o.renews_school_id;
    update public.orders set school_id = o.renews_school_id, status = 'payé', paid_at = coalesce(paid_at, now()) where id = p_order_id;
    return o.renews_school_id;
  end if;

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

-- 0026's trigger: a renewal is approved right here, with no "your school is ready" email.
create or replace function private.open_school_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare hook_url text; hook_secret text;
begin
  if new.renews_school_id is not null then
    perform public.approve_order(new.id);
    return null;
  end if;
  select value into hook_url from private.app_settings where key = 'order_hook_url';
  select value into hook_secret from private.app_settings where key = 'order_hook_secret';
  if hook_url is null or hook_secret is null then
    perform public.approve_order(new.id);   -- not set up: the school opens now, no email (as before)
    return null;
  end if;
  perform net.http_post(
    url := hook_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', hook_secret),
    body := jsonb_build_object('order_id', new.id)
  );
  return null;
end $$;
