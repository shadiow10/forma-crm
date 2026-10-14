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
assert.equal(monthStatus(3000, 7000, 2), "paid");
assert.equal(monthStatus(3000, 7000, 3), "partly");
assert.equal(monthStatus(3000, 7000, 4), "unpaid");

assert.deepEqual([...reEnrollmentIds([enrollment(3, 1, "2026-05-01"), enrollment(2, 2, "2026-01-01"), enrollment(1, 1, "2026-01-01")])], [3]);
console.log("finance ok");
