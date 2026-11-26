import { useCallback, useEffect, useState } from "react";
import { label as labelOf, useAppT } from "../appCopy";
import { friendlyError, useData } from "../data";
import type { EnrollmentStatus } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Drawer, ShowMore } from "../appUI";
import { Badge, Button, EmptyState, Icon, formatDate, initials, statusTone } from "../ui";
import { EnrollmentForm, PaymentForm, StudentForm } from "./forms";
import { Receipt, usePrintReceipt } from "./Payments";
import { StudentCardDialog, shrinkImage, useSignedUrl } from "./StudentCard";

type DocumentRow = { id: number; type: string; file_path: string; status: "Validé" | "À vérifier"; created_at: string };
type NoteRow = { id: number; body: string; created_at: string };
// Stored values, shown through the copy.
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
  const t = useAppT();
  const f = t.student;
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
  const [receipt, printReceipt] = usePrintReceipt();
  const [card, setCard] = useState(false);
  const closeCard = useCallback(() => setCard(false), []);
  const photo = useSignedUrl(studentById.get(studentId)?.photo_path);

  const loadExtras = useCallback(async () => {
    const [docs, notesResult] = await Promise.all([
      supabase.from("student_documents").select("id, type, file_path, status, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
      supabase.from("student_notes").select("id, body, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
    ]);
    if (docs.error || notesResult.error) notify(friendlyError((docs.error ?? notesResult.error)!, t.errors));
    setDocuments((docs.data ?? []) as DocumentRow[]);
    setNotes((notesResult.data ?? []) as NoteRow[]);
  }, [studentId, notify, t]);
  useEffect(() => { void loadExtras(); }, [loadExtras]);

  if (!student) return null; // deleted meanwhile
  const summary = summaryOf(student.id);
  const studentPayments = payments.filter((payment) => summary.enrollments.some((enrollment) => enrollment.id === payment.enrollment_id)).reverse();
  const courseName = (id: number) => courses.find((course) => course.id === id)?.name ?? f.deletedCourse;

  const upload = async (file: File | undefined) => {
    if (!file || blocked()) return;
    if (file.size > 5 * 1024 * 1024) return notify(f.tooBig);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return notify(f.badFormat);
    // file.type is the label the browser was told to send, and the bucket's allowed_mime_types
    // checks that same label, so renaming an executable to .pdf passes both. Read the first bytes
    // and require them to match what the file claims to be.
    if (!(await looksLikeItsType(file))) return notify(f.notThatType);
    setUploading(true);
    const path = `${school.id}/${student.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const stored = await supabase.storage.from(BUCKET).upload(path, file);
    if (stored.error) { setUploading(false); return notify(f.uploadFailed(stored.error.message)); }
    const { error } = await supabase.from("student_documents").insert({ school_id: school.id, student_id: student.id, type: docType, file_path: path });
    if (error) await supabase.storage.from(BUCKET).remove([path]);
    setUploading(false);
    notify(error ? friendlyError(error, t.errors) : f.docAdded);
    void loadExtras();
  };
  const openDocument = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
    if (error || !data) return notify(f.docMissing);
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const deleteDocument = async (doc: DocumentRow) => {
    if (blocked() || !(await ask({ title: f.deleteDocTitle, text: f.deleteDocText(labelOf(t.v.docType, doc.type)), confirmLabel: t.common.del, danger: true }))) return;
    const { error } = await supabase.from("student_documents").delete().eq("id", doc.id);
    if (!error) await supabase.storage.from(BUCKET).remove([doc.file_path]);
    notify(error ? friendlyError(error, t.errors) : f.docDeleted);
    void loadExtras();
  };
  const setDocStatus = async (doc: DocumentRow) => {
    if (blocked()) return;
    const { error } = await supabase.from("student_documents").update({ status: doc.status === "Validé" ? "À vérifier" : "Validé" }).eq("id", doc.id);
    if (error) notify(friendlyError(error, t.errors));
    void loadExtras();
  };
  const addNote = async () => {
    if (!note.trim() || blocked()) return;
    const { error } = await supabase.from("student_notes").insert({ school_id: school.id, student_id: student.id, body: note.trim() });
    if (error) return notify(friendlyError(error, t.errors));
    setNote("");
    notify(f.noteAdded);
    void loadExtras();
  };
  // The photo is a new file each time (the bucket has no "replace" right); the old one is removed after.
  const uploadPhoto = async (file: File | undefined) => {
    if (!file || blocked()) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || !(await looksLikeItsType(file))) return notify(f.photoBad);
    setUploading(true);
    const path = `${school.id}/${student.id}/photo-${Date.now()}.jpg`;
    const stored = await supabase.storage.from(BUCKET).upload(path, await shrinkImage(file, 600, "image/jpeg"), { contentType: "image/jpeg" });
    if (stored.error) { setUploading(false); return notify(f.uploadFailed(stored.error.message)); }
    const old = student.photo_path;
    const ok = await save(() => supabase.from("students").update({ photo_path: path }).eq("id", student.id), f.photoSaved);
    await supabase.storage.from(BUCKET).remove([ok ? old : path].filter((item): item is string => Boolean(item)));
    setUploading(false);
  };
  const deleteStudent = async () => {
    const sure = await ask({ title: f.deleteTitle(student.full_name), danger: true, confirmLabel: f.deleteConfirm, text: f.deleteText });
    if (!sure) return;
    const paths = [...documents.map((doc) => doc.file_path), ...(student.photo_path ? [student.photo_path] : [])];
    if (await save(() => supabase.from("students").delete().eq("id", student.id), f.deleted(student.full_name))) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      onClose();
    }
  };

  return <>
    <Drawer title={student.full_name} eyebrow={f.drawer} onClose={onClose} full>
    <div className="profile-hero">
      <label className={`profile-avatar large profile-photo ${uploading ? "busy" : ""}`} title={student.photo_path ? f.photoChange : f.photoAdd}>
        {photo ? <img src={photo} alt={student.full_name} /> : initials(student.full_name)}
        <input type="file" hidden accept="image/jpeg,image/png" aria-label={student.photo_path ? f.photoChange : f.photoAdd} disabled={uploading} onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.target.value = ""; }} />
        <i><Icon name="edit" size={12} /></i>
      </label>
      <div><h2>{student.full_name}</h2><div className="profile-subline"><span>{student.phone}</span><Badge tone={statusTone(summary.status)} dot>{labelOf(t.v.status, summary.status)}</Badge></div></div>
      <div className="action-stack"><Button variant="outline" icon="edit" onClick={() => setForm("edit")}>{t.common.edit}</Button><Button variant="soft" icon="print" onClick={() => setCard(true)}>{f.card}</Button>{isDirector && <Button variant="danger" icon="trash" onClick={deleteStudent}>{t.common.del}</Button>}</div>
    </div>

    <div className="profile-summary-grid">
      <div><span>{f.attendance}</span><strong>{summary.attendance === null ? "—" : `${summary.attendance}%`}</strong><small>{summary.attendance === null ? f.noSession : f.sessionsNote}</small></div>
      <div><span>{t.common.paid}</span><strong>{money(summary.paid)}</strong><small>{f.paidLeft(money(summary.balance))}</small></div>
      <div><span>{f.enrollmentsCount}</span><strong>{summary.enrollments.length}</strong><small>{f.inTotal}</small></div>
      <div><span>{f.paymentStatus}</span><strong>{labelOf(t.v.status, summary.paymentStatus)}</strong><small>{f.onActive}</small></div>
    </div>

    <div className="drawer-section profile-section">
      <h4>{f.personal}</h4>
      <div className="info-grid">
        <div><span>{t.common.phone}</span><strong>{student.phone}</strong></div>
        <div><span>{t.common.email}</span><strong>{student.email || f.notGiven}</strong></div>
        <div><span>{f.dob}</span><strong>{formatDate(student.dob, "long")}</strong></div>
        <div><span>{t.common.address}</span><strong>{student.address || f.notGivenF}</strong></div>
        <div><span>{f.source}</span><strong>{student.source ? labelOf(t.v.source, student.source) : "—"}</strong></div>
        <div><span>{f.createdOn}</span><strong>{formatDate(student.created_at, "long")}</strong></div>
      </div>
    </div>

    <div className="drawer-section profile-section">
      <div className="drawer-section-head"><div><h4>{f.enrollments}</h4><span className="section-caption">{f.enrollmentsCaption}</span></div><Button icon="plus" onClick={() => setForm("enroll")}>{t.dash.newEnrollment}</Button></div>
      {summary.enrollments.length ? <ShowMore items={[...summary.enrollments].reverse()}>{(list) => <div className="registration-list">{list.map((enrollment) => {
        const { paid, balance } = balanceOf(enrollment.id);
        const group = enrollment.group_id ? groupById.get(enrollment.group_id) : undefined;
        const rate = group ? attendanceRate(student.id, group.id) : null;
        return <div className="registration-card" key={enrollment.id}>
          <div className="registration-card-head">
            <div><strong>{courseName(enrollment.course_id)}</strong><span>{group ? group.name : t.common.noGroup}{rate !== null ? f.presence(rate) : ""}</span></div>
            <select className="compact-select" aria-label={f.statusLabel} value={enrollment.status} onChange={(event) => save(() => supabase.from("enrollments").update({ status: event.target.value }).eq("id", enrollment.id), f.statusSaved)}>
              {STATUSES.map((status) => <option key={status} value={status}>{labelOf(t.v.status, status)}</option>)}
            </select>
          </div>
          <div className="registration-meta">
            <span>{f.enrolledOn} <strong>{formatDate(enrollment.enrolled_on)}</strong></span>
            <span>{t.common.total} <strong>{money(enrollment.total)}</strong></span>
            <span>{t.common.paid} <strong>{money(paid)}</strong></span>
            <span>{f.left} <strong className={balance > 0 ? "money-danger" : "money-ok"}>{money(balance)}</strong></span>
          </div>
          {enrollment.notes && <p className="muted-copy">{enrollment.notes}</p>}
          {balance > 0 && enrollment.status !== "Abandonné" && <Button variant="soft" icon="wallet" onClick={() => { setPayFor(enrollment.id); setForm("pay"); }}>{t.payments.collect}</Button>}
        </div>;
      })}</div>}</ShowMore> : <EmptyState title={f.emptyEnrollments} text={f.emptyEnrollmentsText} />}
    </div>

    <div className="drawer-section profile-section">
      {/* Its own small button, apart from the profile's main actions: the newest payment's receipt. */}
      <div className="drawer-section-head"><h4>{f.payments}</h4>{studentPayments.length > 0 && <Button small variant="outline" icon="print" onClick={() => printReceipt([studentPayments[0].id])}>{f.printLastReceipt}</Button>}</div>
      {studentPayments.length ? <ShowMore items={studentPayments}>{(list) => <div className="document-list">{list.map((payment) => <div className="document-row" key={payment.id}>
        <span className="document-icon"><Icon name="wallet" size={16} /></span>
        <div><strong>{money(payment.amount)}</strong><span>{formatDate(payment.paid_on)} · {labelOf(t.v.method, payment.method)} · {courseName(summary.enrollments.find((enrollment) => enrollment.id === payment.enrollment_id)!.course_id)}</span></div>
      </div>)}</div>}</ShowMore> : <EmptyState title={f.emptyPayments} text={f.emptyPaymentsText} />}
    </div>

    <div className="drawer-section profile-section">
      <div className="drawer-section-head"><div><h4>{f.documents}</h4><span className="section-caption">{f.documentsCaption}</span></div>
        <div className="doc-upload">
          <select className="compact-select" aria-label={f.docType} value={docType} onChange={(event) => setDocType(event.target.value)}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{labelOf(t.v.docType, type)}</option>)}</select>
          <label className="button upload-button"><Icon name="upload" size={15} />{uploading ? f.uploading : t.common.add}<input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
        </div>
      </div>
      {documents.length ? <ShowMore items={documents}>{(list) => <div className="document-list">{list.map((doc) => <div className="document-row" key={doc.id}>
        <span className="document-icon"><Icon name="file" size={16} /></span>
        <div><strong>{labelOf(t.v.docType, doc.type)}</strong><span>{doc.file_path.split("/").pop()?.replace(/^\d+-/, "")}{f.addedOn(formatDate(doc.created_at))}</span></div>
        <button className="badge-button" onClick={() => setDocStatus(doc)} title={f.changeStatus}><Badge tone={doc.status === "Validé" ? "success" : "warning"}>{labelOf(t.v.status, doc.status)}</Badge></button>
        <button className="text-button" onClick={() => openDocument(doc)}>{f.view}</button>
        <button className="row-menu" onClick={() => deleteDocument(doc)} aria-label={t.common.del}><Icon name="trash" size={15} /></button>
      </div>)}</div>}</ShowMore> : <EmptyState title={f.emptyDocuments} text={f.emptyDocumentsText} />}
    </div>

    <div className="drawer-section">
      <h4>{f.notes}</h4>
      <textarea className="field textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder={f.notePlaceholder} />
      <div className="drawer-note-footer"><span>{f.noteVisible}</span><Button icon="check" disabled={!note.trim()} onClick={addNote}>{f.addNote}</Button></div>
      <ShowMore items={notes}>{(list) => list.map((item) => <div className="note-row" key={item.id}><span>{formatDate(item.created_at)}</span><p>{item.body}</p></div>)}</ShowMore>
    </div>

  </Drawer>
    {form === "edit" && <StudentForm student={student} onClose={() => setForm(null)} />}
    {form === "enroll" && <EnrollmentForm studentId={student.id} onClose={() => setForm(null)} />}
    {form === "pay" && <PaymentForm enrollmentId={payFor} onClose={() => setForm(null)} />}
    {receipt && <Receipt paymentIds={receipt} />}
    {card && <StudentCardDialog student={student} onClose={closeCard} onPickPhoto={(file) => { void uploadPhoto(file); }} busy={uploading} />}
  </>;
}
