import { useState } from "react";
import { useData } from "../data";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, EmptyState, Icon, MetricCard, PageHeader, Panel, downloadCSV, formatDate, todayISO } from "../ui";
import { METHODS, PaymentForm } from "./forms";

export function Payments({ openStudent }: { openStudent: (id: number) => void }) {
  const { payments, enrollments, studentById, courses, balanceOf, money, isDirector, save } = useData();
  const [recording, setRecording] = useState<{ enrollmentId?: number } | null>(null);
  const [method, setMethod] = useState("Tous");
  const [query, setQuery] = useState("");
  const month = todayISO().slice(0, 7);

  const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));
  const courseName = (id?: number) => courses.find((course) => course.id === id)?.name ?? "—";
  const rows = [...payments].reverse().map((payment) => {
    const enrollment = enrollmentById.get(payment.enrollment_id);
    return { payment, enrollment, student: enrollment ? studentById.get(enrollment.student_id) : undefined };
  });
  const filtered = rows.filter(({ payment, student }) => (method === "Tous" || payment.method === method) && (student?.full_name ?? "").toLowerCase().includes(query.trim().toLowerCase()));
  const owing = enrollments.filter((enrollment) => enrollment.status !== "Abandonné" && balanceOf(enrollment.id).balance > 0)
    .sort((a, b) => balanceOf(b.id).balance - balanceOf(a.id).balance);
  const outstanding = owing.reduce((sum, enrollment) => sum + balanceOf(enrollment.id).balance, 0);
  const thisMonth = payments.filter((payment) => payment.paid_on.startsWith(month)).reduce((sum, payment) => sum + payment.amount, 0);
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  const exportReport = () => downloadCSV(`paiements-${todayISO()}.csv`, [
    ["Date", "Étudiant", "Formation", "Montant", "Mode"],
    ...filtered.map(({ payment, enrollment, student }) => [payment.paid_on, student?.full_name ?? "", courseName(enrollment?.course_id), payment.amount, payment.method]),
  ]);
  const remove = (id: number, amount: number) => window.confirm(`Supprimer ce paiement de ${money(amount)} ? Le solde de l'inscription augmentera d'autant.`)
    && save(() => supabase.from("payments").delete().eq("id", id), "Paiement supprimé.");

  return <>
    <PageHeader eyebrow="Suivi financier" title="Paiements & finances" description="Encaissements et soldes à recouvrer, calculés à partir des inscriptions." actionLabel="Enregistrer un paiement" onAction={() => setRecording({})}
      extra={<Button variant="outline" icon="download" onClick={exportReport}>Exporter</Button>} />
    <div className="metrics-grid finance-metrics">
      <MetricCard label="Encaissé ce mois" value={money(thisMonth)} note={`${money(total)} encaissés au total`} icon="wallet" accent={COLORS.teal} />
      <MetricCard label="Solde à recouvrer" value={money(outstanding)} note={`${owing.length} inscription${owing.length > 1 ? "s" : ""} avec un reste à payer`} icon="clock" accent={COLORS.yellow} />
      <MetricCard label="Sans aucun versement" value={String(owing.filter((enrollment) => balanceOf(enrollment.id).paid === 0).length)} note="inscriptions à relancer en priorité" icon="warning" accent={COLORS.red} />
    </div>
    <div className="two-column-layout">
      <Panel className="table-panel">
        <div className="toolbar">
          <div><h3 className="inline-title">Historique des paiements <span className="count-chip">{filtered.length}</span></h3><p className="muted-copy">Total affiché : {money(filtered.reduce((sum, row) => sum + row.payment.amount, 0))}</p></div>
          <div className="toolbar-right">
            <div className="search-box compact"><Icon name="search" size={16} /><input aria-label="Rechercher un étudiant" placeholder="Étudiant…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <select className="select" aria-label="Mode de paiement" value={method} onChange={(event) => setMethod(event.target.value)}><option>Tous</option>{METHODS.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </div>
        <div className="table-scroll"><table>
          <thead><tr><th>Date</th><th>Étudiant</th><th>Formation</th><th>Montant</th><th>Mode</th>{isDirector && <th />}</tr></thead>
          <tbody>{filtered.map(({ payment, enrollment, student }) => <tr key={payment.id} onClick={() => student && openStudent(student.id)}>
            <td>{formatDate(payment.paid_on)}</td>
            <td><strong>{student?.full_name ?? "—"}</strong></td>
            <td>{courseName(enrollment?.course_id)}</td>
            <td className="money-ok">{money(payment.amount)}</td>
            <td><Badge>{payment.method}</Badge></td>
            {isDirector && <td><button className="row-menu" aria-label="Supprimer le paiement" onClick={(event) => { event.stopPropagation(); remove(payment.id, payment.amount); }}><Icon name="trash" size={15} /></button></td>}
          </tr>)}</tbody>
        </table></div>
        {!filtered.length && <p className="table-empty">Aucun paiement à afficher.</p>}
      </Panel>
      <Panel title="Soldes à recouvrer">
        {owing.length ? <div className="activity-list">{owing.slice(0, 12).map((enrollment) => {
          const student = studentById.get(enrollment.student_id);
          const { paid, balance } = balanceOf(enrollment.id);
          return <div className="activity-row" key={enrollment.id}>
            <span className="activity-icon" style={{ background: paid ? `${COLORS.yellow}18` : "#FDE8E8", color: paid ? COLORS.yellow : COLORS.red }}><Icon name="wallet" size={15} /></span>
            <div><strong>{student?.full_name}</strong><span>{courseName(enrollment.course_id)} · reste {money(balance)}</span></div>
            <Button variant="soft" onClick={() => setRecording({ enrollmentId: enrollment.id })}>Encaisser</Button>
          </div>;
        })}</div> : <EmptyState title="Tout est réglé" text="Aucune inscription active n'a de reste à payer." />}
        {owing.length > 12 && <p className="muted-copy">+ {owing.length - 12} autres. Exportez l'historique ou filtrez la page Inscriptions.</p>}
        <p className="form-hint"><Icon name="lock" size={13} /> {isDirector ? "Vous pouvez supprimer un paiement saisi par erreur." : "Seul le directeur peut modifier ou supprimer un paiement."}</p>
      </Panel>
    </div>
    {recording && <PaymentForm enrollmentId={recording.enrollmentId} onClose={() => setRecording(null)} />}
  </>;
}
