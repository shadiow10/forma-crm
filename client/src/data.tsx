import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Member as AuthMember } from "./auth";
import { supabase } from "./lib/supabase";
import { loadSchoolData } from "./lib/queries";
import type { Enrollment, EnrollmentStatus, Group, SchoolData, Student } from "./lib/queries";
import { setSchoolKind, useAppT } from "./appCopy";
import type { AppCopy } from "./appCopy";
import { ConfirmDialog } from "./appUI";
import type { Question } from "./appUI";
import { percent } from "./ui";

export type PaymentStatus = "Payé" | "Partiel" | "Non payé" | "—";
export type StudentSummary = {
  enrollments: Enrollment[];
  latest: Enrollment | undefined;
  status: EnrollmentStatus | "Sans inscription";
  total: number;
  paid: number;
  balance: number;
  paymentStatus: PaymentStatus;
  attendance: number | null; // % of sessions present or late, null when no session recorded
};

type Store = SchoolData & {
  me: AuthMember;
  subscription: Subscription;
  canEdit: boolean; // director or secretaire
  readOnly: boolean; // demo school, or subscription past its grace period: the database refuses every change
  blocked: () => boolean; // true (and explains why) when a change is not possible in the demo
  isDirector: boolean;
  isSoutien: boolean; // école de soutien: subjects billed by the month (migration 0019)
  money: (value: number) => string;
  reload: () => Promise<void>;
  notify: (message: string) => void;
  // Asks the question in the app's own dialog; resolves true when the person confirms.
  ask: (question: Question) => Promise<boolean>;
  notice: string;
  clearNotice: () => void;
  // Runs a write. Shows the error in French and returns false on failure; reloads data and shows `success` otherwise.
  save: (action: () => PromiseLike<{ error: { code?: string; message: string } | null }>, success: string) => Promise<boolean>;
  studentById: Map<number, Student>;
  groupById: Map<number, Group>;
  summaryOf: (studentId: number) => StudentSummary;
  balanceOf: (enrollmentId: number) => { paid: number; balance: number; monthsDue: number | null };
  groupStudentIds: (groupId: number) => number[];
  attendanceRate: (studentId: number, groupId?: number) => number | null;
};

// Must match private.is_frozen in the database: 15 days after a paid plan, 3 after a free trial (0033).
const GRACE_DAYS = 15;
const TRIAL_GRACE_DAYS = 3;
const WARN_DAYS = 7;   // start warning this long before the due date

// Where a school stands with its subscription. The database enforces the same rule; this only
// explains it. "none" = never billed (the demo, or a school opened by hand).
export type Subscription =
  | { state: "none" }
  | { state: "active"; daysLeft: number }
  | { state: "trial"; daysLeft: number }   // free trial running: `daysLeft` days of it, today included
  | { state: "grace"; daysLeft: number }   // past due, still writable, `daysLeft` of grace remain
  | { state: "frozen" };

export function subscriptionOf(paidUntil: string | null, billing: string | null = null): Subscription {
  if (!paidUntil) return { state: "none" };
  const day = 24 * 60 * 60 * 1000;
  const today = new Date(new Date().toDateString()).getTime();
  const dueIn = Math.round((new Date(`${paidUntil}T00:00:00`).getTime() - today) / day);
  const trial = billing === "trial";
  if (dueIn >= 0) return trial ? { state: "trial", daysLeft: dueIn + 1 } : { state: "active", daysLeft: dueIn };
  const grace = trial ? TRIAL_GRACE_DAYS : GRACE_DAYS;
  if (dueIn >= -grace) return { state: "grace", daysLeft: grace + dueIn };
  return { state: "frozen" };
}

const DataContext = createContext<Store | null>(null);

export function friendlyError(error: { code?: string; message: string }, e: AppCopy["errors"]) {
  if (error.code === "42501") return e.role;
  if (error.code === "23503") return e.inUse;
  if (error.code === "23505") return e.duplicate;
  if (error.code === "23514") return e.invalid;
  if (error.code === "CL001") return e.studentLimit; // 0027: the school reached its student limit
  if (error.code === "CL002") return e.groupFull; // 0029: the group has no seat left
  if (/fetch|network/i.test(error.message)) return e.network;
  // Raw Postgres messages name tables, columns and constraints. Dev console only: in production the
  // console belongs to whoever opened devtools, and a schema map should not be there for the taking.
  if (import.meta.env.DEV) console.error(error);
  return e.generic;
}

export function DataProvider({ member, children, fallback }: { member: AuthMember; children: ReactNode; fallback: (state: { error?: string; retry: () => void }) => ReactNode }) {
  const t = useAppT();
  const [data, setData] = useState<SchoolData>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [question, setQuestion] = useState<(Question & { answer: (yes: boolean) => void }) | null>(null);

  const reload = useCallback(async () => {
    try {
      const started = performance.now();
      setData(await loadSchoolData(supabase, member.school.id));
      console.info(`Données de l'école chargées en ${Math.round(performance.now() - started)} ms`);
      setError("");
    } catch (caught) {
      if (import.meta.env.DEV) console.error("Chargement des données :", caught); // exact table and reason, dev only
      setError(friendlyError(caught as { code?: string; message: string }, t.errors));
    }
  }, [member.school.id, t]);

  useEffect(() => { void reload(); }, [reload]);

  // Notices disappear on their own after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    setSchoolKind(data.school.kind ?? "formation");
    const currency = data.school.currency || "DA";
    const balances = new Map(data.balances.map((row) => [row.enrollment_id, row]));
    const enrollmentsByStudent = new Map<number, Enrollment[]>();
    for (const enrollment of data.enrollments) enrollmentsByStudent.set(enrollment.student_id, [...(enrollmentsByStudent.get(enrollment.student_id) ?? []), enrollment]);
    const statsByStudent = new Map<number, typeof data.attendanceStats>();
    for (const stat of data.attendanceStats) statsByStudent.set(stat.student_id, [...(statsByStudent.get(stat.student_id) ?? []), stat]);
    const studentsByGroup = new Map<number, number[]>();
    for (const row of data.groupStudents) studentsByGroup.set(row.group_id, [...(studentsByGroup.get(row.group_id) ?? []), row.student_id]);

    const balanceOf = (enrollmentId: number) => {
      const row = balances.get(enrollmentId);
      return { paid: row?.paid ?? 0, balance: row?.balance ?? 0, monthsDue: row?.months_due ?? null };
    };
    const attendanceRate = (studentId: number, groupId?: number) => {
      const stats = (statsByStudent.get(studentId) ?? []).filter((stat) => groupId === undefined || stat.group_id === groupId);
      const sessions = stats.reduce((sum, stat) => sum + stat.sessions - (stat.excused ?? 0), 0); // an excused session is not held against them
      return sessions ? percent(stats.reduce((sum, stat) => sum + stat.present + stat.late, 0), sessions) : null;
    };
    const summaryOf = (studentId: number): StudentSummary => {
      const enrollments = enrollmentsByStudent.get(studentId) ?? [];
      const latest = enrollments[enrollments.length - 1]; // loaded in enrolled_on order
      const billable = enrollments.filter((enrollment) => enrollment.status !== "Abandonné");
      const total = billable.reduce((sum, enrollment) => sum + enrollment.total, 0);
      const paid = billable.reduce((sum, enrollment) => sum + balanceOf(enrollment.id).paid, 0);
      const balance = billable.reduce((sum, enrollment) => sum + balanceOf(enrollment.id).balance, 0);
      const paymentStatus: PaymentStatus = !billable.length ? "—" : balance === 0 ? "Payé" : paid > 0 ? "Partiel" : "Non payé";
      return { enrollments, latest, status: latest?.status ?? "Sans inscription", total, paid, balance, paymentStatus, attendance: attendanceRate(studentId) };
    };

    const subscription = subscriptionOf(data.school.paid_until, data.school.billing);
    // A scheduled deletion (0034) locks the school like an expired one, with its own message.
    const frozen = data.school.is_demo || data.school.delete_after !== null || subscription.state === "frozen";
    const blocked = () => { if (frozen) setNotice(data.school.is_demo ? t.errors.demo : data.school.delete_after ? t.errors.deleting : t.errors.frozen); return frozen; };
    return {
      ...data,
      me: member,
      subscription,
      canEdit: member.role !== "teacher",
      readOnly: frozen,
      blocked,
      isDirector: member.role === "director",
      isSoutien: data.school.kind === "soutien",
      money: (value: number) => `⁦${new Intl.NumberFormat("fr-FR").format(value).replace(/[\u202f\u00a0]/g, " ")} ${currency}⁩`,
      reload,
      notify: setNotice,
      ask: (next: Question) => new Promise<boolean>((resolve) => setQuestion({ ...next, answer: (yes) => { setQuestion(null); resolve(yes); } })),
      notice,
      clearNotice: () => setNotice(""),
      save: async (action, success) => {
        if (blocked()) return false;
        const { error } = await action();
        if (error) { setNotice(friendlyError(error, t.errors)); return false; }
        await reload();
        setNotice(success);
        return true;
      },
      studentById: new Map(data.students.map((student) => [student.id, student])),
      groupById: new Map(data.groups.map((group) => [group.id, group])),
      summaryOf,
      balanceOf,
      groupStudentIds: (groupId: number) => studentsByGroup.get(groupId) ?? [],
      attendanceRate,
    };
  }, [data, member, notice, reload, t]);

  if (!store) return <>{fallback({ error: error || undefined, retry: reload })}</>;
  return <DataContext.Provider value={store}>
    {children}
    {question && <ConfirmDialog question={question} onAnswer={question.answer} />}
  </DataContext.Provider>;
}

export function useData() {
  const store = useContext(DataContext);
  if (!store) throw new Error("useData must be used inside <DataProvider>");
  return store;
}
