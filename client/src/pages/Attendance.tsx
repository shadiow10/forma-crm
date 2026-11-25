import { useCallback, useEffect, useState } from "react";
import { useAppT } from "../appCopy";
import { friendlyError, useData } from "../data";
import type { AttendanceStatus } from "../lib/queries";
import { fetchAll } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, DAYS, EmptyState, Icon, PageHeader, Panel, downloadCSV, formatDate, initialsBadge, todayISO } from "../ui";
import { useRoster } from "./Groups";

const CLASSES: Record<AttendanceStatus, string> = { P: "present", L: "late", A: "absent", E: "excused" };
const SYMBOLS: Record<AttendanceStatus, string> = { P: "✓", L: "~", A: "×", E: "E" };

export function Attendance({ initialGroupId }: { initialGroupId?: number }) {
  const t = useAppT();
  const a = t.attendance;
  const LABELS = a.labels as Record<AttendanceStatus, string>;
  const { groups, school, attendanceRate, notify, reload, blocked } = useData();
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
    if (error) return notify(friendlyError(error, t.errors));
    setMarks(Object.fromEntries((data ?? []).map((row) => [row.student_id, row.status as AttendanceStatus])));
  }, [groupId, date, notify, t]);
  useEffect(() => { setMarks({}); void loadMarks(); }, [loadMarks]);

  const mark = async (studentIds: number[], status: AttendanceStatus) => {
    if (!groupId || blocked()) return;
    setSaving(studentIds.length > 1 ? "all" : studentIds[0]);
    const { error } = await supabase.from("attendance").upsert(studentIds.map((student_id) => ({ school_id: school.id, group_id: groupId, student_id, session_date: date, status })));
    setSaving(null);
    if (error) return notify(friendlyError(error, t.errors));
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
      downloadCSV(`${a.csvFile}-${group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`, [
        [t.common.student, ...dates.map((day) => formatDate(day)), a.csvRate],
        ...roster.map((student) => [student.full_name, ...dates.map((day) => { const status = byKey.get(`${student.id}|${day}`); return status ? LABELS[status] : ""; }), `${attendanceRate(student.id, group.id) ?? "—"}%`]),
      ]);
    } catch (error) {
      notify(friendlyError(error as { message: string }, t.errors));
    }
  };

  if (!usable.length) return <>
    <PageHeader eyebrow={a.eyebrow} title={a.title} description={a.shortDescription} />
    <Panel><EmptyState title={a.noGroups} text={a.noGroupsText} /></Panel>
  </>;

  const weekday = DAYS[new Date(`${date}T00:00:00`).getDay()];
  const counts = { P: 0, L: 0, A: 0, E: 0 } as Record<AttendanceStatus, number>;
  for (const student of roster) if (marks[student.id]) counts[marks[student.id]] += 1;
  const unmarked = roster.filter((student) => !marks[student.id]);

  return <>
    <PageHeader eyebrow={a.eyebrow} title={a.title} description={a.description} actionLabel={a.action} actionIcon="download" onAction={exportSheet} />
    <div className="attendance-controls">
      <div><label htmlFor="attendance-group">{a.group}</label><select id="attendance-group" className="select" value={groupId} onChange={(event) => setGroupId(Number(event.target.value))}>{usable.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label htmlFor="attendance-date">{a.date}</label><input id="attendance-date" className="select" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value || todayISO())} /></div>
      <div className="attendance-legend">{(Object.keys(LABELS) as AttendanceStatus[]).map((status) => <span key={status}><i className={`presence ${CLASSES[status]}`}>{SYMBOLS[status]}</i> {LABELS[status]} · {counts[status]}</span>)}</div>
    </div>
    <Panel className="table-panel attendance-panel">
      <div className="attendance-head">
        <div><h3>{group?.name}</h3><p>{formatDate(date, "long")} · {t.common.students(roster.length)}{group && !group.days.includes(weekday) ? a.warnDay(t.v.day[weekday]) : ""}</p></div>
        {unmarked.length > 0 && <Button variant="outline" icon="check" disabled={saving !== null} onClick={() => mark(unmarked.map((student) => student.id), "P")}>{a.markRest(unmarked.length)}</Button>}
        {roster.length > 0 && !unmarked.length && <Badge tone="success" dot>{a.complete}</Badge>}
      </div>
      {/* One block per student, with the four choices written out in full (validated). */}
      {roster.length ? <div className="roll-list">{roster.map((student) => {
        const rate = attendanceRate(student.id, groupId);
        return <div className="roll-card" key={student.id}>
          <div className="roll-who">{initialsBadge(student.full_name)}<div><strong>{student.full_name}</strong>
            <span>{marks[student.id] ? LABELS[marks[student.id]] : a.unmarked} · {a.colRate} : <b className={rate !== null && rate < 75 ? "text-danger" : ""}>{rate === null ? "—" : `${rate}%`}</b></span></div></div>
          <div className="roll-choices" role="group" aria-label={student.full_name}>{(Object.keys(LABELS) as AttendanceStatus[]).map((status) => <button type="button" key={status}
            className={`roll-choice ${CLASSES[status]} ${marks[student.id] === status ? "selected" : ""}`} aria-pressed={marks[student.id] === status}
            aria-label={`${student.full_name} : ${LABELS[status]}`} disabled={saving !== null}
            onClick={() => mark([student.id], status)}><span className="roll-symbol" aria-hidden="true">{SYMBOLS[status]}</span>{LABELS[status]}</button>)}</div>
        </div>;
      })}</div> : <EmptyState title={a.emptyRoster} text={a.emptyRosterText} />}
    </Panel>
    <p className="form-hint"><Icon name="lock" size={13} /> {a.hint}</p>
  </>;
}
