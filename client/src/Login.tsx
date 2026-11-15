import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { flushSync } from "react-dom";
import { passwordChosen, signOut } from "./auth";
import { usePage, useT } from "./i18n";
import type { Copy } from "./i18n";
import { BrandMark, Icon, Spinner } from "./ui";
import { supabase } from "./lib/supabase";

// The sign-up form lives with the order form it shares its fields with; it loads with the landing page.
const SignupForm = lazy(() => import("./Landing").then((m) => ({ default: m.SignupForm })));

export function AuthShell({ children, tabs }: { children: ReactNode; tabs?: ReactNode }) {
  const t = useT();
  const page = usePage();
  return (
    <div className="auth-page" {...page}>
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark size={36} />
          <div>
            <strong dir="ltr">
              CLASSTRA<span>.</span>
            </strong>
            <small>{t.auth.tagline}</small>
          </div>
        </div>
        {tabs}
        {children}
      </div>
    </div>
  );
}

// Supabase answers a failed sign-in with a code; anything without one is a network or server
// problem, never "wrong password" — saying so plainly is the difference between a user who
// retries and a user who gives up.
const errorMessage = (error: { code?: string; status?: number; message?: string }, t: Copy) => {
  if (error.code === "validation_failed") return t.auth.errors.missing;
  if (error.code === "email_address_invalid") return t.auth.errors.badEmail;
  if (error.code === "email_not_confirmed") return t.auth.errors.notConfirmed;
  if (error.code === "weak_password") return t.auth.errors.weak;
  if (error.code === "same_password") return t.auth.errors.same;
  if (error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit" || error.status === 429) return t.auth.errors.tooMany;
  if (error.code === "invalid_credentials" || error.status === 400) return t.auth.errors.invalid;
  return t.auth.errors.offline;
};

type Tab = "login" | "signup";
const TAB_PATHS: Record<Tab, string> = { login: "/connexion", signup: "/creer-un-compte" };

// Sign in and create an account share one card. The switch moves a thumb between the two tabs
// and the card resizes to the other form; both run as one view transition where the browser has
// them (Chrome, Edge, Safari 18), and as a plain swap elsewhere or under reduced motion.
// `trial` (/essai): the sign-up tab is the free trial one, and keeps the /essai address.
export default function Login({ initial = "login", trial = false }: { initial?: Tab; trial?: boolean }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(initial);
  const wanted = useRef<Tab>(initial); // the last tab asked for, even while a transition is still running
  const running = useRef<ViewTransition | null>(null);
  useEffect(() => { void import("./Landing"); }, []); // the sign-up form is ready before it is asked for
  const show = (next: Tab) => {
    if (next === wanted.current) return;
    wanted.current = next;
    running.current?.skipTransition(); // a quick second click wins over the animation still playing
    // The address changes with the form, never ahead of it.
    const apply = () => { flushSync(() => setTab(next)); window.history.replaceState(null, "", trial && next === "signup" ? "/essai" : TAB_PATHS[next]); };
    if (!("startViewTransition" in document) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    running.current = document.startViewTransition(apply);
  };
  const tabs = <div className="auth-tabs" role="tablist" data-tab={tab}>
    <span className="auth-tabs-thumb" aria-hidden="true" />
    <button type="button" role="tab" aria-selected={tab === "login"} onClick={() => show("login")}>{t.signIn}</button>
    <button type="button" role="tab" aria-selected={tab === "signup"} onClick={() => show("signup")}>{trial ? t.trial.cta : t.signup.link}</button>
  </div>;
  return (
    <AuthShell tabs={tabs}>
      {tab === "login" ? <SignInForm /> : <Suspense fallback={<p className="auth-muted">{t.access.loading}</p>}><SignupForm trial={trial} /></Suspense>}
      <p className="auth-muted auth-foot"><a className="text-button" href="/">{t.auth.discover}</a></p>
    </AuthShell>
  );
}

function SignInForm() {
  const t = useT();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    // Caught before the round trip, so the answer is instant and names the real problem.
    if (!email.trim() || (mode === "login" && !password)) return setError(t.auth.errors.missing);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t.auth.errors.badEmail);
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(errorMessage(error, t));
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) setError(errorMessage(error, t));
        else setSent(true);
      }
    } catch (failure) {
      // A rejected promise means the request never reached Supabase (offline, DNS, blocked).
      console.error(failure);
      setError(t.auth.errors.offline);
    }
    setBusy(false);
  };
  const switchMode = (next: "login" | "reset") => { setMode(next); setError(""); setSent(false); };
  const wrong = Boolean(error) && !sent;

  return (
    <>
      <h1>{mode === "login" ? t.auth.title : t.auth.resetTitle}</h1>
      <p className="auth-muted">{mode === "login" ? t.auth.lead : t.auth.resetLead}</p>
      {sent ? (
        <p className="auth-success" role="status">{t.auth.sent(email.trim())}</p>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <label>
            {t.auth.email}
            <input className="field" type="email" autoComplete="email" autoFocus value={email} aria-invalid={wrong} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="prenom@ecole.dz" />
          </label>
          {mode === "login" && (
            <label>
              {t.auth.password}
              <input className="field" type="password" autoComplete="current-password" value={password} aria-invalid={wrong} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
            </label>
          )}
          {error && <p className="auth-error" role="alert"><Icon name="warning" size={16} />{error}</p>}
          <button className="button auth-submit" type="submit" disabled={busy}>
            {busy && <Spinner />}
            {busy ? (mode === "login" ? t.auth.busy : t.auth.sending) : mode === "login" ? t.auth.submit : t.auth.sendLink}
          </button>
        </form>
      )}
      <p className="auth-muted auth-foot">
        {mode === "login"
          ? <button className="text-button" type="button" onClick={() => switchMode("reset")}>{t.auth.forgot}</button>
          : <button className="text-button" type="button" onClick={() => switchMode("login")}>{t.auth.backToLogin}</button>}
      </p>
    </>
  );
}

// Refuses passwords found in public leaks (Have I Been Pwned). Only the first 5 characters of the
// password's SHA-1 hash are sent; the password itself never leaves the browser.
// ponytail: fails open (offline, blocked API) — Supabase Pro has the same check server-side, switch to it there.
export async function isLeaked(password: string) {
  try {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    return response.ok && (await response.text()).includes(hash.slice(5));
  } catch {
    return false;
  }
}

// Shown after an invitation or password-reset link: the user is signed in and must choose a password.
export function SetPassword({ email }: { email: string }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,}$/.test(password)) return setError(t.auth.errors.weak);
    if (password !== confirm) return setError(t.auth.set.mismatch);
    setBusy(true);
    if (await isLeaked(password)) {
      setBusy(false);
      return setError(t.checkout.errors.leaked);
    }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(errorMessage(error, t));
    window.history.replaceState(null, "", window.location.pathname);
    passwordChosen();
  };

  return (
    <AuthShell>
      <h1>{t.auth.set.title}</h1>
      <p className="auth-muted">{t.auth.set.account(email)}</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          {t.auth.set.newPassword}
          <input className="field" type="password" autoComplete="new-password" required autoFocus minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label>
          {t.auth.set.confirm}
          <input className="field" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        {error && <p className="auth-error" role="alert"><Icon name="warning" size={16} />{error}</p>}
        <button className="button auth-submit" type="submit" disabled={busy}>{busy && <Spinner />}{busy ? t.auth.set.saving : t.auth.set.submit}</button>
      </form>
      <p className="auth-muted auth-foot"><button className="text-button" type="button" onClick={signOut}>{t.auth.set.cancel}</button></p>
    </AuthShell>
  );
}
