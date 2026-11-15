// Deletes the schools whose 30 days are up (migration 0034). Called once a day by the database
// (pg_cron → private.request_purge), never by a browser: it answers only to the shared secret in
// x-hook-secret, the same one as order-approved, and is deployed without JWT verification:
//   supabase functions deploy purge-schools --no-verify-jwt
// Files and logins can only be removed through the storage and auth services, so this runs here;
// everything else is one database call (purge_school).
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const SECRET = Deno.env.get("ORDER_HOOK_SECRET");
const BUCKET = "student-documents";
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (!SECRET) {
    console.error("ORDER_HOOK_SECRET is not set: refusing to serve.");
    return reply({ error: "not configured" }, 500);
  }
  if (req.method !== "POST" || req.headers.get("x-hook-secret") !== SECRET) return reply({ error: "forbidden" }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: due, error } = await admin.rpc("due_school_deletions");
  if (error) { console.error("could not list due schools:", error.message); return reply({ error: "list failed" }, 500); }

  const done: number[] = [];
  for (const schoolId of (due ?? []) as number[]) {
    // Files first: once the school row is gone, nothing would point to them any more. A school
    // whose files could not all be removed is left for tomorrow's run rather than half-deleted.
    const { data: files, error: listError } = await admin.rpc("school_files", { p_school_id: schoolId });
    if (listError) { console.error("school", schoolId, "files not listed:", listError.message); continue; }
    const paths = (files ?? []) as string[];
    let removed = true;
    for (let at = 0; at < paths.length; at += 100) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(paths.slice(at, at + 100));
      if (removeError) { console.error("school", schoolId, "files not removed:", removeError.message); removed = false; break; }
    }
    if (!removed) continue;

    const { data: freed, error: purgeError } = await admin.rpc("purge_school", { p_school_id: schoolId });
    if (purgeError) { console.error("school", schoolId, "not purged:", purgeError.message); continue; }
    // Logins left with no school at all. The school is already gone, so a failure here only leaves
    // an empty login behind, which the "no access" screen handles; it is logged for a manual look.
    for (const userId of (freed ?? []) as string[]) {
      const { error: userError } = await admin.auth.admin.deleteUser(userId);
      if (userError) console.error("school", schoolId, "login", userId, "not deleted:", userError.message);
    }
    done.push(schoolId);
  }
  return reply({ ok: true, purged: done });
});
