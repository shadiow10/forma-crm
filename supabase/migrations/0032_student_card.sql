-- The student card: last name and first name apart, a photo, and the school's logo.
--
-- full_name stays the name the whole app uses (search, sorting, lists, receipts); the form now asks
-- for the last and first names and writes full_name from them, "LAST First" as on an Algerian card.
-- Students saved before keep their full_name; their card shows it until someone fills the two fields.
alter table students add column last_name text, add column first_name text,
  -- <school>/<student>/photo.jpg in the private student-documents bucket (0003, strict paths 0018).
  add column photo_path text;
-- 0005's rule: a column added later is not writable until granted.
grant update (last_name, first_name, photo_path) on students to authenticated;

-- <school>/0/logo.<ext> in the same bucket: "0" stands for "no student", which keeps 0018's
-- <school>/<number>/<file> shape and its school check. Changed by the director (schools' policy).
alter table schools add column logo_path text;
grant update (logo_path) on schools to authenticated;
