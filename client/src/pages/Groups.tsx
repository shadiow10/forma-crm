import { useEffect, useState } from "react";
import type { PageKey } from "../auth";
import { label as labelOf, useAppT } from "../appCopy";
import { friendlyError, useData } from "../data";
import { locale } from "../lang";
import type { Group } from "../lib/queries";
import { plannedSessions } from "../lib/finance";
import { supabase } from "../lib/supabase";
import { Drawer, useShowMore } from "../appUI";
<<<<<<< Updated upstream
import { Badge, Button, COLORS, DAYS, tint, EmptyState, Icon, MetricCard, PageHeader, Panel, clampPercent, formatTime, initialsBadge, percent, statusTone, todayISO } from "../ui";
=======
import { Badge, Button, COLORS, DAYS, tint, EmptyState, Icon, MetricCard, PageHeader, Panel, RecordCard, RecordList, clampPercent, formatTime, initialsBadge, percent, statusTone, todayISO } from "../ui";
>>>>>>> Stashed changes
import { GroupForm } from "./forms";

export const groupStatus = (group: Group, count: number) => (group.status === "Annulé" ? "Annulé" : count >= group.capacity ? "Complet" : "Ouvert");
export const timeRange = (group: Group, fallback: string) => (group.start_time ? `${formatTime(group.start_time)}${group.end_time ? `–${formatTime(group.end_time)}` : ""}` : fallback);

// Names in a group. The office reads them from loaded data; a teacher gets names only, through group_roster().
export function useRoster(groupId: number | undefined) {
  const errors = useAppT().errors;
  const { canEdit, groupStudentIds, studentById, notify } = useData();
  const [teacherRoster, setTeacherRoster] = useState<{ id: number; full_name: string }[]>([]);
  useEffect(() => {
    if (canEdit || !groupId) return;
    supabase.rpc("group_roster", { p_group_id: groupId }).then(({ data, error }) => {
      if (error) notify(friendlyError(error, errors));
      setTeacherRoster(((data ?? []) as { student_id: number; full_name: string }[]).map((row) => ({ id: row.student_id, full_name: row.full_name })));
    });
  }, [canEdit, groupId, notify, errors]);
  if (!groupId) return [];
  if (!canEdit) return teacherRoster;
  return groupStudentIds(groupId).map((id) => studentById.get(id)).filter((student) => student !== undefined).map((student) => ({ id: student.id, full_name: student.full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name));
}


export function Groups({ openGroup }: { openGroup: (id: number) => void }) {
  const t = useAppT();
  const g = t.groups;
  const { groups, teachers, courses, groupStudentIds, groupSessions, school, canEdit } = useData();
  const [creating, setCreating] = useState(false);
  const month = todayISO().slice(0, 7);
  // A session counts the moment attendance is taken for the group that day (group_sessions, 0020).
  const heldThisMonth = new Map<number, number>();
  for (const session of groupSessions) if (session.session_date.startsWith(month)) heldThisMonth.set(session.group_id, (heldThisMonth.get(session.group_id) ?? 0) + 1);
  const statuses = groups.map((group) => groupStatus(group, groupStudentIds(group.id).length));
  const tally = (status: string) => statuses.filter((item) => item === status).length;
  const more = useShowMore(groups);
  return <>
    <PageHeader eyebrow={g.eyebrow} title={g.title} description={canEdit ? g.description : g.descriptionTeacher} actionLabel={canEdit ? g.action : undefined} onAction={() => setCreating(true)} />
    {groups.length > 0 && <div className="metrics-grid metrics-grid-4">
      <MetricCard label={g.countTotal} value={String(groups.length)} note={g.countTotalNote} icon="users" accent="#5B8DEF" />
      <MetricCard label={g.countOpen} value={String(tally("Ouvert"))} note={g.countOpenNote} icon="checkCircle" accent={COLORS.green} />
      <MetricCard label={g.countFull} value={String(tally("Complet"))} note={g.countFullNote} icon="warning" accent={COLORS.yellow} />
      <MetricCard label={g.countClosed} value={String(tally("Annulé"))} note={g.countClosedNote} icon="lock" accent={COLORS.red} />
    </div>}
    {groups.length ? <><div className="class-cards">{more.visible.map((group) => {
      const count = groupStudentIds(group.id).length;
      const status = groupStatus(group, count);
      const planned = plannedSessions(group, courses.find((course) => course.id === group.course_id), school.sessions_per_month, month);
      const held = heldThisMonth.get(group.id) ?? 0;
      return <div className="class-card" key={group.id} onClick={() => openGroup(group.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openGroup(group.id)}>
        <div className="class-color" style={{ background: tint(group.color) }} />
        <div className="class-card-main">
          <div className="class-card-top"><Badge tone={statusTone(status)} dot>{labelOf(t.v.status, status)}</Badge><span className="muted-copy">{courses.find((course) => course.id === group.course_id)?.name ?? ""}</span></div>
          <h3>{group.name}</h3>
          <p><Icon name="teacher" size={14} /> {teachers.find((teacher) => teacher.id === group.teacher_id)?.full_name ?? t.common.unassigned} · {group.room || t.common.noRoom}</p>
          <p><Icon name="calendar" size={14} /> {group.days.map((day) => t.v.day[day]).join(" · ") || t.common.noDays}, {timeRange(group, t.common.noTime)}</p>
          {canEdit && <div className="capacity"><div><span>{g.capacity}</span><strong>{count}/{group.capacity}</strong></div><div className="capacity-track"><i style={{ width: `${clampPercent(percent(count, group.capacity))}%`, background: count >= group.capacity ? COLORS.coral : tint(group.color) }} /></div></div>}
          {status !== "Annulé" && planned > 0 && <div className="capacity month-sessions"><div><span>{g.monthSessions}</span><strong>{g.sessionsOf(held, planned)}</strong></div><div className="capacity-track"><i style={{ width: `${clampPercent(percent(held, planned))}%`, background: held >= planned ? COLORS.green : COLORS.teal }} /></div></div>}
        </div>
      </div>;
    })}</div>{more.button}</> : <Panel><EmptyState title={g.empty} text={canEdit ? g.emptyText : g.emptyTextTeacher} /></Panel>}
    {creating && <GroupForm onClose={() => setCreating(false)} />}
  </>;
}

export function GroupDrawer({ groupId, onClose, goTo }: { groupId: number; onClose: () => void; goTo: (page: PageKey, groupId?: number) => void }) {
  const t = useAppT();
  const g = t.groups;
  const { groupById, teachers, courses, students, enrollments, groupStudentIds, attendanceRate, canEdit, isDirector, school, save, ask } = useData();
  const group = groupById.get(groupId);
  const roster = useRoster(groupId);
  const moreRoster = useShowMore(roster);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState("");
  if (!group) return null;
  const inGroup = new Set(groupStudentIds(group.id));
  const candidates = students.filter((student) => !inGroup.has(student.id));
  // Searched by typing: the browser's own suggestion list narrows as you type. Name · phone, so two
  // pupils with the same name stay apart; only an exact pick from the list can be added.
  const pickLabel = (student: { full_name: string; phone: string }) => `${student.full_name} · ${student.phone}`;
  const picked = candidates.find((student) => pickLabel(student) === adding);
  const status = groupStatus(group, roster.length);

  // Joining a group is enrolling in its subject: the pupil is billed and counts for the teacher's pay.
  // An enrolment in that subject still without a group is put in this one rather than doubled.
  // A group with no subject only takes the member, as before.
  const course = courses.find((item) => item.id === group.course_id);
  const running = (status: string) => status === "Inscrit" || status === "En cours";
  const addStudent = async () => {
    if (!picked) return;
    const member = { school_id: school.id, group_id: group.id, student_id: picked.id };
    const loose = course && enrollments.find((enrollment) => enrollment.student_id === picked.id && enrollment.course_id === course.id && enrollment.group_id === null && running(enrollment.status));
    const done = await save(async () => {
      if (!course) return supabase.from("group_students").insert(member);
      if (loose) {
        const linked = await supabase.from("enrollments").update({ group_id: group.id }).eq("id", loose.id);
        return linked.error ? linked : supabase.from("group_students").insert(member);
      }
      return supabase.rpc("create_enrollment", {
        p_school_id: school.id, p_student_id: picked.id, p_course_id: course.id, p_group_id: group.id, p_enrolled_on: todayISO(),
        p_total: course.billing === "monthly" ? 0 : course.price, p_notes: "", p_first_payment: 0, p_method: "Espèces",
        p_monthly_fee: course.billing === "monthly" ? course.price : null,
      });
    }, course ? g.addedEnrolled(picked.full_name, course.name) : g.added);
    if (done) setAdding("");
  };
  // Leaving the group keeps the enrolment and its payments; it just no longer sits in this group.
  const removeStudent = async (id: number, name: string) => await ask({ title: g.removeTitle(name), danger: true, confirmLabel: t.common.remove })
    && save(async () => {
      const left = await supabase.from("group_students").delete().eq("group_id", group.id).eq("student_id", id);
      return left.error ? left : supabase.from("enrollments").update({ group_id: null }).eq("group_id", group.id).eq("student_id", id).in("status", ["Inscrit", "En cours"]);
    }, g.removed(name));
  const deleteGroup = async () => {
    if (!(await ask({ title: g.deleteTitle(group.name), danger: true, confirmLabel: t.common.del, text: g.deleteText }))) return;
    if (await save(() => supabase.from("groups").delete().eq("id", group.id), g.deleted)) onClose();
  };

  return <>
    <Drawer title={group.name} eyebrow={g.drawer} onClose={onClose} actions={<>
      <Button small variant="soft" icon="check" onClick={() => { onClose(); goTo("attendance", group.id); }}>{g.attendanceShort}</Button>
      {canEdit && <Button small variant="outline" icon="edit" onClick={() => setEditing(true)}>{t.common.edit}</Button>}
    </>}>
    <div className="class-drawer-head">
      <span className="class-color-large" style={{ background: tint(group.color) }} />
      <div>
        <Badge tone={statusTone(status)} dot>{labelOf(t.v.status, status)}</Badge>
        <p>{teachers.find((teacher) => teacher.id === group.teacher_id)?.full_name ?? t.common.unassigned} · {group.room || t.common.noRoom}</p>
        <span>{courses.find((course) => course.id === group.course_id)?.name ?? g.noCourse} · {group.days.map((day) => t.v.day[day]).join(" · ") || t.common.noDays}, {timeRange(group, t.common.noTime)}</span>
      </div>
    </div>
    <div className="drawer-section">
      <div className="drawer-section-head"><h4>{t.nav.students}</h4><span>{g.seats(roster.length, group.capacity)}</span></div>
      {roster.length ? <><div className="roster-list">{moreRoster.visible.map((student) => {
        const rate = attendanceRate(student.id, group.id);
        return <div className="roster-row" key={student.id}>
          {initialsBadge(student.full_name)}
          <div><strong>{student.full_name}</strong><span>{rate === null ? g.noAttendance : g.attendance(rate)}</span></div>
          {rate !== null && <Badge tone={rate < 75 ? "danger" : "success"}>{rate < 75 ? g.watch : g.regular}</Badge>}
          {canEdit && <button className="row-menu" onClick={() => removeStudent(student.id, student.full_name)} aria-label={`${t.common.remove} ${student.full_name}`}><Icon name="close" size={14} /></button>}
        </div>;
      })}</div>{moreRoster.button}</> : <EmptyState title={g.emptyRoster} text={g.emptyRosterText} />}
      {/* A full or cancelled group takes no one else (the database refuses it too, 0029). */}
      {canEdit && status === "Complet" && <p className="muted-copy">{t.errors.groupFull}</p>}
      {canEdit && status === "Ouvert" && candidates.length > 0 && <div className="inline-add">
        <input className="field" type="search" list="group-candidates" aria-label={g.addStudentLabel} placeholder={g.addStudent} value={adding}
          onChange={(event) => setAdding(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addStudent(); }} />
        <datalist id="group-candidates">{candidates.map((student) => <option key={student.id} value={pickLabel(student)} />)}</datalist>
        <Button icon="plus" disabled={!picked} onClick={addStudent}>{t.common.add}</Button>
      </div>}
    </div>
    {/* Attendance and edit sit next to the title; deleting stays down here, away from them. */}
    {isDirector && <div className="drawer-section"><div className="drawer-actions vertical"><Button variant="danger" icon="trash" onClick={deleteGroup}>{g.deleteGroup}</Button></div></div>}
  </Drawer>
    {editing && <GroupForm group={group} onClose={() => setEditing(false)} />}
  </>;
}

// Weekly grid, 08:00 → 20:00. Groups repeat every week; the arrows only move the dates shown.
const GRID_START = 8;
const GRID_HOURS = 12;
const hours = (time: string) => Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60;
const span = (group: Group) => { const from = hours(group.start_time!); return { from, to: group.end_time ? hours(group.end_time) : from + 2 }; };

// Sessions that overlap share the column side by side instead of covering each other. Each run of
// overlapping sessions gets as many lanes as it needs; a session takes the first lane free at its start.
export function layoutDay(dayGroups: Group[]) {
  const placed: { group: Group; lane: number; lanes: number }[] = [];
  let run: typeof placed = [];
  let laneEnds: number[] = [];
  const close = () => { for (const item of run) item.lanes = laneEnds.length; run = []; laneEnds = []; };
  for (const group of [...dayGroups].sort((a, b) => span(a).from - span(b).from)) {
    const { from, to } = span(group);
    if (run.length && from >= Math.max(...laneEnds)) close();
    const free = laneEnds.findIndex((end) => end <= from);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = to;
    const item = { group, lane, lanes: 1 };
    run.push(item);
    placed.push(item);
  }
  close();
  return placed;
}

export function Planning({ openGroup }: { openGroup: (id: number) => void }) {
  const t = useAppT();
  const p = t.planning;
  const { groups, teachers, canEdit } = useData();
  const [weekOffset, setWeekOffset] = useState(0);
  // Day-by-day list first (validated); the week grid stays one click away.
  const [view, setView] = useState<"list" | "grid">("list");
  const [creating, setCreating] = useState(false);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + weekOffset * 7); // Sunday of the shown week
  const dates = DAYS.map((_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const todayKey = new Date().toDateString();
  const range = `${dates[0].toLocaleDateString(locale(), { day: "numeric", month: "short" })} – ${dates[6].toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" })}`;
  const visible = groups.filter((group) => group.status !== "Annulé" && group.start_time);
  const unscheduled = groups.filter((group) => group.status !== "Annulé" && (!group.start_time || !group.days.length));

  return <>
    <PageHeader eyebrow={t.groups.eyebrow} title={p.title} description={canEdit ? p.description : p.descriptionTeacher} actionLabel={canEdit ? t.groups.action : undefined} onAction={() => setCreating(true)} />
    <Panel title={p.weekly} className="planning-panel" action={<div className="week-switch">
      <button onClick={() => setWeekOffset(weekOffset - 1)} aria-label={p.prev}>‹</button>
      <strong>{range}</strong>
      <button onClick={() => setWeekOffset(weekOffset + 1)} aria-label={p.next}>›</button>
      {weekOffset !== 0 && <button className="text-button" onClick={() => setWeekOffset(0)}>{p.today}</button>}
    </div>}>
      <div className="planning-view-switch"><Button variant="outline" icon={view === "list" ? "grid" : "checklist"} onClick={() => setView(view === "list" ? "grid" : "list")}>{view === "list" ? t.simple.showGrid : t.simple.showList}</Button></div>
      {view === "list" ? (() => {
        // This week starts from today; other weeks from their first day. Days without a course are left out.
        const todayIndex = dates.findIndex((date) => date.toDateString() === todayKey);
        const order = DAYS.map((_, index) => index).filter((index) => todayIndex < 0 || index >= todayIndex);
        const tomorrowKey = new Date(Date.now() + 86_400_000).toDateString();
        const days = order.map((index) => ({ index, items: visible.filter((group) => group.days.includes(DAYS[index])).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")) })).filter((day) => day.items.length);
        return days.length ? <div className="day-list">{days.map(({ index, items }) => {
          const date = dates[index];
          const name = date.toDateString() === todayKey ? t.simple.today : date.toDateString() === tomorrowKey ? t.simple.tomorrow : date.toLocaleDateString(locale(), { weekday: "long" });
          return <section className="day-block" key={index} aria-label={name}>
            <h3><span>{name}</span><small>{date.toLocaleDateString(locale(), { day: "numeric", month: "long" })}</small></h3>
            <RecordList label={name}>{items.map((group) => <RecordCard key={group.id} title={timeRange(group, t.common.noTime)} onOpen={() => openGroup(group.id)} openLabel={t.simple.open}
              avatar={<span className="day-dot" style={{ background: tint(group.color) }} aria-hidden="true" />}
              lines={[<b key="name">{group.name}</b>, [group.room || t.common.noRoom, teachers.find((teacher) => teacher.id === group.teacher_id)?.full_name ?? t.common.unassigned].join(" · ")]} />)}</RecordList>
          </section>;
        })}</div> : <EmptyState title={t.groups.empty} text="" />;
      })() : <div className="table-scroll"><div className="calendar-grid">
        <div className="time-col">{[8, 10, 12, 14, 16, 18, 20].map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}</div>
        {DAYS.map((day, index) => <div className={`day-col ${dates[index].toDateString() === todayKey ? "today" : ""}`} key={day}>
          <div className="day-head">{t.v.day[day]}<small>{dates[index].getDate()}</small></div>
          <div className="day-slots">
            {[0, 1, 2, 3, 4, 5].map((slot) => <div className="calendar-slot" key={slot} />)}
            {layoutDay(visible.filter((group) => group.days.includes(day))).map(({ group, lane, lanes }) => {
              const { from, to } = span(group);
              const top = clampPercent(((from - GRID_START) / GRID_HOURS) * 100);
              const height = Math.max(8, clampPercent(((to - GRID_START) / GRID_HOURS) * 100) - top);
              return <div className="calendar-event" key={group.id} style={{ top: `${top}%`, height: `${height}%`, insetInlineStart: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`, background: `${tint(group.color)}1f`, borderInlineStartColor: tint(group.color) }} onClick={() => openGroup(group.id)} title={group.name}>
                <strong>{group.name.split(" — ")[0]}</strong><span>{timeRange(group, t.common.noTime)} · {group.room || "—"}</span>
              </div>;
            })}
          </div>
        </div>)}
      </div></div>}
      {unscheduled.length > 0 && <p className="muted-copy">{p.unscheduled(unscheduled.map((group) => group.name).join(", "))}</p>}
    </Panel>
    {creating && <GroupForm onClose={() => setCreating(false)} />}
  </>;
}
