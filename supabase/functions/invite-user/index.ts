// Invites a staff member by email and attaches them to the caller's school.
// Only a director of that school can call it. Deployed as the Supabase Edge Function "invite-user".
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée." }, 405);

  const { school_id, email, full_name, role, teacher_id, redirect_to } = await req.json().catch(() => ({}));
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

  // Creating a login needs the service role, which never leaves this function.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(cleanEmail, { redirectTo: redirect_to });
  if (inviteError) {
    // ponytail: one school per login for now; attaching an existing account to a second school comes with multi-school support.
    const exists = /already|registered|exists/i.test(inviteError.message);
    return reply({ error: exists ? "Un compte existe déjà avec cet email." : inviteError.message }, 400);
  }

  const { error: memberError } = await caller.from("school_members").insert({
    school_id, user_id: invited.user.id, role, email: cleanEmail,
    full_name: String(full_name ?? "").trim() || null,
    teacher_id: role === "teacher" ? teacher_id : null,
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return reply({ error: memberError.message }, 400);
  }
  return reply({ ok: true });
});
