// Access-rule checks: runs the migration + seed in an in-memory Postgres and verifies what each role can see and do.
// Run: pnpm test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import assert from "assert/strict";
const db = new PGlite();
await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth; create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
const migrations = new URL("../migrations/", import.meta.url);
for (const file of fs.readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(new URL(file, migrations), "utf8"));
await db.exec(fs.readFileSync(new URL("../seed.sql", import.meta.url), "utf8"));
// Supabase grants table privileges to authenticated by default; RLS does the filtering.
await db.exec(`grant all on all tables in schema public to authenticated; grant usage, select on all sequences in schema public to authenticated;`);
const U = { D: "00000000-0000-0000-0000-00000000000d", S: "00000000-0000-0000-0000-00000000000s".replace("s","5"), T: "00000000-0000-0000-0000-00000000000e", D2: "00000000-0000-0000-0000-0000000000d2" };
await db.exec(`insert into auth.users values ('${U.D}'),('${U.S}'),('${U.T}'),('${U.D2}');
insert into schools (id, name, slug) values (2, 'Autre École', 'autre-ecole');
insert into courses (school_id, name, short_name, duration, price) values (2, 'Anglais', 'Anglais', '3 mois', 30000);
insert into students (school_id, full_name, phone) values (2, 'Élève Autre', '0000');
insert into school_members (school_id, user_id, role, teacher_id) values
 (1, '${U.D}', 'director', null), (1, '${U.S}', 'secretaire', null), (1, '${U.T}', 'teacher', 2), (2, '${U.D2}', 'director', null);`);
const as = async (who, sql) => { await db.exec(`reset role; set test.uid = '${U[who]}'; set role authenticated;`); try { return (await db.query(sql)).rows; } finally { await db.exec("reset role"); } };
const count = async (who, t) => Number((await as(who, `select count(*)::int n from ${t}`))[0].n);
const fails = async (who, sql) => { try { await as(who, sql); return false; } catch { return true; } };
const tables = ["schools","school_members","teachers","courses","groups","students","enrollments","payments","attendance","enrollment_balances"];

assert.equal(await count("D", "students"), 18);
assert.equal(await count("S", "payments"), 15);
assert.equal(await count("S", "teachers"), 5);
assert.equal(await count("T", "students"), 0, "teacher must not see students");
assert.equal(await count("T", "payments"), 0, "teacher must not see payments");
assert.equal(await count("T", "courses"), 5);
assert.deepEqual((await as("T", "select name from groups")).map(r => r.name), ["Web Frontend — Soir"], "teacher sees only own group");
assert.equal(await count("T", "teachers"), 1, "teacher sees only self");
assert.equal(await count("D2", "students"), 1, "other school sees only its own student");
assert.equal(await count("S", "school_members"), 1, "secretaire sees only own membership");
assert.equal(await count("D", "school_members"), 3);

assert.ok(!(await fails("S", "insert into students (school_id, full_name, phone) values (1, 'Nouveau', '0555')")), "secretaire can add student");
assert.ok(await fails("S", "insert into students (school_id, full_name, phone) values (2, 'Intrus', '0555')"), "secretaire cannot write to another school");
assert.ok(await fails("S", `insert into school_members (school_id, user_id, role) values (1, '${U.S}', 'director')`), "secretaire cannot promote self");
assert.ok(await fails("S", "insert into teachers (school_id, full_name) values (1, 'X')"), "secretaire cannot add teachers");
assert.ok(await fails("T", "insert into students (school_id, full_name, phone) values (1, 'X', '0')"), "teacher cannot add students");
assert.equal((await as("T", "update groups set room = 'hack' returning id")).length, 0, "teacher cannot edit groups");
assert.equal((await as("D2", "delete from students where school_id = 1 returning id")).length, 0, "other director cannot delete school 1 data");
const otherCourse = (await db.query("select id from courses where school_id = 2")).rows[0].id;
assert.ok(await fails("D", `insert into groups (school_id, name, course_id) values (1, 'cross', ${otherCourse})`), "cannot link to another school's course");
assert.ok(await fails("D", `insert into school_members (school_id, user_id, role) values (1, '${U.D2}', 'teacher')`), "teacher role requires teacher_id");

// Payments: secretaire records, only director changes or deletes.
assert.ok(!(await fails("S", "insert into payments (school_id, enrollment_id, amount, method) values (1, 3, 1000, 'Espèces')")), "secretaire can record payment");
assert.equal((await as("S", "delete from payments returning id")).length, 0, "secretaire cannot delete payments");
assert.equal((await as("S", "update payments set amount = 1 returning id")).length, 0, "secretaire cannot edit payments");
assert.equal((await as("D", "delete from payments where amount = 1000 returning id")).length, 1, "director can delete payment");

// Teacher (Omar, group 5 "Web Frontend — Soir") takes attendance and sees only names in own groups.
assert.deepEqual((await as("T", "select full_name from group_roster(5)")).map((r) => r.full_name), ["Amine Khelifi", "Ilyes Saouli", "Walid Hamza", "Yacine Merabet"]);
assert.equal((await as("T", "select * from group_roster(1)")).length, 0, "teacher cannot list another teacher's group");
assert.equal((await as("D2", "select * from group_roster(5)")).length, 0, "other school cannot list roster");
assert.ok(await count("T", "attendance") > 0, "teacher sees own group attendance");
assert.ok(!(await fails("T", "insert into attendance values (1, 5, 7, '2026-09-14', 'P')")), "teacher records attendance in own group");
assert.equal((await as("T", "update attendance set status = 'A' where group_id = 5 and student_id = 7 returning 1")).length, 1, "teacher corrects own attendance");
assert.ok(await fails("T", "insert into attendance values (1, 1, 1, '2026-09-14', 'P')"), "teacher cannot record another group");
assert.ok(await fails("T", "insert into attendance values (1, 5, 1, '2026-09-14', 'P')"), "teacher cannot record a student outside the group");
assert.equal((await as("T", "delete from attendance returning 1")).length, 0, "teacher cannot delete attendance");
console.log("all access checks passed");
