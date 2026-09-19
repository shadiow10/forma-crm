import { useEffect, useState } from "react";
import { roleLabels, rolePages } from "./auth";
import type { Member, PageKey } from "./auth";
import { useData } from "./data";
import { Certificates, Settings } from "./pages/Admin";
import { Attendance } from "./pages/Attendance";
import { Courses, Teachers } from "./pages/Catalog";
import { Dashboard } from "./pages/Dashboard";
import { GroupDrawer, Groups, Planning } from "./pages/Groups";
import { Payments } from "./pages/Payments";
import { StudentDrawer } from "./pages/StudentDrawer";
import { Enrollments, Students } from "./pages/Students";
import { Icon, initials } from "./ui";
import type { IconName } from "./ui";

// Each page has its own address so refresh, back/forward and shared links work.
const PAGES: { key: PageKey; path: string; label: string; icon: IconName }[] = [
  { key: "dashboard", path: "/", label: "Tableau de bord", icon: "grid" },
  { key: "students", path: "/etudiants", label: "Étudiants", icon: "graduation" },
  { key: "enrollments", path: "/inscriptions", label: "Inscriptions", icon: "file" },
  { key: "formations", path: "/formations", label: "Formations", icon: "checklist" },
  { key: "teachers", path: "/formateurs", label: "Formateurs", icon: "teacher" },
  { key: "groups", path: "/groupes", label: "Groupes", icon: "users" },
  { key: "planning", path: "/planning", label: "Planning", icon: "calendar" },
  { key: "attendance", path: "/presences", label: "Présences", icon: "check" },
  { key: "payments", path: "/paiements", label: "Paiements", icon: "wallet" },
  { key: "certificates", path: "/certificats", label: "Certificats", icon: "print" },
  { key: "settings", path: "/parametres", label: "Paramètres", icon: "settings" },
];
const pathOf = (key: PageKey) => PAGES.find((page) => page.key === key)!.path;
const pageAt = (path: string) => PAGES.find((page) => page.path === (path.replace(/\/+$/, "") || "/"))?.key;

export default function App({ member, email, userId, onSignOut }: { member: Member; email: string; userId: string; onSignOut: () => void }) {
  const { school, students, groups, canEdit, notice, clearNotice } = useData();
  const allowed = rolePages[member.role];
  const resolve = (key: PageKey | undefined) => (key && allowed.includes(key) ? key : allowed[0]);
  const [page, setPage] = useState<PageKey>(() => resolve(pageAt(window.location.pathname)));
  const [attendanceGroup, setAttendanceGroup] = useState<number>();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const displayName = member.full_name || email;

  // Fix the address when it pointed to a page this role cannot open, and follow back/forward.
  useEffect(() => {
    if (window.location.pathname !== pathOf(page)) window.history.replaceState(null, "", pathOf(page));
    const onPop = () => setPage(resolve(pageAt(window.location.pathname)));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { document.title = `${PAGES.find((item) => item.key === page)!.label} · ${school.name}`; }, [page, school.name]);

  const goTo = (key: PageKey, forGroup?: number) => {
    if (!allowed.includes(key)) return;
    if (key === "attendance") setAttendanceGroup(forGroup);
    if (key !== page) window.history.pushState(null, "", pathOf(key));
    setPage(key);
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  };

  const query = search.trim().toLowerCase();
  const results = query.length < 2 ? [] : [
    ...students.filter((student) => `${student.full_name} ${student.phone} ${student.email ?? ""}`.toLowerCase().includes(query)).slice(0, 6)
      .map((student) => ({ key: `s${student.id}`, label: student.full_name, hint: student.phone, open: () => setStudentId(student.id) })),
    ...groups.filter((group) => group.name.toLowerCase().includes(query)).slice(0, 4)
      .map((group) => ({ key: `g${group.id}`, label: group.name, hint: "Groupe", open: () => setGroupId(group.id) })),
  ];

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard goTo={goTo} openStudent={setStudentId} firstName={displayName.split(/[ @]/)[0]} />;
      case "students": return <Students openStudent={setStudentId} />;
      case "enrollments": return <Enrollments openStudent={setStudentId} />;
      case "formations": return <Courses />;
      case "teachers": return <Teachers />;
      case "groups": return <Groups openGroup={setGroupId} />;
      case "planning": return <Planning openGroup={setGroupId} />;
      case "attendance": return <Attendance key={attendanceGroup ?? "default"} initialGroupId={attendanceGroup} />;
      case "payments": return <Payments openStudent={setStudentId} />;
      case "certificates": return <Certificates />;
      case "settings": return <Settings userId={userId} />;
    }
  };

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><span className="brand-mark">F</span><div><strong>FORMA<span>PLUS</span></strong><small>Gestion d'école</small></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu"><Icon name="close" size={18} /></button></div>
      <div className="school-switcher"><span className="school-avatar">{initials(school.name)}</span><div><strong>{school.name}</strong><span>{roleLabels[member.role]}</span></div></div>
      <nav className="nav-groups" aria-label="Navigation principale"><div className="nav-group"><span className="nav-label">GESTION DU CENTRE</span>
        {PAGES.filter((item) => allowed.includes(item.key)).map((item) => <a key={item.key} href={item.path} className={`nav-item ${page === item.key ? "active" : ""}`} aria-current={page === item.key ? "page" : undefined}
          onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey) return; event.preventDefault(); goTo(item.key); }}>
          <Icon name={item.icon} size={17} /><span>{item.label}</span>
        </a>)}
      </div></nav>
      <div className="sidebar-user"><span className="user-avatar">{initials(displayName)}</span><div><strong>{displayName}</strong><span>{roleLabels[member.role]}</span></div><button className="icon-button" onClick={onSignOut} title="Se déconnecter" aria-label="Se déconnecter"><Icon name="logout" size={17} /></button></div>
    </aside>
    {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu"><Icon name="menu" size={20} /></button><span className="breadcrumb">{school.name} <Icon name="chevron" size={13} /> {PAGES.find((item) => item.key === page)!.label}</span></div>
        <div className="topbar-right">
          {canEdit && <div className="global-search">
            <Icon name="search" size={16} />
            <input aria-label="Rechercher un étudiant ou un groupe" placeholder="Rechercher un étudiant, un groupe…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); if (event.key === "Enter" && results[0]) { results[0].open(); setSearch(""); } }} />
            {query.length >= 2 && <div className="search-results" role="listbox">{results.length ? results.map((result) => <button key={result.key} role="option" aria-selected={false} onClick={() => { result.open(); setSearch(""); }}><strong>{result.label}</strong><span>{result.hint}</span></button>) : <span className="search-empty">Aucun résultat</span>}</div>}
          </div>}
          <span className="top-divider" />
          <button className="top-profile" onClick={onSignOut} title="Se déconnecter"><span className="user-avatar small">{initials(displayName)}</span><span>{displayName}</span><Icon name="logout" size={13} /></button>
        </div>
      </header>
      <div className="content-wrap">{renderPage()}</div>
      <footer className="app-footer"><span>FormaPlus · {school.name}</span><span><span className="status-live" /> Données synchronisées avec le serveur</span></footer>
    </main>
    {studentId !== null && <StudentDrawer key={studentId} studentId={studentId} onClose={() => setStudentId(null)} />}
    {groupId !== null && <GroupDrawer key={groupId} groupId={groupId} onClose={() => setGroupId(null)} goTo={goTo} />}
    {notice && <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={14} /></span><span>{notice}</span><button onClick={clearNotice} aria-label="Fermer"><Icon name="close" size={14} /></button></div>}
  </div>;
}
