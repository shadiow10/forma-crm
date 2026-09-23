import { useState } from "react";
import { useData } from "../data";
import type { Course, Teacher } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { Badge, Button, Drawer, EmptyState, FormModal, Icon, PALETTE, PageHeader, Panel, clampPercent, downloadCSV, percent } from "../ui";
import { timeRange } from "./Groups";

const DURATIONS = ["1 mois", "2 mois", "3 mois", "4 mois", "6 mois", "9 mois", "12 mois"];
const CONTRACTS = ["Temps plein", "Temps partiel", "Vacataire"];
const text = (value: string | undefined) => value?.trim() || null;

function CourseForm({ course, onClose }: { course?: Course; onClose: () => void }) {
  const { school, courses, save } = useData();
  return <FormModal title={course ? "Modifier la formation" : "Nouvelle formation"} subtitle="Catalogue" submitLabel={course ? "Enregistrer" : "Ajouter la formation"} onClose={onClose}
    initial={{ name: course?.name ?? "", short_name: course?.short_name ?? "", duration: course?.duration ?? "3 mois", price: course ? String(course.price) : "" }}
    fields={[
      { key: "name", label: "Nom de la formation", required: true, full: true, placeholder: "Ex. Développement mobile" },
      { key: "short_name", label: "Nom court", placeholder: "Mobile" },
      { key: "duration", label: "Durée", type: "select", options: course && !DURATIONS.includes(course.duration) ? [course.duration, ...DURATIONS] : DURATIONS },
      { key: "price", label: `Prix total de la formation (${school.currency})`, type: "number", required: true, full: true, placeholder: "45000" },
    ]}
    onSubmit={(values) => {
      const row = { name: values.name.trim(), short_name: text(values.short_name) ?? values.name.trim().split(" ")[0], duration: values.duration, price: Number(values.price) };
      return save(() => course ? supabase.from("courses").update(row).eq("id", course.id) : supabase.from("courses").insert({ ...row, school_id: school.id, color: PALETTE[courses.length % PALETTE.length] }),
        course ? "Formation mise à jour." : `Formation « ${row.name} » ajoutée.`);
    }} />;
}

export function Courses() {
  const { courses, groups, enrollments, groupStudentIds, money, canEdit, isDirector, save, ask } = useData();
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const stats = (course: Course) => {
    const active = enrollments.filter((enrollment) => enrollment.course_id === course.id && (enrollment.status === "Inscrit" || enrollment.status === "En cours")).length;
    const courseGroups = groups.filter((group) => group.course_id === course.id && group.status !== "Annulé");
    const seats = courseGroups.reduce((sum, group) => sum + group.capacity, 0);
    const filled = courseGroups.reduce((sum, group) => sum + groupStudentIds(group.id).length, 0);
    return { active, groups: courseGroups.length, seats, filled };
  };
  const remove = async (course: Course) => await ask({ title: `Supprimer « ${course.name} » ?`, danger: true, confirmLabel: "Supprimer", text: "Les inscriptions liées à cette formation seront perdues." })
    && save(() => supabase.from("courses").delete().eq("id", course.id), "Formation supprimée.");
  const exportCatalogue = () => downloadCSV("catalogue-formations.csv", [["Formation", "Durée", "Prix", "Inscriptions actives", "Groupes"], ...courses.map((course) => { const s = stats(course); return [course.name, course.duration, course.price, s.active, s.groups]; })]);

  return <>
    <PageHeader eyebrow="Catalogue pédagogique" title="Formations" description="Votre catalogue, les tarifs et le remplissage des groupes par formation." actionLabel={canEdit ? "Nouvelle formation" : undefined} onAction={() => setEditing("new")}
      extra={<Button variant="outline" icon="download" onClick={exportCatalogue}>Exporter</Button>} />
    {courses.length ? <div className="class-cards">{courses.map((course) => {
      const s = stats(course);
      const fill = clampPercent(percent(s.filled, s.seats));
      return <div className="class-card" key={course.id}>
        <div className="class-color" style={{ background: course.color }} />
        <div className="class-card-main">
          <div className="class-card-top"><Badge tone={s.active ? "success" : "neutral"} dot>{s.active ? "Active" : "Sans inscrit"}</Badge>
            {canEdit && <span className="card-actions"><button className="row-menu" aria-label="Modifier" onClick={() => setEditing(course)}><Icon name="edit" size={15} /></button>{isDirector && <button className="row-menu" aria-label="Supprimer" onClick={() => remove(course)}><Icon name="trash" size={15} /></button>}</span>}
          </div>
          <h3>{course.name}</h3>
          <p><Icon name="clock" size={14} /> {course.duration} · {money(course.price)}</p>
          <p><Icon name="graduation" size={14} /> {s.active} inscription{s.active > 1 ? "s" : ""} active{s.active > 1 ? "s" : ""} · {s.groups} groupe{s.groups > 1 ? "s" : ""}</p>
          <div className="capacity"><div><span>Places occupées</span><strong>{s.seats ? `${s.filled}/${s.seats}` : "Aucun groupe"}</strong></div><div className="capacity-track"><i style={{ width: `${fill}%`, background: course.color }} /></div></div>
        </div>
      </div>;
    })}</div> : <Panel><EmptyState title="Aucune formation" text="Ajoutez votre première formation au catalogue." /></Panel>}
    {editing && <CourseForm course={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
  </>;
}

// Weekly hours from each group's days and times.
const weeklyHours = (teacherId: number, groups: ReturnType<typeof useData>["groups"]) => groups
  .filter((group) => group.teacher_id === teacherId && group.status !== "Annulé" && group.start_time && group.end_time)
  .reduce((sum, group) => {
    const [sh, sm] = group.start_time!.split(":").map(Number);
    const [eh, em] = group.end_time!.split(":").map(Number);
    return sum + group.days.length * ((eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);

function TeacherForm({ teacher, onClose }: { teacher?: Teacher; onClose: () => void }) {
  const { school, courses, teachers, save } = useData();
  return <FormModal title={teacher ? "Modifier le formateur" : "Ajouter un formateur"} subtitle="Équipe pédagogique" submitLabel={teacher ? "Enregistrer" : "Ajouter"} onClose={onClose}
    initial={{ full_name: teacher?.full_name ?? "", subject: teacher?.subject ?? courses[0]?.name ?? "", phone: teacher?.phone ?? "", email: teacher?.email ?? "", hourly_rate: String(teacher?.hourly_rate ?? 2000), contract: teacher?.contract ?? "Temps partiel" }}
    fields={[
      { key: "full_name", label: "Nom complet", required: true, full: true },
      { key: "subject", label: "Spécialité", placeholder: "Ex. Comptabilité" },
      { key: "contract", label: "Contrat", type: "select", options: CONTRACTS },
      { key: "phone", label: "Téléphone" },
      { key: "email", label: "Email", type: "email" },
      { key: "hourly_rate", label: `Tarif horaire (${school.currency})`, type: "number", required: true, full: true },
    ]}
    onSubmit={(values) => {
      const row = { full_name: values.full_name.trim(), subject: text(values.subject), phone: text(values.phone), email: text(values.email), hourly_rate: Number(values.hourly_rate), contract: values.contract };
      return save(() => teacher ? supabase.from("teachers").update(row).eq("id", teacher.id) : supabase.from("teachers").insert({ ...row, school_id: school.id, color: PALETTE[teachers.length % PALETTE.length] }),
        teacher ? "Formateur mis à jour." : `${row.full_name} ajouté(e) à l'équipe.`);
    }} />;
}

export function Teachers() {
  const { teachers, groups, money } = useData();
  const [editing, setEditing] = useState<Teacher | "new" | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const maxHours = Math.max(1, ...teachers.map((teacher) => weeklyHours(teacher.id, groups)));
  return <>
    <PageHeader eyebrow="Équipe pédagogique" title="Formateurs" description="L'annuaire de l'équipe et les heures prévues au planning." actionLabel="Ajouter un formateur" onAction={() => setEditing("new")} />
    {teachers.length ? <div className="teacher-grid">{teachers.map((teacher) => {
      const count = groups.filter((group) => group.teacher_id === teacher.id && group.status !== "Annulé").length;
      return <div className="teacher-card" key={teacher.id} onClick={() => setSelected(teacher.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(teacher.id)}>
        <div className="teacher-top"><span className="teacher-avatar" style={{ background: `${teacher.color}22`, color: teacher.color }}>{teacher.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><Badge>{teacher.contract}</Badge></div>
        <h3>{teacher.full_name}</h3>
        <p className="teacher-subject">{teacher.subject || "Spécialité non renseignée"}</p>
        <div className="teacher-details"><span><Icon name="phone" size={14} />{teacher.phone || "—"}</span><span><Icon name="mail" size={14} />{teacher.email || "—"}</span></div>
        <div className="teacher-footer"><span>{count} groupe{count > 1 ? "s" : ""}</span><strong>{teacher.hourly_rate === null ? "—" : `${money(teacher.hourly_rate)}/h`}</strong></div>
      </div>;
    })}</div> : <Panel><EmptyState title="Aucun formateur" text="Ajoutez les formateurs de votre centre." /></Panel>}
    {teachers.length > 0 && <Panel title="Heures prévues par semaine"><div className="hours-grid">{teachers.map((teacher) => {
      const hours = weeklyHours(teacher.id, groups);
      return <div className="hours-row" key={teacher.id}>
        <span className="hours-name">{teacher.full_name}</span>
        <div className="hours-track"><i style={{ width: `${clampPercent(percent(hours, maxHours))}%`, background: teacher.color }} /></div>
        <strong>{Math.round(hours * 10) / 10} h</strong>
      </div>;
    })}</div></Panel>}
    {selected !== null && <TeacherDrawer teacherId={selected} onClose={() => setSelected(null)} onEdit={(teacher) => setEditing(teacher)} />}
    {editing && <TeacherForm teacher={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
  </>;
}

function TeacherDrawer({ teacherId, onClose, onEdit }: { teacherId: number; onClose: () => void; onEdit: (teacher: Teacher) => void }) {
  const { teachers, groups, members, money, save, notify, ask } = useData();
  const teacher = teachers.find((item) => item.id === teacherId);
  if (!teacher) return null;
  const own = groups.filter((group) => group.teacher_id === teacher.id);
  const account = members.find((member) => member.teacher_id === teacher.id);
  const remove = async () => {
    if (account) return notify("Ce formateur a un compte de connexion : retirez d'abord l'utilisateur dans Paramètres → Utilisateurs.");
    if (!(await ask({ title: `Supprimer ${teacher.full_name} ?`, danger: true, confirmLabel: "Supprimer", text: "Ses groupes resteront, sans formateur." }))) return;
    if (await save(() => supabase.from("teachers").delete().eq("id", teacher.id), "Formateur supprimé.")) onClose();
  };
  return <Drawer title={teacher.full_name} eyebrow="FORMATEUR" onClose={onClose}>
    <div className="drawer-section">
      <h4>Coordonnées</h4>
      <div className="info-grid">
        <div><span>Téléphone</span><strong>{teacher.phone || "—"}</strong></div>
        <div><span>Email</span><strong>{teacher.email || "—"}</strong></div>
        <div><span>Tarif horaire</span><strong>{teacher.hourly_rate === null ? "—" : `${money(teacher.hourly_rate)}/h`}</strong></div>
        <div><span>Contrat</span><strong>{teacher.contract}</strong></div>
        <div><span>Heures / semaine</span><strong>{Math.round(weeklyHours(teacher.id, groups) * 10) / 10} h</strong></div>
        <div><span>Compte de connexion</span><strong>{account ? account.email ?? "Actif" : "Aucun (Paramètres → Utilisateurs)"}</strong></div>
      </div>
    </div>
    <div className="drawer-section">
      <h4>Groupes</h4>
      {own.length ? <div className="teacher-schedule">{own.map((group) => <div key={group.id}><span className="schedule-day">{group.days.join(" ") || "—"}</span><div><strong>{group.name}</strong><span>{timeRange(group)} · {group.room || "Salle à définir"}</span></div></div>)}</div>
        : <EmptyState title="Aucun groupe" text="Attribuez-lui un groupe depuis la page Groupes." />}
    </div>
    <div className="drawer-actions vertical">
      <Button variant="outline" icon="edit" onClick={() => onEdit(teacher)}>Modifier</Button>
      <Button variant="danger" icon="trash" onClick={remove}>Supprimer</Button>
    </div>
  </Drawer>;
}
