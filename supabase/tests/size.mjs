// Measures the real disk cost of one student-year with this exact schema (tables + indexes + toast).
// Run: node supabase/tests/size.mjs   (capacity planning: how many students fit in one Supabase project)
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

const db = new PGlite();
await db.exec(`create role authenticated nologin; create role anon nologin; create role service_role nologin; create schema auth; create table auth.users (id uuid primary key, email text, encrypted_password text);
create schema storage; grant usage on schema storage to authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id bigint generated always as identity primary key, bucket_id text, name text);
alter table storage.objects enable row level security; grant all on storage.objects to authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
const migrations = new URL("../migrations/", import.meta.url);
for (const file of fs.readdirSync(migrations).filter((n) => n.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(new URL(file, migrations), "utf8"));

const STUDENTS = 400;
const SESSIONS = 120;       // 3 sessions a week over a 40-week year
const PAYMENTS = 4;         // versements per enrollment
const ENROLL = 1.3;         // enrollments per student per year
console.log(`Generating ${STUDENTS} students · ${SESSIONS} sessions · ${PAYMENTS} payments/enrollment · ${ENROLL} enrollments/student`);

await db.exec(`
insert into schools (id, name, slug) values (1, 'Mesure', 'mesure');
insert into courses (school_id, id, name, short_name, duration, price)
  select 1, g, 'Formation professionnelle numero ' || g, 'F' || g, '6 mois', 60000 from generate_series(1, 12) g;
insert into teachers (school_id, id, full_name, subject, phone, email)
  select 1, g, 'Prenom Nom ' || g, 'Matiere', '0555 00 00 ' || g, 'prenom.nom' || g || '@ecole.dz' from generate_series(1, 20) g;
insert into groups (school_id, id, name, course_id, teacher_id, room, days, start_time, end_time, capacity)
  select 1, g, 'Groupe numero ' || g || ' — Matin', 1 + g % 12, 1 + g % 20, 'Salle ' || g, '{Dim,Mar,Jeu}', '09:00', '11:00', 20 from generate_series(1, 25) g;
insert into students (school_id, id, full_name, phone, email, address, dob, source, staff, last_contact)
  select 1, g, 'Prenom Familier Nom ' || g, '0555 12 34 ' || g, 'prenom.nom' || g || '@gmail.com', 'Cite des Freres, Bab Ezzouar, Alger', '2001-05-05', 'Facebook', 'Nadia Benali', '2026-09-01'
  from generate_series(1, ${STUDENTS}) g;
insert into group_students (school_id, group_id, student_id) select 1, 1 + g % 25, g from generate_series(1, ${STUDENTS}) g;
insert into enrollments (school_id, id, student_id, course_id, group_id, enrolled_on, status, total, notes)
  select 1, g, 1 + (g - 1) % ${STUDENTS}, 1 + g % 12, 1 + g % 25, '2026-01-10', 'En cours', 60000, 'Inscription prise au bureau, dossier complet.'
  from generate_series(1, ${Math.round(STUDENTS * ENROLL)}) g;
insert into payments (school_id, enrollment_id, amount, paid_on, method)
  select 1, e.id, 15000, (date '2026-02-01' + p), 'Espèces' from enrollments e, generate_series(1, ${PAYMENTS}) p;
`);
await db.exec(`insert into attendance (school_id, group_id, student_id, session_date, status)
  select 1, gs.group_id, gs.student_id, date '2026-01-05' + (d * 2), case when random() < 0.88 then 'P' when random() < 0.5 then 'L' else 'A' end
  from group_students gs, generate_series(1, ${SESSIONS}) d;
insert into student_documents (school_id, student_id, type, file_path)
  select 1, g, 'Carte nationale', '1/' || g || '/1737000000000-carte-nationale-identite.pdf' from generate_series(1, ${STUDENTS}) g;
insert into student_notes (school_id, student_id, body)
  select 1, g, 'Appel du 12 septembre : confirme sa presence au groupe du matin, reglera le reste en octobre.' from generate_series(1, ${STUDENTS}) g;`);
await db.query("vacuum analyze");

const rows = (await db.query(`
  select relname, pg_total_relation_size(c.oid) as bytes, (select reltuples::bigint from pg_class x where x.oid = c.oid) as tuples
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by bytes desc`)).rows;
const total = rows.reduce((sum, r) => sum + Number(r.bytes), 0);
for (const r of rows) if (Number(r.bytes) > 60000) console.log(`${r.relname.padEnd(20)} ${(Number(r.bytes) / 1048576).toFixed(2).padStart(7)} MB  ${String(r.tuples).padStart(9)} rows`);
console.log(`\nTOTAL public schema: ${(total / 1048576).toFixed(1)} MB for ${STUDENTS} students`);
console.log(`Per student-year: ${(total / STUDENTS / 1024).toFixed(1)} KB`);
const perStudent = total / STUDENTS;
for (const gb of [4, 6, 8]) console.log(`${gb} GB of database holds ~${Math.round(gb * 1073741824 / perStudent).toLocaleString("en-US")} student-years`);

// What one full app load downloads for this school (the app loads the whole school into memory).
import zlib from "zlib";
const sel = {
  students: "select id, full_name, phone, email, address, dob, source, created_at from students",
  courses: "select id, name, short_name, duration, price, color from courses",
  teachers: "select id, full_name, subject, phone, email, hourly_rate, contract, color from teachers",
  groups: "select id, name, course_id, teacher_id, room, days, start_time, end_time, capacity, status, color from groups",
  group_students: "select group_id, student_id from group_students",
  enrollments: "select id, student_id, course_id, group_id, enrolled_on, status, total, notes from enrollments",
  balances: "select enrollment_id, paid, balance from enrollment_balances",
  payments: "select id, enrollment_id, amount, paid_on, method, created_at from payments",
  stats: "select group_id, student_id, sessions, present, late, absent from attendance_stats",
};
let raw = 0;
for (const [name, sql] of Object.entries(sel)) {
  const json = JSON.stringify((await db.query(sql)).rows);
  raw += json.length;
  console.log(name.padEnd(16), (json.length / 1024).toFixed(0).padStart(6), "KB");
}
const all = JSON.stringify(await Promise.all(Object.values(sel).map(async (q) => (await db.query(q)).rows)));
const gz = zlib.gzipSync(Buffer.from(all)).length;
console.log("One full load:", (raw / 1024).toFixed(0), "KB raw ·", (gz / 1024).toFixed(0), "KB compressed (what Supabase counts as egress)");
const perMonth = (loads) => (gz * loads / 1073741824);
for (const loads of [500, 2000, 6000]) console.log(loads, "loads/month =", perMonth(loads).toFixed(2), "GB · 250 GB allows", Math.floor(250 / perMonth(loads)), "such schools");
