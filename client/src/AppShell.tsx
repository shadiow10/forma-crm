import App from "./App";
import { signOut } from "./auth";
import type { Member } from "./auth";
import { DataProvider } from "./data";
import { AuthShell } from "./Login";

// The whole signed-in app behind one import, so a visitor reading the landing page
// never downloads it. main.tsx loads this file only once someone is signed in.
export default function AppShell({ member, email, userId, onError }: {
  member: Member; email: string; userId: string;
  onError: (message: string, retry: () => void) => React.ReactNode;
}) {
  return (
    <DataProvider member={member} fallback={({ error, retry }) => error
      ? onError(error, retry)
      : <AuthShell><p className="auth-muted">Chargement des données de {member.school.name}…</p></AuthShell>}>
      <App member={member} email={email} userId={userId} onSignOut={signOut} />
    </DataProvider>
  );
}
