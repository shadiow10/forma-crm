import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { passwordChosen, signOut } from "./auth";
import { supabase } from "./lib/supabase";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">F</span>
          <div>
            <strong>
              FORMA<span>PLUS</span>
            </strong>
            <small>Gestion d'école</small>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

const errorMessage = (error: { code?: string; status?: number; message?: string }) => {
  if (error.code === "invalid_credentials") return "Email ou mot de passe incorrect.";
  if (error.code === "email_not_confirmed") return "Ce compte n'est pas encore confirmé. Contactez votre directeur.";
  if (error.code === "weak_password") return "Mot de passe trop faible : au moins 8 caractères, avec lettres et chiffres.";
  if (error.code === "same_password") return "Choisissez un mot de passe différent de l'ancien.";
  if (error.status === 429) return "Trop de tentatives. Réessayez dans quelques minutes.";
  return "Opération impossible. Vérifiez votre connexion internet et réessayez.";
};

export default function Login() {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(errorMessage(error));
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) setError(errorMessage(error));
      else setSent(true);
    }
    setBusy(false);
  };
  const switchMode = (next: "login" | "reset") => { setMode(next); setError(""); setSent(false); };

  return (
    <AuthShell>
      <h1>{mode === "login" ? "Connexion" : "Mot de passe oublié"}</h1>
      <p className="auth-muted">{mode === "login" ? "Accédez à l'espace de gestion de votre établissement." : "Recevez un lien par email pour choisir un nouveau mot de passe."}</p>
      {sent ? (
        <p className="auth-success" role="status">Si un compte existe pour {email.trim()}, un email avec un lien vient d'être envoyé. Pensez à vérifier les courriers indésirables.</p>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input className="field" type="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="prenom@ecole.dz" />
          </label>
          {mode === "login" && (
            <label>
              Mot de passe
              <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button auth-submit" type="submit" disabled={busy}>
            {busy ? "Patientez…" : mode === "login" ? "Se connecter" : "Envoyer le lien"}
          </button>
        </form>
      )}
      <p className="auth-muted auth-foot">
        {mode === "login"
          ? <button className="text-button" type="button" onClick={() => switchMode("reset")}>Mot de passe oublié ?</button>
          : <button className="text-button" type="button" onClick={() => switchMode("login")}>Retour à la connexion</button>}
      </p>
      <p className="auth-muted auth-foot"><a className="text-button" href="/">← Découvrir FormaPlus</a></p>
    </AuthShell>
  );
}

// Refuses passwords found in public leaks (Have I Been Pwned). Only the first 5 characters of the
// password's SHA-1 hash are sent; the password itself never leaves the browser.
// ponytail: fails open (offline, blocked API) — Supabase Pro has the same check server-side, switch to it there.
async function isLeaked(password: string) {
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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    if (await isLeaked(password)) {
      setBusy(false);
      return setError("Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    window.history.replaceState(null, "", window.location.pathname);
    passwordChosen();
  };

  return (
    <AuthShell>
      <h1>Choisissez votre mot de passe</h1>
      <p className="auth-muted">Compte : {email}</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Nouveau mot de passe
          <input className="field" type="password" autoComplete="new-password" required autoFocus minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label>
          Confirmer le mot de passe
          <input className="field" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button auth-submit" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer et continuer"}</button>
      </form>
      <p className="auth-muted auth-foot"><button className="text-button" type="button" onClick={signOut}>Annuler et se déconnecter</button></p>
    </AuthShell>
  );
}
