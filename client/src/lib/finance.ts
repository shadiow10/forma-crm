import type { Course, Enrollment, Group, Teacher } from "./queries";

// Money worked out from what the school already records: course durations, enrollment prices,
// the weekly timetable and each teacher's hourly rate. Months are "YYYY-MM" strings.

export const courseMonths = (course: Course | undefined) => Math.max(1, parseInt(course?.duration ?? "", 10) || 1); // "6 mois" → 6
export const monthlyFee = (enrollment: Enrollment, course: Course | undefined) => Math.round(enrollment.total / courseMonths(course));

export const addMonths = (month: string, count: number) => {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
// 1 in the month of enrollment, then 2, 3… ; 0 before it.
export const monthNumber = (enrollment: Enrollment, month: string) => {
  const diff = (Number(month.slice(0, 4)) - Number(enrollment.enrolled_on.slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(enrollment.enrolled_on.slice(5, 7));
  return diff < 0 ? 0 : diff + 1;
};
// A course runs from the month of enrollment for its duration.
const runsIn = (enrollment: Enrollment, course: Course | undefined, month: string) => {
  const n = monthNumber(enrollment, month);
  return n >= 1 && n <= courseMonths(course);
};

const hours = (time: string) => Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60;
export const weeklyHours = (group: Group) => (group.start_time && group.end_time ? Math.max(0, hours(group.end_time) - hours(group.start_time)) * group.days.length : 0);

// What each teacher earns in a month: the hours on the timetable (weeks × 52/12) for every group of
// theirs that has students running the course that month, at their hourly rate.
// ponytail: planned hours, not sessions held; count attendance dates per group if pay must follow cancellations.
export function teacherPay(month: string, data: { groups: Group[]; teachers: Teacher[]; enrollments: Enrollment[]; courses: Course[] }) {
  const courseById = new Map(data.courses.map((course) => [course.id, course]));
  const pay = new Map<number, { hours: number; amount: number; groups: Group[] }>();
  for (const group of data.groups) {
    const teacher = data.teachers.find((item) => item.id === group.teacher_id);
    if (!teacher || group.status === "Annulé") continue;
    const running = data.enrollments.some((enrollment) => enrollment.group_id === group.id && enrollment.status !== "Abandonné" && runsIn(enrollment, courseById.get(enrollment.course_id), month));
    if (!running) continue;
    const monthHours = Math.round(weeklyHours(group) * 52 / 12);
    const row = pay.get(teacher.id) ?? { hours: 0, amount: 0, groups: [] };
    pay.set(teacher.id, { hours: row.hours + monthHours, amount: row.amount + monthHours * (teacher.hourly_rate ?? 0), groups: [...row.groups, group] });
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
