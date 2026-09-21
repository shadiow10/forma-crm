-- The landing page needs the order number back ("CMD-00007"), but visitors must never be able
-- to read the orders table. An insert that returns a column counts as reading, so the whole
-- request was refused. Orders now go through this function instead, and the table takes no
-- direct writes at all: RLS with no policy left denies everyone except the service role.

drop policy "anyone can place an order" on orders;

create function public.place_order(
  p_school_name text, p_school_type text, p_wilaya text, p_director_name text,
  p_email text, p_phone text, p_plan text, p_billing text, p_notes text default null
) returns bigint language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  -- The table's own checks (email shape, Algerian mobile, known plan) still apply here.
  -- ponytail: no rate limit; add one (or a captcha) only if the form gets spammed.
  insert into public.orders (school_name, school_type, wilaya, director_name, email, phone, plan, billing, notes)
  values (trim(p_school_name), nullif(trim(p_school_type), ''), trim(p_wilaya), trim(p_director_name),
          lower(trim(p_email)), regexp_replace(p_phone, '[^0-9]', '', 'g'), p_plan, p_billing, nullif(trim(p_notes), ''))
  returning id into new_id;
  return new_id;
end $$;

revoke execute on function public.place_order(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, text, text) to anon, authenticated;
