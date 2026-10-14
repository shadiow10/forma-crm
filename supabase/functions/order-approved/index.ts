// Opens a school when its order is set to 'payé', and sends the client's one email.
// Called by the database (migration 0026), never by a browser: it answers only to the shared
// secret in x-hook-secret, and is deployed without JWT verification for that reason:
//   supabase functions deploy order-approved --no-verify-jwt
//   supabase secrets set ORDER_HOOK_SECRET=<same string as private.app_settings> SITE_URL=https://...
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const SECRET = Deno.env.get("ORDER_HOOK_SECRET");
// The emails' links lead to the app's first site (SITE_URL may list several, see invite-user).
const SITE = (Deno.env.get("SITE_URL") ?? "").split(",")[0].trim();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (!SECRET || !SITE) {
    console.error("ORDER_HOOK_SECRET or SITE_URL is not set: refusing to serve.");
    return reply({ error: "not configured" }, 500);
  }
  if (req.method !== "POST" || req.headers.get("x-hook-secret") !== SECRET) return reply({ error: "forbidden" }, 403);
  const orderId = Number((await req.json().catch(() => ({}))).order_id);
  if (!Number.isInteger(orderId) || orderId <= 0) return reply({ error: "bad order id" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: order, error: readError } = await admin.from("orders").select("id, email, status, school_id, user_id").eq("id", orderId).single();
  if (readError || !order) { console.error("order not found:", orderId, readError?.message); return reply({ error: "order not found" }, 404); }
  if (order.status !== "payé" || order.school_id) return reply({ ok: true, skipped: true }); // already opened, or set back meanwhile

  // Who will direct the school: the account that placed the order, an account already made with
  // this address (sign-up page), or a new login created by invitation.
  let userId: string | null = order.user_id;
  let invited = false;
  if (!userId) {
    const { data: existing } = await admin.rpc("orphan_user_id", { p_email: order.email });
    if (existing) {
      const { data: found } = await admin.auth.admin.getUserById(existing as string);
      if (found.user?.email_confirmed_at) userId = found.user.id;
      // Unconfirmed: whoever made it never proved the address is theirs (the 0014 attack). Remove it;
      // the invitation below goes to the real owner, who sets their own password.
      else await admin.auth.admin.deleteUser(existing as string);
    }
  }
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(order.email, { redirectTo: SITE });
    if (error || !data.user) {
      // "already registered" here means the address belongs to another school's login.
      console.error("invite failed for order", orderId, error?.message);
      return reply({ error: "invite failed" }, 409);
    }
    userId = data.user.id;
    invited = true;
  }

  const { error: linkError } = await admin.from("orders").update({ user_id: userId }).eq("id", orderId);
  if (linkError) { console.error("could not link order", orderId, linkError.message); return reply({ error: "link failed" }, 500); }
  const { error: openError } = await admin.rpc("approve_order", { p_order_id: orderId });
  if (openError) {
    console.error("approve_order failed for order", orderId, openError.message);
    if (invited) await admin.auth.admin.deleteUser(userId); // nothing opened: take the invitation back
    return reply({ error: "open failed" }, 500);
  }

  // An invited client already has their email (choose a password). A client with an account gets a
  // sign-in link: that is the "your school is ready" message.
  if (!invited) {
    const { error } = await admin.auth.signInWithOtp({ email: order.email, options: { shouldCreateUser: false, emailRedirectTo: SITE } });
    if (error) console.error("school opened but the email failed for order", orderId, error.message);
  }
  return reply({ ok: true, invited });
});
