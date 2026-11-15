import { Component, StrictMode, Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { signOut, useAuth } from "./auth";
import { useT } from "./i18n";
import { supabase } from "./lib/supabase";
const LEGAL_PATHS = new Set(["/mentions-legales", "/cgv", "/confidentialite"]);
const Landing = lazy(() => import("./Landing").then((m) => ({ default: m.Landing })));
const Checkout = lazy(() => import("./Landing").then((m) => ({ default: m.Checkout })));
const StartTrial = lazy(() => import("./Landing").then((m) => ({ default: m.StartTrial })));
// Not "/inscriptions": that is the app's enrolments page.
const SIGNUP_PATH = "/creer-un-compte";
const TRIAL_PATH = "/essai"; // the 15-day free trial (0033)
const Legal = lazy(() => import("./Legal").then((m) => ({ default: m.Legal })));
import Login, { AuthShell, SetPassword } from "./Login";
// The signed-in app is a separate download: visitors on the landing page never fetch it.
const AppShell = lazy(() => import("./AppShell"));
// Someone with a session will need it in a second: fetch it while the membership check runs,
// instead of after. One round trip less on a slow connection.
if (Object.keys(localStorage).some((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))) void import("./AppShell");
import "./index.css";

const Message = ({ title, text, action }: { title: string; text: string; action?: { label: string; run: () => void } }) => {
  const t = useT();
  return (
    <AuthShell>
      <h1>{title}</h1>
      <p className="auth-muted">{text}</p>
      {action && <button className="button auth-submit" onClick={action.run}>{action.label}</button>}
      <p className="auth-muted auth-foot"><button className="text-button" onClick={signOut}>{t.access.signOut}</button></p>
    </AuthShell>
  );
};
const Loading = () => <AuthShell><p className="auth-muted">{useT().access.loading}</p></AuthShell>;
// The boundary catches render errors, so it cannot use a hook to translate its own message.
const Crash = ({ onReload }: { onReload: () => void }) => {
  const t = useT().access;
  return <Message title={t.crashTitle} text={t.crashText} action={{ label: t.reload, run: onReload }} />;
};

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
    return <Crash onReload={() => window.location.reload()} />;
  }
}

type Order = { id: number; status: string; school_name: string };

function Waiting({ email }: { email: string }) {
  const t = useT().access;
  const [order, setOrder] = useState<Order | null | undefined>();
  useEffect(() => {
    supabase.rpc("my_order_status").then(({ data }) => setOrder((data as Order[])?.[0] ?? null));
  }, []);
  if (order === undefined) return <Loading />;
  if (!order) return <Message title={t.noAccessTitle} text={t.noAccessText(email)}
    action={{ label: t.sendOrder, run: () => { window.location.href = "/commander"; } }} />;
  return <Message
    title={order.status === "annulé" ? t.cancelledTitle : t.waitingTitle}
    text={order.status === "annulé"
      ? t.cancelledText(order.school_name)
      : t.waitingText(`CMD-${String(order.id).padStart(5, "0")}`, order.school_name, email)}
    action={{ label: t.checkNow, run: () => window.location.reload() }} />;
}

// The app's own addresses; anything else typed by hand is a wrong address, not a login page.
const PAGE_PATHS = new Set(["/", "/etudiants", "/inscriptions", "/formations", "/formateurs", "/groupes", "/planning", "/salles", "/presences", "/paiements", "/statistiques", "/certificats", "/parametres"]);

function NotFound() {
  const t = useT().access;
  return <Message title={t.notFoundTitle} text={t.notFoundText} action={{ label: t.backToSite, run: () => { window.location.href = "/"; } }} />;
}

function Root() {
  const auth = useAuth();
  const t = useT().access;
  if (LEGAL_PATHS.has(window.location.pathname)) return <Legal path={window.location.pathname} />;
  if (auth.status === "loading") return <Loading />;
  if (auth.status === "signedOut") {
    // Public site for visitors; any app address (e.g. /etudiants) still leads to the login.
    if (window.location.pathname === "/") return <Landing />;
    if (window.location.pathname === "/commander") return <Checkout />;
    if (window.location.pathname === SIGNUP_PATH) return <Login initial="signup" />;
    if (window.location.pathname === TRIAL_PATH) return <Login initial="signup" trial />;
    // /connexion and the app addresses lead to the login; anything else is a wrong address.
    if (window.location.pathname === "/connexion" || PAGE_PATHS.has(window.location.pathname)) return <Login />;
    return <NotFound />;
  }
  // Signed in with no school: he may still need to send (or resend) his order.
  // A signed-in account opening the sign-up page already has its account: on to the order form.
  if (auth.status === "noAccess" && (window.location.pathname === "/commander" || window.location.pathname === SIGNUP_PATH)) return <Checkout />;
  // Back from a trial sign-up's confirmation link (or signed in there with no school yet): start it.
  if (auth.status === "noAccess" && window.location.pathname === TRIAL_PATH) return <AuthShell><StartTrial /></AuthShell>;
  if (auth.status === "setPassword") return <SetPassword email={auth.email} />;
  if (auth.status === "noAccess") return <Waiting email={auth.email} />;
  if (auth.status === "error") return <Message title={t.loadError} text={t.profileError(auth.message)} action={{ label: t.retry, run: () => window.location.reload() }} />;
  return <AppShell member={auth.member} email={auth.email} userId={auth.userId}
    onError={(message, retry) => <Message title={t.loadError} text={message} action={{ label: t.retry, run: retry }} />} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      <Suspense fallback={<Loading />}>
        <Root />
      </Suspense>
    </Boundary>
  </StrictMode>
);
