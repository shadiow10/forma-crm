import { label as labelOf, useAppT } from "../appCopy";
import { useData } from "../data";
import type { Group, Student } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Drawer, FormModal } from "../appUI";
import { DAYS, EmptyState, PALETTE, formatTime, todayISO } from "../ui";

// Stored values; their labels are translated where they are shown.
export const SOURCES = ["Walk-in", "Facebook", "Instagram", "TikTok", "Parrainage", "Site web", "Autre"];
export const METHODS = ["Espèces", "Virement", "Chèque"];
const text = (value: string | undefined) => value?.trim() || null;

// Create or edit a student. onSaved receives the student id.
export function StudentForm({ student, onClose, onSaved }: { student?: Student; onClose: () => void; onSaved?: (id: number) => void }) {
  const t = useAppT();
  const f = t.student;
  const { school, save } = useData();
  return <FormModal
    title={student ? f.formEdit : f.formNew} subtitle={f.formSubject} submitLabel={student ? t.common.save : f.submitNew} onClose={onClose}
    initial={{ full_name: student?.full_name ?? "", phone: student?.phone ?? "", email: student?.email ?? "", dob: student?.dob ?? "", address: student?.address ?? "", source: student?.source ?? "Walk-in" }}
    fields={[
      { key: "full_name", label: f.fName, required: true, full: true, placeholder: f.fNamePlaceholder },
      { key: "phone", label: t.common.phone, required: true, placeholder: f.fPhonePlaceholder },
      { key: "email", label: t.common.email, type: "email", placeholder: f.fEmailPlaceholder },
      { key: "dob", label: f.fDob, type: "date" },
      { key: "source", label: f.fSource, type: "select", options: SOURCES.map((value) => ({ value, label: labelOf(t.v.source, value) })) },
      { key: "address", label: t.common.address, full: true },
    ]}
    onSubmit={async (values) => {
      const row = { full_name: values.full_name.trim(), phone: values.phone.trim(), email: text(values.email), dob: values.dob || null, address: text(values.address), source: values.source };
      let id = student?.id;
      const ok = await save(async () => {
        if (student) return supabase.from("students").update(row).eq("id", student.id);
        const result = await supabase.from("students").insert({ ...row, school_id: school.id }).select("id").single();
        id = result.data?.id;
        return result;
      }, student ? f.savedEdit : f.savedNew(row.full_name));
      if (ok && id) onSaved?.(id);
      return ok;
    }}
  />;
}

// New enrollment: student (unless given), course, group of that course, price, first payment.
export function EnrollmentForm({ studentId, onClose }: { studentId?: number; onClose: () => void }) {
  const t = useAppT();
  const e = t.enrollForm;
  const { school, courses, groups, students, save, money } = useData();
  if (!courses.length) {
    return <Drawer title={e.title} eyebrow={e.subject} onClose={onClose}>
      <EmptyState title={e.noCourse} text={e.noCourseText} />
    </Drawer>;
  }
  const groupsOf = (courseId: string) => groups.filter((group) => String(group.course_id) === courseId && group.status !== "Annulé");
  const firstCourse = String(courses[0].id);
  return <FormModal
    title={e.title} subtitle={e.subject} submitLabel={e.submit} onClose={onClose}
    initial={{ student: String(studentId ?? students[0]?.id ?? ""), course: firstCourse, group: String(groupsOf(firstCourse)[0]?.id ?? ""), enrolled_on: todayISO(), total: "", first_payment: "", method: "Espèces", notes: "" }}
    fields={(values) => {
      const course = courses.find((item) => String(item.id) === values.course);
      return [
        ...(studentId ? [] : [{ key: "student", label: t.common.student, type: "select" as const, required: true, full: true, options: students.map((student) => ({ value: String(student.id), label: `${student.full_name} · ${student.phone}` })) }]),
        { key: "course", label: t.common.course, type: "select", required: true, options: courses.map((item) => ({ value: String(item.id), label: `${item.name} · ${money(item.price)}` })) },
        { key: "group", label: t.common.group, type: "select", options: [{ value: "", label: e.noGroupYet }, ...groupsOf(values.course).map((group) => ({ value: String(group.id), label: groupLabel(group, t.v.day) }))] },
        { key: "enrolled_on", label: e.date, type: "date", required: true },
        { key: "total", label: e.price, type: "number", placeholder: course ? e.pricePlaceholder(course.price) : "" },
        { key: "first_payment", label: e.firstPayment, type: "number", placeholder: "0" },
        { key: "method", label: t.payments.methodLabel, type: "select", options: METHODS.map((value) => ({ value, label: labelOf(t.v.method, value) })) },
        { key: "notes", label: e.notes, type: "textarea", full: true, placeholder: e.notesPlaceholder },
      ];
    }}
    validate={(values) => {
      const course = courses.find((item) => String(item.id) === values.course);
      const total = values.total ? Number(values.total) : course?.price ?? 0;
      return {
        student: values.student ? "" : e.errStudent,
        group: values.group && !groupsOf(values.course).some((group) => String(group.id) === values.group) ? e.errGroup : "",
        first_payment: Number(values.first_payment || 0) > total ? e.errPayment : "",
      };
    }}
    onSubmit={(values) => {
      const course = courses.find((item) => String(item.id) === values.course)!;
      const student = students.find((item) => String(item.id) === (studentId ? String(studentId) : values.student));
      return save(() => supabase.rpc("create_enrollment", {
        p_school_id: school.id, p_student_id: Number(studentId ?? values.student), p_course_id: course.id, p_group_id: values.group ? Number(values.group) : null,
        p_enrolled_on: values.enrolled_on, p_total: values.total ? Number(values.total) : course.price, p_notes: values.notes,
        p_first_payment: Number(values.first_payment || 0), p_method: values.method,
      }), e.saved(student?.full_name ?? e.someone, course.name));
    }}
  />;
}

export const groupLabel = (group: Group, day: Record<string, string>) =>
  `${group.name}${group.days.length ? ` · ${group.days.map((item) => day[item] ?? item).join(" ")}` : ""}${group.start_time ? ` ${formatTime(group.start_time)}` : ""}`;

// Record a payment on an enrollment that still has something to pay.
export function PaymentForm({ enrollmentId, onClose }: { enrollmentId?: number; onClose: () => void }) {
  const t = useAppT();
  const p = t.payments;
  const { school, enrollments, studentById, courses, balanceOf, money, save } = useData();
  const open = enrollments.filter((enrollment) => enrollment.status !== "Abandonné" && balanceOf(enrollment.id).balance > 0);
  const label = (id: number) => {
    const enrollment = enrollments.find((item) => item.id === id)!;
    return `${studentById.get(enrollment.student_id)?.full_name ?? "?"} · ${courses.find((course) => course.id === enrollment.course_id)?.name ?? "?"} ${p.left(money(balanceOf(id).balance))}`;
  };
  const first = enrollmentId ?? open[0]?.id;
  return <FormModal
    title={p.formTitle} subtitle={p.formSubject} submitLabel={p.formSubmit} onClose={onClose}
    initial={{ enrollment: first ? String(first) : "", amount: "", paid_on: todayISO(), method: "Espèces" }}
    fields={[
      { key: "enrollment", label: p.fEnrollment, type: "select", required: true, full: true, options: open.map((enrollment) => ({ value: String(enrollment.id), label: label(enrollment.id) })) },
      { key: "amount", label: p.fAmount(school.currency), type: "number", required: true, min: 1 },
      { key: "paid_on", label: p.fDate, type: "date", required: true },
      { key: "method", label: p.methodLabel, type: "select", options: METHODS.map((value) => ({ value, label: labelOf(t.v.method, value) })) },
    ]}
    validate={(values) => ({
      enrollment: values.enrollment ? "" : p.errNoEnrollment,
      amount: values.enrollment && Number(values.amount) > balanceOf(Number(values.enrollment)).balance ? p.errTooMuch(money(balanceOf(Number(values.enrollment)).balance)) : "",
    })}
    onSubmit={(values) => save(
      () => supabase.from("payments").insert({ school_id: school.id, enrollment_id: Number(values.enrollment), amount: Number(values.amount), paid_on: values.paid_on, method: values.method }),
      p.saved(money(Number(values.amount))),
    )}
  />;
}

// Create or edit a group.
export function GroupForm({ group, onClose }: { group?: Group; onClose: () => void }) {
  const t = useAppT();
  const g = t.groups;
  const { school, courses, teachers, groups, save } = useData();
  return <FormModal
    title={group ? g.formEdit : g.formNew} subtitle={g.formSubject} submitLabel={group ? t.common.save : g.submitNew} onClose={onClose}
    initial={{
      name: group?.name ?? "", course: String(group?.course_id ?? courses[0]?.id ?? ""), teacher: String(group?.teacher_id ?? ""), room: group?.room ?? "",
      days: (group?.days ?? []).join(","), start_time: formatTime(group?.start_time ?? "09:00"), end_time: formatTime(group?.end_time ?? "11:00"),
      capacity: String(group?.capacity ?? 15), status: group?.status === "Annulé" ? "Annulé" : "Ouvert",
    }}
    fields={[
      { key: "name", label: g.fName, required: true, full: true, placeholder: g.fNamePlaceholder },
      { key: "course", label: t.common.course, type: "select", options: [{ value: "", label: "—" }, ...courses.map((course) => ({ value: String(course.id), label: course.name }))] },
      { key: "teacher", label: t.common.teacher, type: "select", options: [{ value: "", label: t.students.toAssign }, ...teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.full_name }))] },
      { key: "days", label: g.fDays, type: "days", full: true },
      { key: "start_time", label: g.fStart, type: "time", required: true },
      { key: "end_time", label: g.fEnd, type: "time", required: true },
      { key: "room", label: g.fRoom, placeholder: g.fRoomPlaceholder },
      { key: "capacity", label: g.fCapacity, type: "number", required: true, min: 1 },
      { key: "status", label: t.common.status, type: "select", options: ["Ouvert", "Annulé"].map((value) => ({ value, label: labelOf(t.v.status, value) })) },
    ]}
    validate={(values) => ({
      days: values.days ? "" : g.errDays,
      end_time: values.end_time && values.start_time && values.end_time <= values.start_time ? g.errEnd : "",
    })}
    onSubmit={(values) => {
      const row = {
        name: values.name.trim(), course_id: values.course ? Number(values.course) : null, teacher_id: values.teacher ? Number(values.teacher) : null,
        room: text(values.room), days: DAYS.filter((day) => values.days.split(",").includes(day)), start_time: values.start_time, end_time: values.end_time,
        capacity: Number(values.capacity), status: values.status,
      };
      return save(
        () => group ? supabase.from("groups").update(row).eq("id", group.id) : supabase.from("groups").insert({ ...row, school_id: school.id, color: PALETTE[groups.length % PALETTE.length] }),
        group ? g.savedEdit : g.savedNew(row.name),
      );
    }}
  />;
}
