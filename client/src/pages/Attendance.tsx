import { useCallback, useEffect, useState } from "react";
import { friendlyError, useData } from "../data";
import type { AttendanceStatus } from "../lib/queries";
import { fetchAll } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, DAYS, EmptyState, Icon, PageHeader, Panel, downloadCSV, formatDate, initialsBadge, todayISO } from "../ui";
import { useRoster } from "./Groups";

const LABELS: Record<AttendanceStatus, string> = { P: "Présent", L: "En retard", A: "Absent" };
const CLASSES: Record<AttendanceStatus, string> = { P: "present", L: "late", A: "absent" };
const SYMBOLS: Record<AttendanceStatus, string> = { P: "✓", L: "~", A: "×" };

export function Attendance({ initialGroupId }: { initialGroupId?: number }) {
  const { groups, school, attendanceRate, notify, reload } = useData();
  const usable = groups.filter((group) => group.status !== "Annulé");
  const [groupId, setGroupId] = useState<number | undefined>(initialGroupId ?? usable[0]?.id);
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({});
  const [saving, setSaving] = useState<number | "all" | null>(null);
  const roster = useRoster(groupId);
  const group = groups.find((item) => item.id === groupId);

  const loadMarks = useCallback(async () => {
    if (!groupId) return;
    const { data, error } = await supabase.from("attendance").select("student_id, status").eq("group_id", groupId).eq("session_date", date);
    if (error) return notify(friendlyError(error));
    setMarks(Object.fromEntries((data ?? []).map((row) => [row.student_id, row.status as AttendanceStatus])));
  }, [groupId, date, notify]);
  useEffect(() => { setMarks({}); void loadMarks(); }, [loadMarks]);

  const mark = async (studentIds: number[], status: AttendanceStatus) => {
    if (!groupId) return;
    setSaving(studentIds.length > 1 ? "all" : studentIds[0]);
    const { error } = await supabase.from("attendance").upsert(studentIds.map((student_id) => ({ school_id: school.id, group_id: groupId, student_id, session_date: date, status })));
    setSaving(null);
    if (error) return notify(friendlyError(error));
    setMarks((prev) => ({ ...prev, ...Object.fromEntries(studentIds.map((id) => [id, status])) }));
    void reload(); // refresh attendance rates
  };

  const exportSheet = async () => {
    if (!group) return;
    try {
      const rows = await fetchAll<{ student_id: number; session_date: string; status: AttendanceStatus }>(
        () => supabase.from("attendance").select("student_id, session_date, status").eq("group_id", group.id), ["session_date", "student_id"]);
      const dates = [...new Set(rows.map((row) => row.session_date))];
      const byKey = new Map(rows.map((row) => [`${row.student_id}|${row.session_date}`, row.status]));
      downloadCSV(`presences-${group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`, [
        ["Étudiant", ...dates.map((day) => formatDate(day)), "Taux"],
        ...roster.map((student) => [student.full_name, ...dates.map((day) => { const status = byKey.get(`${student.id}|${day}`); return status ? LABELS[status] : ""; }), `${attendanceRate(student.id, group.id) ?? "—"}%`]),
      ]);
    } catch (error) {
      notify(friendlyError(error as { message: string }));
    }
  };

  if (!usable.length) return <>
    <PageHeader eyebrow="Suivi des séances" title="Présences" description="Enregistrez la présence en quelques secondes." />
    <Panel><EmptyState title="Aucun groupe" text="Les présences se prennent par groupe : créez d'abord un groupe." /></Panel>
  </>;

  const weekday = DAYS[new Date(`${date}T00:00:00`).getDay()];
  const counts = { P: 0, L: 0, A: 0 } as Record<AttendanceStatus, number>;
  for (const student of roster) if (marks[student.id]) counts[marks[student.id]] += 1;
  const unmarked = roster.filter((student) => !marks[student.id]);

  return <>
    <PageHeader eyebrow="Suivi des séances" title="Présences" description="Choisissez un groupe et une date, puis marquez chaque étudiant. Chaque clic est enregistré." actionLabel="Exporter la feuille" actionIcon="download" onAction={exportSheet} />
    <div className="attendance-controls">
      <div><label htmlFor="attendance-group">Groupe</label><select id="attendance-group" className="select" value={groupId} onChange={(event) => setGroupId(Number(event.target.value))}>{usable.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label htmlFor="attendance-date">Date de la séance</label><input id="attendance-date" className="select" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value || todayISO())} /></div>
      <div className="attendance-legend">{(Object.keys(LABELS) as AttendanceStatus[]).map((status) => <span key={status}><i className={`presence ${CLASSES[status]}`}>{SYMBOLS[status]}</i> {LABELS[status]} · {counts[status]}</span>)}</div>
    </div>
    <Panel className="table-panel attendance-panel">
      <div className="attendance-head">
        <div><h3>{group?.name}</h3><p>{formatDate(date, "long")} · {roster.length} étudiant{roster.length > 1 ? "s" : ""}{group && !group.days.includes(weekday) ? ` · attention : ce groupe n'a pas cours le ${weekday.toLowerCase()}.` : ""}</p></div>
        {unmarked.length > 0 && <Button variant="soft" icon="check" disabled={saving !== null} onClick={() => mark(unmarked.map((student) => student.id), "P")}>Marquer les {unmarked.length} autres présents</Button>}
        {roster.length > 0 && !unmarked.length && <Badge tone="success" dot>Feuille complète</Badge>}
      </div>
      {roster.length ? <div className="table-scroll"><table className="attendance-table">
        <thead><tr><th>Étudiant</th><th>Statut du jour</th><th>Taux dans ce groupe</th></tr></thead>
        <tbody>{roster.map((student) => {
          const rate = attendanceRate(student.id, groupId);
          return <tr key={student.id}>
            <td><div className="person-cell">{initialsBadge(student.full_name)}<div><strong>{student.full_name}</strong><span>{marks[student.id] ? LABELS[marks[student.id]] : "Non marqué"}</span></div></div></td>
            <td><div className="presence-choices">{(Object.keys(LABELS) as AttendanceStatus[]).map((status) => <button key={status}
              className={`presence ${CLASSES[status]} ${marks[student.id] === status ? "selected" : ""}`} aria-pressed={marks[student.id] === status}
              aria-label={`${student.full_name} : ${LABELS[status]}`} title={LABELS[status]} disabled={saving !== null}
              onClick={() => mark([student.id], status)}>{SYMBOLS[status]}</button>)}</div></td>
            <td><strong className={rate !== null && rate < 75 ? "text-danger" : "text-teal"}>{rate === null ? "—" : `${rate}%`}</strong></td>
          </tr>;
        })}</tbody>
      </table></div> : <EmptyState title="Aucun étudiant dans ce groupe" text="Ajoutez des étudiants au groupe depuis la page Groupes." />}
    </Panel>
    <p className="form-hint"><Icon name="lock" size={13} /> Le taux compte les présences et les retards sur toutes les séances notées.</p>
  </>;
}
