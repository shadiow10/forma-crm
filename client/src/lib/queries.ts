import type { SupabaseClient } from "@supabase/supabase-js";

// Row shapes, matching supabase/migrations. Dates are "YYYY-MM-DD" strings, times "HH:MM:SS".
export type Role = "director" | "secretaire" | "teacher";
export type EnrollmentStatus = "Inscrit" | "En cours" | "Terminé" | "Abandonné";
export type AttendanceStatus = "P" | "A" | "L";

export type School = { id: number; name: string; slug: string; currency: string; phone: string | null; email: string | null; address: string | null; is_demo: boolean; paid_until: string | null; billing: "monthly" | "yearly" | null; kind: "formation" | "soutien"; sessions_per_month: number };
export type Course = { id: number; name: string; short_name: string; duration: string; price: number; color: string; billing: "total" | "monthly"; level: string | null };
// hourly_rate comes from the teacher_pay view: null for a secretaire, who cannot read it.
export type Teacher = { id: number; full_name: string; subject: string | null; phone: string | null; email: string | null; hourly_rate: number | null; monthly_salary: number | null; contract: string; color: string };
export type Group = { id: number; name: string; course_id: number | null; teacher_id: number | null; room: string | null; days: string[]; start_time: string | null; end_time: string | null; capacity: number; status: "Ouvert" | "Complet" | "Annulé"; color: string; level: string | null };
export type Student = { id: number; full_name: string; phone: string; email: string | null; address: string | null; dob: string | null; source: string | null; created_at: string; level: string | null; filiere: string | null; parent_name: string | null; parent_phone: string | null };
export type GroupStudent = { group_id: number; student_id: number };
export type Enrollment = { id: number; student_id: number; course_id: number; group_id: number | null; enrolled_on: string; status: EnrollmentStatus; total: number; notes: string | null; monthly_fee: number | null; ends_on: string | null };
// total: for a monthly enrollment, what is owed so far (monthly_fee × months_due).
export type Balance = { enrollment_id: number; total: number; paid: number; balance: number; months_due: number | null };
export type Payment = { id: number; enrollment_id: number; amount: number; paid_on: string; method: string; created_at: string; month_no: number | null };
export type AttendanceStat = { group_id: number; student_id: number; sessions: number; present: number; late: number; absent: number };
// One row per day a group met, from the registers taken. Teacher pay counts these, so a cancelled
// session (no register) earns nothing — the same rule that already decides what a pupil owes.
export type GroupSession = { group_id: number; session_date: string };
export type MemberRow = { user_id: string; role: Role; full_name: string | null; email: string | null; teacher_id: number | null };

export type SchoolData = {
  school: School;
  courses: Course[];
  teachers: Teacher[];
  groups: Group[];
  students: Student[];
  groupStudents: GroupStudent[];
  enrollments: Enrollment[];
  balances: Balance[];
  payments: Payment[];
  attendanceStats: AttendanceStat[];
  groupSessions: GroupSession[];
  members: MemberRow[];
};

const PAGE = 1000; // Supabase returns at most 1000 rows per request.

// Reads every row of a query. `order` must make the order stable.
//
// The first request asks for the row count as well, so the remaining pages can be fetched together
// instead of one after another. A school with 3000 payments used to wait for four round trips in a
// row; it now waits for two. Most tables fit in one page and are unaffected.
export async function fetchAll<T>(build: () => any, order: string[]): Promise<T[]> {
  const page = async (from: number) => {
    let query = build();
    for (const column of order) query = query.order(column);
    const { data, error, count } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    return { rows: data as T[], count: count as number | null };
  };

  const first = await page(0);
  if (first.rows.length < PAGE) return first.rows;

  // No count (an older client, or a view that cannot be counted): fall back to one page at a time.
  if (first.count == null) {
    const rows = [...first.rows];
    for (let from = PAGE; ; from += PAGE) {
      const next = await page(from);
      rows.push(...next.rows);
      if (next.rows.length < PAGE) return rows;
    }
  }

  const starts: number[] = [];
  for (let from = PAGE; from < first.count; from += PAGE) starts.push(from);
  const rest = await Promise.all(starts.map((from) => page(from)));
  return rest.reduce((all, part) => (all.push(...part.rows), all), [...first.rows]);
}

// Loads everything the app shows for one school. RLS decides what each role gets back:
// a teacher simply receives no students, payments or members.
// ponytail: whole school in memory; move lists to server-side paging when a school passes ~10k students.
export async function loadSchoolData(client: SupabaseClient, schoolId: number): Promise<SchoolData> {
  // count: the first page reports how many rows there are, so fetchAll can request the rest together.
  const from = (table: string, columns: string) => () => client.from(table).select(columns, { count: "exact" }).eq("school_id", schoolId);
  const [school, courses, teachers, pay, groups, students, groupStudents, enrollments, balances, payments, attendanceStats, groupSessions, members] = await Promise.all([
    client.from("schools").select("id, name, slug, currency, phone, email, address, is_demo, paid_until, billing, kind, sessions_per_month").eq("id", schoolId).single().then(({ data, error }) => {
      if (error) throw error;
      return data as School;
    }),
    fetchAll<Course>(from("courses", "id, name, short_name, duration, price, color, billing, level"), ["name", "id"]),
    fetchAll<Omit<Teacher, "hourly_rate" | "monthly_salary">>(from("teachers", "id, full_name, subject, phone, email, contract, color"), ["full_name", "id"]),
    fetchAll<{ teacher_id: number; hourly_rate: number; monthly_salary: number | null }>(from("teacher_pay", "teacher_id, hourly_rate, monthly_salary"), ["teacher_id"]),
    fetchAll<Group>(from("groups", "id, name, course_id, teacher_id, room, days, start_time, end_time, capacity, status, color, level"), ["name", "id"]),
    fetchAll<Student>(from("students", "id, full_name, phone, email, address, dob, source, created_at, level, filiere, parent_name, parent_phone"), ["full_name", "id"]),
    fetchAll<GroupStudent>(from("group_students", "group_id, student_id"), ["group_id", "student_id"]),
    fetchAll<Enrollment>(from("enrollments", "id, student_id, course_id, group_id, enrolled_on, status, total, notes, monthly_fee, ends_on"), ["enrolled_on", "id"]),
    fetchAll<Balance>(from("enrollment_balances", "enrollment_id, total, paid, balance, months_due"), ["enrollment_id"]),
    fetchAll<Payment>(from("payments", "id, enrollment_id, amount, paid_on, method, created_at, month_no"), ["paid_on", "id"]),
    fetchAll<AttendanceStat>(from("attendance_stats", "group_id, student_id, sessions, present, late, absent"), ["group_id", "student_id"]),
    fetchAll<GroupSession>(from("group_sessions", "group_id, session_date"), ["group_id", "session_date"]),
    fetchAll<MemberRow>(from("school_members", "user_id, role, full_name, email, teacher_id"), ["created_at", "user_id"]),
  ]);
  const rates = new Map(pay.map((row) => [row.teacher_id, row]));
  // A monthly enrollment stores no total: what it owes so far comes from the balance view, and
  // every page that shows "Total" reads it from here.
  const owed = new Map(balances.map((row) => [row.enrollment_id, row.total]));
  return {
    school, courses, groups, students, groupStudents, balances, payments, attendanceStats, groupSessions, members,
    enrollments: enrollments.map((enrollment) => (enrollment.monthly_fee === null ? enrollment : { ...enrollment, total: owed.get(enrollment.id) ?? enrollment.monthly_fee })),
    teachers: teachers.map((teacher) => ({ ...teacher, hourly_rate: rates.get(teacher.id)?.hourly_rate ?? null, monthly_salary: rates.get(teacher.id)?.monthly_salary ?? null })),
  };
}
