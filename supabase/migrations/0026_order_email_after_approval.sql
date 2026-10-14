-- The client's first email arrives when the order is accepted, not when it is sent.
--
-- Until now the order form created the login itself (supabase.auth.signUp), so Supabase mailed a
-- confirmation link the moment someone pressed "Envoyer" — before anyone had checked the payment.
-- Now the form only records the order. Setting it to 'payé' calls the Edge Function
-- "order-approved", which creates the login (an invitation: the email says "choose your password"),
-- opens the school, and sends that one email. Someone who already has an account (the sign-up page)
-- gets a sign-in link instead.
--
-- The call goes out through pg_net, so the dashboard update returns at once and the email follows
-- a second later. Where the two settings below are absent — a test database, a project not set up
-- yet — the trigger does exactly what it did before (0009/0014/0016): open the school directly,
-- refusing an order whose address has no confirmed account.
--
-- Setting it up on a project (once, in the SQL editor; the secret is any long random string, the
-- same one given to the function with `supabase secrets set ORDER_HOOK_SECRET=...`):
--   insert into private.app_settings values
--     ('order_hook_url', 'https://<project>.supabase.co/functions/v1/order-approved'),
--     ('order_hook_secret', '<long random string>');
-- If the function fails, the order stays 'payé' with no school: set it back to 'nouveau', then to
-- 'payé' again, to retry. The function's logs say why.

-- pg_net exists on every Supabase project; the in-memory test database (rls.test.mjs) has no such
-- extension, and does not need it: without settings the trigger never reaches net.http_post.
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net unavailable here: orders are approved directly.';
end $$;

create table private.app_settings (key text primary key, value text not null);
revoke all on private.app_settings from public, anon, authenticated;
comment on table private.app_settings is 'Per-project settings the database itself needs (e.g. where to call order-approved). Not readable from the app.';

create or replace function private.open_school_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare hook_url text; hook_secret text;
begin
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

-- The function calls approve_order with the service role once it has created the login.
grant execute on function public.approve_order(bigint) to service_role;
