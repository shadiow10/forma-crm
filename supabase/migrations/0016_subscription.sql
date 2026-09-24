-- Subscriptions: a school that stops paying keeps its data and stops writing.
--
-- paid_until is the last day covered by the subscription. After it, a 15-day grace period
-- (the CGV's "relance restée sans effet pendant 15 jours") during which nothing changes but the
-- app warns. Past that the school is read-only: everything readable and exportable, no new writes.
-- The director never loses access to his data, which the CGV also promises.
--
-- Renewals are recorded by hand for now:  update schools set paid_until = paid_until + interval '1 month' where id = ...;

alter table schools add column paid_until date, add column billing text check (billing in ('monthly', 'yearly'));
-- No update grant needed: 0005 revoked UPDATE on schools and granted back a fixed column list, so a
-- column added afterwards is not writable from the app. Only the service role can renew a school.
-- SELECT is still granted table-wide, so members can read the dates and be warned.

comment on column schools.paid_until is 'Last day covered. Null = never billed (the demo, or a school opened by hand).';

-- ---------------------------------------------------------------------------
-- One idea of "frozen" for the whole database: the demo, or a subscription 15 days past due.
-- The read-only policies from 0004 already exist for the demo; they are rebuilt here to ask this
-- question instead, so there is one rule rather than two overlapping sets.
-- ---------------------------------------------------------------------------
create function private.is_frozen(p_school_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.is_demo or (s.paid_until is not null and current_date > s.paid_until + 15)
     from public.schools s where s.id = p_school_id),
    false);
$$;
grant execute on function private.is_frozen(bigint) to authenticated;

drop policy "demo is read-only" on schools;
create policy "frozen school is read-only" on schools as restrictive for update to authenticated
  using (not private.is_frozen(id));

do $$
declare t text;
begin
  foreach t in array array['school_members','teachers','courses','groups','students','group_students','enrollments','payments','attendance','student_documents','student_notes'] loop
    execute format('drop policy "demo read-only insert" on %I', t);
    execute format('drop policy "demo read-only update" on %I', t);
    execute format('drop policy "demo read-only delete" on %I', t);
    execute format('create policy "frozen read-only insert" on %I as restrictive for insert to authenticated with check (not private.is_frozen(school_id))', t);
    execute format('create policy "frozen read-only update" on %I as restrictive for update to authenticated using (not private.is_frozen(school_id))', t);
    execute format('create policy "frozen read-only delete" on %I as restrictive for delete to authenticated using (not private.is_frozen(school_id))', t);
  end loop;
end $$;

drop policy "demo documents read-only insert" on storage.objects;
drop policy "demo documents read-only delete" on storage.objects;
create policy "frozen documents read-only insert" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'student-documents' or not private.is_frozen(private.path_school_id(name)));
create policy "frozen documents read-only delete" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'student-documents' or not private.is_frozen(private.path_school_id(name)));

-- ---------------------------------------------------------------------------
-- A school opened from a paid order starts with its period already covered.
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

  insert into public.schools (name, slug, currency, billing, paid_until)
  values (o.school_name, private.school_slug(o.school_name), 'DA', o.billing,
          current_date + case when o.billing = 'yearly' then interval '1 year' else interval '1 month' end)
  returning id into new_school;

  insert into public.school_members (school_id, user_id, role, full_name, email)
  values (new_school, o.user_id, 'director', o.director_name, o.email);

  update public.orders set school_id = new_school, status = 'payé', paid_at = coalesce(paid_at, now()) where id = p_order_id;
  return new_school;
end $$;
