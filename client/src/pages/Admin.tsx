import { FunctionsHttpError } from "@supabase/supabase-js";
import { useState } from "react";
import type { FormEvent } from "react";
import { roleLabels } from "../auth";
import type { Role } from "../auth";
import { useData } from "../data";
import type { MemberRow } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, COLORS, EmptyState, FormModal, Icon, PageHeader, Panel, formatDate, initialsBadge, todayISO } from "../ui";

// ---------------------------------------------------------------- Certificates

export function Certificates() {
  const { enrollments, studentById, courses, balanceOf, attendanceRate, school, me } = useData();
  const eligible = enrollments.filter((enrollment) => {
    const rate = attendanceRate(enrollment.student_id, enrollment.group_id ?? undefined);
    return enrollment.status === "Terminé" && balanceOf(enrollment.id).balance === 0 && rate !== null && rate >= 75;
  });
  const [selectedId, setSelectedId] = useState<number | undefined>(eligible[0]?.id);
  const selected = eligible.find((enrollment) => enrollment.id === selectedId);
  const student = selected ? studentById.get(selected.student_id) : undefined;
  const course = selected ? courses.find((item) => item.id === selected.course_id) : undefined;
  const rate = selected ? attendanceRate(selected.student_id, selected.group_id ?? undefined) : null;
  const number = selected ? `${school.slug.slice(0, 4).toUpperCase()}-${selected.enrolled_on.slice(0, 4)}-${String(selected.id).padStart(5, "0")}` : "—";

  return <>
    <PageHeader eyebrow="Documents officiels" title="Certificats" description="Certificats prêts à imprimer pour les formations terminées." actionLabel={selected ? "Imprimer le certificat" : undefined} actionIcon="print" onAction={() => window.print()} />
    <div className="document-layout">
      <Panel>
        <div className="eligibility-banner"><span className="metric-icon" style={{ color: COLORS.teal, background: COLORS.tealLight }}><Icon name="checkCircle" size={17} /></span><div><strong>{eligible.length} certificat{eligible.length > 1 ? "s" : ""} disponible{eligible.length > 1 ? "s" : ""}</strong><span>Formation « Terminé », entièrement réglée, présence ≥ 75 %</span></div></div>
        {eligible.length ? <div className="certificate-list">{eligible.map((enrollment) => {
          const name = studentById.get(enrollment.student_id)?.full_name ?? "—";
          return <div className={`certificate-row ${enrollment.id === selectedId ? "selected" : ""}`} key={enrollment.id} onClick={() => setSelectedId(enrollment.id)}>
            {initialsBadge(name)}<div><strong>{name}</strong><span>{courses.find((item) => item.id === enrollment.course_id)?.name}</span></div><Badge tone="success">Éligible</Badge>
          </div>;
        })}</div> : <EmptyState title="Aucun certificat disponible" text="Passez une inscription en « Terminé » une fois la formation finie, payée et suivie à 75 % au moins." />}
      </Panel>
      <div className="certificate-preview">
        <div className="preview-toolbar"><div><span>APERÇU DU DOCUMENT</span><strong>Certificat de formation</strong></div>{selected && <Button variant="outline" icon="print" onClick={() => window.print()}>Imprimer</Button>}</div>
        <div className="formal-document">
          <div className="document-corner" />
          <div className="document-logo"><span>{school.name[0]}</span><div><strong>{school.name}</strong><small>{school.address || "Centre de formation professionnelle"}</small></div></div>
          <div className="document-rule" />
          <p className="formal-kicker">CERTIFICAT DE RÉUSSITE</p>
          <p className="formal-intro">Le présent certificat est délivré à</p>
          <h2>{student?.full_name ?? "Nom de l'étudiant"}</h2>
          <p className="formal-copy">pour avoir suivi avec assiduité et satisfait aux exigences de la formation</p>
          <h3>{course?.name ?? "Intitulé de la formation"}</h3>
          <div className="document-stats">
            <div><span>Durée</span><strong>{course?.duration ?? "—"}</strong></div>
            <div><span>Assiduité</span><strong>{rate === null ? "—" : `${rate}%`}</strong></div>
            <div><span>N° certificat</span><strong>{number}</strong></div>
          </div>
          <div className="document-bottom"><div><span>Fait le {formatDate(todayISO(), "long")}</span><strong>La Direction</strong></div><div className="signature">{me.full_name ?? ""}</div></div>
        </div>
      </div>
    </div>
  </>;
}

// ---------------------------------------------------------------- Settings

export function Settings({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"school" | "users">("school");
  return <>
    <PageHeader eyebrow="Administration" title="Paramètres" description="L'identité de votre établissement et les accès de votre équipe." />
    <div className="settings-layout">
      <aside className="settings-nav">
        <button className={tab === "school" ? "active" : ""} onClick={() => setTab("school")}><Icon name="building" size={16} />Établissement<Icon name="chevron" size={15} stroke={COLORS.muted} /></button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><Icon name="users" size={16} />Utilisateurs<Icon name="chevron" size={15} stroke={COLORS.muted} /></button>
      </aside>
      <div className="settings-content">{tab === "school" ? <SchoolSettings /> : <UserSettings userId={userId} />}</div>
    </div>
  </>;
}

function SchoolSettings() {
  const { school, save } = useData();
  const [values, setValues] = useState({ name: school.name, phone: school.phone ?? "", email: school.email ?? "", address: school.address ?? "", currency: school.currency });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return;
    setBusy(true);
    await save(() => supabase.from("schools").update({ name: values.name.trim(), phone: values.phone.trim() || null, email: values.email.trim() || null, address: values.address.trim() || null, currency: values.currency }).eq("id", school.id), "Établissement enregistré.");
    setBusy(false);
  };
  return <Panel title="Profil de l'établissement">
    <form onSubmit={submit}>
      <div className="settings-form">
        <label>Nom de l'établissement *<input className="field" required value={values.name} onChange={set("name")} /></label>
        <label>Téléphone<input className="field" value={values.phone} onChange={set("phone")} /></label>
        <label>Email professionnel<input className="field" type="email" value={values.email} onChange={set("email")} /></label>
        <label>Adresse<input className="field" value={values.address} onChange={set("address")} /></label>
        <label>Devise<select className="field" value={values.currency} onChange={set("currency")}><option value="DA">Dinar algérien (DA)</option><option value="€">Euro (€)</option><option value="MAD">Dirham marocain (MAD)</option><option value="TND">Dinar tunisien (TND)</option></select></label>
      </div>
      <p className="form-hint">Le nom et l'adresse apparaissent sur les certificats. Adresse web : {school.slug}</p>
      <Button type="submit" icon="check" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  </Panel>;
}

async function invokeError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    return body?.error ?? "L'invitation a échoué.";
  }
  return "Le service d'invitation est indisponible. Vérifiez que la fonction « invite-user » est déployée dans Supabase.";
}

function UserSettings({ userId }: { userId: string }) {
  const { members, teachers, school, save, notify, reload } = useData();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const roleOptions = (Object.keys(roleLabels) as Role[]).map((role) => ({ value: role, label: roleLabels[role] }));
  const teacherOptions = teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.full_name }));
  const teacherField = (values: Record<string, string>) => (values.role === "teacher" ? [{ key: "teacher", label: "Fiche formateur", type: "select" as const, required: true, full: true, options: [{ value: "", label: "Choisir…" }, ...teacherOptions] }] : []);
  const remove = (member: MemberRow) => window.confirm(`Retirer l'accès de ${member.full_name || member.email} ? Son compte ne pourra plus ouvrir cet établissement.`)
    && save(() => supabase.from("school_members").delete().eq("school_id", school.id).eq("user_id", member.user_id), "Accès retiré.");

  return <Panel title="Utilisateurs & rôles" action={<Button icon="plus" onClick={() => setInviting(true)}>Inviter un utilisateur</Button>}>
    {members.length ? <div className="user-list">{members.map((member) => {
      const teacher = teachers.find((item) => item.id === member.teacher_id);
      const isMe = member.user_id === userId;
      return <div className="user-row" key={member.user_id}>
        {initialsBadge(member.full_name || member.email || "?")}
        <div><strong>{member.full_name || "Sans nom"}{isMe ? " (vous)" : ""}</strong><span>{member.email || "Email inconnu"}{teacher ? ` · fiche ${teacher.full_name}` : ""}</span></div>
        <Badge tone="info">{roleLabels[member.role]}</Badge>
        {!isMe && <span className="card-actions"><button className="row-menu" aria-label="Modifier" onClick={() => setEditing(member)}><Icon name="edit" size={15} /></button><button className="row-menu" aria-label="Retirer" onClick={() => remove(member)}><Icon name="trash" size={15} /></button></span>}
      </div>;
    })}</div> : <EmptyState title="Aucun utilisateur" text="Invitez votre équipe." />}
    <p className="form-hint"><Icon name="mail" size={13} /> La personne invitée reçoit un email pour choisir son mot de passe.</p>

    {inviting && <FormModal title="Inviter un utilisateur" subtitle="Utilisateurs & rôles" submitLabel="Envoyer l'invitation" onClose={() => setInviting(false)}
      initial={{ email: "", full_name: "", role: "secretaire", teacher: "" }}
      fields={(values) => [
        { key: "email", label: "Email", type: "email", required: true, full: true, placeholder: "prenom@ecole.dz" },
        { key: "full_name", label: "Nom complet", required: true, full: true },
        { key: "role", label: "Rôle", type: "select", options: roleOptions, full: true },
        ...teacherField(values),
      ]}
      onSubmit={async (values) => {
        const { error } = await supabase.functions.invoke("invite-user", { body: {
          school_id: school.id, email: values.email.trim(), full_name: values.full_name.trim(), role: values.role,
          teacher_id: values.role === "teacher" ? Number(values.teacher) : null, redirect_to: window.location.origin,
        } });
        if (error) { notify(await invokeError(error)); return false; }
        await reload();
        notify(`Invitation envoyée à ${values.email.trim()}.`);
        return true;
      }} />}

    {editing && <FormModal title="Modifier l'accès" subtitle={editing.email ?? "Utilisateur"} submitLabel="Enregistrer" onClose={() => setEditing(null)}
      initial={{ full_name: editing.full_name ?? "", role: editing.role, teacher: String(editing.teacher_id ?? "") }}
      fields={(values) => [
        { key: "full_name", label: "Nom complet", required: true, full: true },
        { key: "role", label: "Rôle", type: "select", options: roleOptions, full: true },
        ...teacherField(values),
      ]}
      onSubmit={(values) => save(() => supabase.from("school_members").update({
        full_name: values.full_name.trim(), role: values.role, teacher_id: values.role === "teacher" ? Number(values.teacher) : null,
      }).eq("school_id", school.id).eq("user_id", editing.user_id), "Accès mis à jour.")} />}
  </Panel>;
}
