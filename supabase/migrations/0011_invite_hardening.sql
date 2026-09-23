-- Invitations: count what was attempted, not what succeeded.
--
-- The cap in the invite-user function counted rows in school_members created in the last hour, but
-- the invitation email is sent before that row is written. Any failure in between — a teacher_id
-- matching no teacher, for instance — sent the email and left the counter at zero, and deleting the
-- half-created login freed the address to be invited again. The loop had no bound: a director could
-- send unlimited mail from our domain to any address.
--
-- One row is written here before the email goes out, so an attempt counts whether or not it works.

create table invite_attempts (
  id bigint generated always as identity primary key,
  school_id bigint not null,
  actor uuid,                -- the director who asked; null only if the platform ever calls it
  at timestamptz not null default now()
);
create index on invite_attempts (school_id, at desc);

-- Written and read only by the invite-user function, which holds the service role and so is not
-- subject to RLS. Row security on with no policy at all is the default deny for everyone else:
-- a director must not be able to clear their own counter.
alter table invite_attempts enable row level security;
revoke all on invite_attempts from anon, authenticated;

-- Supabase's project-level default privileges would grant these anyway, but spelling them out keeps
-- the table working if this migration is replayed somewhere those defaults are not in place.
grant select, insert on invite_attempts to service_role;
grant usage, select on sequence invite_attempts_id_seq to service_role;

-- 0005 revoked UPDATE on every table then granted it back column by column. That loop ran before
-- this table existed, so nothing here is writable from the app — which is what we want. Left
-- explicit so a later re-run of that pattern does not quietly hand out rights.
