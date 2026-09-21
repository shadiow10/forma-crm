import { Component, StrictMode, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { signOut, useAuth } from "./auth";
import { supabase } from "./lib/supabase";
import { DataProvider } from "./data";
import { Checkout, Landing } from "./Landing";
import { Legal, isLegalPage } from "./Legal";
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

// A crash anywhere in the app shows a message instead of a blank page.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <Message title="Une erreur est survenue" text="Cette page n'a pas pu s'afficher. Rechargez ; si cela se reproduit, prévenez-nous." action={{ label: "Recharger", run: () => window.location.reload() }} />;
  }
}

type Order = { id: number; status: string; school_name: string };

function Waiting({ email }: { email: string }) {
  const [order, setOrder] = useState<Order | null | undefined>();
  useEffect(() => {
    supabase.rpc("my_order_status").then(({ data }) => setOrder((data as Order[])?.[0] ?? null));
  }, []);
  if (order === undefined) return <AuthShell><p className="auth-muted">Chargement…</p></AuthShell>;
  if (!order) return <Message title="Accès non configuré" text={`Le compte ${email} n'est rattaché à aucun établissement. Demandez à votre directeur de vous inviter.`} />;
  return <Message
    title={order.status === "annulé" ? "Demande annulée" : "Espace en préparation"}
    text={order.status === "annulé"
      ? `Votre demande pour « ${order.school_name} » a été annulée. Contactez-nous pour la reprendre.`
      : `Votre demande CMD-${String(order.id).padStart(5, "0")} pour « ${order.school_name} » est enregistrée. Votre espace s'ouvre dès que votre paiement est confirmé — reconnectez-vous ensuite avec ${email}.`}
    action={{ label: "Vérifier maintenant", run: () => window.location.reload() }} />;
}

function Root() {
  const auth = useAuth();
  if (isLegalPage(window.location.pathname)) return <Legal path={window.location.pathname} />;
  if (auth.status === "loading") return <AuthShell><p className="auth-muted">Chargement…</p></AuthShell>;
  if (auth.status === "signedOut") {
    // Public site for visitors; any app address (e.g. /etudiants) still leads to the login.
    if (window.location.pathname === "/") return <Landing />;
    if (window.location.pathname === "/commander") return <Checkout />;
    return <Login />;
  }
  if (auth.status === "setPassword") return <SetPassword email={auth.email} />;
  if (auth.status === "noAccess") return <Waiting email={auth.email} />;
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
    <Boundary>
      <Root />
    </Boundary>
  </StrictMode>
);
