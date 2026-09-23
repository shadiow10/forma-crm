-- An order may only be claimed by an account that has proved it owns the email.
--
-- approve_order falls back to matching auth.users on email when the order carries no user_id
-- (the order was placed before the account existed, or signup returned no session). Supabase
-- creates the auth.users row at signup, BEFORE the confirmation link is clicked — so whoever
-- registered an address first got the school, confirmed or not. Someone could register a
-- director's address, never confirm it, and be handed their school on payment; the real director's
-- signup would then bounce with "already registered".
--
-- Replaces the function from 0009, which is already applied: editing that file changes nothing
-- on a deployed database.

create or replace function public.approve_order(p_order_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare o public.orders; new_school bigint;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable.'; end if;
  if o.school_id is not null then return o.school_id; end if;        -- already opened, nothing to do
  if o.user_id is null then
    -- The account may have been created after the order (or the session was not open yet): match on
    -- email, but only a CONFIRMED one. An unconfirmed row proves nothing about who owns the address.
    select u.id into o.user_id from auth.users u
     where lower(u.email) = o.email and u.email_confirmed_at is not null;
    if o.user_id is null then raise exception 'Cette commande n''a pas de compte confirmé : le directeur doit créer son compte avec ''%'' et cliquer le lien de confirmation.', o.email; end if;
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

-- An order whose user_id was set by place_order() is unaffected: that id came from auth.uid(),
-- which only exists for a session, and a session already required confirmation.
