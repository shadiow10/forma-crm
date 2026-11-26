import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import qrcode from "qrcode-generator";
import { useAppT } from "../appCopy";
import { useData } from "../data";
import { Button, Icon } from "../ui";
import type { Student } from "../lib/queries";
import { supabase } from "../lib/supabase";

// Photos and the logo live in the private student-documents bucket (0032), shown through short-lived links.
export const BUCKET = "student-documents";
// undefined while asking, null when there is none (or the file is gone), else the link.
export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null | undefined>(path ? undefined : null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    setUrl(undefined);
    let live = true;
    let objectUrl: string | null = null;
    // Downloaded and shown from memory (blob:): the site's CSP only lets images come from itself,
    // data: or blob:, so a signed https link to the storage server would stay blank in production.
    void supabase.storage.from(BUCKET).download(path).then(({ data }) => {
      if (!live) return;
      objectUrl = data ? URL.createObjectURL(data) : null;
      setUrl(objectUrl);
    });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return url;
}

// A photo or a logo, made small before it leaves the browser: a phone photo is 3–5 MB, a card needs
// a few hundred pixels. Re-drawing it also drops the camera's metadata (location, device).
export async function shrinkImage(file: File, maxSide: number, type: "image/jpeg" | "image/png") {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("image"))), type, 0.85));
}

// The school year a card is valid for: September to August.
const schoolYear = (today = new Date()) => {
  const start = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}/${start + 1}`;
};

// The card is French and Arabic whatever the app's language, like an Algerian student card.
const L = {
  title: ["Carte d'étudiant", "بطاقة الطالب"], last: ["Nom", "اللقب"], first: ["Prénom", "الاسم"],
  dob: ["Né(e) le", "تاريخ الميلاد"], level: ["Niveau", "المستوى"], course: ["Formation", "التكوين"],
};
const Field = ({ label, value }: { label: string[]; value: string }) =>
  <div className="card-field"><span><i>{label[0]}</i><i lang="ar" dir="rtl">{label[1]}</i></span><strong>{value || "—"}</strong></div>;

// The address a card's QR code holds; reading it back gives the student (CardScanner).
const cardLink = (studentId: number) => `${window.location.origin}/etudiants?eleve=${studentId}`;
export function studentFromLink(text: string) {
  try {
    const url = new URL(text);
    const id = Number(url.searchParams.get("eleve"));
    return url.origin === window.location.origin && url.pathname === "/etudiants" && Number.isInteger(id) && id > 0 ? id : null;
  } catch { return null; }
}

// The card itself, credit-card size (85.6 × 54 mm). The QR code opens the student's profile in the
// app; only signed-in staff of the school get past the login.
function CardFace({ student, photo, logo, onImage }: { student: Student; photo: string | null | undefined; logo: string | null | undefined; onImage?: () => void }) {
  const { school, summaryOf, courses } = useData();
  const qr = qrcode(0, "M");
  qr.addData(cardLink(student.id));
  qr.make();
  const named = Boolean(student.last_name || student.first_name);
  const latest = summaryOf(student.id).latest;
  const course = latest ? courses.find((item) => item.id === latest.course_id)?.name ?? "" : "";
  return <article className="student-card">
    <header>
      {logo ? <img src={logo} alt="" onLoad={onImage} onError={onImage} /> : <span />}
      <div><strong>{school.name}</strong><span>{L.title[0]} · <i lang="ar" dir="rtl">{L.title[1]}</i></span></div>
      <small>{schoolYear()}</small>
    </header>
    <div className="card-body">
      <div className="card-qr" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true }) }} />
      <div className="card-fields">
        <Field label={L.last} value={named ? (student.last_name ?? "").toUpperCase() : student.full_name} />
        <Field label={L.first} value={named ? student.first_name ?? "" : ""} />
        <Field label={L.dob} value={student.dob ? student.dob.split("-").reverse().join("/") : ""} />
        {student.level ? <Field label={L.level} value={student.level} /> : <Field label={L.course} value={course} />}
      </div>
      <div className="card-photo">{photo && <img src={photo} alt="" onLoad={onImage} onError={onImage} />}</div>
    </div>
    <footer>N° {String(student.id).padStart(8, "0")}</footer>
  </article>;
}

// Preview first, then print. The printed copy sits straight under <body>, outside the app, and
// prints alone (index.css); "Imprimer" waits until the pictures are in.
export function StudentCardDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const t = useAppT();
  const { school } = useData();
  const photo = useSignedUrl(student.photo_path);
  const logo = useSignedUrl(school.logo_path);
  const [loaded, setLoaded] = useState(0);
  const ready = photo !== undefined && logo !== undefined && loaded >= Number(Boolean(photo)) + Number(Boolean(logo));
  const done = () => setLoaded((count) => count + 1);
  return <>
    <div className="drawer-layer" onClick={onClose}><div className="form-modal card-dialog" role="dialog" aria-label={t.student.card} onClick={(event) => event.stopPropagation()}>
      <div className="form-modal-head"><div><span className="eyebrow">{student.full_name}</span><h2>{t.student.card}</h2></div><button className="close-button" onClick={onClose} aria-label={t.common.close}><Icon name="close" size={20} /></button></div>
      <div className="form-modal-body"><div className="card-preview"><CardFace student={student} photo={photo} logo={logo} onImage={done} /></div>
        <p className="form-hint">{t.student.cardHint}</p></div>
      <div className="form-modal-foot"><Button variant="outline" onClick={onClose}>{t.common.close}</Button><Button icon="print" disabled={!ready} onClick={() => window.print()}>{t.student.cardPrint}</Button></div>
    </div></div>
    {createPortal(<div className="print-card"><CardFace student={student} photo={photo} logo={logo} /></div>, document.body)}
  </>;
}

// Reads a student card with the camera and hands back the student. jsQR is loaded only when the
// scanner opens: most browsers cannot read a QR code on their own.
export function CardScanner({ onFound, onClose }: { onFound: (studentId: number) => void; onClose: () => void }) {
  const t = useAppT();
  const v = t.student;
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState(v.scanHint);
  // The caller's handler changes on every render of its page; the camera must not restart for that.
  const found = useRef(onFound);
  found.current = onFound;
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let live = true;
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setMessage(v.scanNoCamera);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch (error) {
        return setMessage((error as DOMException).name === "NotAllowedError" ? v.scanDenied : v.scanNoCamera);
      }
      if (!live || !video.current) return stream.getTracks().forEach((track) => track.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      const jsQR = (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      // Five looks a second is plenty for a card held up to a camera.
      timer = window.setInterval(() => {
        const frame = video.current;
        if (!frame || !frame.videoWidth) return;
        canvas.width = frame.videoWidth;
        canvas.height = frame.videoHeight;
        context.drawImage(frame, 0, 0);
        const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (!code) return;
        const id = studentFromLink(code.data);
        if (!id) return setMessage(v.scanUnknown);
        window.clearInterval(timer);
        found.current(id);
      }, 200);
    })();
    return () => { live = false; window.clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [v]);
  return <div className="drawer-layer" onClick={onClose}><div className="form-modal scan-dialog" role="dialog" aria-label={v.scanTitle} onClick={(event) => event.stopPropagation()}>
    <div className="form-modal-head"><div><span className="eyebrow">{v.drawer}</span><h2>{v.scanTitle}</h2></div><button className="close-button" onClick={onClose} aria-label={t.common.close}><Icon name="close" size={20} /></button></div>
    <div className="form-modal-body"><video ref={video} className="scan-video" muted playsInline /><p className="form-hint" role="status">{message}</p></div>
    <div className="form-modal-foot"><Button variant="outline" onClick={onClose}>{t.common.close}</Button></div>
  </div></div>;
}
