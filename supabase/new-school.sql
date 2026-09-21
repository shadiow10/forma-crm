-- Opening a school by hand, after a director has paid.
-- Whole thing takes two minutes: part A here, part B in the dashboard, part C back here.

-- ---------------------------------------------------------------------------
-- A. Create the school. Fill in the four values, run, note the id it prints.
-- ---------------------------------------------------------------------------
insert into schools (name, slug, currency, phone, email, address)
values (
  'École Ibn Sina',          -- nom affiché
  'ecole-ibn-sina',          -- adresse web : minuscules, chiffres et tirets seulement
  'DA',
  '0550 00 00 00',           -- téléphone (ou null)
  'contact@ecole.dz',        -- email (ou null)
  'Bab Ezzouar, Alger'       -- adresse (ou null)
)
returning id, name, slug;

-- ---------------------------------------------------------------------------
-- B. In the dashboard: Authentication → Users → Add user → Invite user,
--    with the director's email. He receives a link to choose his password.
--    Copy his User UID from that list for part C.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- C. Make him the director of that school (ids from A and B).
-- ---------------------------------------------------------------------------
insert into school_members (school_id, user_id, role, full_name, email)
values (
  0,                                        -- id de l'école (partie A)
  '00000000-0000-0000-0000-000000000000',   -- User UID (partie B)
  'director',
  'Nom du directeur',
  'directeur@ecole.dz'
);

-- ---------------------------------------------------------------------------
-- D. Close the order: mark it paid and link it to the school.
-- ---------------------------------------------------------------------------
update orders set status = 'payé', paid_at = now(), school_id = 0 -- id de l'école
where id = 0;                                                      -- n° de la demande (CMD-00007 → 7)

-- ---------------------------------------------------------------------------
-- New orders waiting for a call:
-- ---------------------------------------------------------------------------
select id, created_at::date as le, school_name, wilaya, director_name, phone, email, plan, billing, notes
from orders where status = 'nouveau' order by id desc;
