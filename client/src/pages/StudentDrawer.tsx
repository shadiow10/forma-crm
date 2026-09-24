import { useCallback, useEffect, useState } from "react";
import { friendlyError, useData } from "../data";
import type { EnrollmentStatus } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, Drawer, EmptyState, Icon, formatDate, initials, statusTone } from "../ui";
import { EnrollmentForm, PaymentForm, StudentForm } from "./forms";

type DocumentRow = { id: number; type: string; file_path: string; status: "Validé" | "À vérifier"; created_at: string };
type NoteRow = { id: number; body: string; created_at: string };
const DOCUMENT_TYPES = ["Carte d'identité", "Photo d'identité", "Diplôme / justificatif", "Contrat", "Autre"];
const STATUSES: EnrollmentStatus[] = ["Inscrit", "En cours", "Terminé", "Abandonné"];
const BUCKET = "student-documents";

// Magic bytes for the three formats the bucket accepts. A file's real type is its first few bytes,
// not the Content-Type its uploader chose. ponytail: signature check only, no full parse — enough to
// stop a renamed executable; a genuinely malformed PDF is the PDF reader's problem, not ours.
const SIGNATURES: Record<string, string[]> = {
  "application/pdf": ["25504446"],              // %PDF
  "image/jpeg": ["ffd8ff"],                     // SOI marker
  "image/png": ["89504e470d0a1a0a"],            // PNG signature
};
async function looksLikeItsType(file: File) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const hex = [...head].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return (SIGNATURES[file.type] ?? []).some((signature) => hex.startsWith(signature));
}

export function StudentDrawer({ studentId, onClose }: { studentId: number; onClose: () => void }) {
  const store = useData();
  const { studentById, summaryOf, courses, groupById, payments, money, save, notify, isDirector, school, balanceOf, attendanceRate, blocked, ask } = store;
  const student = studentById.get(studentId);
  const [form, setForm] = useState<"edit" | "enroll" | "pay" | null>(null);
  const [payFor, setPayFor] = useState<number>();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [note, setNote] = useState("");
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [uploading, setUploading] = useState(false);

  const loadExtras = useCallback(async () => {
    const [docs, notesResult] = await Promise.all([
      supabase.from("student_documents").select("id, type, file_path, status, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
      supabase.from("student_notes").select("id, body, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
    ]);
    if (docs.error || notesResult.error) notify(friendlyError((docs.error ?? notesResult.error)!));
    setDocuments((docs.data ?? []) as DocumentRow[]);
    setNotes((notesResult.data ?? []) as NoteRow[]);
  }, [studentId, notify]);
  useEffect(() => { void loadExtras(); }, [loadExtras]);

  if (!student) return null; // deleted meanwhile
  const summary = summaryOf(student.id);
  const studentPayments = payments.filter((payment) => summary.enrollments.some((enrollment) => enrollment.id === payment.enrollment_id)).reverse();
  const courseName = (id: number) => courses.find((course) => course.id === id)?.name ?? "Formation supprimée";

  const upload = async (file: File | undefined) => {
    if (!file || blocked()) return;
    if (file.size > 5 * 1024 * 1024) return notify("Fichier trop lourd : 5 Mo maximum.");
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return notify("Formats acceptés : PDF, JPG ou PNG.");
    // file.type is the label the browser was told to send, and the bucket's allowed_mime_types
    // checks that same label — so renaming an executable to .pdf passes both. Read the first bytes
    // and require them to match what the file claims to be.
    if (!(await looksLikeItsType(file))) return notify("Ce fichier ne correspond pas à un PDF, JPG ou PNG valide.");
    setUploading(true);
    const path = `${school.id}/${student.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const stored = await supabase.storage.from(BUCKET).upload(path, file);
    if (stored.error) { setUploading(false); return notify(`Envoi impossible : ${stored.error.message}`); }
    const { error } = await supabase.from("student_documents").insert({ school_id: school.id, student_id: student.id, type: docType, file_path: path });
    if (error) await supabase.storage.from(BUCKET).remove([path]);
    setUploading(false);
    notify(error ? friendlyError(error) : "Document ajouté.");
    void loadExtras();
  };
  const openDocument = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
    if (error || !data) return notify("Document introuvable.");
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const deleteDocument = async (doc: DocumentRow) => {
    if (blocked() || !(await ask({ title: "Supprimer ce document ?", text: `« ${doc.type} » sera définitivement retiré du dossier.`, confirmLabel: "Supprimer", danger: true }))) return;
    const { error } = await supabase.from("student_documents").delete().eq("id", doc.id);
    if (!error) await supabase.storage.from(BUCKET).remove([doc.file_path]);
    notify(error ? friendlyError(error) : "Document supprimé.");
    void loadExtras();
  };
  const setDocStatus = async (doc: DocumentRow) => {
    if (blocked()) return;
    const { error } = await supabase.from("student_documents").update({ status: doc.status === "Validé" ? "À vérifier" : "Validé" }).eq("id", doc.id);
    if (error) notify(friendlyError(error));
    void loadExtras();
  };
  const addNote = async () => {
    if (!note.trim() || blocked()) return;
    const { error } = await supabase.from("student_notes").insert({ school_id: school.id, student_id: student.id, body: note.trim() });
    if (error) return notify(friendlyError(error));
    setNote("");
    notify("Note ajoutée.");
    void loadExtras();
  };
  const deleteStudent = async () => {
    const sure = await ask({ title: `Supprimer ${student.full_name} ?`, danger: true, confirmLabel: "Supprimer définitivement",
      text: "Ses inscriptions, paiements, présences et documents seront supprimés en même temps. Cette action est définitive." });
    if (!sure) return;
    const paths = documents.map((doc) => doc.file_path);
    if (await save(() => supabase.from("students").delete().eq("id", student.id), `${student.full_name} a été supprimé(e).`)) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      onClose();
    }
  };

  return <>
    <Drawer title={student.full_name} eyebrow="FICHE ÉTUDIANT" onClose={onClose}>
    <div className="profile-hero">
      <span className="profile-avatar large">{initials(student.full_name)}</span>
      <div><h2>{student.full_name}</h2><div className="profile-subline"><span>{student.phone}</span><Badge tone={statusTone(summary.status)} dot>{summary.status}</Badge></div></div>
      <div className="action-stack"><Button variant="outline" icon="edit" onClick={() => setForm("edit")}>Modifier</Button>{isDirector && <Button variant="danger" icon="trash" onClick={deleteStudent}>Supprimer</Button>}</div>
    </div>

    <div className="profile-summary-grid">
      <div><span>Présence</span><strong>{summary.attendance === null ? "—" : `${summary.attendance}%`}</strong><small>{summary.attendance === null ? "aucune séance notée" : "séances présentes ou en retard"}</small></div>
      <div><span>Payé</span><strong>{money(summary.paid)}</strong><small>{money(summary.balance)} restant</small></div>
      <div><span>Inscriptions</span><strong>{summary.enrollments.length}</strong><small>au total</small></div>
      <div><span>Paiement</span><strong>{summary.paymentStatus}</strong><small>sur les inscriptions actives</small></div>
    </div>

    <div className="drawer-section profile-section">
      <h4>Informations personnelles</h4>
      <div className="info-grid">
        <div><span>Téléphone</span><strong>{student.phone}</strong></div>
        <div><span>Email</span><strong>{student.email || "Non renseigné"}</strong></div>
        <div><span>Date de naissance</span><strong>{formatDate(student.dob, "long")}</strong></div>
        <div><span>Adresse</span><strong>{student.address || "Non renseignée"}</strong></div>
        <div><span>Source</span><strong>{student.source || "—"}</strong></div>
        <div><span>Fiche créée le</span><strong>{formatDate(student.created_at, "long")}</strong></div>
      </div>
    </div>

    <div className="drawer-section profile-section">
      <div className="drawer-section-head"><div><h4>Inscriptions</h4><span className="section-caption">Une fiche peut contenir plusieurs inscriptions.</span></div><Button icon="plus" onClick={() => setForm("enroll")}>Nouvelle inscription</Button></div>
      {summary.enrollments.length ? <div className="registration-list">{[...summary.enrollments].reverse().map((enrollment) => {
        const { paid, balance } = balanceOf(enrollment.id);
        const group = enrollment.group_id ? groupById.get(enrollment.group_id) : undefined;
        const rate = group ? attendanceRate(student.id, group.id) : null;
        return <div className="registration-card" key={enrollment.id}>
          <div className="registration-card-head">
            <div><strong>{courseName(enrollment.course_id)}</strong><span>{group ? group.name : "Sans groupe"}{rate !== null ? ` · présence ${rate}%` : ""}</span></div>
            <select className="compact-select" aria-label="Statut de l'inscription" value={enrollment.status} onChange={(event) => save(() => supabase.from("enrollments").update({ status: event.target.value }).eq("id", enrollment.id), "Statut mis à jour.")}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div className="registration-meta">
            <span>Inscrit le <strong>{formatDate(enrollment.enrolled_on)}</strong></span>
            <span>Total <strong>{money(enrollment.total)}</strong></span>
            <span>Payé <strong>{money(paid)}</strong></span>
            <span>Restant <strong className={balance > 0 ? "money-danger" : "money-ok"}>{money(balance)}</strong></span>
          </div>
          {enrollment.notes && <p className="muted-copy">{enrollment.notes}</p>}
          {balance > 0 && enrollment.status !== "Abandonné" && <Button variant="soft" icon="wallet" onClick={() => { setPayFor(enrollment.id); setForm("pay"); }}>Encaisser</Button>}
        </div>;
      })}</div> : <EmptyState title="Aucune inscription" text="Créez une inscription pour associer une formation et un groupe." />}
    </div>

    <div className="drawer-section profile-section">
      <h4>Paiements</h4>
      {studentPayments.length ? <div className="document-list">{studentPayments.map((payment) => <div className="document-row" key={payment.id}>
        <span className="document-icon"><Icon name="wallet" size={16} /></span>
        <div><strong>{money(payment.amount)}</strong><span>{formatDate(payment.paid_on)} · {payment.method} · {courseName(summary.enrollments.find((enrollment) => enrollment.id === payment.enrollment_id)!.course_id)}</span></div>
      </div>)}</div> : <EmptyState title="Aucun paiement" text="Les versements enregistrés apparaîtront ici." />}
    </div>

    <div className="drawer-section profile-section">
      <div className="drawer-section-head"><div><h4>Documents</h4><span className="section-caption">PDF, JPG ou PNG · 5 Mo maximum</span></div>
        <div className="doc-upload">
          <select className="compact-select" aria-label="Type de document" value={docType} onChange={(event) => setDocType(event.target.value)}>{DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
          <label className="button upload-button"><Icon name="upload" size={15} />{uploading ? "Envoi…" : "Ajouter"}<input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
        </div>
      </div>
      {documents.length ? <div className="document-list">{documents.map((doc) => <div className="document-row" key={doc.id}>
        <span className="document-icon"><Icon name="file" size={16} /></span>
        <div><strong>{doc.type}</strong><span>{doc.file_path.split("/").pop()?.replace(/^\d+-/, "")} · ajouté le {formatDate(doc.created_at)}</span></div>
        <button className="badge-button" onClick={() => setDocStatus(doc)} title="Changer le statut"><Badge tone={doc.status === "Validé" ? "success" : "warning"}>{doc.status}</Badge></button>
        <button className="text-button" onClick={() => openDocument(doc)}>Voir</button>
        <button className="row-menu" onClick={() => deleteDocument(doc)} aria-label="Supprimer le document"><Icon name="trash" size={15} /></button>
      </div>)}</div> : <EmptyState title="Aucun document" text="Ajoutez la carte d'identité ou un justificatif." />}
    </div>

    <div className="drawer-section">
      <h4>Notes</h4>
      <textarea className="field textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Écrivez une note sur cet étudiant…" />
      <div className="drawer-note-footer"><span>Visible par l'équipe administrative</span><Button icon="check" disabled={!note.trim()} onClick={addNote}>Ajouter la note</Button></div>
      {notes.map((item) => <div className="note-row" key={item.id}><span>{formatDate(item.created_at)}</span><p>{item.body}</p></div>)}
    </div>

  </Drawer>
    {form === "edit" && <StudentForm student={student} onClose={() => setForm(null)} />}
    {form === "enroll" && <EnrollmentForm studentId={student.id} onClose={() => setForm(null)} />}
    {form === "pay" && <PaymentForm enrollmentId={payFor} onClose={() => setForm(null)} />}
  </>;
}
