import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.");
}

// Read before the client consumes the URL: links from invitation and password-reset emails
// arrive with #...&type=invite or type=recovery, and those users must choose a password first.
export const arrivedToSetPassword = ["invite", "recovery"].includes(new URLSearchParams(window.location.hash.slice(1)).get("type") ?? "");

export const supabase = createClient(url, anonKey);
