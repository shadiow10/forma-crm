import type { PageKey } from "../auth";
import { label, useAppT } from "../appCopy";
import { useData } from "../data";
import { locale } from "../lang";
import type { IconName } from "../ui";
import { Badge, Button, COLORS, tint, DAYS, EmptyState, Icon, MetricCard, Panel, formatDate, formatTime, initialsBadge, todayISO } from "../ui";

export function Dashboard({ goTo, openStudent }: { goTo: (page: PageKey) => void; openStudent: (id: number) => void }) {
  const { students, enrollments, groups, payments, attendanceStats, courses, teachers, studentById, groupStudentIds, summaryOf, balanceOf, money, canEdit, isSoutien } = useData();
  const t = useAppT();
  const d = t.dash;
  const today = new Date();
  const todayName = DAYS[today.getDay()];
  const monthPrefix = todayISO().slice(0, 7);

  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === "Inscrit" || enrollment.status === "En cours");
  const openGroups = groups.filter((group) => group.status !== "Annulé");
  const todayGroups = openGroups.filter((group) => group.days.includes(todayName)).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const sessions = attendanceStats.reduce((sum, stat) => sum + stat.sessions - (stat.excused ?? 0), 0);
  const presentRate = sessions ? Math.round((attendanceStats.reduce((sum, stat) => sum + stat.present + stat.late, 0) / sessions) * 100) : null;
  const owing = activeEnrollments.filter((enrollment) => balanceOf(enrollment.id).balance > 0);
  const collectedThisMonth = payments.filter((payment) => payment.paid_on.startsWith(monthPrefix)).reduce((sum, payment) => sum + payment.amount, 0);
  const watchList = students.map((student) => ({ student, rate: summaryOf(student.id).attendance })).filter((row) => row.rate !== null && row.rate < 75).sort((a, b) => a.rate! - b.rate!).slice(0, 5);
  const courseName = (id: number) => courses.find((course) => course.id === id)?.name ?? "—";

  // École de soutien: whose current month is not fully paid, and how the pupils spread over the levels.
  const monthlyRunning = activeEnrollments.filter((enrollment) => enrollment.monthly_fee != null);
  const unpaidMonth = monthlyRunning
    .map((enrollment) => ({ enrollment, student: studentById.get(enrollment.student_id), left: balanceOf(enrollment.id).balance, month: balanceOf(enrollment.id).monthsDue ?? 1 }))
    .filter((row) => row.left > 0)
    .sort((a, b) => b.left - a.left);
  const so = t.so;
  const dateLabel = today.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // A school that has never enrolled anyone gets the setup list instead of empty panels.
  const setupPages: PageKey[] = ["formations", "teachers", "groups", "enrollments"];
  const setupDone = [courses.length > 0, teachers.length > 0, groups.length > 0, enrollments.length > 0];
  const setup = d.setupSteps.map((step, index) => ({ ...step, page: setupPages[index], done: setupDone[index] }));

  return <>
    {/* No "Bonjour" title (removed at the user's request): the date, one sentence, then the tasks. */}
    <div className="page-header home-header"><div><div className="eyebrow">{dateLabel}</div><p>{d.intro}</p></div></div>
    {/* "What would you like to do?" (validated): the four everyday tasks as big buttons, first thing on the page. */}
    <section className="home-tasks" aria-labelledby="home-tasks-title">
      <h1 id="home-tasks-title">{t.simple.question}</h1>
      <div className="task-grid">
        {([
          { label: t.simple.enrol, icon: "plus", page: "enrollments" },
          { label: t.simple.attendance, icon: "check", page: "attendance" },
          { label: t.simple.collect, icon: "wallet", page: "payments" },
          { label: d.seePlanning, icon: "calendar", page: "planning" },
        ] as { label: string; icon: IconName; page: PageKey }[]).map((task) => <button type="button" className="task-button" key={task.page} onClick={() => goTo(task.page)}>
          <span className="task-icon"><Icon name={task.icon} size={26} /></span><span>{task.label}</span>
        </button>)}
      </div>
    </section>
    {/* Three figures (redesign): what came in this month, how well pupils attend, what happens today.
        The others stay on their own pages (Students, Enrollments, Groups). */}
    <div className="metrics-grid home-metrics">
      <MetricCard label={d.collected} value={money(collectedThisMonth)} note={d.withBalance(owing.length)} icon="wallet" highlight />
      <MetricCard label={d.avgAttendance} value={presentRate === null ? "—" : `${presentRate}%`} note={d.overSessions(sessions)} icon="checkCircle" />
      <MetricCard label={d.todayCourses} value={String(todayGroups.length)} note={d.scheduledOn(t.v.day[todayName])} icon="calendar" />
    </div>
    {canEdit && !enrollments.length && <Panel title={d.setup} className="setup-panel">
      <p className="setup-intro">{d.setupIntro}</p>
      <ol className="setup-steps">{setup.map((step, index) => <li className={step.done ? "done" : ""} key={step.page}>
        <span className="setup-number">{step.done ? <Icon name="check" size={18} /> : index + 1}</span>
        <span className="setup-text"><strong>{step.label}</strong><span className="setup-hint">{step.hint}</span></span>
        {step.done ? <span className="setup-done">{d.done}</span> : <button className="setup-cta" onClick={() => goTo(step.page)}>{d.start} <Icon name="arrow" size={15} /></button>}
      </li>)}</ol>
    </Panel>}
    <div className="home-today">
      <Panel title={d.todayCourses} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("planning")}>{d.seePlanning}</Button>}>
        {todayGroups.length ? <div className="activity-list">{todayGroups.map((group) => <div className="activity-row" key={group.id}>
          <span className="activity-icon" style={{ color: tint(group.color) }}><Icon name="calendar" size={15} /></span>
          <div><strong>{group.name}</strong><span>{formatTime(group.start_time)}–{formatTime(group.end_time)} · {group.room || t.common.noRoom}</span></div>
          <Badge tone="info">{groupStudentIds(group.id).length}/{group.capacity}</Badge>
        </div>)}</div> : <EmptyState title={d.emptyToday} text={d.emptyTodayText} />}
      </Panel>
    </div>
    <div className="dashboard-grid home-pair">
      {isSoutien ? <Panel title={so.dashUnpaidList} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("payments")}>{d.seePayments}</Button>}>
        {unpaidMonth.length ? <div className="risk-list">{unpaidMonth.slice(0, 6).map(({ enrollment, student, left, month }) => <div className="risk-row" key={enrollment.id} onClick={() => student && openStudent(student.id)}>
          <div>{initialsBadge(student?.full_name ?? "?")}</div>
          <div className="task-copy"><strong>{student?.full_name ?? "—"}</strong><span>{so.monthOf(month, courseName(enrollment.course_id))} · {student?.parent_phone ?? student?.phone}</span></div>
          <div className="risk-score">{money(left)}<span>{so.notPaid}</span></div>
          <Icon name="chevron" size={16} />
        </div>)}</div> : <EmptyState title={so.dashAllPaid} text={so.dashAllPaidText} />}
      </Panel> : <Panel title={d.watch} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("attendance")}>{d.openAttendance}</Button>}>
        {watchList.length ? <div className="risk-list">{watchList.map(({ student, rate }) => <div className="risk-row" key={student.id} onClick={() => openStudent(student.id)}>
          <div>{initialsBadge(student.full_name)}</div>
          <div className="task-copy"><strong>{student.full_name}</strong><span>{student.phone}</span></div>
          <div className="risk-score">{rate}%<span>{d.attendanceWord}</span></div>
          <Icon name="chevron" size={16} />
        </div>)}</div> : <EmptyState title={d.emptyWatch} text={d.emptyWatchText} />}
      </Panel>}
      <Panel title={d.recentPayments} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("payments")}>{d.seePayments}</Button>}>
        {payments.length ? <div className="activity-list">{[...payments].reverse().slice(0, 5).map((payment) => {
          const enrollment = enrollments.find((item) => item.id === payment.enrollment_id);
          return <div className="activity-row" key={payment.id}>
            <span className="activity-icon" style={{ background: "var(--warn-bg)", color: COLORS.yellow }}><Icon name="wallet" size={15} /></span>
            <div><strong>{enrollment ? studentById.get(enrollment.student_id)?.full_name : "—"}</strong><span>{money(payment.amount)} · {formatDate(payment.paid_on)}</span></div>
            <Badge>{label(t.v.method, payment.method)}</Badge>
          </div>;
        })}</div> : <EmptyState title={d.emptyPayments} text={d.emptyPaymentsText} />}
      </Panel>
    </div>
  </>;
}
