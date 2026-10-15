import { useState } from "react";
import { useAppT } from "../appCopy";
import { useData } from "../data";
import { locale } from "../lang";
import { reEnrollmentIds, teacherPay, totalPay } from "../lib/finance";
import { COLORS, MetricCard, PageHeader, Panel, percent, todayISO } from "../ui";

// One bar per month, zero line in the middle when there are losses. The value is in the hover title and in the table.
function BarChart({ bars, label }: { bars: { key: string; label: string; value: number | null; title: string }[]; label: string }) {
  const values = bars.map((bar) => bar.value ?? 0);
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const range = top - bottom || 1;
  const zero = top === 0 && bottom === 0 ? 100 : (top / range) * 100; // distance of the zero line from the top, in %
  return <div className="bar-chart" role="img" aria-label={label}>
    {bars.map((bar) => {
      const size = (Math.abs(bar.value ?? 0) / range) * 100;
      const negative = (bar.value ?? 0) < 0;
      return <div className="bar-col" key={bar.key} title={bar.title}>
        <div className="bar-area">
          <span className="bar-zero" style={{ top: `${zero}%` }} />
          {!!bar.value && <span className={`bar ${negative ? "negative" : ""}`} style={negative ? { top: `${zero}%`, height: `${size}%` } : { bottom: `${100 - zero}%`, height: `${size}%` }} />}
        </div>
        <span className="bar-label">{bar.label}</span>
      </div>;
    })}
  </div>;
}

export function Analytics() {
  const t = useAppT();
  const a = t.analytics;
  const { payments, enrollments, groups, teachers, courses, groupSessions, groupStudents, school, money } = useData();
  const thisMonth = todayISO().slice(0, 7);
  const years = [...new Set([thisMonth.slice(0, 4), ...payments.map((payment) => payment.paid_on.slice(0, 4)), ...enrollments.map((enrollment) => enrollment.enrolled_on.slice(0, 4))])].sort().reverse();
  const [year, setYear] = useState(years[0]);
  const [table, setTable] = useState(false);

  const again = reEnrollmentIds(enrollments);
  const payData = { groups, teachers, enrollments, courses, groupSessions, groupStudents, schoolSessions: school.sessions_per_month };
  // Months not reached yet stay empty rather than showing a zero.
  const monthStats = (month: string) => {
    if (month > thisMonth) return null;
    const collected = payments.filter((payment) => payment.paid_on.startsWith(month)).reduce((sum, payment) => sum + payment.amount, 0);
    const pay = totalPay(teacherPay(month, payData));
    const enrolled = enrollments.filter((enrollment) => enrollment.enrolled_on.startsWith(month));
    return { collected, pay, profit: collected - pay, enrollments: enrolled.length, again: enrolled.filter((enrollment) => again.has(enrollment.id)).length };
  };
  type Stats = NonNullable<ReturnType<typeof monthStats>>;
  const sum = (rows: (Stats | null)[]) => rows.reduce<Stats>((total, row) => row ? {
    collected: total.collected + row.collected, pay: total.pay + row.pay, profit: total.profit + row.profit, enrollments: total.enrollments + row.enrollments, again: total.again + row.again,
  } : total, { collected: 0, pay: 0, profit: 0, enrollments: 0, again: 0 });
  const monthsOf = (y: string) => Array.from({ length: 12 }, (_, index) => `${y}-${String(index + 1).padStart(2, "0")}`);
  const months = monthsOf(year).map((month) => ({ month, stats: monthStats(month) }));
  const totals = sum(months.map((row) => row.stats));
  const yearly = years.map((y) => ({ year: y, ...sum(monthsOf(y).map(monthStats)) }));
  const monthName = (month: string, style: "short" | "long") => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString(locale(), { month: style });

  return <>
    <PageHeader eyebrow={a.eyebrow} title={a.title} description={a.description}
      extra={<select className="select" aria-label={a.year} value={year} onChange={(event) => setYear(event.target.value)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>} />
    <div className="metrics-grid metrics-grid-4">
      <MetricCard label={a.collected} value={money(totals.collected)} note={a.collectedNote(year)} icon="wallet" accent={COLORS.teal} />
      <MetricCard label={a.pay} value={money(totals.pay)} note={a.payNote} icon="teacher" accent="#6A63B8" />
      <MetricCard label={a.profit} value={money(totals.profit)} note={a.profitNote} icon="spark" accent={totals.profit < 0 ? COLORS.red : COLORS.green} />
      <MetricCard label={a.again} value={String(totals.again)} note={a.againNote(percent(totals.again, totals.enrollments), totals.enrollments)} icon="users" accent={COLORS.yellow} />
    </div>
    <div className="dashboard-grid analytics-grid">
      <Panel title={`${a.profitChart} · ${year}`}>
        <BarChart label={a.profitChart} bars={months.map(({ month, stats }) => ({
          key: month, label: monthName(month, "short"), value: stats?.profit ?? null,
          title: stats ? `${monthName(month, "long")} : ${money(stats.collected)} − ${money(stats.pay)} = ${money(stats.profit)}` : monthName(month, "long"),
        }))} />
      </Panel>
      <Panel title={`${a.againChart} · ${year}`}>
        <BarChart label={a.againChart} bars={months.map(({ month, stats }) => ({
          key: month, label: monthName(month, "short"), value: stats?.again ?? null,
          title: stats ? `${monthName(month, "long")} : ${stats.again} / ${stats.enrollments}` : monthName(month, "long"),
        }))} />
      </Panel>
    </div>
    <Panel className="table-panel" title={year} action={<button className="text-button" onClick={() => setTable(!table)}>{table ? a.hideTable : a.showTable}</button>}>
      {table && <div className="table-scroll"><table>
        <thead><tr><th>{a.colMonth}</th><th>{a.colCollected}</th><th>{a.colPay}</th><th>{a.colProfit}</th><th>{a.colEnrollments}</th><th>{a.colAgain}</th></tr></thead>
        <tbody>{months.filter((row) => row.stats).map(({ month, stats }) => <tr key={month}>
          <td>{monthName(month, "long")}</td><td>{money(stats!.collected)}</td><td>{money(stats!.pay)}</td>
          <td className={stats!.profit < 0 ? "money-danger" : "money-ok"}>{money(stats!.profit)}</td><td>{stats!.enrollments}</td><td>{stats!.again}</td>
        </tr>)}</tbody>
      </table></div>}
    </Panel>
    <Panel className="table-panel" title={a.byYear}>
      <div className="table-scroll"><table>
        <thead><tr><th>{a.colYear}</th><th>{a.colCollected}</th><th>{a.colPay}</th><th>{a.colProfit}</th><th>{a.colEnrollments}</th><th>{a.colAgain}</th><th>{a.colRate}</th></tr></thead>
        <tbody>{yearly.map((row) => <tr key={row.year} onClick={() => setYear(row.year)}>
          <td><strong>{row.year}</strong></td><td>{money(row.collected)}</td><td>{money(row.pay)}</td>
          <td className={row.profit < 0 ? "money-danger" : "money-ok"}>{money(row.profit)}</td><td>{row.enrollments}</td><td>{row.again}</td><td>{percent(row.again, row.enrollments)}%</td>
        </tr>)}</tbody>
      </table></div>
      <p className="form-hint table-note">{a.hint}</p>
    </Panel>
  </>;
}
