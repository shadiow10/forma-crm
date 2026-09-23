import { useEffect, useState } from "react";
import type { PageKey } from "../auth";
import { friendlyError, useData } from "../data";
import type { Group } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, DAYS, Drawer, EmptyState, Icon, PageHeader, Panel, clampPercent, formatTime, initialsBadge, percent, statusTone } from "../ui";
import { GroupForm } from "./forms";

export const groupStatus = (group: Group, count: number) => (group.status === "Annulé" ? "Annulé" : count >= group.capacity ? "Complet" : "Ouvert");
export const timeRange = (group: Group) => (group.start_time ? `${formatTime(group.start_time)}${group.end_time ? `–${formatTime(group.end_time)}` : ""}` : "Horaire à définir");

// Names in a group. The office reads them from loaded data; a teacher gets names only, through group_roster().
export function useRoster(groupId: number | undefined) {
  const { canEdit, groupStudentIds, studentById, notify } = useData();
  const [teacherRoster, setTeacherRoster] = useState<{ id: number; full_name: string }[]>([]);
  useEffect(() => {
    if (canEdit || !groupId) return;
    supabase.rpc("group_roster", { p_group_id: groupId }).then(({ data, error }) => {
      if (error) notify(friendlyError(error));
      setTeacherRoster(((data ?? []) as { student_id: number; full_name: string }[]).map((row) => ({ id: row.student_id, full_name: row.full_name })));
    });
  }, [canEdit, groupId, notify]);
  if (!groupId) return [];
  if (!canEdit) return teacherRoster;
  return groupStudentIds(groupId).map((id) => studentById.get(id)).filter((student) => student !== undefined).map((student) => ({ id: student.id, full_name: student.full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function Groups({ openGroup }: { openGroup: (id: number) => void }) {
  const { groups, teachers, courses, groupStudentIds, canEdit } = useData();
  const [creating, setCreating] = useState(false);
  return <>
    <PageHeader eyebrow="Organisation pédagogique" title="Groupes" description={canEdit ? "Les groupes, leurs salles, formateurs et capacités." : "Les groupes dont vous êtes le formateur."} actionLabel={canEdit ? "Créer un groupe" : undefined} onAction={() => setCreating(true)} />
    {groups.length ? <div className="class-cards">{groups.map((group) => {
      const count = groupStudentIds(group.id).length;
      const status = groupStatus(group, count);
      return <div className="class-card" key={group.id} onClick={() => openGroup(group.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openGroup(group.id)}>
        <div className="class-color" style={{ background: group.color }} />
        <div className="class-card-main">
          <div className="class-card-top"><Badge tone={statusTone(status)} dot>{status}</Badge><span className="muted-copy">{courses.find((course) => course.id === group.course_id)?.name ?? ""}</span></div>
          <h3>{group.name}</h3>
          <p><Icon name="teacher" size={14} /> {teachers.find((teacher) => teacher.id === group.teacher_id)?.full_name ?? "Formateur à affecter"} · {group.room || "Salle à définir"}</p>
          <p><Icon name="calendar" size={14} /> {group.days.join(" · ") || "Jours à définir"}, {timeRange(group)}</p>
          {canEdit && <div className="capacity"><div><span>Capacité</span><strong>{count}/{group.capacity}</strong></div><div className="capacity-track"><i style={{ width: `${clampPercent(percent(count, group.capacity))}%`, background: count >= group.capacity ? COLORS.coral : group.color }} /></div></div>}
        </div>
      </div>;
    })}</div> : <Panel><EmptyState title="Aucun groupe" text={canEdit ? "Créez votre premier groupe." : "Aucun groupe ne vous est encore attribué."} /></Panel>}
    {creating && <GroupForm onClose={() => setCreating(false)} />}
  </>;
}

export function GroupDrawer({ groupId, onClose, goTo }: { groupId: number; onClose: () => void; goTo: (page: PageKey, groupId?: number) => void }) {
  const { groupById, teachers, courses, students, groupStudentIds, attendanceRate, canEdit, isDirector, school, save, ask } = useData();
  const group = groupById.get(groupId);
  const roster = useRoster(groupId);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState("");
  if (!group) return null;
  const inGroup = new Set(groupStudentIds(group.id));
  const candidates = students.filter((student) => !inGroup.has(student.id));
  const status = groupStatus(group, roster.length);

  const addStudent = async () => {
    if (!adding) return;
    if (await save(() => supabase.from("group_students").insert({ school_id: school.id, group_id: group.id, student_id: Number(adding) }), "Étudiant ajouté au groupe.")) setAdding("");
  };
  const removeStudent = async (id: number, name: string) => await ask({ title: `Retirer ${name} du groupe ?`, danger: true, confirmLabel: "Retirer" })
    && save(() => supabase.from("group_students").delete().eq("group_id", group.id).eq("student_id", id), `${name} retiré(e) du groupe.`);
  const deleteGroup = async () => {
    if (!(await ask({ title: `Supprimer le groupe « ${group.name} » ?`, danger: true, confirmLabel: "Supprimer", text: "Ses présences seront supprimées avec lui." }))) return;
    if (await save(() => supabase.from("groups").delete().eq("id", group.id), "Groupe supprimé.")) onClose();
  };

  return <>
    <Drawer title={group.name} eyebrow="GROUPE" onClose={onClose}>
    <div className="class-drawer-head">
      <span className="class-color-large" style={{ background: group.color }} />
      <div>
        <Badge tone={statusTone(status)} dot>{status}</Badge>
        <p>{teachers.find((teacher) => teacher.id === group.teacher_id)?.full_name ?? "Formateur à affecter"} · {group.room || "Salle à définir"}</p>
        <span>{courses.find((course) => course.id === group.course_id)?.name ?? "Sans formation"} · {group.days.join(" · ") || "Jours à définir"}, {timeRange(group)}</span>
      </div>
    </div>
    <div className="drawer-section">
      <div className="drawer-section-head"><h4>Étudiants</h4><span>{roster.length}/{group.capacity} places</span></div>
      {roster.length ? <div className="roster-list">{roster.map((student) => {
        const rate = attendanceRate(student.id, group.id);
        return <div className="roster-row" key={student.id}>
          {initialsBadge(student.full_name)}
          <div><strong>{student.full_name}</strong><span>{rate === null ? "Aucune présence notée" : `Présence ${rate}%`}</span></div>
          {rate !== null && <Badge tone={rate < 75 ? "danger" : "success"}>{rate < 75 ? "À surveiller" : "Régulier"}</Badge>}
          {canEdit && <button className="row-menu" onClick={() => removeStudent(student.id, student.full_name)} aria-label={`Retirer ${student.full_name}`}><Icon name="close" size={14} /></button>}
        </div>;
      })}</div> : <EmptyState title="Aucun étudiant" text="Ajoutez des étudiants ou créez une inscription avec ce groupe." />}
      {canEdit && candidates.length > 0 && <div className="inline-add">
        <select className="field" aria-label="Étudiant à ajouter" value={adding} onChange={(event) => setAdding(event.target.value)}><option value="">Ajouter un étudiant…</option>{candidates.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select>
        <Button icon="plus" disabled={!adding} onClick={addStudent}>Ajouter</Button>
      </div>}
    </div>
    <div className="drawer-section">
      <h4>Actions</h4>
      <div className="drawer-actions vertical">
        <Button variant="soft" icon="check" onClick={() => { onClose(); goTo("attendance", group.id); }}>Prendre les présences</Button>
        {canEdit && <Button variant="outline" icon="edit" onClick={() => setEditing(true)}>Modifier le groupe</Button>}
        {isDirector && <Button variant="danger" icon="trash" onClick={deleteGroup}>Supprimer le groupe</Button>}
      </div>
    </div>
  </Drawer>
    {editing && <GroupForm group={group} onClose={() => setEditing(false)} />}
  </>;
}

// Weekly grid, 08:00 → 20:00. Groups repeat every week; the arrows only move the dates shown.
const GRID_START = 8;
const GRID_HOURS = 12;
const hours = (time: string) => Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60;

export function Planning({ openGroup }: { openGroup: (id: number) => void }) {
  const { groups, canEdit } = useData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + weekOffset * 7); // Sunday of the shown week
  const dates = DAYS.map((_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const todayKey = new Date().toDateString();
  const range = `${dates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${dates[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  const visible = groups.filter((group) => group.status !== "Annulé" && group.start_time);
  const unscheduled = groups.filter((group) => group.status !== "Annulé" && (!group.start_time || !group.days.length));

  return <>
    <PageHeader eyebrow="Organisation pédagogique" title="Planning" description={canEdit ? "Les séances de la semaine et les créneaux encore libres." : "Vos séances de la semaine."} actionLabel={canEdit ? "Créer un groupe" : undefined} onAction={() => setCreating(true)} />
    <Panel title="Planning hebdomadaire" action={<div className="week-switch">
      <button onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Semaine précédente">‹</button>
      <strong>{range}</strong>
      <button onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Semaine suivante">›</button>
      {weekOffset !== 0 && <button className="text-button" onClick={() => setWeekOffset(0)}>Aujourd'hui</button>}
    </div>}>
      <div className="table-scroll"><div className="calendar-grid">
        <div className="time-col"><span />{[8, 10, 12, 14, 16, 18, 20].map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}</div>
        {DAYS.map((day, index) => <div className={`day-col ${dates[index].toDateString() === todayKey ? "today" : ""}`} key={day}>
          <div className="day-head">{day}<small>{dates[index].getDate()}</small></div>
          <div className="day-slots">
            {[0, 1, 2, 3, 4, 5].map((slot) => <div className="calendar-slot" key={slot} />)}
            {visible.filter((group) => group.days.includes(day)).map((group) => {
              const from = hours(group.start_time!);
              const to = group.end_time ? hours(group.end_time) : from + 2;
              const top = clampPercent(((from - GRID_START) / GRID_HOURS) * 100);
              const height = Math.max(8, clampPercent(((to - GRID_START) / GRID_HOURS) * 100) - top);
              return <div className="calendar-event" key={group.id} style={{ top: `${top}%`, height: `${height}%`, background: `${group.color}18`, borderLeftColor: group.color }} onClick={() => openGroup(group.id)} title={group.name}>
                <strong>{group.name.split(" — ")[0]}</strong><span>{timeRange(group)} · {group.room || "—"}</span>
              </div>;
            })}
          </div>
        </div>)}
      </div></div>
      {unscheduled.length > 0 && <p className="muted-copy">Sans horaire complet : {unscheduled.map((group) => group.name).join(", ")}.</p>}
    </Panel>
    {creating && <GroupForm onClose={() => setCreating(false)} />}
  </>;
}
