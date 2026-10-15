import type { Course, Enrollment, Group, GroupSession, GroupStudent, PayMode, Teacher } from "./queries";

// Money worked out from what the school already records: course durations, enrollment prices,
// the weekly timetable and each teacher's hourly rate. Months are "YYYY-MM" strings.

export const courseMonths = (course: Course | undefined) => Math.max(1, parseInt(course?.duration ?? "", 10) || 1); // "6 mois" → 6
// A monthly enrollment (école de soutien) carries its fee; a formation spreads its price over its months.
export const monthlyFee = (enrollment: Enrollment, course: Course | undefined) => enrollment.monthly_fee ?? Math.round(enrollment.total / courseMonths(course));

// Payments settle months in order: month n is paid once everything paid covers n fees.
export const monthStatus = (fee: number, paid: number, n: number): "paid" | "partly" | "unpaid" =>
  paid >= fee * n ? "paid" : paid > fee * (n - 1) ? "partly" : "unpaid";

export const addMonths = (month: string, count: number) => {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
// 1 in the month of enrollment, then 2, 3… ; 0 before it.
export const monthNumber = (enrollment: Enrollment, month: string) => {
  const diff = (Number(month.slice(0, 4)) - Number(enrollment.enrolled_on.slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(enrollment.enrolled_on.slice(5, 7));
  return diff < 0 ? 0 : diff + 1;
};
// A course runs from the month of enrollment for its duration; a monthly enrollment until it ends.
const runsIn = (enrollment: Enrollment, course: Course | undefined, month: string) => {
  const n = monthNumber(enrollment, month);
  if (enrollment.monthly_fee != null) return n >= 1 && (!enrollment.ends_on || enrollment.ends_on.slice(0, 7) >= month);
  return n >= 1 && n <= courseMonths(course);
};

// Sessions a group should hold in a month ("YYYY-MM"): the "séances par mois" of a monthly subject
// (0025), otherwise one per timetable day that falls in the month (every Sunday and Wednesday…).
const WEEK = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]; // as stored in groups.days (ui.tsx DAYS)
export function plannedSessions(group: Group, course: Course | undefined, schoolSessions: number, month: string) {
  if (course?.billing === "monthly") return course.sessions_per_month ?? schoolSessions;
  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1];
  let count = 0;
  for (let day = new Date(year, monthIndex, 1); day.getMonth() === monthIndex; day.setDate(day.getDate() + 1)) {
    if (group.days.includes(WEEK[day.getDay()])) count++;
  }
  return count;
}

const hours = (time: string) => Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60;
export const sessionHours = (group: Group) => (group.start_time && group.end_time ? Math.max(0, hours(group.end_time) - hours(group.start_time)) : 0);
export const weeklyHours = (group: Group) => sessionHours(group) * group.days.length;

// Days this group actually met in "YYYY-MM", from the registers taken.
export const sessionsInMonth = (sessions: GroupSession[], groupId: number, month: string) =>
  sessions.filter((session) => session.group_id === groupId && session.session_date.slice(0, 7) === month).length;

// What each teacher earns in a month, for every group of theirs that has students running the course
// that month, by their pay mode (0030): the hours held × the hourly rate; or the students running
// × the per-student rate, in proportion to the sessions held out of those planned (2 of 8 held:
// a quarter; never more than the full amount); or a fixed salary, once, in every month they have at least one such group.
// Hours are the sessions actually held — the days a register was taken — not the timetable. A
// cancelled session earns nothing, the same rule that already decides what a pupil owes (0019).
// The school's side of that bargain: no register means no session, for billing and for pay alike.
// A group's students are everyone in it once: those whose enrolment in the group runs that month,
// and the members added from the group's own panel (no enrolment in it), but not someone whose
// enrolment in this group has ended or was dropped. A group with no one enrolled counts once it
// held a session that month.
// ponytail: group_students has no dates, so a past month counts today's members; dated membership if that matters.
export function teacherPay(month: string, data: { groups: Group[]; teachers: Teacher[]; enrollments: Enrollment[]; courses: Course[]; groupSessions: GroupSession[]; groupStudents?: GroupStudent[]; schoolSessions?: number }) {
  const courseById = new Map(data.courses.map((course) => [course.id, course]));
  const pay = new Map<number, { hours: number; students: number; held: number; planned: number; studentPay: number; amount: number; groups: Group[]; mode: PayMode }>();
  for (const group of data.groups) {
    const teacher = data.teachers.find((item) => item.id === group.teacher_id);
    if (!teacher || group.status === "Annulé") continue;
    // A dropped monthly enrollment still ran until its ends_on; a dropped formation never counts.
    const here = data.enrollments.filter((enrollment) => enrollment.group_id === group.id);
    const runningIds = new Set(here.filter((enrollment) => (enrollment.monthly_fee != null || enrollment.status !== "Abandonné") && runsIn(enrollment, courseById.get(enrollment.course_id), month)).map((enrollment) => enrollment.student_id));
    const held = sessionsInMonth(data.groupSessions, group.id, month);
    if (!runningIds.size && !held) continue;
    const stopped = new Set(here.map((enrollment) => enrollment.student_id).filter((id) => !runningIds.has(id)));
    const members = (data.groupStudents ?? []).filter((member) => member.group_id === group.id && !stopped.has(member.student_id)).map((member) => member.student_id);
    const running = new Set([...runningIds, ...members]).size;
    const monthHours = Math.round(held * sessionHours(group));
    const planned = plannedSessions(group, courseById.get(group.course_id ?? -1), data.schoolSessions ?? 8, month);
    const share = planned > 0 ? Math.min(1, held / planned) : 1; // no timetable to compare with: paid in full
    const row = pay.get(teacher.id) ?? { hours: 0, students: 0, held: 0, planned: 0, studentPay: 0, amount: 0, groups: [], mode: teacher.pay_mode ?? "hour" };
    const hours = row.hours + monthHours;
    const students = row.students + running;
    const studentPay = row.studentPay + running * (teacher.per_student_rate ?? 0) * share;
    const amount = row.mode === "month" ? teacher.monthly_salary ?? 0 : row.mode === "student" ? Math.round(studentPay) : hours * (teacher.hourly_rate ?? 0);
    pay.set(teacher.id, { ...row, hours, students, held: row.held + held, planned: row.planned + planned, studentPay, amount, groups: [...row.groups, group] });
  }
  return pay;
}
export const totalPay = (pay: ReturnType<typeof teacherPay>) => [...pay.values()].reduce((sum, row) => sum + row.amount, 0);

// An enrollment is a re-enrollment when the same student already had an earlier one.
export function reEnrollmentIds(enrollments: Enrollment[]) {
  const seen = new Set<number>();
  const again = new Set<number>();
  for (const enrollment of [...enrollments].sort((a, b) => a.enrolled_on.localeCompare(b.enrolled_on) || a.id - b.id)) {
    if (seen.has(enrollment.student_id)) again.add(enrollment.id);
    seen.add(enrollment.student_id);
  }
  return again;
}
