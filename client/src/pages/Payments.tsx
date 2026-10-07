import { useEffect, useState } from "react";
import { label as labelOf, useAppT } from "../appCopy";
import { useData } from "../data";
import { courseMonths, monthNumber, monthlyFee, teacherPay, totalPay } from "../lib/finance";
import type { Payment } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, EmptyState, Icon, MetricCard, PageHeader, Panel, downloadCSV, formatDate, todayISO } from "../ui";
import { METHODS, PaymentForm } from "./forms";

export const receiptNumber = (payment: Payment) => `R-${payment.paid_on.slice(0, 4)}-${String(payment.id).padStart(6, "0")}`;

export function Payments({ openStudent }: { openStudent: (id: number) => void }) {
  const t = useAppT();
  const p = t.payments;
  const { payments, enrollments, studentById, courses, groups, teachers, balanceOf, money, isDirector, save, ask } = useData();
  const [tab, setTab] = useState<"history" | "unpaid" | "monthly" | "teachers">("history");
  const [recording, setRecording] = useState<{ enrollmentId?: number } | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [method, setMethod] = useState("Tous");
  const [sort, setSort] = useState<"balance" | "last">("balance");
  const [query, setQuery] = useState("");
  const month = todayISO().slice(0, 7);
  const search = query.trim().toLowerCase();

  // Print the receipt once it is on the page, then take it away.
  useEffect(() => {
    if (!receipt) return;
    const done = () => setReceipt(null);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [receipt]);

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
      const months = courseMonths(course);
      const current = monthNumber(enrollment, month);
      const fee = monthlyFee(enrollment, course);
      const due = current >= months ? enrollment.total : Math.min(enrollment.total, fee * current); // last month absorbs the rounding
      const { paid } = balanceOf(enrollment.id);
      return { enrollment, student: studentById.get(enrollment.student_id), fee, months, current, due, paid, behind: Math.max(0, due - paid) };
    })
    .filter((row) => (row.student?.full_name ?? "").toLowerCase().includes(search))
    .sort((a, b) => b.behind - a.behind);
  // Pay needs the hourly rates, which only the director can read.
  const pay = isDirector ? teacherPay(month, { groups, teachers, enrollments, courses }) : new Map() as ReturnType<typeof teacherPay>;
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
      ...payRows.map((row) => [row.teacher.full_name, row.groups.map((group) => group.name).join(", "), row.hours, row.teacher.hourly_rate, row.amount]),
    ]);
  const remove = async (id: number, amount: number) => {
    const sure = await ask({ title: p.deleteTitle(money(amount)), danger: true, confirmLabel: t.common.del, text: p.deleteText });
    if (sure) await save(() => supabase.from("payments").delete().eq("id", id), p.deleted);
  };
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return <>
    <PageHeader eyebrow={p.eyebrow} title={p.title} description={p.description} actionLabel={p.action} onAction={() => setRecording({})}
      extra={<Button variant="outline" icon="download" onClick={exportReport}>{t.common.export}</Button>} />
    <div className={`metrics-grid finance-metrics ${isDirector ? "five" : ""}`}>
      <MetricCard label={p.collected} value={money(thisMonth)} note={p.collectedNote(money(total))} icon="wallet" accent={COLORS.teal} />
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
          <button role="tab" aria-selected={tab === "monthly"} className={tab === "monthly" ? "active" : ""} onClick={() => setTab("monthly")}>{p.tabMonthly} <span className="count-chip">{monthly.filter((row) => row.behind > 0).length}</span></button>
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
        <div className="table-scroll"><table>
          <thead><tr><th>{p.colReceipt}</th><th>{t.common.date}</th><th>{t.common.student}</th><th>{t.common.course}</th><th>{p.colAmount}</th><th>{p.colMethod}</th><th /></tr></thead>
          <tbody>{filtered.map(({ payment, enrollment, student }) => <tr key={payment.id} onClick={() => student && openStudent(student.id)}>
            <td className="muted-cell">{receiptNumber(payment)}</td>
            <td>{formatDate(payment.paid_on)}</td>
            <td><strong>{student?.full_name ?? "—"}</strong></td>
            <td>{courseName(enrollment?.course_id)}</td>
            <td className="money-ok">{money(payment.amount)}</td>
            <td><Badge>{labelOf(t.v.method, payment.method)}</Badge></td>
            <td><span className="card-actions">
              <button className="row-menu" aria-label={p.printReceipt} title={p.printReceipt} onClick={(event) => { stop(event); setReceipt(payment); }}><Icon name="print" size={15} /></button>
              {isDirector && <button className="row-menu" aria-label={p.deletePayment} onClick={(event) => { stop(event); remove(payment.id, payment.amount); }}><Icon name="trash" size={15} /></button>}
            </span></td>
          </tr>)}</tbody>
        </table></div>
        {!filtered.length && <p className="table-empty">{p.emptyHistory}</p>}
      </> : tab === "monthly" ? monthly.length ? <>
        <p className="muted-copy table-note">{p.monthlyNote}</p>
        <div className="table-scroll"><table>
          <thead><tr><th>{t.common.student}</th><th>{t.common.course}</th><th>{p.colMonthly}</th><th>{p.colMonth}</th><th>{p.colDue}</th><th>{t.common.paid}</th><th>{p.colBehind}</th></tr></thead>
          <tbody>{monthly.map((row) => <tr key={row.enrollment.id} onClick={() => row.student && openStudent(row.student.id)}>
            <td><strong>{row.student?.full_name ?? "—"}</strong><span className="cell-sub">{row.student?.phone}</span></td>
            <td>{courseName(row.enrollment.course_id)}</td>
            <td><strong>{money(row.fee)}</strong></td>
            <td>{p.monthOf(row.current, row.months)}</td>
            <td>{money(row.due)}</td>
            <td>{money(row.paid)}</td>
            <td>{row.behind ? <span className="money-due">{money(row.behind)}</span> : <Badge tone="success">{p.upToDate}</Badge>}</td>
          </tr>)}</tbody>
        </table></div>
      </> : <EmptyState title={search ? p.emptySearch : p.emptyMonthly} text={search ? "" : p.emptyMonthlyText} />
      : tab === "teachers" ? payRows.length ? <>
        <div className="table-scroll"><table>
          <thead><tr><th>{t.common.teacher}</th><th>{p.colGroups}</th><th>{p.colHours}</th><th>{p.colRate}</th><th>{p.colPay}</th></tr></thead>
          <tbody>{payRows.map((row) => <tr key={row.teacher.id}>
            <td><strong>{row.teacher.full_name}</strong><span className="cell-sub">{labelOf(t.v.contract, row.teacher.contract)}</span></td>
            <td>{row.groups.map((group) => group.name).join(", ")}</td>
            <td>{row.hours} h</td>
            <td>{money(row.teacher.hourly_rate ?? 0)}</td>
            <td><strong>{money(row.amount)}</strong></td>
          </tr>)}</tbody>
        </table></div>
        <p className="muted-copy table-note">{p.payHint}</p>
      </> : <EmptyState title={p.emptyTeachers} text={p.emptyTeachersText} />
      : unpaid.length ? <div className="table-scroll"><table>
        <thead><tr><th>{t.common.student}</th><th>{t.common.course}</th><th>{t.common.total}</th><th>{t.common.paid}</th><th>{t.common.left}</th><th>{p.colLast}</th><th /></tr></thead>
        <tbody>{unpaid.map((row) => <tr key={row.enrollment.id} onClick={() => row.student && openStudent(row.student.id)}>
          <td><strong>{row.student?.full_name ?? "—"}</strong><span className="cell-sub">{row.student?.phone}</span></td>
          <td>{courseName(row.enrollment.course_id)}</td>
          <td>{money(row.enrollment.total)}</td>
          <td>{money(row.paid)}</td>
          <td className="money-due">{money(row.balance)}</td>
          <td>{row.last ? formatDate(row.last) : <Badge tone="danger">{p.noneYet}</Badge>}</td>
          <td onClick={stop}><Button variant="soft" onClick={() => setRecording({ enrollmentId: row.enrollment.id })}>{p.collect}</Button></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState title={search ? p.emptySearch : p.allPaid} text={search ? p.emptySearchText : p.allPaidText} />}
      <p className="form-hint table-note"><Icon name="lock" size={13} /> {isDirector ? p.hintDirector : p.hintOther}</p>
    </Panel>
    {recording && <PaymentForm enrollmentId={recording.enrollmentId} onClose={() => setRecording(null)} />}
    {receipt && <Receipt payment={receipt} />}
  </>;
}

// Printed on the top half of an A4 sheet; hidden on screen.
function Receipt({ payment }: { payment: Payment }) {
  const t = useAppT();
  const r = t.payments.receipt;
  const { school, enrollments, studentById, courses, balanceOf, money, me } = useData();
  const enrollment = enrollments.find((item) => item.id === payment.enrollment_id);
  const student = enrollment ? studentById.get(enrollment.student_id) : undefined;
  const course = courses.find((item) => item.id === enrollment?.course_id);
  const { paid, balance } = enrollment ? balanceOf(enrollment.id) : { paid: 0, balance: 0 };
  return <div className="print-receipt">
    <header>
      <div><strong>{school.name}</strong><span>{[school.address, school.phone, school.email].filter(Boolean).join(" · ")}</span></div>
      <div className="receipt-number"><small>{r.title}</small><strong>{r.number} {receiptNumber(payment)}</strong><span>{r.on(formatDate(payment.paid_on, "long"))}</span></div>
    </header>
    <dl>
      <div><dt>{r.from}</dt><dd>{student?.full_name ?? "—"}</dd></div>
      <div><dt>{r.course}</dt><dd>{course?.name ?? "—"}</dd></div>
      <div><dt>{r.method}</dt><dd>{labelOf(t.v.method, payment.method)}</dd></div>
    </dl>
    <p className="receipt-amount"><span>{r.amount}</span><strong>{money(payment.amount)}</strong></p>
    {enrollment && <table>
      <tbody>
        <tr><th>{r.price}</th><td>{money(enrollment.total)}</td></tr>
        <tr><th>{r.paidToDate}</th><td>{money(paid)}</td></tr>
        <tr><th>{r.leftToDate}</th><td>{money(balance)}</td></tr>
      </tbody>
    </table>}
    <footer><span>{r.printedOn(formatDate(todayISO(), "long"))}{me.full_name ? r.by(me.full_name) : ""}</span><div>{r.signature}</div></footer>
  </div>;
}
