-- Orders placed from the landing page. Today they are leads: the director fills the form,
-- you call them, they pay by CCP/virement/Edahabia, you create their school by hand
-- (supabase/new-school.sql) and invite them.
-- When Chargily is added, its webhook function (service role) fills paid_at and school_id
-- and creates the school automatically. Nothing here changes.

create table orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  school_name text not null check (length(trim(school_name)) between 2 and 120),
  school_type text check (length(school_type) <= 60),
  wilaya text not null check (length(trim(wilaya)) between 2 and 60),
  director_name text not null check (length(trim(director_name)) between 2 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160),
  phone text not null check (phone ~ '^0[5-7][0-9]{8}$'),
  plan text not null check (plan in ('essentiel', 'pro', 'etablissement')),
  billing text not null check (billing in ('monthly', 'yearly')),
  -- No amount column: the price comes from plan + billing, so a visitor cannot send their own.
  status text not null default 'nouveau' check (status in ('nouveau', 'contacté', 'payé', 'annulé')),
  paid_at timestamptz,
  school_id bigint references schools(id) on delete set null,
  notes text
);
create index on orders (created_at desc);

alter table orders enable row level security;
-- Anyone may place an order; nobody may read, change or delete one from the app.
-- You read them in the Supabase dashboard (service role), which RLS does not apply to.
-- ponytail: no rate limit; add one (or a captcha) only if the form gets spammed.
create policy "anyone can place an order" on orders for insert to anon, authenticated with check (true);
