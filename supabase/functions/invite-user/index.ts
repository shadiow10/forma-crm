// Invites a staff member by email and attaches them to the caller's school.
// Only a director of that school can call it. Deployed as the Supabase Edge Function "invite-user".
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

// Only the app's own site may call this from a browser. SITE_URL is set with
// `supabase secrets set SITE_URL=https://...`. Without it the function refuses to serve:
// falling back to "*" would silently drop the origin check on a half-configured deploy.
const SITE_URL = Deno.env.get("SITE_URL");
const cors = {
  "Access-Control-Allow-Origin": SITE_URL ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// A school adds a handful of people, not a hundred.
const MAX_INVITES_PER_HOUR = 10;

Deno.serve(async (req) => {
  if (!SITE_URL) {
    console.error("SITE_URL is not set: refusing to serve. `supabase secrets set SITE_URL=https://...`");
    return new Response(JSON.stringify({ error: "Service mal configuré." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  const { school_id, email, full_name, role, teacher_id } = await req.json().catch(() => ({}));

  // school_id reaches four queries and an insert below; RLS is the real gate, but a value that is
  // not a plain positive integer is a malformed request and should say so rather than fail deeper.
  const schoolId = Number(school_id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) return reply({ error: "École invalide." }, 400);
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return reply({ error: "Email invalide." }, 400);
  if (!["director", "secretaire", "teacher"].includes(role)) return reply({ error: "Rôle invalide." }, 400);
  const teacherId = role === "teacher" ? Number(teacher_id) : null;
  if (role === "teacher" && (!Number.isInteger(teacherId) || teacherId! <= 0))
    return reply({ error: "Choisissez la fiche formateur à associer." }, 400);

  // The caller's own token: every table access below still goes through RLS.
  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return reply({ error: "Session expirée. Reconnectez-vous." }, 401);
  const { data: me } = await caller.from("school_members").select("role").eq("school_id", schoolId).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "director") return reply({ error: "Seul le directeur peut inviter des utilisateurs." }, 403);
  const { data: school } = await caller.from("schools").select("is_demo").eq("id", schoolId).single();
  if (school?.is_demo) return reply({ error: "La démonstration est en lecture seule." }, 403);

  // Everything that can be checked without sending an email is checked first, so a rejected
  // request never costs an email. The membership insert at the end is guarded by the same
  // foreign key, but reaching it means the invitation has already gone out.
  if (teacherId !== null) {
    const { data: teacher } = await caller.from("teachers").select("id").eq("school_id", schoolId).eq("id", teacherId).maybeSingle();
    if (!teacher) return reply({ error: "Fiche formateur introuvable." }, 400);
  }

  // Creating a login needs the service role, which never leaves this function.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cap attempts, not successes: the row goes in before the email is sent, so a request that fails
  // later still counts. invite_attempts is closed to the app, so a director cannot clear their own
  // counter. Without this, a stolen director session could send unlimited mail from our domain.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent } = await admin.from("invite_attempts")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .gte("at", since);
  if ((recent ?? 0) >= MAX_INVITES_PER_HOUR) return reply({ error: "Trop d'invitations en une heure. Réessayez plus tard." }, 429);
  const { error: attemptError } = await admin.from("invite_attempts").insert({ school_id: schoolId, actor: user.id });
  if (attemptError) {
    console.error("could not record invite attempt:", attemptError.message);
    return reply({ error: "L'invitation n'a pas pu être envoyée. Réessayez dans un instant." }, 503);
  }

  // No redirectTo from the request: the email link always goes to the project's Site URL (Auth → URL Configuration).
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(cleanEmail);
  let userId: string | undefined = invited?.user?.id;
  let reactivated = false;
  if (inviteError) {
    if (!/already|registered|exists/i.test(inviteError.message)) {
      console.error("invite failed:", inviteError.message); // details stay in the function logs
      return reply({ error: "L'invitation n'a pas pu être envoyée. Réessayez dans un instant." }, 400);
    }
    // Removing someone's access leaves their login in place, so a new invitation bounces here.
    // Attach it again when it belongs to no school at all; they keep their existing password.
    // ponytail: one school per login for now; joining a second school comes with multi-school support.
    const { data: orphan } = await admin.rpc("orphan_user_id", { p_email: cleanEmail });
    if (!orphan) {
      // The login exists but belongs to a school. Naming that is fine when it is this school —
      // the director can already see their own members — but saying it for any address would
      // turn this endpoint into a platform-wide "does this person have an account?" oracle.
      const { data: mine } = await caller.from("school_members").select("user_id").eq("school_id", schoolId).eq("email", cleanEmail).maybeSingle();
      if (mine) return reply({ error: "Cette personne fait déjà partie de votre école." }, 400);
      console.error("invite refused: address already belongs to another school:", cleanEmail);
      return reply({ error: "L'invitation n'a pas pu être envoyée pour cette adresse." }, 400);
    }
    userId = orphan as string;
    reactivated = true;
  }

  const { error: memberError } = await caller.from("school_members").insert({
    school_id: schoolId, user_id: userId, role, email: cleanEmail,
    full_name: String(full_name ?? "").trim() || null,
    teacher_id: teacherId,
  });
  if (memberError) {
    if (!reactivated) await admin.auth.admin.deleteUser(userId!); // invited a moment ago: undo it
    console.error("membership insert failed:", memberError.message);
    return reply({ error: "Impossible d'ajouter cette personne à l'école." }, 400);
  }
  return reply({ ok: true, reactivated });
});
