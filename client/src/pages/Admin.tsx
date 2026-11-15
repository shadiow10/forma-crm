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
import { EXTRA_PACKS } from "../lib/plans";
import type { MemberRow } from "../lib/queries";
import { supabase } from "../lib/supabase";
import { FormModal } from "../appUI";
import { Badge, Button, COLORS, EmptyState, Icon, PageHeader, Panel, formatDate, initialsBadge, setTheme, todayISO, useTheme, variants } from "../ui";
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
        {eligible.length ? <div className="certificate-list">{eligible.map((enrollment) => {
          const name = studentById.get(enrollment.student_id)?.full_name ?? "—";
          return <div className={`certificate-row ${enrollment.id === selectedId ? "selected" : ""}`} key={enrollment.id} onClick={() => setSelectedId(enrollment.id)}>
            {initialsBadge(name)}<div><strong>{name}</strong><span>{courses.find((item) => item.id === enrollment.course_id)?.name}</span></div><Badge tone="success">{c.eligible}</Badge>
          </div>;
        })}</div> : <EmptyState title={c.empty} text={c.emptyText} />}
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
export function Settings({ userId, signedInAs, onSignOut }: { userId: string; signedInAs: string; onSignOut: () => void }) {
  const t = useAppT();
  const s = t.settings;
  const { isDirector } = useData();
  // Everyone gets the display preferences; the school, the team and the log stay with the director.
  const tabs: { key: "school" | "users" | "activity" | "prefs"; icon: IconName; label: string }[] = [
    ...(isDirector ? [
      { key: "school" as const, icon: "building" as const, label: s.tabSchool },
      { key: "users" as const, icon: "users" as const, label: s.tabUsers },
      { key: "activity" as const, icon: "clock" as const, label: s.tabActivity },
    ] : []),
    { key: "prefs", icon: "settings", label: s.tabPrefs },
  ];
  const [tab, setTab] = useState(tabs[0].key);
  return <>
    <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} />
    <div className="settings-layout">
      <aside className="settings-nav">
        {tabs.map((item) => <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}><Icon name={item.icon} size={16} />{item.label}<Icon name="chevron" size={15} /></button>)}
        <div className="settings-account">
          <span>{s.signedInAs(signedInAs)}</span>
          <button className="settings-logout" onClick={onSignOut}><Icon name="logout" size={16} />{t.common.signOut}</button>
        </div>
      </aside>
      <div className="settings-content">{tab === "school" ? <><SchoolSettings /><StudentLimit /></> : tab === "users" ? <UserSettings userId={userId} /> : tab === "activity" ? <ActivityLog /> : <Preferences />}</div>
    </div>
  </>;
}

function Preferences() {
  const s = useAppT().settings;
  const lang = useLang();
  const theme = useTheme();
  return <Panel title={s.prefs}>
    <div className="settings-form">
      <label>{s.fLanguage}<select className="field" value={lang} onChange={(event) => setLang(event.target.value as Lang)}>{LANGS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>{s.fTheme}<select className="field" value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark")}><option value="light">{s.themeLight}</option><option value="dark">{s.themeDark}</option></select></label>
    </div>
    <p className="form-hint">{s.prefsHint}</p>
  </Panel>;
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
      {school.paid_until && <p className="form-hint"><Icon name="calendar" size={13} /> {s.subscription(school.billing === "yearly" ? s.yearly : school.billing === "semester" ? s.semester : s.monthly, subscription.state === "frozen" ? s.expired : s.valid, formatDate(school.paid_until))}</p>}
      <Button type="submit" icon="check" disabled={busy}>{busy ? t.common.saving : t.common.save}</Button>
    </form>
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
    {members.length ? <div className="user-list">{members.map((member) => {
      const teacher = teachers.find((item) => item.id === member.teacher_id);
      const isMe = member.user_id === userId;
      return <div className="user-row" key={member.user_id}>
        {initialsBadge(member.full_name || member.email || "?")}
        <div><strong>{member.full_name || s.noName}{isMe ? s.you : ""}</strong><span>{member.email || s.unknownEmail}{teacher ? s.teacherFile(teacher.full_name) : ""}</span></div>
        <Badge tone="info">{t.roles[member.role]}</Badge>
        {!isMe && <span className="card-actions"><button className="row-menu" aria-label={t.common.edit} onClick={() => setEditing(member)}><Icon name="edit" size={15} /></button><button className="row-menu" aria-label={t.common.remove} onClick={() => remove(member)}><Icon name="trash" size={15} /></button></span>}
      </div>;
    })}</div> : <EmptyState title={s.emptyUsers} text={s.emptyUsersText} />}
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
const LOG_ICONS: Record<string, IconName> = { payments: "wallet", enrollments: "file", students: "graduation", school_members: "lock" };

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
    {!rows ? <p className="muted-copy">{t.common.loading}</p> : rows.length ? <div className="activity-log">{rows.map((row) => <div className="activity-log-row" key={row.id}>
      <span className="activity-icon" style={{ background: row.action === "DELETE" ? "var(--bad-bg)" : COLORS.tealLight, color: row.action === "DELETE" ? COLORS.red : COLORS.teal }}><Icon name={LOG_ICONS[row.table_name] ?? "file"} size={14} /></span>
      <p><strong>{row.actor_name || (row.actor ? s.someone : s.system)}</strong> {describe(row)}</p>
      <time dateTime={row.at}>{time(row.at)}</time>
    </div>)}</div> : <EmptyState title={s.emptyLog} text={s.emptyLogText} />}
    <p className="form-hint"><Icon name="lock" size={13} /> {s.logHint}</p>
  </Panel>;
}
