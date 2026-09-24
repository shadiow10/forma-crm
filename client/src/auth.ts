import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { arrivedToSetPassword, supabase } from "./lib/supabase";

export type Role = "director" | "secretaire" | "teacher";
export type PageKey = "dashboard" | "students" | "enrollments" | "formations" | "teachers" | "groups" | "planning" | "attendance" | "payments" | "certificates" | "settings";

export type Member = {
  role: Role;
  full_name: string | null;
  teacher_id: number | null;
  school: { id: number; name: string; slug: string };
};

export const roleLabels: Record<Role, string> = { director: "Directeur", secretaire: "Secrétaire", teacher: "Formateur" };

// Menu access per role. The database enforces the same rules; this only hides pages a role cannot use.
export const rolePages: Record<Role, PageKey[]> = {
  director: ["dashboard", "students", "enrollments", "formations", "teachers", "groups", "planning", "attendance", "payments", "certificates", "settings"],
  secretaire: ["dashboard", "students", "enrollments", "formations", "groups", "planning", "attendance", "payments"],
  teacher: ["planning", "groups", "attendance", "formations"],
};

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "setPassword"; email: string }
  | { status: "error"; message: string }
  | { status: "noAccess"; email: string }
  | { status: "ready"; member: Member; email: string; userId: string };

let passwordListener: (() => void) | null = null;
// Called once the user has chosen their password after an invitation or reset link.
export const passwordChosen = () => passwordListener?.();

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>();
  const [members, setMembers] = useState<Member[]>();
  const [error, setError] = useState("");
  const [mustSetPassword, setMustSetPassword] = useState(arrivedToSetPassword);

  useEffect(() => {
    passwordListener = () => setMustSetPassword(false);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setMustSetPassword(true);
      if (event === "SIGNED_OUT") setMustSetPassword(false);
      setSession(next);
    });
    return () => { data.subscription.unsubscribe(); passwordListener = null; };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    setMembers(undefined);
    setError("");
    if (!userId) return;
    supabase
      .from("school_members")
      .select("role, full_name, teacher_id, school:schools(id, name, slug)")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        // The raw message names tables and columns: it belongs in the console, not on screen.
        if (error) { console.error("Chargement du profil :", error); setError("profil illisible"); }
        else setMembers(data as unknown as Member[]);
      });
  }, [userId]);

  if (session === undefined) return { status: "loading" };
  if (session === null) return { status: "signedOut" };
  const email = session.user.email ?? "";
  if (mustSetPassword) return { status: "setPassword", email };
  if (error) return { status: "error", message: error };
  if (!members) return { status: "loading" };
  // ponytail: first membership wins; pick the school from the subdomain once schools get their own addresses.
  if (!members.length) return { status: "noAccess", email };
  return { status: "ready", member: members[0], email, userId: session.user.id };
}

export const signOut = () => supabase.auth.signOut();
