import { FunctionsHttpError } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ROLES } from "../auth";
import type { Role } from "../auth";
import { label as labelOf, useAppT } from "../appCopy";
import { friendlyError, useData } from "../data";
import { LANGS } from "../i18n";
import { locale, setLang, useLang } from "../lang";
import type { Lang } from "../lang";
import { EXTRA_PACKS, PLANS } from "../lib/plans";
import type { PlanId } from "../lib/plans";
import type { MemberRow } from "../lib/queries";
import { fetchAll } from "../lib/queries";
import { toCSV, zipFiles } from "../lib/zip";
import { supabase } from "../lib/supabase";
import { FormModal, ShowMore } from "../appUI";
import { Badge, Button, COLORS, EmptyState, Icon, PageHeader, Panel, formatDate, initialsBadge, todayISO, variants } from "../ui";
import type { IconName } from "../ui";
import { BUCKET, shrinkImage, useSignedUrl } from "./StudentCard";

// ---------------------------------------------------------------- Certificates

export function Certificates() {
  const t = useAppT();
  const c = t.certificates;
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
    <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} actionLabel={selected ? c.action : undefined} actionIcon="print" onAction={() => window.print()} />
    <div className="document-layout">
      <Panel>
        <div className="eligibility-banner"><span className="metric-icon" style={{ color: COLORS.teal, background: COLORS.tealLight }}><Icon name="checkCircle" size={17} /></span><div><strong>{c.available(eligible.length)}</strong><span>{c.rule}</span></div></div>
        {eligible.length ? <ShowMore items={eligible}>{(list) => <div className="certificate-list">{list.map((enrollment) => {
          const name = studentById.get(enrollment.student_id)?.full_name ?? "—";
          return <div className={`certificate-row ${enrollment.id === selectedId ? "selected" : ""}`} key={enrollment.id} onClick={() => setSelectedId(enrollment.id)}>
            {initialsBadge(name)}<div><strong>{name}</strong><span>{courses.find((item) => item.id === enrollment.course_id)?.name}</span></div><Badge tone="success">{c.eligible}</Badge>
          </div>;
        })}</div>}</ShowMore> : <EmptyState title={c.empty} text={c.emptyText} />}
      </Panel>
      <div className="certificate-preview">
        <div className="preview-toolbar"><div><span>{c.preview}</span><strong>{c.previewTitle}</strong></div>{selected && <Button variant="outline" icon="print" onClick={() => window.print()}>{t.common.print}</Button>}</div>
        <div className="formal-document">
          <div className="document-corner" />
          <div className="document-logo"><span>{school.name[0]}</span><div><strong>{school.name}</strong><small>{school.address || c.defaultAddress}</small></div></div>
          <div className="document-rule" />
          <p className="formal-kicker">{c.kicker}</p>
          <p className="formal-intro">{c.intro}</p>
          <h2>{student?.full_name ?? c.studentPlaceholder}</h2>
          <p className="formal-copy">{c.copy}</p>
          <h3>{course?.name ?? c.coursePlaceholder}</h3>
          <div className="document-stats">
            <div><span>{c.duration}</span><strong>{course ? t.v.months(Number(course.duration.split(" ")[0]) || 0) : "—"}</strong></div>
            <div><span>{c.attendance}</span><strong>{rate === null ? "—" : `${rate}%`}</strong></div>
            <div><span>{c.number}</span><strong>{number}</strong></div>
          </div>
          <div className="document-bottom"><div><span>{c.madeOn(formatDate(todayISO(), "long"))}</span><strong>{c.direction}</strong></div><div className="signature">{me.full_name ?? ""}</div></div>
        </div>
      </div>
    </div>
  </>;
}

// ---------------------------------------------------------------- Settings

// Logging out lives here, at the foot of the settings menu, for every role.
export type SettingsTab = "school" | "users" | "activity";
export function Settings({ userId, signedInAs, onSignOut, tab }: { userId: string; signedInAs: string; onSignOut: () => void; tab: SettingsTab }) {
  const t = useAppT();
  const s = t.settings;
  const { isDirector } = useData();
  // The three sections are chosen from the sidebar (task list); the language moved to the sidebar too.
  return <>
    <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} />
    <div className="settings-layout">
      <div className="settings-content">{isDirector ? (tab === "users" ? <UserSettings userId={userId} /> : tab === "activity" ? <ActivityLog /> : <><Subscription /><SchoolSettings /><StudentLimit /><DangerZone /></>) : null}
        <div className="settings-account panel">
          <span>{s.signedInAs(signedInAs)}</span>
          <button className="settings-logout" onClick={onSignOut}><Icon name="logout" size={16} />{t.common.signOut}</button>
        </div>
      </div>
    </div>
  </>;
}


function SchoolSettings() {
  const t = useAppT();
  const s = t.settings;
  const { school, save, subscription, notify, blocked } = useData();
  const logo = useSignedUrl(school.logo_path);
  const [uploading, setUploading] = useState(false);
  // <school>/0/logo-….png: a new file each time, the old one removed once the school points to the new one.
  const uploadLogo = async (file: File | undefined) => {
    if (!file || blocked()) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return notify(s.logoBad);
    setUploading(true);
    const path = `${school.id}/0/logo-${Date.now()}.png`;
    const stored = await supabase.storage.from(BUCKET).upload(path, await shrinkImage(file, 400, "image/png"), { contentType: "image/png" });
    if (stored.error) { setUploading(false); return notify(s.logoBad); }
    const old = school.logo_path;
    const ok = await save(() => supabase.from("schools").update({ logo_path: path }).eq("id", school.id), s.logoSaved);
    await supabase.storage.from(BUCKET).remove([ok ? old : path].filter((item): item is string => Boolean(item)));
    setUploading(false);
  };
  const [values, setValues] = useState({ name: school.name, phone: school.phone ?? "", email: school.email ?? "", address: school.address ?? "", currency: school.currency });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return;
    setBusy(true);
    // Sessions per month moved to each course (0025).
    await save(() => supabase.from("schools").update({
      name: values.name.trim(), phone: values.phone.trim() || null, email: values.email.trim() || null, address: values.address.trim() || null, currency: values.currency,
    }).eq("id", school.id), s.saved);
    setBusy(false);
  };
  return <Panel title={s.profile}>
    <form onSubmit={submit}>
      <div className="settings-form">
        <label>{s.fName}<input className="field" required value={values.name} onChange={set("name")} /></label>
        <label>{s.fPhone}<input className="field" value={values.phone} onChange={set("phone")} /></label>
        <label>{s.fEmail}<input className="field" type="email" value={values.email} onChange={set("email")} /></label>
        <label>{s.fAddress}<input className="field" value={values.address} onChange={set("address")} /></label>
        <label>{s.fCurrency}<select className="field" value={values.currency} onChange={set("currency")}>{Object.keys(t.v.currency).map((code) => <option key={code} value={code}>{t.v.currency[code]}</option>)}</select></label>
      </div>
      <div className="settings-logo">
        <span className="settings-logo-box">{logo ? <img src={logo} alt={s.logo} /> : <Icon name="building" size={20} />}</span>
        <div><strong>{s.logo}</strong><span className="form-hint">{s.logoHint}</span></div>
        <label className="button small" style={{ ...variants.outline, cursor: "pointer", opacity: uploading ? 0.5 : 1 }}>{school.logo_path ? s.logoChange : s.logoAdd}
          <input type="file" hidden accept="image/png,image/jpeg" disabled={uploading} onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} /></label>
      </div>
      <p className="form-hint">{s.hint(school.slug)}</p>
      {school.paid_until && <p className="form-hint"><Icon name="calendar" size={13} /> {s.subscription(school.billing === "trial" ? s.trial : school.billing === "yearly" ? s.yearly : school.billing === "semester" ? s.semester : s.monthly, subscription.state === "frozen" ? s.expired : s.valid, formatDate(school.paid_until))}</p>}
      <Button type="submit" icon="check" disabled={busy}>{busy ? t.common.saving : t.common.save}</Button>
    </form>
  </Panel>;
}

// Choosing a plan, after a trial or to renew (0033). The request waits for payment like an order;
// marking it paid extends this same school. It goes straight to the database rather than through
// save(): an expired, read-only school must still be able to ask for a plan.
function Subscription() {
  const t = useAppT();
  const s = t.settings;
  const { school, money, notify, reload, isDirector, subscription } = useData();
  const [pending, setPending] = useState<{ billing: PlanId; created_at: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<PlanId>("yearly");
  const mobile = (value: string) => value.replace(/\D/g, "");
  const isMobile = (value: string) => /^0[5-7]\d{8}$/.test(mobile(value));
  const [phone, setPhone] = useState(isMobile(school.phone ?? "") ? school.phone ?? "" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => supabase.rpc("pending_renewal", { p_school_id: school.id })
    .then(({ data, error: failed }) => { if (failed) notify(friendlyError(failed, t.errors)); else setPending((data as { billing: PlanId; created_at: string }[] | null)?.[0] ?? null); });
  useEffect(() => { if (isDirector) void load(); }, [school.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only when a plan has to be chosen: a free trial, or a subscription that has ended (grace days,
  // then read-only). A school with a running plan sees nothing, unless a request is still pending.
  const needed = subscription.state === "trial" || subscription.state === "grace" || subscription.state === "frozen";
  if (!isDirector || (!needed && !pending)) return null;
  const name = (id: PlanId) => ({ monthly: s.monthly, semester: s.semester, yearly: s.yearly })[id];
  const price = (id: PlanId) => money(PLANS.find((item) => item.id === id)!.price);
  const send = async () => {
    if (!isMobile(phone)) return setError(s.planPhoneBad);
    setBusy(true);
    const { error: failed } = await supabase.rpc("request_renewal", { p_school_id: school.id, p_billing: plan, p_phone: mobile(phone) });
    setBusy(false);
    if (failed) return notify(friendlyError(failed, t.errors));
    notify(s.planSent);
    setEditing(false);
    await load();
    void reload();
  };
  return <Panel title={s.planTitle}>
    {pending && !editing ? <>
      <p className="form-hint"><Icon name="clock" size={13} /> {s.planPending(`${name(pending.billing)} · ${price(pending.billing)}`, formatDate(pending.created_at.slice(0, 10)))}</p>
      <Button variant="outline" icon="edit" onClick={() => { setPlan(pending.billing); setEditing(true); }}>{s.planChange}</Button>
    </> : <>
      <div className="settings-form">
        <label>{s.planPick}<select className="field" value={plan} onChange={(event) => setPlan(event.target.value as PlanId)}>
          {PLANS.map((item) => <option key={item.id} value={item.id}>{name(item.id)} · {price(item.id)}</option>)}
        </select></label>
        <label>{s.planPhone}<input className="field" type="tel" value={phone} placeholder="0555 00 00 00" aria-invalid={Boolean(error)}
          onChange={(event) => { setPhone(event.target.value); setError(""); }} />{error && <span className="field-error">{error}</span>}</label>
      </div>
      <p className="form-hint">{s.planHint}</p>
      <Button icon="check" disabled={busy} onClick={send}>{s.planSend}</Button>
    </>}
  </Panel>;
}

// How many students the plan covers, and a way to ask for more (0027). The request is paid like an
// order; the limit goes up when it is marked paid in the dashboard.
function StudentLimit() {
  const t = useAppT();
  const s = t.settings;
  const { school, students, money, save, notify } = useData();
  const [pending, setPending] = useState<{ pack: number | null; on_quote: boolean }[]>([]);
  const [choice, setChoice] = useState<string>(String(EXTRA_PACKS[0].students));
  const [busy, setBusy] = useState(false);
  const load = () => supabase.from("student_packs").select("pack, on_quote").eq("school_id", school.id).eq("status", "nouveau")
    .then(({ data, error }) => { if (error) notify(friendlyError(error, t.errors)); else setPending(data ?? []); });
  useEffect(() => { void load(); }, [school.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = (pack: number | null, onQuote: boolean) => onQuote || pack === null ? s.packQuote : `+${pack} · ${money(EXTRA_PACKS.find((item) => item.students === pack)?.price ?? 0)}`;
  const request = async () => {
    setBusy(true);
    const onQuote = choice === "quote";
    if (await save(() => supabase.from("student_packs").insert({ school_id: school.id, pack: onQuote ? null : Number(choice), on_quote: onQuote }), s.packSent)) await load();
    setBusy(false);
  };
  const near = school.student_limit !== null && students.length >= school.student_limit * 0.9;
  return <Panel title={s.students}>
    <p className={`student-count ${near ? "near" : ""}`}><Icon name="users" size={15} /> {school.student_limit === null ? s.noLimit(students.length) : s.studentsOf(students.length, school.student_limit)}</p>
    {school.student_limit !== null && <>
      <h4 className="pack-title">{s.packTitle}</h4>
      <div className="inline-add">
        <select className="field" aria-label={s.packTitle} value={choice} onChange={(event) => setChoice(event.target.value)}>
          {EXTRA_PACKS.map((item) => <option key={item.students} value={String(item.students)}>{label(item.students, false)}</option>)}
          <option value="quote">{s.packQuote}</option>
        </select>
        <Button icon="plus" disabled={busy} onClick={request}>{s.packRequest}</Button>
      </div>
      {pending.map((item, index) => <p className="form-hint" key={index}><Icon name="clock" size={13} /> {s.packPending(label(item.pack, item.on_quote))}</p>)}
      <p className="form-hint">{s.packHint}</p>
    </>}
  </Panel>;
}

// "Download my data" and "Delete the school" (0034), director only. Deleting asks for the school's
// exact name and the director's password again, then leaves 30 days to change one's mind; the
// export works throughout, read-only school included.
function DangerZone() {
  const t = useAppT();
  const s = t.settings;
  const { school, isDirector, students, studentById, enrollments, payments, teachers, courses, groups, rooms, notify, reload } = useData();
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  if (!isDirector) return null;

  // One CSV per table, the columns as stored, plus the student's name where a row only has an id.
  const exportAll = async () => {
    setExporting(true);
    try {
      const attendance = await fetchAll<{ student_id: number; group_id: number; session_date: string; status: string }>(
        () => supabase.from("attendance").select("student_id, group_id, session_date, status"), ["session_date", "group_id", "student_id"]);
      const enrollmentById = new Map(enrollments.map((item) => [item.id, item]));
      const table = <T extends object>(rows: T[], extra: (row: T) => Record<string, unknown> = () => ({})) => {
        const shaped = rows.map((row) => ({ ...extra(row), ...row }) as Record<string, unknown>);
        const columns = [...new Set(shaped.flatMap((row) => Object.keys(row)))];
        return toCSV([columns, ...shaped.map((row) => columns.map((column) => {
          const value = row[column];
          return Array.isArray(value) ? value.join(" ") : (value as string | number | null);
        }))]);
      };
      const nameOf = (id: number | undefined) => ({ etudiant: id ? studentById.get(id)?.full_name ?? "" : "" });
      const blob = zipFiles([
        { name: "etudiants.csv", text: table(students) },
        { name: "inscriptions.csv", text: table(enrollments, (row) => nameOf(row.student_id)) },
        { name: "paiements.csv", text: table(payments, (row) => nameOf(enrollmentById.get(row.enrollment_id)?.student_id)) },
        { name: "presences.csv", text: table(attendance, (row) => nameOf(row.student_id)) },
        { name: "formateurs.csv", text: table(teachers) },
        { name: "formations.csv", text: table(courses) },
        { name: "groupes.csv", text: table(groups) },
        { name: "salles.csv", text: table(rooms) },
      ]);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `classtra-${school.slug}-${todayISO()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      notify(s.exportDone);
    } catch (error) {
      notify(friendlyError(error as { message: string }, t.errors));
    }
    setExporting(false);
  };
  const cancel = async () => {
    const { error } = await supabase.rpc("cancel_school_deletion", { p_school_id: school.id });
    if (error) return notify(friendlyError(error, t.errors));
    await reload();
    notify(s.deleteCancelled);
  };

  return <Panel title={s.dangerTitle}>
    <div className="danger-row">
      <div><strong>{s.exportTitle}</strong><p className="form-hint">{s.exportText}</p></div>
      <Button variant="outline" icon="download" disabled={exporting} onClick={exportAll}>{s.exportTitle}</Button>
    </div>
    <div className="danger-row">
      <div><strong>{s.deleteTitle}</strong><p className="form-hint">{school.delete_after ? s.deletePending(formatDate(school.delete_after, "long")) : s.deleteText}</p></div>
      {school.delete_after
        ? <Button variant="outline" icon="check" onClick={cancel}>{t.banner.cancelDeletion}</Button>
        : <Button variant="danger" icon="trash" onClick={() => setConfirming(true)}>{s.deleteAction}</Button>}
    </div>
    {confirming && <DeleteSchoolDialog onClose={() => setConfirming(false)} />}
  </Panel>;
}

function DeleteSchoolDialog({ onClose }: { onClose: () => void }) {
  const t = useAppT();
  const s = t.settings;
  const { school, notify, reload } = useData();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ field: "name" | "password" | "form"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!same(name, school.name)) return setError({ field: "name", text: s.deleteWrongName });
    setBusy(true);
    // The password again: an open session on a shared computer is not enough to delete a school.
    const { data } = await supabase.auth.getUser();
    const { error: wrong } = await supabase.auth.signInWithPassword({ email: data.user?.email ?? "", password });
    if (wrong) { setBusy(false); return setError({ field: "password", text: s.deleteWrongPassword }); }
    const { data: when, error: failed } = await supabase.rpc("request_school_deletion", { p_school_id: school.id, p_confirm_name: name });
    setBusy(false);
    if (failed) return setError(failed.code === "CL005" ? { field: "name", text: s.deleteWrongName } : { field: "form", text: friendlyError(failed, t.errors) });
    onClose();
    await reload();
    notify(s.deleteScheduled(formatDate(String(when), "long")));
  };
  return <div className="drawer-layer" onClick={onClose}><form className="form-modal" role="alertdialog" aria-label={s.deleteConfirmTitle} onClick={(event) => event.stopPropagation()} onSubmit={submit}>
    <div className="form-modal-head"><div><span className="eyebrow">{s.dangerTitle}</span><h2>{s.deleteConfirmTitle}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label={t.common.close}><Icon name="close" size={20} /></button></div>
    <div className="form-modal-body">
      <p className="danger-warning"><Icon name="warning" size={16} /> {s.deleteText}</p>
      <label className="form-field full">{s.deleteTypeName(school.name)}
        <input className="field" value={name} autoComplete="off" aria-invalid={error?.field === "name"} onChange={(event) => { setName(event.target.value); setError(null); }} />
        {error?.field === "name" && <span className="field-error">{error.text}</span>}</label>
      <label className="form-field full">{s.deletePassword}
        <input className="field" type="password" value={password} autoComplete="current-password" aria-invalid={error?.field === "password"} onChange={(event) => { setPassword(event.target.value); setError(null); }} />
        {error?.field === "password" && <span className="field-error">{error.text}</span>}</label>
      {error?.field === "form" && <p className="field-error">{error.text}</p>}
    </div>
    <div className="form-modal-foot"><Button variant="outline" onClick={onClose}>{t.common.cancel}</Button><Button type="submit" variant="danger" icon="trash" disabled={busy || !name || !password}>{s.deleteConfirm}</Button></div>
  </form></div>;
}

async function invokeError(error: unknown, failed: string, unavailable: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    return body?.error ?? failed;
  }
  return unavailable;
}

function UserSettings({ userId }: { userId: string }) {
  const t = useAppT();
  const s = t.settings;
  const { members, teachers, school, save, notify, reload, blocked, ask } = useData();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const roleOptions = ROLES.map((role) => ({ value: role, label: t.roles[role] }));
  const teacherOptions = teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.full_name }));
  const teacherField = (values: Record<string, string>) => (values.role === "teacher" ? [{ key: "teacher", label: s.fTeacher, type: "select" as const, required: true, full: true, options: [{ value: "", label: s.chooseOne }, ...teacherOptions] }] : []);
  const remove = async (member: MemberRow) => await ask({ title: s.removeTitle(member.full_name || member.email || ""), danger: true, confirmLabel: s.removeConfirm, text: s.removeText })
    && save(() => supabase.from("school_members").delete().eq("school_id", school.id).eq("user_id", member.user_id), s.removed);

  return <Panel title={s.users} action={<Button icon="plus" onClick={() => setInviting(true)}>{s.invite}</Button>}>
    {members.length ? <ShowMore items={members}>{(list) => <div className="user-list">{list.map((member) => {
      const teacher = teachers.find((item) => item.id === member.teacher_id);
      const isMe = member.user_id === userId;
      return <div className="user-row" key={member.user_id}>
        {initialsBadge(member.full_name || member.email || "?")}
        <div><strong>{member.full_name || s.noName}{isMe ? s.you : ""}</strong><span>{member.email || s.unknownEmail}{teacher ? s.teacherFile(teacher.full_name) : ""}</span></div>
        <Badge tone="info">{t.roles[member.role]}</Badge>
        {!isMe && <span className="card-actions"><button className="row-menu" aria-label={t.common.edit} onClick={() => setEditing(member)}><Icon name="edit" size={15} /></button><button className="row-menu" aria-label={t.common.remove} onClick={() => remove(member)}><Icon name="trash" size={15} /></button></span>}
      </div>;
    })}</div>}</ShowMore> : <EmptyState title={s.emptyUsers} text={s.emptyUsersText} />}
    <p className="form-hint"><Icon name="mail" size={13} /> {s.inviteHint}</p>

    {inviting && <FormModal title={s.inviteTitle} subtitle={s.users} submitLabel={s.inviteSubmit} onClose={() => setInviting(false)}
      initial={{ email: "", full_name: "", role: "secretaire", teacher: "" }}
      fields={(values) => [
        { key: "email", label: t.common.email, type: "email", required: true, full: true, placeholder: "prenom@ecole.dz" },
        { key: "full_name", label: s.fFullName, required: true, full: true },
        { key: "role", label: s.fRole, type: "select", options: roleOptions, full: true },
        ...teacherField(values),
      ]}
      onSubmit={async (values) => {
        if (blocked()) return false;
        const { data, error } = await supabase.functions.invoke("invite-user", { body: {
          school_id: school.id, email: values.email.trim(), full_name: values.full_name.trim(), role: values.role,
          teacher_id: values.role === "teacher" ? Number(values.teacher) : null,
        } });
        if (error) { notify(await invokeError(error, s.inviteFailed, s.inviteUnavailable)); return false; }
        await reload();
        // A login whose access was removed keeps its password: no new email is sent.
        notify(data?.reactivated ? s.reactivated(values.email.trim()) : s.invited(values.email.trim()));
        return true;
      }} />}

    {editing && <FormModal title={s.editAccess} subtitle={editing.email ?? s.user} submitLabel={t.common.save} onClose={() => setEditing(null)}
      initial={{ full_name: editing.full_name ?? "", role: editing.role, teacher: String(editing.teacher_id ?? "") }}
      fields={(values) => [
        { key: "full_name", label: s.fFullName, required: true, full: true },
        { key: "role", label: s.fRole, type: "select", options: roleOptions, full: true },
        ...teacherField(values),
      ]}
      onSubmit={(values) => save(() => supabase.from("school_members").update({
        full_name: values.full_name.trim(), role: values.role, teacher_id: values.role === "teacher" ? Number(values.teacher) : null,
      }).eq("school_id", school.id).eq("user_id", editing.user_id), s.accessSaved)} />}
  </Panel>;
}

// ---------------------------------------------------------------- Activity log

type LogRow = { id: number; at: string; actor: string | null; actor_name: string | null; table_name: string; action: "INSERT" | "UPDATE" | "DELETE"; old_row: Record<string, any> | null; new_row: Record<string, any> | null; changed: string[] | null };
// The log keeps no personal details, only the names of the fields that changed (see migration 0012),
// so names are resolved against the live data and fall back once the record is gone.
const LOG_KINDS = ["", "payments", "enrollments", "students", "school_members"];
const LOG_ICONS: Record<string, IconName> = { payments: "wallet", enrollments: "enrol", students: "graduation", school_members: "lock" };

function ActivityLog() {
  const t = useAppT();
  const s = t.settings;
  const { studentById, enrollments, courses, members, money, notify } = useData();
  const changedFields = (changed: string[] | null) =>
    changed?.length ? ` (${changed.map((field) => s.fields[field] ?? field).join(", ")})` : "";
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState<LogRow[]>();

  useEffect(() => {
    let query = supabase.from("activity_log").select("id, at, actor, actor_name, table_name, action, old_row, new_row, changed").order("at", { ascending: false }).limit(200);
    if (kind) query = query.eq("table_name", kind);
    query.then(({ data, error }) => {
      if (error) notify(friendlyError(error, t.errors));
      setRows((data ?? []) as LogRow[]);
    });
  }, [kind, notify, t]);

  // Names come from the saved row itself when the student or enrollment no longer exists.
  const studentName = (id?: number) => (id && studentById.get(id)?.full_name) || s.deletedStudent;
  const enrollmentLabel = (row: Record<string, any>) => `${studentName(row.student_id)} · ${courses.find((course) => course.id === row.course_id)?.name ?? s.someCourse}`;
  const payer = (enrollmentId: number) => { const enrollment = enrollments.find((item) => item.id === enrollmentId); return enrollment ? studentName(enrollment.student_id) : s.deletedEnrollment; };
  const memberName = (userId?: string) => {
    const member = members.find((item) => item.user_id === userId);
    return member?.full_name || member?.email || s.someUser;
  };
  const describe = ({ table_name, action, old_row: old, new_row: row, changed }: LogRow) => {
    const data = (row ?? old)!;
    if (table_name === "payments") {
      const method = labelOf(t.v.method, data.method);
      if (action === "INSERT") return s.logPaymentIn(money(data.amount), method, payer(data.enrollment_id));
      if (action === "DELETE") return s.logPaymentOut(money(data.amount), method, payer(data.enrollment_id));
      return s.logPaymentEdit(payer(data.enrollment_id), money(old!.amount), money(data.amount));
    }
    if (table_name === "enrollments") {
      if (action === "INSERT") return s.logEnrollIn(enrollmentLabel(data), money(data.total));
      if (action === "DELETE") return s.logEnrollOut(enrollmentLabel(data));
      if (old!.status !== data.status) return s.logEnrollStatus(enrollmentLabel(data), labelOf(t.v.status, old!.status), labelOf(t.v.status, data.status));
      if (old!.total !== data.total) return s.logEnrollTotal(enrollmentLabel(data), money(old!.total), money(data.total));
      return s.logEnrollEdit(enrollmentLabel(data), changedFields(changed));
    }
    if (table_name === "students") {
      const student = studentName(data.id);
      if (action === "INSERT") return s.logStudentIn(student);
      if (action === "DELETE") return s.logStudentOut(student);
      return s.logStudentEdit(student, changedFields(changed));
    }
    const who = memberName(data.user_id);
    const roleName = (role: string) => t.roles[role as Role] ?? role;
    if (action === "INSERT") return s.logAccessIn(roleName(data.role), who);
    if (action === "DELETE") return s.logAccessOut(who);
    return old!.role !== data.role ? s.logAccessRole(who, roleName(old!.role), roleName(data.role)) : s.logAccessEdit(who, changedFields(changed));
  };
  const time = (at: string) => new Date(at).toLocaleString(locale(), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return <Panel title={s.log} action={<select className="select" aria-label={s.logKind} value={kind} onChange={(event) => setKind(event.target.value)}>{LOG_KINDS.map((value) => <option key={value} value={value}>{s.logKinds[value]}</option>)}</select>}>
    {!rows ? <p className="muted-copy">{t.common.loading}</p> : rows.length ? <ShowMore items={rows}>{(list) => <div className="activity-log">{list.map((row) => <div className="activity-log-row" key={row.id}>
      <span className="activity-icon" style={{ background: row.action === "DELETE" ? "var(--bad-bg)" : COLORS.tealLight, color: row.action === "DELETE" ? COLORS.red : COLORS.teal }}><Icon name={LOG_ICONS[row.table_name] ?? "file"} size={14} /></span>
      <p><strong>{row.actor_name || (row.actor ? s.someone : s.system)}</strong> {describe(row)}</p>
      <time dateTime={row.at}>{time(row.at)}</time>
    </div>)}</div>}</ShowMore> : <EmptyState title={s.emptyLog} text={s.emptyLogText} />}
    <p className="form-hint"><Icon name="lock" size={13} /> {s.logHint}</p>
  </Panel>;
}
