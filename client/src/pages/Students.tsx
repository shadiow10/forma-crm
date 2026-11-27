import { useEffect, useRef, useState } from "react";
import { label as labelOf, useAppT } from "../appCopy";
import { useData } from "../data";
import { useShowMore } from "../appUI";
import { readSheet, studentsFromSheet } from "../lib/sheet";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, Icon, MetricCard, PageHeader, Panel, RecordCard, RecordList, downloadCSV, formatDate, initialsBadge, statusTone } from "../ui";
import { EnrollmentForm, StudentForm, levelOptions } from "./forms";
import { CardScanner, useSignedUrl } from "./StudentCard";
import type { Student } from "../lib/queries";
import type { StudentSummary } from "../data";

// Stored values: the filter compares them, the label is translated when shown.
const STATUS_FILTERS = ["Tous", "Inscrit", "En cours", "Terminé", "Abandonné", "Sans inscription"];
const matches = (query: string, ...values: (string | null | undefined)[]) => values.join(" ").toLowerCase().includes(query.trim().toLowerCase());

export function Students({ openStudent }: { openStudent: (id: number) => void }) {
  const t = useAppT();
  const s = t.students;
  const { students, courses, summaryOf, money, groupById, teachers, school, save, ask, notify, blocked, isSoutien } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const [course, setCourse] = useState("Toutes");
  const [level, setLevel] = useState("");
  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // A row needs a name and a phone; a phone already in the school is skipped rather than doubled.
  const importFile = async (file: File | undefined) => {
    if (!file || blocked()) return;
    const sheet = await readSheet(file).catch(() => null);
    if (!sheet) { notify(s.importUnreadable); return; }
    const found = studentsFromSheet(sheet, students);
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
    && (course === "Toutes" || summary.enrollments.some((enrollment) => String(enrollment.course_id) === course))
    && (!level || student.level === level));
  const more = useShowMore(filtered);
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
        <Button variant="soft" icon="scan" onClick={() => setScanning(true)}>{t.student.scan}</Button>
      </>} />
    {scanning && <CardScanner onClose={() => setScanning(false)} onFound={(id) => {
      setScanning(false);
      // A card from this school whose student was deleted since: say so rather than open nothing.
      if (students.some((student) => student.id === id)) openStudent(id); else notify(t.student.scanUnknown);
    }} />}
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
          <select className="select" aria-label={t.common.course} value={course} onChange={(event) => setCourse(event.target.value)}><option value="Toutes">{s.allCourses}</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          {isSoutien && <select className="select" aria-label={t.so.fLevel} value={level} onChange={(event) => setLevel(event.target.value)}>{levelOptions(t.so.noLevel).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}
        </div>
        <div className="tabs choice-row" role="group" aria-label={t.common.status}>{STATUS_FILTERS.map((item) => <button type="button" key={item} className={status === item ? "active" : ""} aria-pressed={status === item} onClick={() => setStatus(item)}>{item === "Tous" ? t.common.all : labelOf(t.v.status, item)}</button>)}</div>
        <button className="text-button" onClick={exportList}><Icon name="download" size={14} /> {t.common.export}</button>
      </div>
      {/* One line per student (task list): a click opens a small preview, and from there the full record. */}
      <div className="student-rows" role="list" aria-label={s.title}>{more.visible.map(({ student, summary }) => <StudentRow key={student.id} student={student} summary={summary}
        course={courseName(summary.latest?.course_id)} teacher={teacherOf(summary.latest?.group_id) ?? s.toAssign} onOpen={() => setPreview(student.id)} />)}</div>
      {more.button}
      {!filtered.length && <p className="table-empty">{students.length ? s.emptyFiltered : s.empty}</p>}
      <div className="table-footer"><span>{s.shown(more.visible.length, filtered.length)}</span></div>
    </Panel>
    {creating && <StudentForm onClose={() => setCreating(false)} onSaved={openStudent} />}
    {preview !== null && <StudentPreview studentId={preview} onClose={() => setPreview(null)} onFull={() => { const id = preview; setPreview(null); openStudent(id); }} />}
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
  const more = useShowMore(filtered);
  const active = enrollments.filter((enrollment) => enrollment.status === "Inscrit" || enrollment.status === "En cours");

  return <>
    <PageHeader eyebrow={e.eyebrow} title={e.title} description={e.description} actionLabel={e.action} onAction={() => setCreating(true)} />
    <div className="metrics-grid metrics-grid-4">
      <MetricCard label={e.active} value={String(active.length)} note={e.activeNote} icon="enrol" accent={COLORS.teal} />
      <MetricCard label={e.running} value={String(enrollments.filter((enrollment) => enrollment.status === "En cours").length)} note={e.runningNote} icon="graduation" accent="#5B8DEF" />
      <MetricCard label={e.finished} value={String(enrollments.filter((enrollment) => enrollment.status === "Terminé").length)} note={e.finishedNote} icon="checkCircle" accent={COLORS.green} />
      <MetricCard label={e.balance} value={money(active.reduce((sum, enrollment) => sum + balanceOf(enrollment.id).balance, 0))} note={e.balanceNote} icon="wallet" accent={COLORS.yellow} />
    </div>
    <Panel className="table-panel" title={e.panel}>
      <div className="toolbar">
        <div className="search-box"><Icon name="search" size={16} /><input aria-label={t.common.search} placeholder={t.common.search} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="tabs choice-row" role="group" aria-label={t.common.status}>{["Tous", "Inscrit", "En cours", "Terminé", "Abandonné"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} aria-pressed={status === item} onClick={() => setStatus(item)}>{item === "Tous" ? t.common.all : labelOf(t.v.status, item)}</button>)}</div>
      </div>
      <RecordList label={e.panel}>{more.visible.map(({ enrollment, student, balance }) => <RecordCard key={enrollment.id} avatar={initialsBadge(student?.full_name ?? "?")} title={student?.full_name ?? "—"}
        onOpen={() => openStudent(enrollment.student_id)} openLabel={t.simple.open}
        lines={[
          [courseName(enrollment.course_id), enrollment.group_id ? groupById.get(enrollment.group_id)?.name : t.common.noGroup].join(" · "),
          `${formatDate(enrollment.enrolled_on)} · ${t.common.total} : ${money(enrollment.total)}`,
        ]}
        status={<Badge tone={statusTone(enrollment.status)}>{labelOf(t.v.status, enrollment.status)}</Badge>}
        extra={<span className="record-amount"><small>{t.common.left}</small><strong className={balance ? "money-danger" : "money-ok"}>{money(balance)}</strong></span>} />)}</RecordList>
      {more.button}
      {!filtered.length && <p className="table-empty">{e.empty}</p>}
      <div className="table-footer"><span>{e.shown(more.visible.length, filtered.length)}</span></div>
    </Panel>
    {creating && <EnrollmentForm onClose={() => setCreating(false)} />}
  </>;
}

// A student's photo when there is one, else their initials.
function StudentFace({ student, size = "" }: { student: Student; size?: string }) {
  const photo = useSignedUrl(student.photo_path);
  return photo ? <span className={`avatar photo-avatar ${size}`}><img src={photo} alt="" /></span> : initialsBadge(student.full_name);
}

function StudentRow({ student, summary, course, teacher, onOpen }: { student: Student; summary: StudentSummary; course: string; teacher: string; onOpen: () => void }) {
  const t = useAppT();
  const { money } = useData();
  return <button type="button" role="listitem" className="student-row" onClick={onOpen}>
    <StudentFace student={student} />
    <span className="student-row-name"><strong>{student.full_name}</strong><small>{course} · {teacher}</small></span>
    <span className="student-row-figures"><small>{t.common.left}</small><b className={summary.balance ? "money-danger" : "money-ok"}>{money(summary.balance)}</b></span>
    <span className="student-row-badges"><Badge tone={statusTone(summary.status)}>{labelOf(t.v.status, summary.status)}</Badge><Badge tone={statusTone(summary.paymentStatus)}>{labelOf(t.v.status, summary.paymentStatus)}</Badge></span>
    <Icon name="chevron" size={18} />
  </button>;
}

// The small profile: who, how they are doing, and one button to the full record.
function StudentPreview({ studentId, onClose, onFull }: { studentId: number; onClose: () => void; onFull: () => void }) {
  const t = useAppT();
  const s = t.students;
  const { studentById, summaryOf, courses, groupById, teachers, money } = useData();
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const student = studentById.get(studentId);
  if (!student) return null;
  const summary = summaryOf(student.id);
  const group = summary.latest?.group_id ? groupById.get(summary.latest.group_id) : undefined;
  const teacher = group ? teachers.find((item) => item.id === group.teacher_id)?.full_name : undefined;
  const rows: [string, string][] = [
    [t.common.phone, student.phone],
    [t.common.course, courses.find((item) => item.id === summary.latest?.course_id)?.name ?? "—"],
    [t.common.group, group?.name ?? t.common.noGroup],
    [t.common.teacher, teacher ?? s.toAssign],
    [s.colAttendance, summary.attendance === null ? "—" : `${summary.attendance}%`],
    [t.common.paid, money(summary.paid)],
    [t.common.left, money(summary.balance)],
  ];
  return <div className="drawer-layer confirm-layer" onClick={onClose}>
    <div className="student-preview" role="dialog" aria-label={student.full_name} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="close-button" onClick={onClose} aria-label={t.common.close}><Icon name="close" size={18} /></button>
      <div className="student-preview-head"><StudentFace student={student} size="large" /><div><h2>{student.full_name}</h2>
        <div className="student-preview-badges"><Badge tone={statusTone(summary.status)}>{labelOf(t.v.status, summary.status)}</Badge><Badge tone={statusTone(summary.paymentStatus)}>{labelOf(t.v.status, summary.paymentStatus)}</Badge></div></div></div>
      <dl className="student-preview-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === t.common.left && summary.balance ? "money-danger" : ""}>{value}</dd></div>)}</dl>
      <Button icon="file" onClick={onFull}>{t.simple.fullRecord}</Button>
    </div>
  </div>;
}
