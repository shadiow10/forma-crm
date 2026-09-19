import type { SupabaseClient } from "@supabase/supabase-js";

// Row shapes, matching supabase/migrations. Dates are "YYYY-MM-DD" strings, times "HH:MM:SS".
export type Role = "director" | "secretaire" | "teacher";
export type EnrollmentStatus = "Inscrit" | "En cours" | "Terminé" | "Abandonné";
export type AttendanceStatus = "P" | "A" | "L";

export type School = { id: number; name: string; slug: string; currency: string; phone: string | null; email: string | null; address: string | null; is_demo: boolean };
export type Course = { id: number; name: string; short_name: string; duration: string; price: number; color: string };
export type Teacher = { id: number; full_name: string; subject: string | null; phone: string | null; email: string | null; hourly_rate: number; contract: string; color: string };
export type Group = { id: number; name: string; course_id: number | null; teacher_id: number | null; room: string | null; days: string[]; start_time: string | null; end_time: string | null; capacity: number; status: "Ouvert" | "Complet" | "Annulé"; color: string };
export type Student = { id: number; full_name: string; phone: string; email: string | null; address: string | null; dob: string | null; source: string | null; created_at: string };
export type GroupStudent = { group_id: number; student_id: number };
export type Enrollment = { id: number; student_id: number; course_id: number; group_id: number | null; enrolled_on: string; status: EnrollmentStatus; total: number; notes: string | null };
export type Balance = { enrollment_id: number; paid: number; balance: number };
export type Payment = { id: number; enrollment_id: number; amount: number; paid_on: string; method: string; created_at: string };
export type AttendanceStat = { group_id: number; student_id: number; sessions: number; present: number; late: number; absent: number };
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
  members: MemberRow[];
};

const PAGE = 1000; // Supabase returns at most 1000 rows per request.

// Reads every row of a query, page by page. `order` must make the order stable.
export async function fetchAll<T>(build: () => any, order: string[]): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = build();
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < PAGE) return rows;
  }
}

// Loads everything the app shows for one school. RLS decides what each role gets back:
// a teacher simply receives no students, payments or members.
// ponytail: whole school in memory; move lists to server-side paging when a school passes ~10k students.
export async function loadSchoolData(client: SupabaseClient, schoolId: number): Promise<SchoolData> {
  const from = (table: string, columns: string) => () => client.from(table).select(columns).eq("school_id", schoolId);
  const [school, courses, teachers, groups, students, groupStudents, enrollments, balances, payments, attendanceStats, members] = await Promise.all([
    client.from("schools").select("id, name, slug, currency, phone, email, address, is_demo").eq("id", schoolId).single().then(({ data, error }) => {
      if (error) throw error;
      return data as School;
    }),
    fetchAll<Course>(from("courses", "id, name, short_name, duration, price, color"), ["name", "id"]),
    fetchAll<Teacher>(from("teachers", "id, full_name, subject, phone, email, hourly_rate, contract, color"), ["full_name", "id"]),
    fetchAll<Group>(from("groups", "id, name, course_id, teacher_id, room, days, start_time, end_time, capacity, status, color"), ["name", "id"]),
    fetchAll<Student>(from("students", "id, full_name, phone, email, address, dob, source, created_at"), ["full_name", "id"]),
    fetchAll<GroupStudent>(from("group_students", "group_id, student_id"), ["group_id", "student_id"]),
    fetchAll<Enrollment>(from("enrollments", "id, student_id, course_id, group_id, enrolled_on, status, total, notes"), ["enrolled_on", "id"]),
    fetchAll<Balance>(from("enrollment_balances", "enrollment_id, paid, balance"), ["enrollment_id"]),
    fetchAll<Payment>(from("payments", "id, enrollment_id, amount, paid_on, method, created_at"), ["paid_on", "id"]),
    fetchAll<AttendanceStat>(from("attendance_stats", "group_id, student_id, sessions, present, late, absent"), ["group_id", "student_id"]),
    fetchAll<MemberRow>(from("school_members", "user_id, role, full_name, email, teacher_id"), ["created_at", "user_id"]),
  ]);
  return { school, courses, teachers, groups, students, groupStudents, enrollments, balances, payments, attendanceStats, members };
}
