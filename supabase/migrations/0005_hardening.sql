-- Security hardening: which columns the app may write, and who may change what a student owes.

-- Schools: the director edits contact details only. The address (slug, custom_domain) and the
-- demo flag are set by the platform; a director flipping is_demo would lock their own school.
revoke update on schools from anon, authenticated;
grant update (name, currency, phone, email, address) on schools to authenticated;

-- Everywhere else: a row's id, creation time and note author never change from the app,
-- so history and the activity log stay trustworthy.
-- A column added later is NOT writable until granted: `grant update (col) on <table> to authenticated;`
do $$
declare t text; cols text;
begin
  for t in select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not in ('schools', 'activity_log') loop
    select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
    where table_schema = 'public' and table_name = t and column_name not in ('id', 'created_at', 'author_id');
    execute format('revoke update on %I from anon, authenticated', t);
    execute format('grant update (%s) on %I to authenticated', cols, t);
  end loop;
end $$;

-- Only the director may change what an enrollment costs: lowering the total would mark an unpaid
-- student as "Payé". The secretaire still sets the total when enrolling.
-- The platform (service role, SQL editor: no auth.uid()) is not restricted.
create function private.guard_enrollment_total()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.total is distinct from old.total and auth.uid() is not null
     and not private.has_role(new.school_id, '{director}') then
    raise exception 'Seul le directeur peut modifier le montant d''une inscription.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_enrollment_total before update on enrollments
  for each row execute function private.guard_enrollment_total();
