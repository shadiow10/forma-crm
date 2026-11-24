import { useState } from "react";
import { label as labelOf, useAppT } from "../appCopy";
import type { AppCopy } from "../appCopy";
import { useData } from "../data";
import type { Course, PayMode, Teacher } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Drawer, FormModal, useShowMore } from "../appUI";
import { Badge, Button, EmptyState, Icon, PALETTE, tint, PageHeader, Panel, clampPercent, downloadCSV, percent } from "../ui";
import { timeRange } from "./Groups";
import { levelOptions } from "./forms";

// Stored values, shown through the copy: the rows keep reading "3 mois" whatever the language.
const DURATIONS = ["1 mois", "2 mois", "3 mois", "4 mois", "6 mois", "9 mois", "12 mois"];
const CONTRACTS = ["Temps plein", "Temps partiel", "Vacataire"];
const PAY_MODES: PayMode[] = ["hour", "student", "month"];
const monthsOf = (value: string) => Number(value.split(" ")[0]) || 0;
const text = (value: string | undefined) => value?.trim() || null;

function CourseForm({ course, onClose }: { course?: Course; onClose: () => void }) {
  const t = useAppT();
  const c = t.courses;
  const { school, courses, save, isSoutien } = useData();
  // An école de soutien bills by the month by default; a formation may still sell a monthly subject.
  return <FormModal title={course ? c.formEdit : c.formNew} subtitle={c.formSubject} submitLabel={course ? t.common.save : c.submitNew} onClose={onClose}
    initial={{
      name: course?.name ?? "", short_name: course?.short_name ?? "", duration: course?.duration || "3 mois", price: course ? String(course.price) : "", billing: course?.billing ?? (isSoutien ? "monthly" : "total"), level: course?.level ?? "",
      sessions: String(course?.sessions_per_month ?? school.sessions_per_month ?? 4),
    }}
    fields={(values) => [
      { key: "name", label: c.fName, required: true, full: true, placeholder: isSoutien ? "Maths" : c.fNamePlaceholder },
      { key: "short_name", label: c.fShort, placeholder: isSoutien ? "Maths" : c.fShortPlaceholder },
      { key: "billing", label: t.so.fBilling, type: "select", options: [{ value: "monthly", label: t.so.billingMonthly }, { value: "total", label: t.so.billingTotal }] },
      ...(values.billing === "monthly"
        ? [{ key: "level", label: t.so.fLevel, type: "select" as const, options: levelOptions(t.so.noLevel) },
           // A month of this subject = this many sessions, counted from the pupil's first session (0025).
           { key: "sessions", label: t.so.fSessions, type: "number" as const, required: true, min: 1, placeholder: "4" }]
        : [{ key: "duration", label: c.fDuration, type: "select" as const, options: (course && course.duration && !DURATIONS.includes(course.duration) ? [course.duration, ...DURATIONS] : DURATIONS).map((value) => ({ value, label: t.v.months(monthsOf(value)) })) }]),
      { key: "price", label: values.billing === "monthly" ? t.so.fMonthlyPrice(school.currency) : c.fPrice(school.currency), type: "number", required: true, full: true, placeholder: values.billing === "monthly" ? "3000" : "45000" },
    ]}
    validate={(values) => ({ sessions: values.billing === "monthly" && !(Number.isInteger(Number(values.sessions)) && Number(values.sessions) >= 1 && Number(values.sessions) <= 31) ? t.so.sessionsRange : "" })}
    onSubmit={(values) => {
      const monthly = values.billing === "monthly";
      const row = {
        name: values.name.trim(), short_name: text(values.short_name) ?? values.name.trim().split(" ")[0], price: Number(values.price),
        billing: values.billing, duration: monthly ? "" : values.duration, level: monthly ? values.level || null : null,
        sessions_per_month: monthly ? Number(values.sessions) : null,
      };
      return save(() => course ? supabase.from("courses").update(row).eq("id", course.id) : supabase.from("courses").insert({ ...row, school_id: school.id, color: PALETTE[courses.length % PALETTE.length] }),
        course ? c.savedEdit : c.savedNew(row.name));
    }} />;
}

export function Courses() {
  const t = useAppT();
  const c = t.courses;
  const { school, courses, groups, enrollments, groupStudentIds, money, canEdit, isDirector, save, ask } = useData();
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const stats = (course: Course) => {
    const active = enrollments.filter((enrollment) => enrollment.course_id === course.id && (enrollment.status === "Inscrit" || enrollment.status === "En cours")).length;
    const courseGroups = groups.filter((group) => group.course_id === course.id && group.status !== "Annulé");
    const seats = courseGroups.reduce((sum, group) => sum + group.capacity, 0);
    const filled = courseGroups.reduce((sum, group) => sum + groupStudentIds(group.id).length, 0);
    return { active, groups: courseGroups.length, seats, filled };
  };
  const remove = async (course: Course) => await ask({ title: c.deleteTitle(course.name), danger: true, confirmLabel: t.common.del, text: c.deleteText })
    && save(() => supabase.from("courses").delete().eq("id", course.id), c.deleted);
  const exportCatalogue = () => downloadCSV(c.csvFile, [c.csv, ...courses.map((course) => { const s = stats(course); return [course.name, t.v.months(monthsOf(course.duration)), course.price, s.active, s.groups]; })]);

  const more = useShowMore(courses);
  return <>
    <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} actionLabel={canEdit ? c.action : undefined} onAction={() => setEditing("new")}
      extra={<Button variant="outline" icon="download" onClick={exportCatalogue}>{t.common.export}</Button>} />
    {courses.length ? <><div className="class-cards">{more.visible.map((course) => {
      const s = stats(course);
      const fill = clampPercent(percent(s.filled, s.seats));
      return <div className="class-card" key={course.id}>
        <div className="class-color" style={{ background: tint(course.color) }} />
        <div className="class-card-main">
          <div className="class-card-top"><Badge tone={s.active ? "success" : "neutral"} dot>{s.active ? c.active : c.inactive}</Badge>
            {canEdit && <span className="card-actions"><button className="row-menu" aria-label={t.common.edit} onClick={() => setEditing(course)}><Icon name="edit" size={15} /></button>{isDirector && <button className="row-menu" aria-label={t.common.del} onClick={() => remove(course)}><Icon name="trash" size={15} /></button>}</span>}
          </div>
          <h3>{course.name}</h3>
          <p><Icon name="clock" size={14} /> {course.billing === "monthly" ? `${course.level ?? t.so.noLevel} · ${money(course.price)} ${t.so.perMonth} · ${t.so.sessionsShort(course.sessions_per_month ?? school.sessions_per_month)}` : `${t.v.months(monthsOf(course.duration))} · ${money(course.price)}`}</p>
          <p><Icon name="graduation" size={14} /> {c.enrollmentsCount(s.active)} · {c.groupsCount(s.groups)}</p>
          <div className="capacity"><div><span>{c.seats}</span><strong>{s.seats ? `${s.filled}/${s.seats}` : c.noGroup}</strong></div><div className="capacity-track"><i style={{ width: `${fill}%`, background: course.color }} /></div></div>
        </div>
      </div>;
    })}</div>{more.button}</> : <Panel><EmptyState title={c.empty} text={c.emptyText} /></Panel>}
    {editing && <CourseForm course={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
  </>;
}

// Weekly hours from each group's days and times.
const weeklyHours = (teacherId: number, groups: ReturnType<typeof useData>["groups"]) => groups
  .filter((group) => group.teacher_id === teacherId && group.status !== "Annulé" && group.start_time && group.end_time)
  .reduce((sum, group) => {
    const [sh, sm] = group.start_time!.split(":").map(Number);
    const [eh, em] = group.end_time!.split(":").map(Number);
    return sum + group.days.length * ((eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);

// "2 000 DA/h", "800 DA / élève", "30 000 DA / mois"; "—" for whoever cannot read pay (secrétaire).
export function payRate(teacher: Teacher, money: (n: number) => string, t: AppCopy) {
  if (teacher.pay_mode === null) return "—";
  if (teacher.pay_mode === "month") return `${money(teacher.monthly_salary ?? 0)} ${t.so.perMonth}`;
  if (teacher.pay_mode === "student") return `${money(teacher.per_student_rate ?? 0)} ${t.teachers.perStudent}`;
  return `${money(teacher.hourly_rate ?? 0)}/${t.teachers.hourShort}`;
}

// The pay mode decides which amount is asked for (0030). The other two keep what they held, so
// switching back and forth loses nothing.
function TeacherForm({ teacher, onClose }: { teacher?: Teacher; onClose: () => void }) {
  const t = useAppT();
  const w = t.teachers;
  const { school, courses, teachers, save } = useData();
  return <FormModal title={teacher ? w.formEdit : w.formNew} subtitle={w.formSubject} submitLabel={teacher ? t.common.save : t.common.add} onClose={onClose}
    initial={{ full_name: teacher?.full_name ?? "", subject: teacher?.subject ?? courses[0]?.name ?? "", phone: teacher?.phone ?? "", email: teacher?.email ?? "", contract: teacher?.contract ?? "Temps partiel",
      pay_mode: teacher?.pay_mode ?? "hour", hourly_rate: String(teacher?.hourly_rate ?? 2000), monthly_salary: teacher?.monthly_salary == null ? "" : String(teacher.monthly_salary), per_student_rate: teacher?.per_student_rate == null ? "" : String(teacher.per_student_rate) }}
    fields={(values) => [
      { key: "full_name", label: w.fName, required: true, full: true },
      { key: "subject", label: w.fSpecialty, placeholder: w.fSpecialtyPlaceholder },
      { key: "contract", label: w.fContract, type: "select", options: CONTRACTS.map((value) => ({ value, label: labelOf(t.v.contract, value) })) },
      { key: "phone", label: t.common.phone },
      { key: "email", label: t.common.email, type: "email" },
      { key: "pay_mode", label: w.fPayMode, type: "select", options: PAY_MODES.map((value) => ({ value, label: w.payModes[value] })) },
      values.pay_mode === "month" ? { key: "monthly_salary", label: t.so.fSalary(school.currency), type: "number", required: true, min: 0 }
        : values.pay_mode === "student" ? { key: "per_student_rate", label: w.fPerStudent(school.currency), type: "number", required: true, min: 0 }
        : { key: "hourly_rate", label: w.fRate(school.currency), type: "number", required: true, min: 0 },
    ]}
    onSubmit={(values) => {
      const amount = (value: string) => (value ? Number(value) : null);
      const row = { full_name: values.full_name.trim(), subject: text(values.subject), phone: text(values.phone), email: text(values.email), contract: values.contract,
        pay_mode: values.pay_mode, hourly_rate: Number(values.hourly_rate || 0), monthly_salary: amount(values.monthly_salary), per_student_rate: amount(values.per_student_rate) };
      return save(() => teacher ? supabase.from("teachers").update(row).eq("id", teacher.id) : supabase.from("teachers").insert({ ...row, school_id: school.id, color: PALETTE[teachers.length % PALETTE.length] }),
        teacher ? w.savedEdit : w.savedNew(row.full_name));
    }} />;
}

export function Teachers() {
  const t = useAppT();
  const w = t.teachers;
  const { teachers, groups, money } = useData();
  const [editing, setEditing] = useState<Teacher | "new" | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const maxHours = Math.max(1, ...teachers.map((teacher) => weeklyHours(teacher.id, groups)));
  const more = useShowMore(teachers);
  const moreHours = useShowMore(teachers);
  return <>
    <PageHeader eyebrow={w.eyebrow} title={w.title} description={w.description} actionLabel={w.action} onAction={() => setEditing("new")} />
    {teachers.length ? <><div className="teacher-grid">{more.visible.map((teacher) => {
      const count = groups.filter((group) => group.teacher_id === teacher.id && group.status !== "Annulé").length;
      return <div className="teacher-card" key={teacher.id} onClick={() => setSelected(teacher.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(teacher.id)}>
        <div className="teacher-top"><span className="teacher-avatar" style={{ background: `${tint(teacher.color)}22`, color: "var(--umber)" }}>{teacher.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><Badge>{labelOf(t.v.contract, teacher.contract)}</Badge></div>
        <h3>{teacher.full_name}</h3>
        <p className="teacher-subject">{teacher.subject || w.noSubject}</p>
        <div className="teacher-details"><span><Icon name="phone" size={14} />{teacher.phone || "—"}</span><span><Icon name="mail" size={14} />{teacher.email || "—"}</span></div>
        <div className="teacher-footer"><span>{w.groupsCount(count)}</span><strong>{payRate(teacher, money, t)}</strong></div>
      </div>;
    })}</div>{more.button}</> : <Panel><EmptyState title={w.empty} text={w.emptyText} /></Panel>}
    {teachers.length > 0 && <Panel title={w.weekly}><div className="hours-grid">{moreHours.visible.map((teacher) => {
      const hours = weeklyHours(teacher.id, groups);
      return <div className="hours-row" key={teacher.id}>
        <span className="hours-name">{teacher.full_name}</span>
        <div className="hours-track"><i style={{ width: `${clampPercent(percent(hours, maxHours))}%`, background: tint(teacher.color) }} /></div>
        <strong>{Math.round(hours * 10) / 10} {w.hourShort}</strong>
      </div>;
    })}</div>{moreHours.button}</Panel>}
    {selected !== null && <TeacherDrawer teacherId={selected} onClose={() => setSelected(null)} onEdit={(teacher) => setEditing(teacher)} />}
    {editing && <TeacherForm teacher={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
  </>;
}

function TeacherDrawer({ teacherId, onClose, onEdit }: { teacherId: number; onClose: () => void; onEdit: (teacher: Teacher) => void }) {
  const t = useAppT();
  const w = t.teachers;
  const { teachers, groups, members, money, save, notify, ask } = useData();
  const teacher = teachers.find((item) => item.id === teacherId);
  if (!teacher) return null;
  const own = groups.filter((group) => group.teacher_id === teacher.id);
  const account = members.find((member) => member.teacher_id === teacher.id);
  const remove = async () => {
    if (account) return notify(w.hasAccount);
    if (!(await ask({ title: w.deleteTitle(teacher.full_name), danger: true, confirmLabel: t.common.del, text: w.deleteText }))) return;
    if (await save(() => supabase.from("teachers").delete().eq("id", teacher.id), w.deleted)) onClose();
  };
  return <Drawer title={teacher.full_name} eyebrow={w.drawer} onClose={onClose}>
    <div className="drawer-section">
      <h4>{w.contact}</h4>
      <div className="info-grid">
        <div><span>{t.common.phone}</span><strong>{teacher.phone || "—"}</strong></div>
        <div><span>{t.common.email}</span><strong>{teacher.email || "—"}</strong></div>
        <div><span>{w.rate}</span><strong>{payRate(teacher, money, t)}</strong></div>
        <div><span>{w.fContract}</span><strong>{labelOf(t.v.contract, teacher.contract)}</strong></div>
        <div><span>{w.weeklyHours}</span><strong>{Math.round(weeklyHours(teacher.id, groups) * 10) / 10} {w.hourShort}</strong></div>
        <div><span>{w.account}</span><strong>{account ? account.email ?? w.accountActive : w.accountNone}</strong></div>
      </div>
    </div>
    <div className="drawer-section">
      <h4>{w.groups}</h4>
      {own.length ? <div className="teacher-schedule">{own.map((group) => <div key={group.id}><span className="schedule-day">{group.days.map((day) => t.v.day[day]).join(" ") || "—"}</span><div><strong>{group.name}</strong><span>{timeRange(group, t.common.noTime)} · {group.room || t.common.noRoom}</span></div></div>)}</div>
        : <EmptyState title={w.noGroups} text={w.noGroupsText} />}
    </div>
    <div className="drawer-actions vertical">
      <Button variant="outline" icon="edit" onClick={() => onEdit(teacher)}>{t.common.edit}</Button>
      <Button variant="danger" icon="trash" onClick={remove}>{t.common.del}</Button>
    </div>
  </Drawer>;
}
