import type { PageKey } from "../auth";
import { label, useAppT } from "../appCopy";
import { useData } from "../data";
import { locale } from "../lang";
import { Badge, Button, COLORS, DAYS, EmptyState, Icon, MetricCard, PageHeader, Panel, formatDate, formatTime, initialsBadge, statusTone, todayISO } from "../ui";

export function Dashboard({ goTo, openStudent, firstName }: { goTo: (page: PageKey) => void; openStudent: (id: number) => void; firstName: string }) {
  const { students, enrollments, groups, payments, attendanceStats, courses, teachers, studentById, groupStudentIds, summaryOf, balanceOf, money, canEdit, isSoutien } = useData();
  const t = useAppT();
  const d = t.dash;
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

  // École de soutien: whose current month is not fully paid, and how the pupils spread over the levels.
  const monthlyRunning = activeEnrollments.filter((enrollment) => enrollment.monthly_fee != null);
  const unpaidMonth = monthlyRunning
    .map((enrollment) => ({ enrollment, student: studentById.get(enrollment.student_id), left: balanceOf(enrollment.id).balance, month: balanceOf(enrollment.id).monthsDue ?? 1 }))
    .filter((row) => row.left > 0)
    .sort((a, b) => b.left - a.left);
  const levels = [...new Set([...activeStudents].map((id) => studentById.get(id)?.level ?? "—"))]
    .map((level) => ({ level, count: [...activeStudents].filter((id) => (studentById.get(id)?.level ?? "—") === level).length }))
    .sort((a, b) => a.level.localeCompare(b.level));
  const so = t.so;
  const dateLabel = today.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // A school that has never enrolled anyone gets the setup list instead of empty panels.
  const setupPages: PageKey[] = ["formations", "teachers", "groups", "enrollments"];
  const setupDone = [courses.length > 0, teachers.length > 0, groups.length > 0, enrollments.length > 0];
  const setup = d.setupSteps.map((step, index) => ({ ...step, page: setupPages[index], done: setupDone[index] }));

  return <>
    <PageHeader eyebrow={dateLabel} title={d.hello(firstName)} description={d.intro} actionLabel={d.newEnrollment} onAction={() => goTo("enrollments")} />
    <div className="metrics-grid">
      <MetricCard label={d.activeStudents} value={String(activeStudents.size)} note={d.ofDirectory(students.length)} icon="graduation" accent={COLORS.teal} />
      {isSoutien
        ? <MetricCard label={so.dashUnpaid} value={String(unpaidMonth.length)} note={so.dashUnpaidNote(money(unpaidMonth.reduce((sum, row) => sum + row.left, 0)))} icon="wallet" accent={COLORS.red} />
        : <MetricCard label={d.activeEnrollments} value={String(activeEnrollments.length)} note={d.enrolledOrRunning} icon="file" accent="#5B8DEF" />}
      <MetricCard label={d.openGroups} value={String(openGroups.length)} note={d.onPlanning} icon="users" accent={COLORS.coral} />
      <MetricCard label={d.todayCourses} value={String(todayGroups.length)} note={d.scheduledOn(t.v.day[todayName])} icon="calendar" accent="#6A63B8" />
      <MetricCard label={d.avgAttendance} value={presentRate === null ? "—" : `${presentRate}%`} note={d.overSessions(sessions)} icon="checkCircle" accent={COLORS.green} />
      <MetricCard label={d.collected} value={money(collectedThisMonth)} note={d.withBalance(owing.length)} icon="wallet" accent={COLORS.yellow} />
    </div>
    {canEdit && !enrollments.length && <Panel title={d.setup} className="setup-panel">
      <p className="setup-intro">{d.setupIntro}</p>
      <ol className="setup-steps">{setup.map((step, index) => <li className={step.done ? "done" : ""} key={step.page}>
        <span className="setup-number">{step.done ? <Icon name="check" size={18} /> : index + 1}</span>
        <span className="setup-text"><strong>{step.label}</strong><span className="setup-hint">{step.hint}</span></span>
        {step.done ? <span className="setup-done">{d.done}</span> : <button className="setup-cta" onClick={() => goTo(step.page)}>{d.start} <Icon name="arrow" size={15} /></button>}
      </li>)}</ol>
    </Panel>}
    <div className="dashboard-grid top-grid">
      <Panel title={d.todayCourses} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("planning")}>{d.seePlanning}</Button>}>
        {todayGroups.length ? <div className="activity-list">{todayGroups.map((group) => <div className="activity-row" key={group.id}>
          <span className="activity-icon" style={{ background: `${group.color}18`, color: group.color }}><Icon name="calendar" size={15} /></span>
          <div><strong>{group.name}</strong><span>{formatTime(group.start_time)}–{formatTime(group.end_time)} · {group.room || t.common.noRoom}</span></div>
          <Badge tone="info">{groupStudentIds(group.id).length}/{group.capacity}</Badge>
        </div>)}</div> : <EmptyState title={d.emptyToday} text={d.emptyTodayText} />}
      </Panel>
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
    </div>
    <div className="dashboard-grid lower-grid">
      {isSoutien ? <Panel title={so.dashByLevel} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("students")}>{t.nav.students}</Button>}>
        {levels.length ? <div className="activity-list">{levels.map(({ level, count }) => <div className="activity-row" key={level}>
          <span className="activity-icon" style={{ background: COLORS.tealLight, color: COLORS.teal }}><Icon name="graduation" size={15} /></span>
          <div><strong>{level}</strong><span>{t.common.students(count)}</span></div>
          <div className="capacity-track level-track"><i style={{ width: `${Math.round((count / Math.max(1, activeStudents.size)) * 100)}%`, background: COLORS.teal }} /></div>
        </div>)}</div> : <EmptyState title={d.emptyEnrollments} text={d.emptyEnrollmentsText} />}
      </Panel> : <Panel title={d.recentEnrollments} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("enrollments")}>{d.allEnrollments}</Button>}>
        {enrollments.length ? <div className="activity-list">{[...enrollments].reverse().slice(0, 5).map((enrollment) => <div className="activity-row" key={enrollment.id} onClick={() => openStudent(enrollment.student_id)}>
          <span className="activity-icon" style={{ background: COLORS.tealLight, color: COLORS.teal }}><Icon name="check" size={15} /></span>
          <div><strong>{studentById.get(enrollment.student_id)?.full_name}</strong><span>{courseName(enrollment.course_id)} · {formatDate(enrollment.enrolled_on)}</span></div>
          <Badge tone={statusTone(enrollment.status)}>{label(t.v.status, enrollment.status)}</Badge>
        </div>)}</div> : <EmptyState title={d.emptyEnrollments} text={d.emptyEnrollmentsText} />}
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
      <Panel title={d.openGroups} action={<Button variant="ghost" icon="arrow" onClick={() => goTo("groups")}>{d.seeGroups}</Button>}>
        {openGroups.length ? <div className="activity-list">{openGroups.slice(0, 5).map((group) => {
          const count = groupStudentIds(group.id).length;
          const status = count >= group.capacity ? "Complet" : "Ouvert";
          return <div className="activity-row" key={group.id}>
            <span className="activity-icon" style={{ background: `${group.color}18`, color: group.color }}><Icon name="users" size={15} /></span>
            <div><strong>{group.name}</strong><span>{count}/{group.capacity} {t.common.student.toLowerCase()} · {group.days.map((day) => t.v.day[day]).join(" ") || t.common.noDays}</span></div>
            <Badge tone={statusTone(status)}>{label(t.v.status, status)}</Badge>
          </div>;
        })}</div> : <EmptyState title={d.emptyGroups} text={d.emptyGroupsText} />}
      </Panel>
    </div>
  </>;
}
