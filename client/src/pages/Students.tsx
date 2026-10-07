import { useRef, useState } from "react";
import { label as labelOf, useAppT } from "../appCopy";
import { useData } from "../data";
import { readSheet, studentsFromSheet } from "../lib/sheet";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, Icon, MetricCard, PageHeader, Panel, clampPercent, downloadCSV, formatDate, initialsBadge, statusTone } from "../ui";
import { EnrollmentForm, StudentForm } from "./forms";

// Stored values: the filter compares them, the label is translated when shown.
const STATUS_FILTERS = ["Tous", "Inscrit", "En cours", "Terminé", "Abandonné", "Sans inscription"];
const matches = (query: string, ...values: (string | null | undefined)[]) => values.join(" ").toLowerCase().includes(query.trim().toLowerCase());

export function Students({ openStudent }: { openStudent: (id: number) => void }) {
  const t = useAppT();
  const s = t.students;
  const { students, courses, summaryOf, money, groupById, teachers, school, save, ask, notify, blocked } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const [course, setCourse] = useState("Toutes");
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A row needs a name and a phone; a phone already in the school is skipped rather than doubled.
  const importFile = async (file: File | undefined) => {
    if (!file || blocked()) return;
    const sheet = await readSheet(file).catch(() => null);
    if (!sheet) { notify(s.importUnreadable); return; }
    const found = studentsFromSheet(sheet, students.map((student) => student.phone));
    if (!found.students.length) { notify(s.importNothing); return; }
    if (!(await ask({ title: s.importTitle(found.students.length), text: s.importText(found.incomplete, found.duplicates), confirmLabel: s.importConfirm }))) return;
    // ponytail: one insert for the whole file; split it into batches if schools import tens of thousands of rows.
    await save(() => supabase.from("students").insert(found.students.map((student) => ({ ...student, school_id: school.id }))), s.imported(found.students.length));
  };

  const rows = students.map((student) => ({ student, summary: summaryOf(student.id) }));
  const courseName = (id?: number) => courses.find((item) => item.id === id)?.name ?? "—";
  const teacherOf = (groupId: number | null | undefined) => {
    const group = groupId ? groupById.get(groupId) : undefined;
    return teachers.find((teacher) => teacher.id === group?.teacher_id)?.full_name;
  };
  const filtered = rows.filter(({ student, summary }) =>
    matches(query, student.full_name, student.email, student.phone, courseName(summary.latest?.course_id))
    && (status === "Tous" || summary.status === status)
    && (course === "Toutes" || summary.enrollments.some((enrollment) => String(enrollment.course_id) === course)));
  const exportList = () => downloadCSV("etudiants.csv", [
    s.csv,
    ...filtered.map(({ student, summary }) => [student.full_name, student.phone, student.email, labelOf(t.v.status, summary.status), courseName(summary.latest?.course_id), summary.attendance === null ? "" : `${summary.attendance}%`, summary.paid, summary.balance]),
  ]);

  return <>
    <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} actionLabel={s.action} onAction={() => setCreating(true)}
      extra={<>
        <input ref={fileInput} type="file" hidden accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />
        <Button variant="outline" icon="upload" onClick={() => fileInput.current?.click()}>{s.importAction}</Button>
      </>} />
    <div className="metrics-grid metrics-grid-4">
      <MetricCard label={s.total} value={String(students.length)} note={s.inDirectory} icon="users" accent={COLORS.teal} />
      <MetricCard label={s.running} value={String(rows.filter(({ summary }) => summary.status === "En cours").length)} note={s.started} icon="graduation" accent="#5B8DEF" />
      <MetricCard label={s.finished} value={String(rows.filter(({ summary }) => summary.status === "Terminé").length)} note={s.completed} icon="checkCircle" accent={COLORS.green} />
      <MetricCard label={s.watch} value={String(rows.filter(({ summary }) => summary.attendance !== null && summary.attendance < 75).length)} note={s.under75} icon="warning" accent={COLORS.coral} />
    </div>
    <Panel className="table-panel">
      <div className="filter-bar student-filter-bar">
        <div className="student-filter-main">
          <div className="search-box"><Icon name="search" size={16} /><input aria-label={s.searchPlaceholder} placeholder={s.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <select className="select" aria-label={t.common.status} value={status} onChange={(event) => setStatus(event.target.value)}>{STATUS_FILTERS.map((item) => <option key={item} value={item}>{item === "Tous" ? t.common.all : labelOf(t.v.status, item)}</option>)}</select>
          <select className="select" aria-label={t.common.course} value={course} onChange={(event) => setCourse(event.target.value)}><option value="Toutes">{s.allCourses}</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </div>
        <button className="text-button" onClick={exportList}><Icon name="download" size={14} /> {t.common.export}</button>
      </div>
      <div className="table-scroll"><table>
        <thead><tr><th>{t.common.student}</th><th>{t.common.status}</th><th>{t.common.course}</th><th>{s.colAttendance}</th><th>{s.colPayment}</th><th>{t.common.left}</th><th>{t.common.teacher}</th></tr></thead>
        <tbody>{filtered.map(({ student, summary }) => {
          const low = summary.attendance !== null && summary.attendance < 75;
          return <tr key={student.id} onClick={() => openStudent(student.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openStudent(student.id)}>
            <td><div className="person-cell">{initialsBadge(student.full_name)}<div><strong>{student.full_name}</strong><span>{student.phone}{student.email ? ` · ${student.email}` : ""}</span></div></div></td>
            <td><Badge tone={statusTone(summary.status)} dot>{labelOf(t.v.status, summary.status)}</Badge></td>
            <td>{courseName(summary.latest?.course_id)}</td>
            <td><div className="inline-progress"><span className={low ? "low" : ""}>{summary.attendance === null ? "—" : `${summary.attendance}%`}</span><div><i style={{ width: `${clampPercent(summary.attendance ?? 0)}%`, background: low ? COLORS.red : COLORS.teal }} /></div></div></td>
            <td><Badge tone={statusTone(summary.paymentStatus)}>{labelOf(t.v.status, summary.paymentStatus)}</Badge></td>
            <td className={summary.balance ? "money-danger" : "money-ok"}>{money(summary.balance)}</td>
            <td>{teacherOf(summary.latest?.group_id) ?? s.toAssign}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {!filtered.length && <p className="table-empty">{students.length ? s.emptyFiltered : s.empty}</p>}
      <div className="table-footer"><span>{s.shown(filtered.length)}</span></div>
    </Panel>
    {creating && <StudentForm onClose={() => setCreating(false)} onSaved={openStudent} />}
  </>;
}

export function Enrollments({ openStudent }: { openStudent: (id: number) => void }) {
  const t = useAppT();
  const e = t.enrollments;
  const { enrollments, studentById, courses, groupById, balanceOf, money } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const [creating, setCreating] = useState(false);
  const courseName = (id: number) => courses.find((course) => course.id === id)?.name ?? "—";
  const rows = [...enrollments].reverse().map((enrollment) => ({ enrollment, student: studentById.get(enrollment.student_id), ...balanceOf(enrollment.id) }));
  const filtered = rows.filter(({ enrollment, student }) => matches(query, student?.full_name, courseName(enrollment.course_id)) && (status === "Tous" || enrollment.status === status));
  const active = enrollments.filter((enrollment) => enrollment.status === "Inscrit" || enrollment.status === "En cours");

  return <>
    <PageHeader eyebrow={e.eyebrow} title={e.title} description={e.description} actionLabel={e.action} onAction={() => setCreating(true)} />
    <div className="metrics-grid metrics-grid-4">
      <MetricCard label={e.active} value={String(active.length)} note={e.activeNote} icon="file" accent={COLORS.teal} />
      <MetricCard label={e.running} value={String(enrollments.filter((enrollment) => enrollment.status === "En cours").length)} note={e.runningNote} icon="graduation" accent="#5B8DEF" />
      <MetricCard label={e.finished} value={String(enrollments.filter((enrollment) => enrollment.status === "Terminé").length)} note={e.finishedNote} icon="checkCircle" accent={COLORS.green} />
      <MetricCard label={e.balance} value={money(active.reduce((sum, enrollment) => sum + balanceOf(enrollment.id).balance, 0))} note={e.balanceNote} icon="wallet" accent={COLORS.yellow} />
    </div>
    <Panel className="table-panel" title={e.panel} action={<div className="toolbar-right">
      <select className="select" aria-label={t.common.status} value={status} onChange={(event) => setStatus(event.target.value)}>{["Tous", "Inscrit", "En cours", "Terminé", "Abandonné"].map((item) => <option key={item} value={item}>{item === "Tous" ? t.common.all : labelOf(t.v.status, item)}</option>)}</select>
      <div className="search-box compact"><Icon name="search" size={16} /><input aria-label={t.common.search} placeholder={t.common.search} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    </div>}>
      <div className="table-scroll"><table>
        <thead><tr><th>{t.common.student}</th><th>{t.common.course}</th><th>{t.common.group}</th><th>{t.common.status}</th><th>{t.common.date}</th><th>{t.common.total}</th><th>{t.common.left}</th></tr></thead>
        <tbody>{filtered.map(({ enrollment, student, balance }) => <tr key={enrollment.id} onClick={() => openStudent(enrollment.student_id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openStudent(enrollment.student_id)}>
          <td><div className="person-cell">{initialsBadge(student?.full_name ?? "?")}<div><strong>{student?.full_name ?? "—"}</strong><span>{student?.phone}</span></div></div></td>
          <td>{courseName(enrollment.course_id)}</td>
          <td>{enrollment.group_id ? groupById.get(enrollment.group_id)?.name : t.common.noGroup}</td>
          <td><Badge tone={statusTone(enrollment.status)} dot>{labelOf(t.v.status, enrollment.status)}</Badge></td>
          <td>{formatDate(enrollment.enrolled_on)}</td>
          <td>{money(enrollment.total)}</td>
          <td className={balance ? "money-danger" : "money-ok"}>{money(balance)}</td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && <p className="table-empty">{e.empty}</p>}
      <div className="table-footer"><span>{e.shown(filtered.length)}</span></div>
    </Panel>
    {creating && <EnrollmentForm onClose={() => setCreating(false)} />}
  </>;
}
