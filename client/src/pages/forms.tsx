import { useData } from "../data";
import type { Group, Student } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { DAYS, Drawer, EmptyState, FormModal, PALETTE, formatTime, todayISO } from "../ui";

export const SOURCES = ["Walk-in", "Facebook", "Instagram", "TikTok", "Parrainage", "Site web", "Autre"];
export const METHODS = ["Espèces", "Virement", "Chèque"];
const text = (value: string | undefined) => value?.trim() || null;

// Create or edit a student. onSaved receives the student id.
export function StudentForm({ student, onClose, onSaved }: { student?: Student; onClose: () => void; onSaved?: (id: number) => void }) {
  const { school, save } = useData();
  return <FormModal
    title={student ? "Modifier l'étudiant" : "Nouvel étudiant"} subtitle="Fiche étudiant" submitLabel={student ? "Enregistrer" : "Créer l'étudiant"} onClose={onClose}
    initial={{ full_name: student?.full_name ?? "", phone: student?.phone ?? "", email: student?.email ?? "", dob: student?.dob ?? "", address: student?.address ?? "", source: student?.source ?? "Walk-in" }}
    fields={[
      { key: "full_name", label: "Nom complet", required: true, full: true, placeholder: "Ex. Amine Khelifi" },
      { key: "phone", label: "Téléphone", required: true, placeholder: "0555 00 00 00" },
      { key: "email", label: "Email", type: "email", placeholder: "email@exemple.com" },
      { key: "dob", label: "Date de naissance", type: "date" },
      { key: "source", label: "Source", type: "select", options: SOURCES },
      { key: "address", label: "Adresse", full: true },
    ]}
    onSubmit={async (values) => {
      const row = { full_name: values.full_name.trim(), phone: values.phone.trim(), email: text(values.email), dob: values.dob || null, address: text(values.address), source: values.source };
      let id = student?.id;
      const ok = await save(async () => {
        if (student) return supabase.from("students").update(row).eq("id", student.id);
        const result = await supabase.from("students").insert({ ...row, school_id: school.id }).select("id").single();
        id = result.data?.id;
        return result;
      }, student ? "Fiche étudiant mise à jour." : `${row.full_name} a été ajouté(e).`);
      if (ok && id) onSaved?.(id);
      return ok;
    }}
  />;
}

// New enrollment: student (unless given), course, group of that course, price, first payment.
export function EnrollmentForm({ studentId, onClose }: { studentId?: number; onClose: () => void }) {
  const { school, courses, groups, students, save, money } = useData();
  if (!courses.length) {
    return <Drawer title="Nouvelle inscription" eyebrow="INSCRIPTION" onClose={onClose}>
      <EmptyState title="Aucune formation" text="Ajoutez d'abord une formation dans la page Formations." />
    </Drawer>;
  }
  const groupsOf = (courseId: string) => groups.filter((group) => String(group.course_id) === courseId && group.status !== "Annulé");
  const firstCourse = String(courses[0].id);
  return <FormModal
    title="Nouvelle inscription" subtitle="Inscription" submitLabel="Confirmer l'inscription" onClose={onClose}
    initial={{ student: String(studentId ?? students[0]?.id ?? ""), course: firstCourse, group: String(groupsOf(firstCourse)[0]?.id ?? ""), enrolled_on: todayISO(), total: "", first_payment: "", method: "Espèces", notes: "" }}
    fields={(values) => {
      const course = courses.find((item) => String(item.id) === values.course);
      return [
        ...(studentId ? [] : [{ key: "student", label: "Étudiant", type: "select" as const, required: true, full: true, options: students.map((student) => ({ value: String(student.id), label: `${student.full_name} · ${student.phone}` })) }]),
        { key: "course", label: "Formation", type: "select", required: true, options: courses.map((item) => ({ value: String(item.id), label: `${item.name} · ${money(item.price)}` })) },
        { key: "group", label: "Groupe", type: "select", options: [{ value: "", label: "Sans groupe pour l'instant" }, ...groupsOf(values.course).map((group) => ({ value: String(group.id), label: groupLabel(group) }))] },
        { key: "enrolled_on", label: "Date d'inscription", type: "date", required: true },
        { key: "total", label: "Prix convenu", type: "number", placeholder: course ? `${course.price} (prix de la formation)` : "" },
        { key: "first_payment", label: "Premier versement", type: "number", placeholder: "0" },
        { key: "method", label: "Mode de paiement", type: "select", options: METHODS },
        { key: "notes", label: "Notes", type: "textarea", full: true, placeholder: "Informations utiles pour l'équipe…" },
      ];
    }}
    validate={(values) => {
      const course = courses.find((item) => String(item.id) === values.course);
      const total = values.total ? Number(values.total) : course?.price ?? 0;
      return {
        student: values.student ? "" : "Créez d'abord l'étudiant.",
        group: values.group && !groupsOf(values.course).some((group) => String(group.id) === values.group) ? "Choisissez un groupe de cette formation." : "",
        first_payment: Number(values.first_payment || 0) > total ? "Le versement dépasse le prix." : "",
      };
    }}
    onSubmit={(values) => {
      const course = courses.find((item) => String(item.id) === values.course)!;
      const student = students.find((item) => String(item.id) === (studentId ? String(studentId) : values.student));
      return save(() => supabase.rpc("create_enrollment", {
        p_school_id: school.id, p_student_id: Number(studentId ?? values.student), p_course_id: course.id, p_group_id: values.group ? Number(values.group) : null,
        p_enrolled_on: values.enrolled_on, p_total: values.total ? Number(values.total) : course.price, p_notes: values.notes,
        p_first_payment: Number(values.first_payment || 0), p_method: values.method,
      }), `${student?.full_name ?? "Étudiant"} inscrit(e) en ${course.name}.`);
    }}
  />;
}

export const groupLabel = (group: Group) => `${group.name}${group.days.length ? ` · ${group.days.join(" ")}` : ""}${group.start_time ? ` ${formatTime(group.start_time)}` : ""}`;

// Record a payment on an enrollment that still has something to pay.
export function PaymentForm({ enrollmentId, onClose }: { enrollmentId?: number; onClose: () => void }) {
  const { school, enrollments, studentById, courses, balanceOf, money, save } = useData();
  const open = enrollments.filter((enrollment) => enrollment.status !== "Abandonné" && balanceOf(enrollment.id).balance > 0);
  const label = (id: number) => {
    const enrollment = enrollments.find((item) => item.id === id)!;
    return `${studentById.get(enrollment.student_id)?.full_name ?? "?"} · ${courses.find((course) => course.id === enrollment.course_id)?.name ?? "?"} (reste ${money(balanceOf(id).balance)})`;
  };
  const first = enrollmentId ?? open[0]?.id;
  return <FormModal
    title="Enregistrer un paiement" subtitle="Paiement" submitLabel="Enregistrer le paiement" onClose={onClose}
    initial={{ enrollment: first ? String(first) : "", amount: "", paid_on: todayISO(), method: "Espèces" }}
    fields={[
      { key: "enrollment", label: "Inscription", type: "select", required: true, full: true, options: open.map((enrollment) => ({ value: String(enrollment.id), label: label(enrollment.id) })) },
      { key: "amount", label: `Montant (${school.currency})`, type: "number", required: true, min: 1 },
      { key: "paid_on", label: "Date du paiement", type: "date", required: true },
      { key: "method", label: "Mode de paiement", type: "select", options: METHODS },
    ]}
    validate={(values) => ({
      enrollment: values.enrollment ? "" : "Aucune inscription avec un solde à payer.",
      amount: values.enrollment && Number(values.amount) > balanceOf(Number(values.enrollment)).balance ? `Le reste à payer est de ${money(balanceOf(Number(values.enrollment)).balance)}.` : "",
    })}
    onSubmit={(values) => save(
      () => supabase.from("payments").insert({ school_id: school.id, enrollment_id: Number(values.enrollment), amount: Number(values.amount), paid_on: values.paid_on, method: values.method }),
      `Paiement de ${money(Number(values.amount))} enregistré.`,
    )}
  />;
}

// Create or edit a group.
export function GroupForm({ group, onClose }: { group?: Group; onClose: () => void }) {
  const { school, courses, teachers, groups, save } = useData();
  return <FormModal
    title={group ? "Modifier le groupe" : "Créer un groupe"} subtitle="Groupe" submitLabel={group ? "Enregistrer" : "Créer le groupe"} onClose={onClose}
    initial={{
      name: group?.name ?? "", course: String(group?.course_id ?? courses[0]?.id ?? ""), teacher: String(group?.teacher_id ?? ""), room: group?.room ?? "",
      days: (group?.days ?? []).join(","), start_time: formatTime(group?.start_time ?? "09:00"), end_time: formatTime(group?.end_time ?? "11:00"),
      capacity: String(group?.capacity ?? 15), status: group?.status === "Annulé" ? "Annulé" : "Ouvert",
    }}
    fields={[
      { key: "name", label: "Nom du groupe", required: true, full: true, placeholder: "Ex. Excel avancé — Matin" },
      { key: "course", label: "Formation", type: "select", options: [{ value: "", label: "—" }, ...courses.map((course) => ({ value: String(course.id), label: course.name }))] },
      { key: "teacher", label: "Formateur", type: "select", options: [{ value: "", label: "À affecter" }, ...teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.full_name }))] },
      { key: "days", label: "Jours de cours", type: "days", full: true },
      { key: "start_time", label: "Début", type: "time", required: true },
      { key: "end_time", label: "Fin", type: "time", required: true },
      { key: "room", label: "Salle", placeholder: "Salle A1" },
      { key: "capacity", label: "Capacité", type: "number", required: true, min: 1 },
      { key: "status", label: "Statut", type: "select", options: ["Ouvert", "Annulé"] },
    ]}
    validate={(values) => ({
      days: values.days ? "" : "Choisissez au moins un jour.",
      end_time: values.end_time && values.start_time && values.end_time <= values.start_time ? "La fin doit être après le début." : "",
    })}
    onSubmit={(values) => {
      const row = {
        name: values.name.trim(), course_id: values.course ? Number(values.course) : null, teacher_id: values.teacher ? Number(values.teacher) : null,
        room: text(values.room), days: DAYS.filter((day) => values.days.split(",").includes(day)), start_time: values.start_time, end_time: values.end_time,
        capacity: Number(values.capacity), status: values.status,
      };
      return save(
        () => group ? supabase.from("groups").update(row).eq("id", group.id) : supabase.from("groups").insert({ ...row, school_id: school.id, color: PALETTE[groups.length % PALETTE.length] }),
        group ? "Groupe mis à jour." : `Groupe « ${row.name} » créé.`,
      );
    }}
  />;
}
