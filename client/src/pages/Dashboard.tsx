import type { PageKey } from "../auth";
import { useData } from "../data";
import { Badge, Button, COLORS, DAYS, EmptyState, Icon, MetricCard, PageHeader, Panel, formatDate, formatTime, initialsBadge, statusTone, todayISO } from "../ui";

export function Dashboard({ goTo, openStudent, firstName }: { goTo: (page: PageKey) => void; openStudent: (id: number) => void; firstName: string }) {
  const { students, enrollments, groups, payments, attendanceStats, courses, teachers, studentById, groupStudentIds, summaryOf, balanceOf, money, canEdit } = useData();
  const today = new Date();
  const todayName = DAYS[today.getDay()];
  const monthPrefix = todayISO().slice(0, 7);

  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === "Inscrit" || enrollment.status === "En cours");
  const activeStudents = new Set(activeEnrollments.map((enrollment) => enrollment.student_id));
  const openGroups = groups.filter((group) => group.status !== "Annulé");
  const todayGroups = openGroups.filter((group) => group.days.includes(todayName)).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const sessions = attendanceStats.reduce((sum, stat) => sum + stat.sessions, 0);
  const presentRate = sessions ? Math.round((attendanceStats.reduce((sum, stat) => sum + stat.present + stat.late, 0) / sessions) * 100) : null;
  const owing = activeEnrollments.filter((enrollment) => balanceOf(enrollment.id).balance > 0);
  const collectedThisMonth = payments.filter((payment) => payment.paid_on.startsWith(monthPrefix)).reduce((sum, payment) => sum + payment.amount, 0);
  const watchList = students.map((student) => ({ student, rate: summaryOf(student.id).attendance })).filter((row) => row.rate !== null && row.rate < 75).sort((a, b) => a.rate! - b.rate!).slice(0, 5);
  const courseName = (id: number) => courses.find((course) => course.id === id)?.name ?? "—";
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // A school that has never enrolled anyone gets the setup list instead of empty panels.
  const setup: { label: string; hint: string; page: PageKey; done: boolean }[] = [
    { label: "Ajoutez vos formations", hint: "Intitulé, durée et prix", page: "formations", done: courses.length > 0 },
    { label: "Ajoutez vos formateurs", hint: "Qui enseigne quoi", page: "teachers", done: teachers.length > 0 },
    { label: "Créez vos groupes", hint: "Horaires, salle et formateur", page: "groups", done: groups.length > 0 },
    { label: "Inscrivez vos étudiants", hint: "Fiche, formation et premier versement", page: "enrollments", done: enrollments.length > 0 },
  ];

  return <>
    <PageHeader eyebrow={dateLabel} title={`Bonjour ${firstName},`} description="Voici ce qui se passe dans votre centre aujourd'hui." actionLabel="Nouvelle inscription" onAction={() => goTo("enrollments")} />
    <div className="metrics-grid">
      <MetricCard label="Étudiants actifs" value={String(activeStudents.size)} note={`sur ${students.length} dans l'annuaire`} icon="graduation" accent={COLORS.teal} />
      <MetricCard label="Inscriptions actives" value={String(activeEnrollments.length)} note="inscrites ou en cours" icon="file" accent="#5B8DEF" />
      <MetricCard label="Groupes ouverts" value={String(openGroups.length)} note="sur le planning" icon="users" accent={COLORS.coral} />
      <MetricCard label="Cours aujourd'hui" value={String(todayGroups.length)} note={`groupes programmés le ${todayName.toLowerCase()}.`} icon="calendar" accent="#6A63B8" />
      <MetricCard label="Présence moyenne" value={presentRate === null ? "—" : `${presentRate}%`} note={`sur ${sessions} présences notées`} icon="checkCircle" accent={COLORS.green} />
      <MetricCard label="Encaissé ce mois" value={money(collectedThisMonth)} note={`${owing.length} dossier${owing.length > 1 ? "s" : ""} avec un solde`} icon="wallet" accent={COLORS.yellow} />
    </div>
    {canEdit && !enrollments.length && <Panel title="Premiers pas" className="setup-panel">
      <p className="setup-intro">Quatre étapes pour que votre école tourne. Vous pourrez inviter votre équipe ensuite, dans Paramètres.</p>
      <ol className="setup-steps">{setup.map((step, index) => <li className={step.done ? "done" : ""} key={step.page}>
        <span className="setup-number">{step.done ? <Icon name="check" size={18} /> : index + 1}</span>
        <span className="setup-text"><strong>{step.label}</strong><span className="setup-hint">{step.hint}</span></span>
        {step.done ? <span className="setup-done">Fait</span> : <button className="setup-cta" onClick={() => goTo(step.page)}>Commencer <Icon name="arrow" size={15} /></button>}
      </li>)}</ol>
    </Panel>}
    <div className="dashboard-grid top-grid">
      <Panel title="Cours aujourd'hui" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("planning")}>Voir le planning</Button>}>
        {todayGroups.length ? <div className="activity-list">{todayGroups.map((group) => <div className="activity-row" key={group.id}>
          <span className="activity-icon" style={{ background: `${group.color}18`, color: group.color }}><Icon name="calendar" size={15} /></span>
          <div><strong>{group.name}</strong><span>{formatTime(group.start_time)}–{formatTime(group.end_time)} · {group.room || "Salle à définir"}</span></div>
          <Badge tone="info">{groupStudentIds(group.id).length}/{group.capacity}</Badge>
        </div>)}</div> : <EmptyState title="Aucun cours aujourd'hui" text="Les groupes programmés ce jour apparaîtront ici." />}
      </Panel>
      <Panel title="Présence à surveiller" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("attendance")}>Ouvrir les présences</Button>}>
        {watchList.length ? <div className="risk-list">{watchList.map(({ student, rate }) => <div className="risk-row" key={student.id} onClick={() => openStudent(student.id)}>
          <div>{initialsBadge(student.full_name)}</div>
          <div className="task-copy"><strong>{student.full_name}</strong><span>{student.phone}</span></div>
          <div className="risk-score">{rate}%<span>présence</span></div>
          <Icon name="chevron" size={16} stroke={COLORS.muted} />
        </div>)}</div> : <EmptyState title="Rien à signaler" text="Aucun étudiant sous 75 % de présence." />}
      </Panel>
    </div>
    <div className="dashboard-grid lower-grid">
      <Panel title="Inscriptions récentes" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("enrollments")}>Toutes les inscriptions</Button>}>
        {enrollments.length ? <div className="activity-list">{[...enrollments].reverse().slice(0, 5).map((enrollment) => <div className="activity-row" key={enrollment.id} onClick={() => openStudent(enrollment.student_id)}>
          <span className="activity-icon" style={{ background: COLORS.tealLight, color: COLORS.teal }}><Icon name="check" size={15} /></span>
          <div><strong>{studentById.get(enrollment.student_id)?.full_name}</strong><span>{courseName(enrollment.course_id)} · {formatDate(enrollment.enrolled_on)}</span></div>
          <Badge tone={statusTone(enrollment.status)}>{enrollment.status}</Badge>
        </div>)}</div> : <EmptyState title="Aucune inscription" text="Les nouvelles inscriptions apparaîtront ici." />}
      </Panel>
      <Panel title="Paiements récents" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("payments")}>Voir les paiements</Button>}>
        {payments.length ? <div className="activity-list">{[...payments].reverse().slice(0, 5).map((payment) => {
          const enrollment = enrollments.find((item) => item.id === payment.enrollment_id);
          return <div className="activity-row" key={payment.id}>
            <span className="activity-icon" style={{ background: `${COLORS.yellow}18`, color: COLORS.yellow }}><Icon name="wallet" size={15} /></span>
            <div><strong>{enrollment ? studentById.get(enrollment.student_id)?.full_name : "—"}</strong><span>{money(payment.amount)} · {formatDate(payment.paid_on)}</span></div>
            <Badge>{payment.method}</Badge>
          </div>;
        })}</div> : <EmptyState title="Aucun paiement" text="Les encaissements apparaîtront ici." />}
      </Panel>
      <Panel title="Groupes ouverts" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("groups")}>Voir les groupes</Button>}>
        {openGroups.length ? <div className="activity-list">{openGroups.slice(0, 5).map((group) => {
          const count = groupStudentIds(group.id).length;
          const status = count >= group.capacity ? "Complet" : "Ouvert";
          return <div className="activity-row" key={group.id}>
            <span className="activity-icon" style={{ background: `${group.color}18`, color: group.color }}><Icon name="users" size={15} /></span>
            <div><strong>{group.name}</strong><span>{count}/{group.capacity} étudiants · {group.days.join(" ") || "jours à définir"}</span></div>
            <Badge tone={statusTone(status)}>{status}</Badge>
          </div>;
        })}</div> : <EmptyState title="Aucun groupe" text="Créez un groupe dans la page Groupes." />}
      </Panel>
    </div>
  </>;
}
