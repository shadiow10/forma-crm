import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
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

const errorMessage = (error: { code?: string; status?: number }) => {
  if (error.code === "invalid_credentials") return "Email ou mot de passe incorrect.";
  if (error.code === "email_not_confirmed") return "Ce compte n'est pas encore confirmé. Contactez votre directeur.";
  if (error.status === 429) return "Trop de tentatives. Réessayez dans quelques minutes.";
  return "Connexion impossible. Vérifiez votre connexion internet et réessayez.";
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(errorMessage(error));
  };

  return (
    <AuthShell>
      <h1>Connexion</h1>
      <p className="auth-muted">Accédez à l'espace de gestion de votre établissement.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Email
          <input className="field" type="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="prenom@ecole.dz" />
        </label>
        <label>
          Mot de passe
          <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button auth-submit" type="submit" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p className="auth-muted auth-foot">Mot de passe oublié ? Contactez le directeur de votre établissement.</p>
    </AuthShell>
  );
}
