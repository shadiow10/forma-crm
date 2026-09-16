import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { signOut, useAuth } from "./auth";
import Login, { AuthShell } from "./Login";
import "./index.css";

function Root() {
  const auth = useAuth();
  if (auth.status === "loading") return <AuthShell><p className="auth-muted">Chargement…</p></AuthShell>;
  if (auth.status === "signedOut") return <Login />;
  if (auth.status !== "ready")
    return (
      <AuthShell>
        <h1>{auth.status === "noAccess" ? "Accès non configuré" : "Erreur de chargement"}</h1>
        <p className="auth-muted">
          {auth.status === "noAccess"
            ? `Le compte ${auth.email} n'est rattaché à aucun établissement. Demandez à votre directeur de vous ajouter.`
            : `Impossible de charger votre profil (${auth.message}). Réessayez dans un instant.`}
        </p>
        <button className="button auth-submit" onClick={signOut}>Se déconnecter</button>
      </AuthShell>
    );
  return <App member={auth.member} email={auth.email} onSignOut={signOut} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
