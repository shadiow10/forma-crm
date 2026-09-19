import { useEffect, useState } from "react";
import { useData } from "../data";
import type { Payment } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, EmptyState, Icon, MetricCard, PageHeader, Panel, downloadCSV, formatDate, todayISO } from "../ui";
import { METHODS, PaymentForm } from "./forms";

export const receiptNumber = (payment: Payment) => `R-${payment.paid_on.slice(0, 4)}-${String(payment.id).padStart(6, "0")}`;

export function Payments({ openStudent }: { openStudent: (id: number) => void }) {
  const { payments, enrollments, studentById, courses, balanceOf, money, isDirector, save } = useData();
  const [tab, setTab] = useState<"history" | "unpaid">("history");
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

  const exportReport = () => tab === "history"
    ? downloadCSV(`paiements-${todayISO()}.csv`, [
      ["N° reçu", "Date", "Étudiant", "Formation", "Montant", "Mode"],
      ...filtered.map(({ payment, enrollment, student }) => [receiptNumber(payment), payment.paid_on, student?.full_name ?? "", courseName(enrollment?.course_id), payment.amount, payment.method]),
    ])
    : downloadCSV(`impayes-${todayISO()}.csv`, [
      ["Étudiant", "Téléphone", "Formation", "Total", "Versé", "Reste", "Dernier versement"],
      ...unpaid.map((row) => [row.student?.full_name ?? "", row.student?.phone ?? "", courseName(row.enrollment.course_id), row.enrollment.total, row.paid, row.balance, row.last ?? "Aucun"]),
    ]);
  const remove = (id: number, amount: number) => window.confirm(`Supprimer ce paiement de ${money(amount)} ? Le solde de l'inscription augmentera d'autant.`)
    && save(() => supabase.from("payments").delete().eq("id", id), "Paiement supprimé.");
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return <>
    <PageHeader eyebrow="Suivi financier" title="Paiements & finances" description="Encaissements, reçus et soldes à recouvrer, calculés à partir des inscriptions." actionLabel="Enregistrer un paiement" onAction={() => setRecording({})}
      extra={<Button variant="outline" icon="download" onClick={exportReport}>Exporter</Button>} />
    <div className="metrics-grid finance-metrics">
      <MetricCard label="Encaissé ce mois" value={money(thisMonth)} note={`${money(total)} encaissés au total`} icon="wallet" accent={COLORS.teal} />
      <MetricCard label="Solde à recouvrer" value={money(outstanding)} note={`${owing.length} inscription${owing.length > 1 ? "s" : ""} avec un reste à payer`} icon="clock" accent={COLORS.yellow} />
      <MetricCard label="Sans aucun versement" value={String(owing.filter((enrollment) => balanceOf(enrollment.id).paid === 0).length)} note="inscriptions à relancer en priorité" icon="warning" accent={COLORS.red} />
    </div>
    <Panel className="table-panel">
      <div className="toolbar">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Historique <span className="count-chip">{filtered.length}</span></button>
          <button role="tab" aria-selected={tab === "unpaid"} className={tab === "unpaid" ? "active" : ""} onClick={() => setTab("unpaid")}>Impayés <span className="count-chip">{owing.length}</span></button>
        </div>
        <div className="toolbar-right">
          <div className="search-box compact"><Icon name="search" size={16} /><input aria-label="Rechercher un étudiant" placeholder="Étudiant…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {tab === "history"
            ? <select className="select" aria-label="Mode de paiement" value={method} onChange={(event) => setMethod(event.target.value)}><option>Tous</option>{METHODS.map((item) => <option key={item}>{item}</option>)}</select>
            : <select className="select" aria-label="Trier" value={sort} onChange={(event) => setSort(event.target.value as "balance" | "last")}><option value="balance">Plus gros reste</option><option value="last">Plus ancien versement</option></select>}
        </div>
      </div>

      {tab === "history" ? <>
        <p className="muted-copy table-note">Total affiché : {money(filtered.reduce((sum, row) => sum + row.payment.amount, 0))}</p>
        <div className="table-scroll"><table>
          <thead><tr><th>N° reçu</th><th>Date</th><th>Étudiant</th><th>Formation</th><th>Montant</th><th>Mode</th><th /></tr></thead>
          <tbody>{filtered.map(({ payment, enrollment, student }) => <tr key={payment.id} onClick={() => student && openStudent(student.id)}>
            <td className="muted-cell">{receiptNumber(payment)}</td>
            <td>{formatDate(payment.paid_on)}</td>
            <td><strong>{student?.full_name ?? "—"}</strong></td>
            <td>{courseName(enrollment?.course_id)}</td>
            <td className="money-ok">{money(payment.amount)}</td>
            <td><Badge>{payment.method}</Badge></td>
            <td><span className="card-actions">
              <button className="row-menu" aria-label="Imprimer le reçu" title="Imprimer le reçu" onClick={(event) => { stop(event); setReceipt(payment); }}><Icon name="print" size={15} /></button>
              {isDirector && <button className="row-menu" aria-label="Supprimer le paiement" onClick={(event) => { stop(event); remove(payment.id, payment.amount); }}><Icon name="trash" size={15} /></button>}
            </span></td>
          </tr>)}</tbody>
        </table></div>
        {!filtered.length && <p className="table-empty">Aucun paiement à afficher.</p>}
      </> : unpaid.length ? <div className="table-scroll"><table>
        <thead><tr><th>Étudiant</th><th>Formation</th><th>Total</th><th>Versé</th><th>Reste</th><th>Dernier versement</th><th /></tr></thead>
        <tbody>{unpaid.map((row) => <tr key={row.enrollment.id} onClick={() => row.student && openStudent(row.student.id)}>
          <td><strong>{row.student?.full_name ?? "—"}</strong><span className="cell-sub">{row.student?.phone}</span></td>
          <td>{courseName(row.enrollment.course_id)}</td>
          <td>{money(row.enrollment.total)}</td>
          <td>{money(row.paid)}</td>
          <td className="money-due">{money(row.balance)}</td>
          <td>{row.last ? formatDate(row.last) : <Badge tone="danger">Aucun</Badge>}</td>
          <td onClick={stop}><Button variant="soft" onClick={() => setRecording({ enrollmentId: row.enrollment.id })}>Encaisser</Button></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState title={search ? "Aucun résultat" : "Tout est réglé"} text={search ? "Aucun impayé pour cette recherche." : "Aucune inscription active n'a de reste à payer."} />}
      <p className="form-hint table-note"><Icon name="lock" size={13} /> {isDirector ? "Vous pouvez supprimer un paiement saisi par erreur. Chaque suppression est notée dans le journal d'activité." : "Seul le directeur peut modifier ou supprimer un paiement."}</p>
    </Panel>
    {recording && <PaymentForm enrollmentId={recording.enrollmentId} onClose={() => setRecording(null)} />}
    {receipt && <Receipt payment={receipt} />}
  </>;
}

// Printed on the top half of an A4 sheet; hidden on screen.
function Receipt({ payment }: { payment: Payment }) {
  const { school, enrollments, studentById, courses, balanceOf, money, me } = useData();
  const enrollment = enrollments.find((item) => item.id === payment.enrollment_id);
  const student = enrollment ? studentById.get(enrollment.student_id) : undefined;
  const course = courses.find((item) => item.id === enrollment?.course_id);
  const { paid, balance } = enrollment ? balanceOf(enrollment.id) : { paid: 0, balance: 0 };
  return <div className="print-receipt">
    <header>
      <div><strong>{school.name}</strong><span>{[school.address, school.phone, school.email].filter(Boolean).join(" · ")}</span></div>
      <div className="receipt-number"><small>REÇU DE PAIEMENT</small><strong>N° {receiptNumber(payment)}</strong><span>Le {formatDate(payment.paid_on, "long")}</span></div>
    </header>
    <dl>
      <div><dt>Reçu de</dt><dd>{student?.full_name ?? "—"}</dd></div>
      <div><dt>Formation</dt><dd>{course?.name ?? "—"}</dd></div>
      <div><dt>Mode de paiement</dt><dd>{payment.method}</dd></div>
    </dl>
    <p className="receipt-amount"><span>Montant versé</span><strong>{money(payment.amount)}</strong></p>
    {enrollment && <table>
      <tbody>
        <tr><th>Prix de la formation</th><td>{money(enrollment.total)}</td></tr>
        <tr><th>Total versé à ce jour</th><td>{money(paid)}</td></tr>
        <tr><th>Reste à payer à ce jour</th><td>{money(balance)}</td></tr>
      </tbody>
    </table>}
    <footer><span>Imprimé le {formatDate(todayISO(), "long")}{me.full_name ? ` par ${me.full_name}` : ""}</span><div>Cachet et signature</div></footer>
  </div>;
}
