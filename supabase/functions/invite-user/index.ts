// Invites a staff member by email and attaches them to the caller's school.
// Only a director of that school can call it. Deployed as the Supabase Edge Function "invite-user".
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  // Only the app's own site may call this from a browser. SITE_URL is set with
  // `supabase secrets set SITE_URL=https://...`; without it, any origin is allowed.
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  const { school_id, email, full_name, role, teacher_id } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return reply({ error: "Email invalide." }, 400);
  if (!["director", "secretaire", "teacher"].includes(role)) return reply({ error: "Rôle invalide." }, 400);
  if (role === "teacher" && !teacher_id) return reply({ error: "Choisissez la fiche formateur à associer." }, 400);

  // The caller's own token: every table access below still goes through RLS.
  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return reply({ error: "Session expirée. Reconnectez-vous." }, 401);
  const { data: me } = await caller.from("school_members").select("role").eq("school_id", school_id).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "director") return reply({ error: "Seul le directeur peut inviter des utilisateurs." }, 403);
  const { data: school } = await caller.from("schools").select("is_demo").eq("id", school_id).single();
  if (school?.is_demo) return reply({ error: "La démonstration est en lecture seule." }, 403);

  // A school adds a handful of people, not a hundred: cap invitations so a stolen director
  // session cannot burn the email quota. Counted from the memberships created in the last hour.
  const { count: recent } = await caller.from("school_members")
    .select("user_id", { count: "exact", head: true })
    .eq("school_id", school_id)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((recent ?? 0) >= 10) return reply({ error: "Trop d'invitations en une heure. Réessayez plus tard." }, 429);

  // Creating a login needs the service role, which never leaves this function.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // No redirectTo from the request: the email link always goes to the project's Site URL (Auth → URL Configuration).
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(cleanEmail);
  let userId: string | undefined = invited?.user?.id;
  let reactivated = false;
  if (inviteError) {
    if (!/already|registered|exists/i.test(inviteError.message)) return reply({ error: inviteError.message }, 400);
    // Removing someone's access leaves their login in place, so a new invitation bounces here.
    // Attach it again when it belongs to no school at all; they keep their existing password.
    // ponytail: one school per login for now; joining a second school comes with multi-school support.
    const { data: orphan } = await admin.rpc("orphan_user_id", { p_email: cleanEmail });
    if (!orphan) return reply({ error: "Un compte existe déjà avec cet email." }, 400);
    userId = orphan as string;
    reactivated = true;
  }

  const { error: memberError } = await caller.from("school_members").insert({
    school_id, user_id: userId, role, email: cleanEmail,
    full_name: String(full_name ?? "").trim() || null,
    teacher_id: role === "teacher" ? teacher_id : null,
  });
  if (memberError) {
    if (!reactivated) await admin.auth.admin.deleteUser(userId!); // invited a moment ago: undo it
    return reply({ error: memberError.message }, 400);
  }
  return reply({ ok: true, reactivated });
});
