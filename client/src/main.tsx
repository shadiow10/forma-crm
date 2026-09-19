import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { signOut, useAuth } from "./auth";
import { DataProvider } from "./data";
import { Checkout, Landing } from "./Landing";
import Login, { AuthShell, SetPassword } from "./Login";
import "./index.css";

const Message = ({ title, text, action }: { title: string; text: string; action?: { label: string; run: () => void } }) => (
  <AuthShell>
    <h1>{title}</h1>
    <p className="auth-muted">{text}</p>
    {action && <button className="button auth-submit" onClick={action.run}>{action.label}</button>}
    <p className="auth-muted auth-foot"><button className="text-button" onClick={signOut}>Se déconnecter</button></p>
  </AuthShell>
);

function Root() {
  const auth = useAuth();
  if (auth.status === "loading") return <AuthShell><p className="auth-muted">Chargement…</p></AuthShell>;
  if (auth.status === "signedOut") {
    // Public site for visitors; any app address (e.g. /etudiants) still leads to the login.
    if (window.location.pathname === "/") return <Landing />;
    if (window.location.pathname === "/commander") return <Checkout />;
    return <Login />;
  }
  if (auth.status === "setPassword") return <SetPassword email={auth.email} />;
  if (auth.status === "noAccess") return <Message title="Accès non configuré" text={`Le compte ${auth.email} n'est rattaché à aucun établissement. Demandez à votre directeur de vous inviter.`} />;
  if (auth.status === "error") return <Message title="Erreur de chargement" text={`Impossible de charger votre profil (${auth.message}).`} action={{ label: "Réessayer", run: () => window.location.reload() }} />;
  return (
    <DataProvider member={auth.member} fallback={({ error, retry }) => error
      ? <Message title="Erreur de chargement" text={error} action={{ label: "Réessayer", run: retry }} />
      : <AuthShell><p className="auth-muted">Chargement des données de {auth.member.school.name}…</p></AuthShell>}>
      <App member={auth.member} email={auth.email} userId={auth.userId} onSignOut={signOut} />
    </DataProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
