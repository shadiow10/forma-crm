// node client/src/lib/finance.check.mjs — checks monthly fees, teacher pay and re-enrollment counting.
import assert from "node:assert/strict";
import { courseMonths, monthNumber, monthStatus, monthlyFee, reEnrollmentIds, teacherPay, totalPay } from "./finance.ts";

const course = { id: 1, duration: "6 mois" };
const enrollment = (id, student_id, enrolled_on, extra = {}) => ({ id, student_id, course_id: 1, group_id: 10, enrolled_on, status: "En cours", total: 85000, ...extra });

assert.equal(courseMonths(course), 6);
assert.equal(courseMonths({ duration: "" }), 1);
assert.equal(monthlyFee(enrollment(1, 1, "2026-03-10"), course), 14167);
assert.equal(monthNumber(enrollment(1, 1, "2026-03-10"), "2026-02"), 0);
assert.equal(monthNumber(enrollment(1, 1, "2025-12-31"), "2026-02"), 3);

const data = {
  courses: [course],
  teachers: [{ id: 5, hourly_rate: 2000 }],
  groups: [{ id: 10, teacher_id: 5, status: "Ouvert", days: ["Lun", "Mer"], start_time: "14:00:00", end_time: "16:00:00" }],
  enrollments: [enrollment(1, 1, "2026-03-10")],
  // Registers taken in March: nine sessions of 2 h. Pay follows the sessions held (0020), not the timetable.
  groupSessions: ["02", "04", "09", "11", "16", "18", "23", "25", "30"].map((day) => ({ group_id: 10, session_date: `2026-03-${day}` })),
};
assert.equal(totalPay(teacherPay("2026-03", data)), 9 * 2 * 2000);
assert.equal(totalPay(teacherPay("2026-04", data)), 0, "no register in April: no session, no hourly pay");
assert.equal(totalPay(teacherPay("2026-09", data)), 0);          // the 6-month course ended in August
assert.equal(totalPay(teacherPay("2026-04", { ...data, enrollments: [enrollment(1, 1, "2026-03-10", { status: "Abandonné" })] })), 0);

// École de soutien: monthly enrollments run until ends_on; a fixed salary is paid once a month.
const monthlyData = { ...data, teachers: [{ id: 5, hourly_rate: 2000, monthly_salary: 30000, pay_mode: "month" }], enrollments: [enrollment(1, 1, "2026-03-10", { monthly_fee: 3000, total: 0, ends_on: "2026-11-02" })] };
assert.equal(totalPay(teacherPay("2026-11", monthlyData)), 30000);
assert.equal(totalPay(teacherPay("2026-12", monthlyData)), 0, "nothing after ends_on");
assert.equal(monthlyFee(monthlyData.enrollments[0], course), 3000);

// Per student (0030): the students running that month × the rate, whatever the hours.
const perStudent = { ...data, teachers: [{ id: 5, hourly_rate: 2000, per_student_rate: 800, pay_mode: "student" }], enrollments: [enrollment(1, 1, "2026-03-10"), enrollment(2, 2, "2026-03-12"), enrollment(3, 3, "2026-03-15", { status: "Abandonné" })] };
assert.equal(totalPay(teacherPay("2026-03", perStudent)), 2 * 800, "a dropped student is not paid for");
assert.equal(teacherPay("2026-03", perStudent).get(5).students, 2);

// A group filled from its own panel (members, no enrolment in it) counts once it held a session.
const panelOnly = { ...data, enrollments: [], groupStudents: [{ group_id: 10, student_id: 1 }, { group_id: 10, student_id: 2 }, { group_id: 10, student_id: 3 }] };
assert.equal(totalPay(teacherPay("2026-03", { ...panelOnly, teachers: [{ id: 5, monthly_salary: 30000, pay_mode: "month" }] })), 30000, "salary paid");
assert.equal(totalPay(teacherPay("2026-03", { ...panelOnly, teachers: [{ id: 5, per_student_rate: 800, pay_mode: "student" }] })), 3 * 800, "its members are its students");
assert.equal(totalPay(teacherPay("2026-03", panelOnly)), 9 * 2 * 2000, "hours held");
assert.equal(totalPay(teacherPay("2026-04", panelOnly)), 0, "no session that month: not counted");

// Both kinds in one group: the 2 running enrolments, plus a pupil added from the panel; the dropped one is not paid for.
const mixed = { ...perStudent, groupStudents: [1, 2, 3, 4].map((student_id) => ({ group_id: 10, student_id })) };
assert.equal(teacherPay("2026-03", mixed).get(5).students, 3);
assert.equal(totalPay(teacherPay("2026-03", mixed)), 3 * 800, "adding a pupil to the group raises per-student pay");

// Per student is paid in proportion to the sessions held. Formation: planned = timetable days in the
// month (Mondays and Wednesdays of March 2026: 9). Monthly subject: its sessions per month.
const fewHeld = { ...perStudent, groupSessions: perStudent.groupSessions.slice(0, 3) };
assert.equal(totalPay(teacherPay("2026-03", fewHeld)), Math.round(2 * 800 * 3 / 9), "3 of 9 sessions: a third");
assert.deepEqual([teacherPay("2026-03", fewHeld).get(5).held, teacherPay("2026-03", fewHeld).get(5).planned], [3, 9]);
const monthlySubject = { ...fewHeld, groups: fewHeld.groups.map((group) => ({ ...group, course_id: 1 })), courses: [{ ...course, billing: "monthly", sessions_per_month: 12 }] };
assert.equal(totalPay(teacherPay("2026-03", monthlySubject)), 2 * 800 * 3 / 12, "3 of 12: a quarter");
assert.equal(totalPay(teacherPay("2026-03", { ...perStudent, groupSessions: [...perStudent.groupSessions, { group_id: 10, session_date: "2026-03-31" }] })), 2 * 800, "an extra session never pays more than the full amount");
assert.equal(monthStatus(3000, 7000, 2), "paid");
assert.equal(monthStatus(3000, 7000, 3), "partly");
assert.equal(monthStatus(3000, 7000, 4), "unpaid");

assert.deepEqual([...reEnrollmentIds([enrollment(3, 1, "2026-05-01"), enrollment(2, 2, "2026-01-01"), enrollment(1, 1, "2026-01-01")])], [3]);
console.log("finance ok");
