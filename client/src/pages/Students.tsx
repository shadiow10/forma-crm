import { useState } from "react";
import { useData } from "../data";
import { Badge, COLORS, Icon, MetricCard, PageHeader, Panel, clampPercent, downloadCSV, formatDate, initialsBadge, statusTone } from "../ui";
import { EnrollmentForm, StudentForm } from "./forms";

const STATUS_FILTERS = ["Tous", "Inscrit", "En cours", "Terminé", "Abandonné", "Sans inscription"];
const matches = (query: string, ...values: (string | null | undefined)[]) => values.join(" ").toLowerCase().includes(query.trim().toLowerCase());

export function Students({ openStudent }: { openStudent: (id: number) => void }) {
  const { students, courses, summaryOf, money, groupById, teachers } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const [course, setCourse] = useState("Toutes");
  const [creating, setCreating] = useState(false);

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
    ["Nom", "Téléphone", "Email", "Statut", "Formation", "Présence", "Payé", "Reste"],
    ...filtered.map(({ student, summary }) => [student.full_name, student.phone, student.email, summary.status, courseName(summary.latest?.course_id), summary.attendance === null ? "" : `${summary.attendance}%`, summary.paid, summary.balance]),
  ]);

  return <>
    <PageHeader eyebrow="Annuaire du centre" title="Étudiants" description="Gérez les étudiants, leurs inscriptions et leur suivi au sein du centre." actionLabel="Nouvel étudiant" onAction={() => setCreating(true)} />
    <div className="metrics-grid metrics-grid-4">
      <MetricCard label="Étudiants" value={String(students.length)} note="dans l'annuaire" icon="users" accent={COLORS.teal} />
      <MetricCard label="En cours" value={String(rows.filter(({ summary }) => summary.status === "En cours").length)} note="formations commencées" icon="graduation" accent="#5B8DEF" />
      <MetricCard label="Terminés" value={String(rows.filter(({ summary }) => summary.status === "Terminé").length)} note="formations achevées" icon="checkCircle" accent={COLORS.green} />
      <MetricCard label="À surveiller" value={String(rows.filter(({ summary }) => summary.attendance !== null && summary.attendance < 75).length)} note="présence sous 75%" icon="warning" accent={COLORS.coral} />
    </div>
    <Panel className="table-panel">
      <div className="filter-bar student-filter-bar">
        <div className="student-filter-main">
          <div className="search-box"><Icon name="search" size={16} /><input aria-label="Rechercher un étudiant" placeholder="Rechercher un étudiant…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <select className="select" aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value)}>{STATUS_FILTERS.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="select" aria-label="Formation" value={course} onChange={(event) => setCourse(event.target.value)}><option value="Toutes">Toutes les formations</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </div>
        <button className="text-button" onClick={exportList}><Icon name="download" size={14} /> Exporter</button>
      </div>
      <div className="table-scroll"><table>
        <thead><tr><th>Étudiant</th><th>Statut</th><th>Formation</th><th>Présence</th><th>Paiement</th><th>Reste</th><th>Formateur</th></tr></thead>
        <tbody>{filtered.map(({ student, summary }) => {
          const low = summary.attendance !== null && summary.attendance < 75;
          return <tr key={student.id} onClick={() => openStudent(student.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openStudent(student.id)}>
            <td><div className="person-cell">{initialsBadge(student.full_name)}<div><strong>{student.full_name}</strong><span>{student.phone}{student.email ? ` · ${student.email}` : ""}</span></div></div></td>
            <td><Badge tone={statusTone(summary.status)} dot>{summary.status}</Badge></td>
            <td>{courseName(summary.latest?.course_id)}</td>
            <td><div className="inline-progress"><span className={low ? "low" : ""}>{summary.attendance === null ? "—" : `${summary.attendance}%`}</span><div><i style={{ width: `${clampPercent(summary.attendance ?? 0)}%`, background: low ? COLORS.red : COLORS.teal }} /></div></div></td>
            <td><Badge tone={statusTone(summary.paymentStatus)}>{summary.paymentStatus}</Badge></td>
            <td className={summary.balance ? "money-danger" : "money-ok"}>{money(summary.balance)}</td>
            <td>{teacherOf(summary.latest?.group_id) ?? "À affecter"}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {!filtered.length && <p className="table-empty">{students.length ? "Aucun étudiant ne correspond à ces filtres." : "Aucun étudiant pour l'instant. Cliquez sur « Nouvel étudiant »."}</p>}
      <div className="table-footer"><span>{filtered.length} étudiant{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}</span></div>
    </Panel>
    {creating && <StudentForm onClose={() => setCreating(false)} onSaved={openStudent} />}
  </>;
}

export function Enrollments({ openStudent }: { openStudent: (id: number) => void }) {
  const { enrollments, studentById, courses, groupById, balanceOf, money } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const [creating, setCreating] = useState(false);
  const courseName = (id: number) => courses.find((course) => course.id === id)?.name ?? "—";
  const rows = [...enrollments].reverse().map((enrollment) => ({ enrollment, student: studentById.get(enrollment.student_id), ...balanceOf(enrollment.id) }));
  const filtered = rows.filter(({ enrollment, student }) => matches(query, student?.full_name, courseName(enrollment.course_id)) && (status === "Tous" || enrollment.status === status));
  const active = enrollments.filter((enrollment) => enrollment.status === "Inscrit" || enrollment.status === "En cours");

  return <>
    <PageHeader eyebrow="Gestion des dossiers" title="Inscriptions" description="Une inscription associe un étudiant à une formation et à un groupe." actionLabel="Nouvelle inscription" onAction={() => setCreating(true)} />
    <div className="metrics-grid metrics-grid-4">
      <MetricCard label="Inscriptions actives" value={String(active.length)} note="inscrits ou en cours" icon="file" accent={COLORS.teal} />
      <MetricCard label="En cours" value={String(enrollments.filter((enrollment) => enrollment.status === "En cours").length)} note="formations commencées" icon="graduation" accent="#5B8DEF" />
      <MetricCard label="Terminées" value={String(enrollments.filter((enrollment) => enrollment.status === "Terminé").length)} note="certificats possibles" icon="checkCircle" accent={COLORS.green} />
      <MetricCard label="Solde restant" value={money(active.reduce((sum, enrollment) => sum + balanceOf(enrollment.id).balance, 0))} note="sur les inscriptions actives" icon="wallet" accent={COLORS.yellow} />
    </div>
    <Panel className="table-panel" title="Dossiers d'inscription" action={<div className="toolbar-right">
      <select className="select" aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value)}>{["Tous", "Inscrit", "En cours", "Terminé", "Abandonné"].map((item) => <option key={item}>{item}</option>)}</select>
      <div className="search-box compact"><Icon name="search" size={16} /><input aria-label="Rechercher" placeholder="Rechercher…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    </div>}>
      <div className="table-scroll"><table>
        <thead><tr><th>Étudiant</th><th>Formation</th><th>Groupe</th><th>Statut</th><th>Date</th><th>Total</th><th>Reste</th></tr></thead>
        <tbody>{filtered.map(({ enrollment, student, balance }) => <tr key={enrollment.id} onClick={() => openStudent(enrollment.student_id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openStudent(enrollment.student_id)}>
          <td><div className="person-cell">{initialsBadge(student?.full_name ?? "?")}<div><strong>{student?.full_name ?? "—"}</strong><span>{student?.phone}</span></div></div></td>
          <td>{courseName(enrollment.course_id)}</td>
          <td>{enrollment.group_id ? groupById.get(enrollment.group_id)?.name : "Sans groupe"}</td>
          <td><Badge tone={statusTone(enrollment.status)} dot>{enrollment.status}</Badge></td>
          <td>{formatDate(enrollment.enrolled_on)}</td>
          <td>{money(enrollment.total)}</td>
          <td className={balance ? "money-danger" : "money-ok"}>{money(balance)}</td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && <p className="table-empty">Aucune inscription à afficher.</p>}
      <div className="table-footer"><span>{filtered.length} inscription{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}</span></div>
    </Panel>
    {creating && <EnrollmentForm onClose={() => setCreating(false)} />}
  </>;
}
