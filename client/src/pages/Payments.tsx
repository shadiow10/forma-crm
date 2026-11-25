import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { label as labelOf, useAppT } from "../appCopy";
import { useData } from "../data";
import { useShowMore } from "../appUI";
import { courseMonths, monthNumber, monthStatus, monthlyFee, teacherPay, totalPay } from "../lib/finance";
import type { Payment } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, EmptyState, Icon, MetricCard, PageHeader, Panel, RecordCard, RecordList, downloadCSV, formatDate, todayISO } from "../ui";
import { payRate } from "./Catalog";
import { METHODS, MultiPaymentForm, PaymentForm } from "./forms";

export const receiptNumber = (payment: Payment) => `R-${payment.paid_on.slice(0, 4)}-${String(payment.id).padStart(6, "0")}`;

// Which payments to print. Setting ids puts <Receipt> on the page, prints it, then takes it away.
// Shared by the payments page and the student profile.
export function usePrintReceipt() {
  const [receipt, setReceipt] = useState<number[] | null>(null);
  useEffect(() => {
    if (!receipt) return;
    const done = () => setReceipt(null);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [receipt]);
  return [receipt, setReceipt] as const;
}

export function Payments({ openStudent }: { openStudent: (id: number) => void }) {
  const t = useAppT();
  const p = t.payments;
  const { payments, enrollments, studentById, courses, groups, teachers, groupSessions, groupStudents, school, balanceOf, money, isDirector, isSoutien, save, ask } = useData();
  // An école de soutien opens on this month's fees: that is the question at the desk.
  const [tab, setTab] = useState<"history" | "unpaid" | "monthly" | "teachers">(isSoutien ? "monthly" : "history");
  const [recording, setRecording] = useState<{ enrollmentId?: number } | null>(null);
  const [receipt, setReceipt] = usePrintReceipt(); // payment ids printed on one sheet
  const [multi, setMulti] = useState(false);
  const [method, setMethod] = useState("Tous");
  const [sort, setSort] = useState<"balance" | "last">("balance");
  const [query, setQuery] = useState("");
  const month = todayISO().slice(0, 7);
  const search = query.trim().toLowerCase();


  const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
  const courseName = (id?: number) => courses.find((course) => course.id === id)?.name ?? "—";
  const rows = [...payments].reverse().map((payment) => {
    const enrollment = enrollmentById.get(payment.enrollment_id);
    return { payment, enrollment, student: enrollment ? studentById.get(enrollment.student_id) : undefined };
  });
  const filtered = rows.filter(({ payment, student }) => (method === "Tous" || payment.method === method) && (student?.full_name ?? "").toLowerCase().includes(search));

  const lastPaid = new Map<number, string>(); // payments are loaded oldest first
  for (const payment of payments) lastPaid.set(payment.enrollment_id, payment.paid_on);
  const owing = enrollments.filter((enrollment) => enrollment.status !== "Abandonné" && balanceOf(enrollment.id).balance > 0);
  const unpaid = owing
    .map((enrollment) => ({ enrollment, student: studentById.get(enrollment.student_id), ...balanceOf(enrollment.id), last: lastPaid.get(enrollment.id) }))
    .filter((row) => (row.student?.full_name ?? "").toLowerCase().includes(search))
    .sort((a, b) => sort === "balance" ? b.balance - a.balance : (a.last ?? a.enrollment.enrolled_on).localeCompare(b.last ?? b.enrollment.enrolled_on));
  const outstanding = owing.reduce((sum, enrollment) => sum + balanceOf(enrollment.id).balance, 0);
  const thisMonth = payments.filter((payment) => payment.paid_on.startsWith(month)).reduce((sum, payment) => sum + payment.amount, 0);
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  // Running enrollments split into monthly fees: what should be in by now, against what was paid.
  const monthly = enrollments
    .filter((enrollment) => enrollment.status === "Inscrit" || enrollment.status === "En cours")
    .map((enrollment) => {
      const course = courses.find((item) => item.id === enrollment.course_id);
      const fee = monthlyFee(enrollment, course);
      const { paid, monthsDue } = balanceOf(enrollment.id);
      // Monthly (soutien): open-ended, the current month is the last one started; total is what is owed so far.
      const months = monthsDue ?? courseMonths(course);
      const current = monthsDue ?? monthNumber(enrollment, month);
      const due = monthsDue !== null || current >= months ? enrollment.total : Math.min(enrollment.total, fee * current); // last month absorbs the rounding
      const state = monthStatus(fee, paid, Math.max(1, Math.min(current, months)));
      return { enrollment, student: studentById.get(enrollment.student_id), fee, months, current, due, paid, behind: Math.max(0, due - paid), monthly: monthsDue !== null, state };
    })
    .filter((row) => (row.student?.full_name ?? "").toLowerCase().includes(search))
    .sort((a, b) => b.behind - a.behind);
  // Pay needs the hourly rates, which only the director can read.
  const pay = isDirector ? teacherPay(month, { groups, teachers, enrollments, courses, groupSessions, groupStudents, schoolSessions: school.sessions_per_month }) : new Map() as ReturnType<typeof teacherPay>;
  const payRows = [...pay].map(([id, row]) => ({ teacher: teachers.find((item) => item.id === id)!, ...row })).sort((a, b) => b.amount - a.amount);
  const payTotal = totalPay(pay);

  const exportReport = () => tab === "history"
    ? downloadCSV(`paiements-${todayISO()}.csv`, [
      p.csvHistory,
      ...filtered.map(({ payment, enrollment, student }) => [receiptNumber(payment), payment.paid_on, student?.full_name ?? "", courseName(enrollment?.course_id), payment.amount, labelOf(t.v.method, payment.method)]),
    ])
    : tab === "unpaid" ? downloadCSV(`impayes-${todayISO()}.csv`, [
      p.csvUnpaid,
      ...unpaid.map((row) => [row.student?.full_name ?? "", row.student?.phone ?? "", courseName(row.enrollment.course_id), row.enrollment.total, row.paid, row.balance, row.last ?? p.noneYet]),
    ])
    : tab === "monthly" ? downloadCSV(`mensualites-${month}.csv`, [
      p.csvMonthly,
      ...monthly.map((row) => [row.student?.full_name ?? "", courseName(row.enrollment.course_id), row.fee, p.monthOf(row.current, row.months), row.due, row.paid, row.behind]),
    ])
    : downloadCSV(`paie-formateurs-${month}.csv`, [
      p.csvTeachers,
      ...payRows.map((row) => [row.teacher.full_name, row.groups.map((group) => group.name).join(", "), t.teachers.payModes[row.mode], row.hours, row.students, payRate(row.teacher, money, t), row.amount]),
    ]);
  const remove = async (id: number, amount: number) => {
    const sure = await ask({ title: p.deleteTitle(money(amount)), danger: true, confirmLabel: t.common.del, text: p.deleteText });
    if (sure) await save(() => supabase.from("payments").delete().eq("id", id), p.deleted);
  };
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  // Each tab's list shows 15 rows at a time.
  const moreHistory = useShowMore(filtered);
  const moreMonthly = useShowMore(monthly);
  const morePay = useShowMore(payRows);
  const moreUnpaid = useShowMore(unpaid);

  return <>
    <PageHeader eyebrow={p.eyebrow} title={p.title} description={p.description} actionLabel={p.action} onAction={() => setRecording({})}
      extra={<>
        <Button variant="outline" icon="download" onClick={exportReport}>{t.common.export}</Button>
        {isSoutien && <Button variant="soft" icon="wallet" onClick={() => setMulti(true)}>{t.so.multiAction}</Button>}
      </>} />
    <div className={`metrics-grid finance-metrics ${isDirector ? "five" : ""}`}>
      <MetricCard label={p.collected} value={money(thisMonth)} note={p.collectedNote(money(total))} icon="wallet" accent={COLORS.teal} highlight />
      {isDirector && <MetricCard label={p.teacherPay} value={money(payTotal)} note={p.teacherPayNote(pay.size)} icon="teacher" accent="#6A63B8" />}
      {isDirector && <MetricCard label={p.profit} value={money(thisMonth - payTotal)} note={p.profitNote} icon="spark" accent={thisMonth - payTotal < 0 ? COLORS.red : COLORS.green} />}
      <MetricCard label={p.outstanding} value={money(outstanding)} note={p.outstandingNote(owing.length)} icon="clock" accent={COLORS.yellow} />
      <MetricCard label={p.nothingPaid} value={String(owing.filter((enrollment) => balanceOf(enrollment.id).paid === 0).length)} note={p.nothingPaidNote} icon="warning" accent={COLORS.red} />
    </div>
    <Panel className="table-panel">
      <div className="toolbar">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>{p.tabHistory} <span className="count-chip">{filtered.length}</span></button>
          <button role="tab" aria-selected={tab === "unpaid"} className={tab === "unpaid" ? "active" : ""} onClick={() => setTab("unpaid")}>{p.tabUnpaid} <span className="count-chip">{owing.length}</span></button>
          <button role="tab" aria-selected={tab === "monthly"} className={tab === "monthly" ? "active" : ""} onClick={() => setTab("monthly")}>{isSoutien ? t.so.tabThisMonth : p.tabMonthly} <span className="count-chip">{monthly.filter((row) => row.behind > 0).length}</span></button>
          {isDirector && <button role="tab" aria-selected={tab === "teachers"} className={tab === "teachers" ? "active" : ""} onClick={() => setTab("teachers")}>{p.tabTeachers} <span className="count-chip">{pay.size}</span></button>}
        </div>
        <div className="toolbar-right">
          <div className="search-box compact"><Icon name="search" size={16} /><input aria-label={t.common.searchLabel} placeholder={`${t.common.student}…`} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {tab === "history"
            ? <select className="select" aria-label={p.methodLabel} value={method} onChange={(event) => setMethod(event.target.value)}><option value="Tous">{t.common.all}</option>{METHODS.map((item) => <option key={item} value={item}>{labelOf(t.v.method, item)}</option>)}</select>
            : tab === "unpaid" && <select className="select" aria-label={p.sortLabel} value={sort} onChange={(event) => setSort(event.target.value as "balance" | "last")}><option value="balance">{p.sortBalance}</option><option value="last">{p.sortLast}</option></select>}
        </div>
      </div>

      {tab === "history" ? <>
        <p className="muted-copy table-note">{p.shownTotal(money(filtered.reduce((sum, row) => sum + row.payment.amount, 0)))}</p>
        <RecordList label={p.tabHistory}>{moreHistory.visible.map(({ payment, enrollment, student }) => <RecordCard key={payment.id} title={student?.full_name ?? "—"}
          onOpen={student ? () => openStudent(student.id) : undefined} openLabel={t.simple.open}
          lines={[payment.month_no ? t.so.monthOf(payment.month_no, courseName(enrollment?.course_id)) : courseName(enrollment?.course_id), `${formatDate(payment.paid_on)} · ${receiptNumber(payment)}`]}
          status={<Badge>{labelOf(t.v.method, payment.method)}</Badge>}
          extra={<strong className="money-ok">{money(payment.amount)}</strong>}
          actions={<>
            <Button variant="outline" icon="print" onClick={() => setReceipt([payment.id])}>{p.printReceipt}</Button>
            {isDirector && <Button variant="danger" icon="trash" onClick={() => remove(payment.id, payment.amount)}>{p.deletePayment}</Button>}
          </>} />)}</RecordList>
        {moreHistory.button}
        {!filtered.length && <p className="table-empty">{p.emptyHistory}</p>}
      </> : tab === "monthly" ? monthly.length ? <>
        <p className="muted-copy table-note">{isSoutien ? t.so.sessionsHint : p.monthlyNote}</p>
        <RecordList label={isSoutien ? t.so.tabThisMonth : p.tabMonthly}>{moreMonthly.visible.map((row) => <RecordCard key={row.enrollment.id} title={row.student?.full_name ?? "—"}
          onOpen={row.student ? () => openStudent(row.student!.id) : undefined} openLabel={t.simple.open}
          lines={[`${courseName(row.enrollment.course_id)} · ${p.colMonthly} : ${money(row.fee)}`,
            row.monthly ? <>{t.so.month(row.current)} <Badge tone={row.state === "paid" ? "success" : row.state === "partly" ? "warning" : "danger"}>{row.state === "paid" ? t.so.paidOk : row.state === "partly" ? t.so.partly : t.so.notPaid}</Badge></> : p.monthOf(row.current, row.months),
            `${p.colDue} : ${money(row.due)} · ${t.common.paid} : ${money(row.paid)}`]}
          extra={row.behind ? <span className="record-amount"><small>{p.colBehind}</small><strong className="money-due">{money(row.behind)}</strong></span> : <Badge tone="success">{p.upToDate}</Badge>}
          actions={row.behind > 0 ? <Button variant="outline" icon="wallet" onClick={() => setRecording({ enrollmentId: row.enrollment.id })}>{p.collect}</Button> : undefined} />)}</RecordList>
        {moreMonthly.button}
      </> : <EmptyState title={search ? p.emptySearch : p.emptyMonthly} text={search ? "" : p.emptyMonthlyText} />
      : tab === "teachers" ? payRows.length ? <>
        <RecordList label={p.tabTeachers}>{morePay.visible.map((row) => <RecordCard key={row.teacher.id} title={row.teacher.full_name}
          lines={[`${labelOf(t.v.contract, row.teacher.contract)} · ${t.teachers.payModes[row.mode]}`, row.groups.map((group) => group.name).join(", "),
            row.mode === "student" ? `${t.common.students(row.students)} · ${t.groups.monthSessions} ${t.groups.sessionsOf(row.held, row.planned)}` : <>{row.hours} h · {payRate(row.teacher, money, t)}</>]}
          extra={<span className="record-amount"><small>{p.colPay}</small><strong>{money(row.amount)}</strong></span>} />)}</RecordList>
        {morePay.button}
        <p className="muted-copy table-note">{p.payHint}</p>
      </> : <EmptyState title={p.emptyTeachers} text={p.emptyTeachersText} />
      : unpaid.length ? <><RecordList label={p.tabUnpaid}>{moreUnpaid.visible.map((row) => <RecordCard key={row.enrollment.id} title={row.student?.full_name ?? "—"}
        onOpen={row.student ? () => openStudent(row.student!.id) : undefined} openLabel={t.simple.open}
        lines={[`${courseName(row.enrollment.course_id)} · ${row.student?.phone ?? ""}`, `${t.common.total} : ${money(row.enrollment.total)} · ${t.common.paid} : ${money(row.paid)}`,
          <>{p.colLast} : {row.last ? formatDate(row.last) : <Badge tone="danger">{p.noneYet}</Badge>}</>]}
        extra={<span className="record-amount"><small>{t.common.left}</small><strong className="money-due">{money(row.balance)}</strong></span>}
        actions={<Button variant="outline" icon="wallet" onClick={() => setRecording({ enrollmentId: row.enrollment.id })}>{p.collect}</Button>} />)}</RecordList>{moreUnpaid.button}</> : <EmptyState title={search ? p.emptySearch : p.allPaid} text={search ? p.emptySearchText : p.allPaidText} />}
      <p className="form-hint table-note"><Icon name="lock" size={13} /> {isDirector ? p.hintDirector : p.hintOther}</p>
    </Panel>
    {recording && <PaymentForm enrollmentId={recording.enrollmentId} onClose={() => setRecording(null)} />}
    {multi && <MultiPaymentForm onClose={() => setMulti(false)} onPaid={(ids) => setReceipt(ids)} />}
    {receipt && <Receipt paymentIds={receipt} />}
  </>;
}

// Printed on the top half of an A4 sheet; hidden on screen. Several payments (one desk visit,
// several subjects) share one sheet: one line each, the total underneath.
export function Receipt({ paymentIds }: { paymentIds: number[] }) {
  const t = useAppT();
  const r = t.payments.receipt;
  const { school, payments, enrollments, studentById, courses, balanceOf, money, me } = useData();
  const lines = payments.filter((payment) => paymentIds.includes(payment.id));
  if (!lines.length) return null;
  const payment = lines[0];
  const enrollmentOf = (item: Payment) => enrollments.find((enrollment) => enrollment.id === item.enrollment_id);
  const lineLabel = (item: Payment) => {
    const name = courses.find((course) => course.id === enrollmentOf(item)?.course_id)?.name ?? "—";
    return item.month_no ? t.so.monthOf(item.month_no, name) : name;
  };
  const enrollment = enrollmentOf(payment);
  const student = enrollment ? studentById.get(enrollment.student_id) : undefined;
  const { paid, balance } = enrollment ? balanceOf(enrollment.id) : { paid: 0, balance: 0 };
  // Straight under <body>, outside the app: printing shows this alone, on one page (index.css).
  return createPortal(<div className="print-receipt">
    <header>
      <div><strong>{school.name}</strong><span>{[school.address, school.phone, school.email].filter(Boolean).join(" · ")}</span></div>
      <div className="receipt-number"><small>{r.title}</small><strong>{r.number} {lines.map(receiptNumber).join(", ")}</strong><span>{r.on(formatDate(payment.paid_on, "long"))}</span></div>
    </header>
    <dl>
      <div><dt>{r.from}</dt><dd>{student?.full_name ?? "—"}</dd></div>
      {lines.length === 1
        ? <div><dt>{r.course}</dt><dd>{lineLabel(payment)}</dd></div>
        : lines.map((item) => <div key={item.id}><dt>{lineLabel(item)}</dt><dd>{money(item.amount)}</dd></div>)}
      <div><dt>{r.method}</dt><dd>{labelOf(t.v.method, payment.method)}</dd></div>
    </dl>
    <p className="receipt-amount"><span>{r.amount}</span><strong>{money(lines.reduce((sum, item) => sum + item.amount, 0))}</strong></p>
    {enrollment && lines.length === 1 && <table>
      <tbody>
        <tr><th>{r.price}</th><td>{money(enrollment.total)}</td></tr>
        <tr><th>{r.paidToDate}</th><td>{money(paid)}</td></tr>
        <tr><th>{r.leftToDate}</th><td>{money(balance)}</td></tr>
      </tbody>
    </table>}
    <footer><span>{r.printedOn(formatDate(todayISO(), "long"))}{me.full_name ? r.by(me.full_name) : ""}</span><div>{r.signature}</div></footer>
  </div>, document.body);
}
