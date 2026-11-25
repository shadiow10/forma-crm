import { useEffect, useState } from "react";
import { rolePages } from "./auth";
import type { Member, PageKey } from "./auth";
import { useAppT } from "./appCopy";
import { friendlyError, useData } from "./data";
import { usePage } from "./i18n";
import { supabase } from "./lib/supabase";
import { Certificates, Settings } from "./pages/Admin";
import { Attendance } from "./pages/Attendance";
import { Courses, Teachers } from "./pages/Catalog";
import { Dashboard } from "./pages/Dashboard";
import { GroupDrawer, Groups, Planning } from "./pages/Groups";
import { Analytics } from "./pages/Analytics";
import { Payments } from "./pages/Payments";
import { Rooms } from "./pages/Rooms";
import { StudentDrawer } from "./pages/StudentDrawer";
import { Enrollments, Students } from "./pages/Students";
import { BrandMark, Icon, formatDate, initials } from "./ui";
import type { IconName } from "./ui";

// Each page has its own address so refresh, back/forward and shared links work.
// Grouped by use (redesign): what is done every day first, then organising, then follow-up;
// Settings stands alone at the bottom of the menu.
type Section = "daily" | "organisation" | "followUp" | "settings";
const PAGES: { key: PageKey; path: string; icon: IconName; section: Section }[] = [
  { key: "dashboard", path: "/", icon: "grid", section: "daily" },
  { key: "students", path: "/etudiants", icon: "graduation", section: "daily" },
  { key: "attendance", path: "/presences", icon: "check", section: "daily" },
  { key: "payments", path: "/paiements", icon: "wallet", section: "daily" },
  { key: "enrollments", path: "/inscriptions", icon: "file", section: "organisation" },
  { key: "formations", path: "/formations", icon: "checklist", section: "organisation" },
  { key: "teachers", path: "/formateurs", icon: "teacher", section: "organisation" },
  { key: "groups", path: "/groupes", icon: "users", section: "organisation" },
  { key: "planning", path: "/planning", icon: "calendar", section: "organisation" },
  { key: "rooms", path: "/salles", icon: "building", section: "organisation" },
  { key: "analytics", path: "/statistiques", icon: "chart", section: "followUp" },
  { key: "certificates", path: "/certificats", icon: "print", section: "followUp" },
  { key: "settings", path: "/parametres", icon: "settings", section: "settings" },
];
const SECTIONS: Section[] = ["daily", "organisation", "followUp", "settings"];
const pathOf = (key: PageKey) => PAGES.find((page) => page.key === key)!.path;
const pageAt = (path: string) => PAGES.find((page) => page.path === (path.replace(/\/+$/, "") || "/"))?.key;

// A free trial shows its days left all along; a paid plan nothing before its last week, then a
// warning, then the read-only notice. The director gets a button to choose a plan (Settings, 0033);
// a secretaire or a teacher only sees why saving stopped.
function SubscriptionBanner({ onChoose }: { onChoose: () => void }) {
  const { subscription, isDirector, school, reload, notify } = useData();
  const copy = useAppT();
  const t = copy.banner;
  // A scheduled deletion (0034) comes first: the date, and the director's way back.
  if (school.delete_after) {
    const cancel = async () => {
      const { error } = await supabase.rpc("cancel_school_deletion", { p_school_id: school.id });
      if (error) return notify(friendlyError(error, copy.errors));
      await reload();
      notify(copy.settings.deleteCancelled);
    };
    return <div className="demo-banner" role="alert"><Icon name="trash" size={15} /><span><strong>{t.deletingTitle}</strong> {t.deletingText(formatDate(school.delete_after, "long"))}{isDirector ? "" : t.renewTeam}</span>
      {isDirector && <button className="text-button" onClick={cancel}>{t.cancelDeletion}</button>}</div>;
  }
  const renew = isDirector ? "" : t.renewTeam;
  // Choosing a plan only once one is needed: a free trial, or a subscription that has ended.
  const choose = isDirector && subscription.state !== "active" && <button className="text-button" onClick={onChoose}>{t.choosePlan}</button>;
  const left = (days: number, zero: string) => (days === 0 ? zero : t.days(days));
  if (subscription.state === "trial")
    return <div className="demo-banner trial-banner" role="note"><Icon name="spark" size={15} /><span><strong>{t.trialTitle}</strong> {t.trialText(subscription.daysLeft)}{renew}</span>{choose}</div>;
  if (subscription.state === "active" && subscription.daysLeft <= 7)
    return <div className="demo-banner" role="note"><Icon name="calendar" size={15} /><span><strong>{t.dueTitle}</strong> {t.dueText(left(subscription.daysLeft, t.lessThanDay))}{renew}</span>{choose}</div>;
  if (subscription.state === "grace")
    return <div className="demo-banner" role="alert"><Icon name="warning" size={15} /><span><strong>{t.graceTitle}</strong> {t.graceText(left(subscription.daysLeft, t.today))}{renew}</span>{choose}</div>;
  if (subscription.state === "frozen")
    return <div className="demo-banner" role="alert"><Icon name="lock" size={15} /><span><strong>{t.frozenTitle}</strong> {t.frozenText}{renew}</span>{choose}</div>;
  return null;
}

export default function App({ member, email, userId, onSignOut }: { member: Member; email: string; userId: string; onSignOut: () => void }) {
  const { school, students, groups, canEdit, readOnly, notice, clearNotice, isSoutien, syncing } = useData();
  const t = useAppT();
  const page_ = usePage();
  // An école de soutien hands out no certificates.
  const allowed = rolePages[member.role].filter((key) => !(isSoutien && key === "certificates"));
  const resolve = (key: PageKey | undefined) => (key && allowed.includes(key) ? key : allowed[0]);
  const [page, setPage] = useState<PageKey>(() => resolve(pageAt(window.location.pathname)));
  const [attendanceGroup, setAttendanceGroup] = useState<number>();
  // A student card's QR code opens /etudiants?eleve=<id>: straight to that student's profile.
  const [studentId, setStudentId] = useState<number | null>(() => Number(new URLSearchParams(window.location.search).get("eleve")) || null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const displayName = member.full_name || email;

  // Fix the address when it pointed to a page this role cannot open, and follow back/forward.
  useEffect(() => {
    if (window.location.pathname !== pathOf(page) || window.location.search) window.history.replaceState(null, "", pathOf(page));
    const onPop = () => setPage(resolve(pageAt(window.location.pathname)));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { document.title = `${t.nav[page]} · ${school.name}`; }, [page, school.name, t]);

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
      case "dashboard": return <Dashboard goTo={goTo} openStudent={setStudentId} />;
      case "students": return <Students openStudent={setStudentId} />;
      case "enrollments": return <Enrollments openStudent={setStudentId} />;
      case "formations": return <Courses />;
      case "teachers": return <Teachers />;
      case "groups": return <Groups openGroup={setGroupId} />;
      case "planning": return <Planning openGroup={setGroupId} />;
      case "attendance": return <Attendance key={attendanceGroup ?? "default"} initialGroupId={attendanceGroup} />;
      case "payments": return <Payments openStudent={setStudentId} />;
      case "rooms": return <Rooms openGroup={setGroupId} />;
      case "analytics": return <Analytics />;
      case "certificates": return <Certificates />;
      case "settings": return <Settings userId={userId} signedInAs={displayName} onSignOut={onSignOut} />;
    }
  };

  return <div className="app-shell" {...page_}>
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><BrandMark /><div><strong className="wm" dir="ltr">Classtra</strong><small>{t.tagline}</small></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label={t.common.closeMenu}><Icon name="close" size={18} /></button></div>
      <div className="school-switcher"><span className="school-avatar">{initials(school.name)}</span><div><strong>{school.name}</strong><span>{t.roles[member.role]}</span></div></div>
      <nav className="nav-groups" aria-label={t.navGroup}>{SECTIONS.map((section) => {
        const items = PAGES.filter((item) => item.section === section && allowed.includes(item.key));
        if (!items.length) return null;
        return <div className={`nav-group nav-group-${section}`} key={section}>
          {section !== "settings" && <span className="nav-label">{t.navSections[section]}</span>}
          {items.map((item) => <a key={item.key} href={item.path} className={`nav-item ${page === item.key ? "active" : ""}`} aria-current={page === item.key ? "page" : undefined}
            onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey) return; event.preventDefault(); goTo(item.key); }}>
            <Icon name={item.icon} size={17} /><span>{t.nav[item.key]}</span>
          </a>)}
        </div>;
      })}</nav>
    </aside>
    {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label={t.common.openMenu}><Icon name="menu" size={20} /></button><span className="breadcrumb">{school.name} <Icon name="chevron" size={13} /> {t.nav[page]}</span></div>
        <div className="topbar-right">
          {canEdit && <div className="global-search">
            <Icon name="search" size={16} />
            <input aria-label={t.common.searchLabel} placeholder={t.common.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); if (event.key === "Enter" && results[0]) { results[0].open(); setSearch(""); } }} />
            {query.length >= 2 && <div className="search-results" role="listbox">{results.length ? results.map((result) => <button key={result.key} role="option" aria-selected={false} onClick={() => { result.open(); setSearch(""); }}><strong>{result.label}</strong><span>{result.hint}</span></button>) : <span className="search-empty">{t.common.noResult}</span>}</div>}
          </div>}
        </div>
      </header>
      {school.is_demo
        ? <div className="demo-banner" role="note"><Icon name="lock" size={15} /><span><strong>{t.banner.demo}</strong> {t.banner.demoText}</span><button className="text-button" onClick={onSignOut}>{t.banner.demoLeave}</button></div>
        : <SubscriptionBanner onChoose={() => goTo("settings")} />}
      <div className="content-wrap">{renderPage()}</div>
      <footer className="app-footer"><span>Classtra · {school.name}</span><span role="status"><span className={syncing ? "status-live syncing" : "status-live"} /> {syncing ? t.common.syncing : t.common.synced}</span></footer>
    </main>
    {/* Phones: the four everyday pages always one tap away, and the full menu behind "Menu". */}
    <nav className="tabbar" aria-label={t.navSections.daily}>
      {PAGES.filter((item) => item.section === "daily" && allowed.includes(item.key)).map((item) => <a key={item.key} href={item.path} className={page === item.key ? "active" : ""} aria-current={page === item.key ? "page" : undefined}
        onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey) return; event.preventDefault(); goTo(item.key); }}>
        <Icon name={item.icon} size={22} /><span>{t.nav[item.key]}</span>
      </a>)}
      <button type="button" onClick={() => setSidebarOpen(true)} aria-label={t.common.openMenu}><Icon name="menu" size={22} /><span>{t.simple.menu}</span></button>
    </nav>
    {studentId !== null && <StudentDrawer key={studentId} studentId={studentId} onClose={() => setStudentId(null)} />}
    {groupId !== null && <GroupDrawer key={groupId} groupId={groupId} onClose={() => setGroupId(null)} goTo={goTo} />}
    {notice && <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={14} /></span><span>{notice}</span><button onClick={clearNotice} aria-label={t.common.close}><Icon name="close" size={14} /></button></div>}
  </div>;
}
