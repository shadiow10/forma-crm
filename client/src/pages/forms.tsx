import { label as labelOf, useAppT } from "../appCopy";
import { useData } from "../data";
import type { Group, Student } from "../lib/queries";
import { roomClashes, sameRoom } from "../lib/rooms";
import { supabase } from "../lib/supabase";
import { Drawer, FormModal } from "../appUI";
import { DAYS, EmptyState, PALETTE, formatTime, todayISO } from "../ui";

// Stored values; their labels are translated where they are shown.
export const SOURCES = ["Walk-in", "Facebook", "Instagram", "TikTok", "Parrainage", "Site web", "Autre"];
export const METHODS = ["Espèces", "Virement", "Chèque"];
const text = (value: string | undefined) => value?.trim() || null;

// École de soutien: the Algerian school years (primaire, CEM → BEM, lycée → BAC) and the lycée streams.
// The codes are what every school writes, in every language.
export const LEVELS = ["1AP", "2AP", "3AP", "4AP", "5AP", "1AM", "2AM", "3AM", "4AM", "1AS", "2AS", "3AS"];
// ponytail: stored and shown in French; add a v.filiere map if Arabic-only schools ask for it.
export const FILIERES = ["Tronc commun Sciences", "Tronc commun Lettres", "Sciences expérimentales", "Mathématiques", "Techniques mathématiques", "Gestion et économie", "Lettres et philosophie", "Langues étrangères"];
export const levelOptions = (none: string) => [{ value: "", label: none }, ...LEVELS.map((value) => ({ value, label: value }))];

// Create or edit a student. onSaved receives the student id.
export function StudentForm({ student, onClose, onSaved }: { student?: Student; onClose: () => void; onSaved?: (id: number) => void }) {
  const t = useAppT();
  const f = t.student;
  const { school, save, isSoutien } = useData();
  return <FormModal
    title={student ? f.formEdit : f.formNew} subtitle={f.formSubject} submitLabel={student ? t.common.save : f.submitNew} onClose={onClose}
    initial={{
      full_name: student?.full_name ?? "", phone: student?.phone ?? "", email: student?.email ?? "", dob: student?.dob ?? "", address: student?.address ?? "", source: student?.source ?? "Walk-in",
      level: student?.level ?? "", filiere: student?.filiere ?? "", parent_name: student?.parent_name ?? "", parent_phone: student?.parent_phone ?? "",
    }}
    fields={(values) => [
      { key: "full_name", label: f.fName, required: true, full: true, placeholder: f.fNamePlaceholder },
      { key: "phone", label: t.common.phone, required: true, placeholder: f.fPhonePlaceholder },
      ...(isSoutien ? [
        { key: "parent_phone", label: t.so.fParentPhone, placeholder: f.fPhonePlaceholder },
        { key: "parent_name", label: t.so.fParentName },
        { key: "level", label: t.so.fLevel, type: "select" as const, options: levelOptions("—") },
        ...(values.level.endsWith("AS") ? [{ key: "filiere", label: t.so.fFiliere, type: "select" as const, options: [{ value: "", label: "—" }, ...FILIERES] }] : []),
      ] : []),
      { key: "email", label: t.common.email, type: "email", placeholder: f.fEmailPlaceholder },
      { key: "dob", label: f.fDob, type: "date" },
      { key: "source", label: f.fSource, type: "select", options: SOURCES.map((value) => ({ value, label: labelOf(t.v.source, value) })) },
      { key: "address", label: t.common.address, full: true },
    ]}
    onSubmit={async (values) => {
      const row = {
        full_name: values.full_name.trim(), phone: values.phone.trim(), email: text(values.email), dob: values.dob || null, address: text(values.address), source: values.source,
        ...(isSoutien ? { level: values.level || null, filiere: values.level.endsWith("AS") ? values.filiere || null : null, parent_name: text(values.parent_name), parent_phone: text(values.parent_phone) } : {}),
      };
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
  const { school, courses, groups, students, groupStudentIds, save, money } = useData();
  if (!courses.length) {
    return <Drawer title={e.title} eyebrow={e.subject} onClose={onClose}>
      <EmptyState title={e.noCourse} text={e.noCourseText} />
    </Drawer>;
  }
  // Only groups with a seat left: a full group takes no one else.
  const groupsOf = (courseId: string) => groups.filter((group) => String(group.course_id) === courseId && group.status !== "Annulé" && groupStudentIds(group.id).length < group.capacity);
  const firstCourse = String(courses[0].id);
  return <FormModal
    title={e.title} subtitle={e.subject} submitLabel={e.submit} onClose={onClose}
    initial={{ student: String(studentId ?? students[0]?.id ?? ""), course: firstCourse, group: String(groupsOf(firstCourse)[0]?.id ?? ""), enrolled_on: todayISO(), total: "", first_payment: "", method: "Espèces", notes: "" }}
    fields={(values) => {
      const course = courses.find((item) => String(item.id) === values.course);
      const monthly = course?.billing === "monthly";
      return [
        ...(studentId ? [] : [{ key: "student", label: t.common.student, type: "select" as const, required: true, full: true, options: students.map((student) => ({ value: String(student.id), label: `${student.full_name} · ${student.phone}` })) }]),
        { key: "course", label: t.common.course, type: "select", required: true, options: courses.map((item) => ({ value: String(item.id), label: `${item.name} · ${money(item.price)}${item.billing === "monthly" ? ` ${t.so.perMonth}` : ""}` })) },
        { key: "group", label: t.common.group, type: "select", options: [{ value: "", label: e.noGroupYet }, ...groupsOf(values.course).map((group) => ({ value: String(group.id), label: groupLabel(group, t.v.day) }))] },
        { key: "enrolled_on", label: e.date, type: "date", required: true },
        monthly
          ? { key: "total", label: t.so.fMonthlyFee(school.currency), type: "number", placeholder: t.so.monthlyFeePlaceholder(course.price) }
          : { key: "total", label: e.price, type: "number", placeholder: course ? e.pricePlaceholder(course.price) : "" },
        { key: "first_payment", label: monthly ? t.so.firstMonth : e.firstPayment, type: "number", placeholder: "0" },
        { key: "method", label: t.payments.methodLabel, type: "select", options: METHODS.map((value) => ({ value, label: labelOf(t.v.method, value) })) },
        { key: "notes", label: e.notes, type: "textarea", full: true, placeholder: e.notesPlaceholder },
      ];
    }}
    validate={(values) => {
      const course = courses.find((item) => String(item.id) === values.course);
      // Monthly: the first payment settles month 1, so it is capped at one month's fee.
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
      const price = values.total ? Number(values.total) : course.price;
      return save(() => supabase.rpc("create_enrollment", {
        p_school_id: school.id, p_student_id: Number(studentId ?? values.student), p_course_id: course.id, p_group_id: values.group ? Number(values.group) : null,
        p_enrolled_on: values.enrolled_on, p_total: course.billing === "monthly" ? 0 : price, p_notes: values.notes,
        p_first_payment: Number(values.first_payment || 0), p_method: values.method,
        p_monthly_fee: course.billing === "monthly" ? price : null,
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
  const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
  // A running monthly enrollment can always pay one month ahead, so it stays in the list when up to date.
  const running = (id: number) => { const status = enrollmentById.get(id)?.status; return status === "Inscrit" || status === "En cours"; };
  const isMonthly = (id: number) => enrollmentById.get(id)?.monthly_fee != null;
  const maxAmount = (id: number) => balanceOf(id).balance + (isMonthly(id) && running(id) ? enrollmentById.get(id)!.monthly_fee! : 0);
  const open = enrollments.filter((enrollment) => enrollment.status !== "Abandonné" && maxAmount(enrollment.id) > 0);
  const label = (id: number) => {
    const enrollment = enrollmentById.get(id)!;
    return `${studentById.get(enrollment.student_id)?.full_name ?? "?"} · ${courses.find((course) => course.id === enrollment.course_id)?.name ?? "?"} ${p.left(money(balanceOf(id).balance))}`;
  };
  // Months this payment can settle: from the first one not fully paid to one past what is due.
  const monthsOf = (id: number) => {
    const enrollment = enrollmentById.get(id);
    if (!enrollment?.monthly_fee) return [];
    const { paid, monthsDue } = balanceOf(id);
    const from = Math.min(Math.floor(paid / enrollment.monthly_fee) + 1, (monthsDue ?? 1) + 1);
    return Array.from({ length: (monthsDue ?? 1) + 2 - from }, (_, index) => from + index);
  };
  const first = enrollmentId ?? open[0]?.id;
  return <FormModal
    title={p.formTitle} subtitle={p.formSubject} submitLabel={p.formSubmit} onClose={onClose}
    initial={{ enrollment: first ? String(first) : "", month_no: first ? String(monthsOf(first)[0] ?? "") : "", amount: "", paid_on: todayISO(), method: "Espèces" }}
    fields={(values) => {
      const id = Number(values.enrollment);
      const fee = enrollmentById.get(id)?.monthly_fee;
      return [
        { key: "enrollment", label: p.fEnrollment, type: "select", required: true, full: true, options: open.map((enrollment) => ({ value: String(enrollment.id), label: label(enrollment.id) })) },
        ...(fee ? [{ key: "month_no", label: t.so.fMonthNo, type: "select" as const, options: monthsOf(id).map((n) => ({ value: String(n), label: `${t.so.month(n)}${n > (balanceOf(id).monthsDue ?? 1) ? ` ${t.so.nextMonth}` : ""}` })) }] : []),
        { key: "amount", label: p.fAmount(school.currency), type: "number", required: true, min: 1, placeholder: fee ? String(fee) : undefined },
        { key: "paid_on", label: p.fDate, type: "date", required: true },
        { key: "method", label: p.methodLabel, type: "select", options: METHODS.map((value) => ({ value, label: labelOf(t.v.method, value) })) },
      ];
    }}
    validate={(values) => ({
      enrollment: values.enrollment ? "" : p.errNoEnrollment,
      amount: values.enrollment && Number(values.amount) > maxAmount(Number(values.enrollment)) ? p.errTooMuch(money(maxAmount(Number(values.enrollment)))) : "",
    })}
    onSubmit={(values) => save(
      () => supabase.from("payments").insert({
        school_id: school.id, enrollment_id: Number(values.enrollment), amount: Number(values.amount), paid_on: values.paid_on, method: values.method,
        ...(isMonthly(Number(values.enrollment)) ? { month_no: Number(values.month_no || monthsOf(Number(values.enrollment))[0]) } : {}),
      }),
      p.saved(money(Number(values.amount))),
    )}
  />;
}

// École de soutien: one visit to the desk, several subjects. Each ticked month becomes its own
// payment row (so balances and receipts stay per subject), all printed on one receipt.
export function MultiPaymentForm({ onClose, onPaid }: { onClose: () => void; onPaid: (paymentIds: number[]) => void }) {
  const t = useAppT();
  const s = t.so;
  const { school, enrollments, students, courses, balanceOf, money, save } = useData();
  const monthly = enrollments.filter((enrollment) => enrollment.monthly_fee != null && (enrollment.status === "Inscrit" || enrollment.status === "En cours"));
  const pupils = students.filter((student) => monthly.some((enrollment) => enrollment.student_id === student.id));
  // The next month to settle for each subject, with what is left on it (it may be partly paid).
  const nextMonth = (enrollmentId: number) => {
    const enrollment = monthly.find((item) => item.id === enrollmentId)!;
    const fee = enrollment.monthly_fee!;
    const { paid } = balanceOf(enrollmentId);
    const n = Math.floor(paid / fee) + 1;
    return { n, amount: fee * n - paid, ahead: n > (balanceOf(enrollmentId).monthsDue ?? 1) };
  };
  const subjectsOf = (studentId: string) => monthly.filter((enrollment) => String(enrollment.student_id) === studentId);
  const courseName = (id: number) => courses.find((course) => course.id === id)?.name ?? "?";
  const dueTicks = (studentId: string) => subjectsOf(studentId).filter((enrollment) => !nextMonth(enrollment.id).ahead).map((enrollment) => String(enrollment.id)).join(",");
  const firstPupil = String(pupils[0]?.id ?? "");
  return <FormModal
    title={s.multiAction} subtitle={t.payments.formSubject} submitLabel={s.multiSubmit} onClose={onClose}
    initial={{ student: firstPupil, ticks: dueTicks(firstPupil), paid_on: todayISO(), method: "Espèces" }}
    fields={(values) => [
      { key: "student", label: s.multiStudent, type: "select", required: true, full: true, options: pupils.map((student) => ({ value: String(student.id), label: `${student.full_name}${student.level ? ` · ${student.level}` : ""}` })) },
      { key: "ticks", label: s.multiPick, type: "checks", full: true, options: subjectsOf(values.student).map((enrollment) => {
        const next = nextMonth(enrollment.id);
        return { value: String(enrollment.id), label: `${s.monthOf(next.n, courseName(enrollment.course_id))} · ${money(next.amount)}${next.ahead ? ` ${s.nextMonth}` : ""}` };
      }) },
      { key: "paid_on", label: t.payments.fDate, type: "date", required: true },
      { key: "method", label: t.payments.methodLabel, type: "select", options: METHODS.map((value) => ({ value, label: labelOf(t.v.method, value) })) },
    ]}
    validate={(values) => ({ ticks: values.ticks ? "" : s.multiNone })}
    onSubmit={async (values) => {
      const rows = values.ticks.split(",").filter(Boolean).map(Number)
        .filter((id) => subjectsOf(values.student).some((enrollment) => enrollment.id === id))
        .map((id) => ({ school_id: school.id, enrollment_id: id, amount: nextMonth(id).amount, month_no: nextMonth(id).n, paid_on: values.paid_on, method: values.method }));
      const total = rows.reduce((sum, row) => sum + row.amount, 0);
      let ids: number[] = [];
      const ok = await save(async () => {
        const result = await supabase.from("payments").insert(rows).select("id");
        ids = (result.data ?? []).map((row: { id: number }) => row.id);
        return result;
      }, s.multiSaved(rows.length, money(total)));
      if (ok) onPaid(ids);
      return ok;
    }}
  />;
}

// Create or edit a group.
export function GroupForm({ group, onClose }: { group?: Group; onClose: () => void }) {
  const t = useAppT();
  const g = t.groups;
  const { school, courses, teachers, groups, rooms, save, isSoutien } = useData();
  // With rooms listed (0028), the room is picked among those free on the chosen days and hours.
  // The group's own room stays offered when editing. No rooms yet: free text, as before.
  const roomOptions = (values: Record<string, string>) => [
    { value: "", label: t.rooms.none },
    ...rooms.filter((room) => sameRoom(room.name, group?.room ?? null) || values.start_time >= values.end_time
        || !roomClashes(groups, room.name, values.days.split(",").filter(Boolean), values.start_time, values.end_time, group?.id).length)
      .map((room) => ({ value: room.name, label: room.capacity ? `${room.name} · ${t.rooms.fullFor(room.capacity)}` : room.name })),
  ];
  // Another open group on one of the same days whose hours cross these ones.
  const clash = (values: Record<string, string>, same: (other: Group) => boolean) => groups.find((other) =>
    other.id !== group?.id && other.status !== "Annulé" && other.start_time && other.end_time && same(other)
    && other.days.some((day) => values.days.split(",").includes(day))
    && formatTime(other.start_time) < values.end_time && values.start_time < formatTime(other.end_time));
  return <FormModal
    title={group ? g.formEdit : g.formNew} subtitle={g.formSubject} submitLabel={group ? t.common.save : g.submitNew} onClose={onClose}
    initial={{
      name: group?.name ?? "", course: String(group?.course_id ?? courses[0]?.id ?? ""), teacher: String(group?.teacher_id ?? ""), room: group?.room ?? "",
      days: (group?.days ?? []).join(","), start_time: formatTime(group?.start_time ?? "09:00"), end_time: formatTime(group?.end_time ?? "11:00"),
      capacity: String(group?.capacity ?? 15), status: group?.status === "Annulé" ? "Annulé" : "Ouvert", level: group?.level ?? "",
    }}
    fields={(values) => [
      { key: "name", label: g.fName, required: true, full: true, placeholder: g.fNamePlaceholder },
      { key: "course", label: t.common.course, type: "select", options: [{ value: "", label: "—" }, ...courses.map((course) => ({ value: String(course.id), label: course.name }))] },
      { key: "teacher", label: t.common.teacher, type: "select", options: [{ value: "", label: t.students.toAssign }, ...teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.full_name }))] },
      ...(isSoutien ? [{ key: "level", label: t.so.fLevel, type: "select" as const, options: levelOptions(t.so.noLevel) }] : []),
      { key: "days", label: g.fDays, type: "days", full: true },
      { key: "start_time", label: g.fStart, type: "time", required: true },
      { key: "end_time", label: g.fEnd, type: "time", required: true },
      rooms.length
        ? { key: "room", label: t.rooms.pickFree, type: "select" as const, options: roomOptions(values) }
        : { key: "room", label: g.fRoom, placeholder: g.fRoomPlaceholder },
      { key: "capacity", label: g.fCapacity, type: "number", required: true, min: 1 },
      { key: "status", label: t.common.status, type: "select", options: ["Ouvert", "Annulé"].map((value) => ({ value, label: labelOf(t.v.status, value) })) },
    ]}
    validate={(values) => {
      const open = values.status !== "Annulé" && values.start_time < values.end_time;
      const room = values.room.trim().toLowerCase();
      const roomClash = open && room ? clash(values, (other) => (other.room ?? "").trim().toLowerCase() === room) : undefined;
      const teacherClash = open && values.teacher ? clash(values, (other) => String(other.teacher_id) === values.teacher) : undefined;
      return {
        days: values.days ? "" : g.errDays,
        end_time: values.end_time && values.start_time && values.end_time <= values.start_time ? g.errEnd : "",
        room: roomClash ? t.so.conflictRoom(values.room.trim(), roomClash.name) : "",
        teacher: teacherClash ? t.so.conflictTeacher(teacherClash.name) : "",
      };
    }}
    onSubmit={(values) => {
      const row = {
        name: values.name.trim(), course_id: values.course ? Number(values.course) : null, teacher_id: values.teacher ? Number(values.teacher) : null,
        room: text(values.room), days: DAYS.filter((day) => values.days.split(",").includes(day)), start_time: values.start_time, end_time: values.end_time,
        capacity: Number(values.capacity), status: values.status,
        ...(isSoutien ? { level: values.level || null } : {}),
      };
      return save(
        () => group ? supabase.from("groups").update(row).eq("id", group.id) : supabase.from("groups").insert({ ...row, school_id: school.id, color: PALETTE[groups.length % PALETTE.length] }),
        group ? g.savedEdit : g.savedNew(row.name),
      );
    }}
  />;
}
