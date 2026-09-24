import { Component, StrictMode, Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { signOut, useAuth } from "./auth";
import { supabase } from "./lib/supabase";
const LEGAL_PATHS = new Set(["/mentions-legales", "/cgv", "/confidentialite"]);
const Landing = lazy(() => import("./Landing").then((m) => ({ default: m.Landing })));
const Checkout = lazy(() => import("./Landing").then((m) => ({ default: m.Checkout })));
const Legal = lazy(() => import("./Legal").then((m) => ({ default: m.Legal })));
import Login, { AuthShell, SetPassword } from "./Login";
// The signed-in app is a separate download: visitors on the landing page never fetch it.
const AppShell = lazy(() => import("./AppShell"));
// Someone with a session will need it in a second: fetch it while the membership check runs,
// instead of after. One round trip less on a slow connection.
if (Object.keys(localStorage).some((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))) void import("./AppShell");
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
  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.error(error);
    // A page we deployed while this tab was open: its file is gone, so fetching it fails.
    // Reloading picks up the new version. Once only, so a real crash still shows the message.
    const message = error instanceof Error ? error.message : "";
    if (/dynamically imported module|Importing a module script failed/i.test(message) && !sessionStorage.getItem("reloaded-for-update")) {
      sessionStorage.setItem("reloaded-for-update", "1");
      window.location.reload();
    }
  }
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
  if (!order) return <Message title="Accès non configuré"
    text={`Le compte ${email} n'est rattaché à aucun établissement. Si vous êtes secrétaire ou formateur, demandez à votre directeur de vous inviter. Si vous ouvrez une école, envoyez votre demande.`}
    action={{ label: "Envoyer ma demande", run: () => { window.location.href = "/commander"; } }} />;
  return <Message
    title={order.status === "annulé" ? "Demande annulée" : "Espace en préparation"}
    text={order.status === "annulé"
      ? `Votre demande pour « ${order.school_name} » a été annulée. Contactez-nous pour la reprendre.`
      : `Votre demande CMD-${String(order.id).padStart(5, "0")} pour « ${order.school_name} » est enregistrée. Votre espace s'ouvre dès que votre paiement est confirmé — reconnectez-vous ensuite avec ${email}.`}
    action={{ label: "Vérifier maintenant", run: () => window.location.reload() }} />;
}

// The app's own addresses; anything else typed by hand is a wrong address, not a login page.
const PAGE_PATHS = new Set(["/", "/etudiants", "/inscriptions", "/formations", "/formateurs", "/groupes", "/planning", "/presences", "/paiements", "/certificats", "/parametres"]);

const NotFound = () => <Message title="Page introuvable" text="Cette adresse n'existe pas. Revenez au site ou connectez-vous à votre espace."
  action={{ label: "Retour au site", run: () => { window.location.href = "/"; } }} />;

function Root() {
  const auth = useAuth();
  if (LEGAL_PATHS.has(window.location.pathname)) return <Legal path={window.location.pathname} />;
  if (auth.status === "loading") return <AuthShell><p className="auth-muted">Chargement…</p></AuthShell>;
  if (auth.status === "signedOut") {
    // Public site for visitors; any app address (e.g. /etudiants) still leads to the login.
    if (window.location.pathname === "/") return <Landing />;
    if (window.location.pathname === "/commander") return <Checkout />;
    // /connexion and the app addresses lead to the login; anything else is a wrong address.
    if (window.location.pathname === "/connexion" || PAGE_PATHS.has(window.location.pathname)) return <Login />;
    return <NotFound />;
  }
  // Signed in with no school: he may still need to send (or resend) his order.
  if (auth.status === "noAccess" && window.location.pathname === "/commander") return <Checkout />;
  if (auth.status === "setPassword") return <SetPassword email={auth.email} />;
  if (auth.status === "noAccess") return <Waiting email={auth.email} />;
  if (auth.status === "error") return <Message title="Erreur de chargement" text={`Impossible de charger votre profil (${auth.message}).`} action={{ label: "Réessayer", run: () => window.location.reload() }} />;
  return <AppShell member={auth.member} email={auth.email} userId={auth.userId}
    onError={(message, retry) => <Message title="Erreur de chargement" text={message} action={{ label: "Réessayer", run: retry }} />} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      <Suspense fallback={<AuthShell><p className="auth-muted">Chargement…</p></AuthShell>}>
        <Root />
      </Suspense>
    </Boundary>
  </StrictMode>
);
