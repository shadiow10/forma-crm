-- Self-service signup with manual payment confirmation.
-- The director creates his own login and sends his order; you take the money in hand,
-- then set the order's status to 'payé' in the dashboard. That one change creates his school
-- and makes him its director. No SQL, no invitation email.

alter table orders add column user_id uuid references auth.users(id) on delete set null;

-- place_order now remembers which login placed the order.
create or replace function public.place_order(
  p_school_name text, p_school_type text, p_wilaya text, p_director_name text,
  p_email text, p_phone text, p_plan text, p_billing text, p_notes text default null
) returns bigint language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  insert into public.orders (school_name, school_type, wilaya, director_name, email, phone, plan, billing, notes, user_id)
  values (trim(p_school_name), nullif(trim(p_school_type), ''), trim(p_wilaya), trim(p_director_name),
          lower(trim(p_email)), regexp_replace(p_phone, '[^0-9]', '', 'g'), p_plan, p_billing, nullif(trim(p_notes), ''), auth.uid())
  returning id into new_id;
  return new_id;
end $$;

-- "École Ibn Sina (Alger)" -> "ecole-ibn-sina-alger", with -2, -3… if the name is taken.
create function private.school_slug(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare base text; try text; n int := 1;
begin
  base := trim(both '-' from regexp_replace(lower(public.unaccent_fallback(p_name)), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'ecole'; end if;
  base := left(base, 40);
  try := base;
  while exists (select 1 from public.schools s where s.slug = try) loop
    n := n + 1;
    try := base || '-' || n;
  end loop;
  return try;
end $$;

-- Accents without the unaccent extension: the few letters French and Arabic transliteration use.
create function public.unaccent_fallback(p_text text)
returns text language sql immutable set search_path = '' as $$
  select translate(p_text, 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY');
$$;
revoke execute on function public.unaccent_fallback(text) from public, anon, authenticated;

-- Opens the school for an order. Called by the trigger below; also callable from the SQL editor.
create function public.approve_order(p_order_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare o public.orders; new_school bigint;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable.'; end if;
  if o.school_id is not null then return o.school_id; end if;        -- already opened, nothing to do
  if o.user_id is null then
    -- The account may have been created after the order (or the session was not open yet): match on email.
    select u.id into o.user_id from auth.users u where lower(u.email) = o.email;
    if o.user_id is null then raise exception 'Cette commande n''a pas de compte : le directeur doit d''abord créer son compte avec ''%''.', o.email; end if;
    update public.orders set user_id = o.user_id where id = p_order_id;
  end if;

  insert into public.schools (name, slug, currency)
  values (o.school_name, private.school_slug(o.school_name), 'DA')
  returning id into new_school;

  insert into public.school_members (school_id, user_id, role, full_name, email)
  values (new_school, o.user_id, 'director', o.director_name, o.email);

  update public.orders set school_id = new_school, status = 'payé', paid_at = coalesce(paid_at, now()) where id = p_order_id;
  return new_school;
end $$;
revoke execute on function public.approve_order(bigint) from public, anon, authenticated;

-- Setting status to 'payé' in the dashboard is all it takes.
create function private.open_school_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.approve_order(new.id);
  return null;
end $$;

create trigger open_school_on_payment after update of status on orders
  for each row when (new.status = 'payé' and new.school_id is null)
  execute function private.open_school_on_payment();

-- The waiting screen: a signed-in director with no school yet sees where his order stands.
create function public.my_order_status()
returns table (id bigint, status text, school_name text, plan text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.status, o.school_name, o.plan
  from public.orders o
  where o.user_id = auth.uid()
  order by o.id desc
  limit 1;
$$;
grant execute on function public.my_order_status() to authenticated;
