import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import type { FormEvent, ReactNode } from "react";
import { Icon } from "./ui";
import type { IconName } from "./ui";

// Public site: landing page and a DEMO checkout. Nothing here charges money or creates accounts.
// Real version: checkout → payment gateway (Chargily: Edahabia/CIB) → webhook creates the school
// and invites the director with the existing invite-user flow.

type Billing = "monthly" | "yearly";
type Plan = { id: string; name: string; monthly: number; tagline: string; students: string; users: string; features: string[]; featured?: boolean };

// Monthly prices in DA. Yearly = 10 months (2 months free). `features` = what the plan adds on top of INCLUDED.
export const PLANS: Plan[] = [
  { id: "essentiel", name: "Essentiel", monthly: 7900, tagline: "Écoles de soutien et petits centres", students: "100 étudiants", users: "3 utilisateurs", features: ["Support par email"] },
  { id: "pro", name: "Pro", monthly: 14900, tagline: "Écoles privées et centres de formation", students: "400 étudiants", users: "10 utilisateurs", featured: true, features: ["Import de vos listes Excel par notre équipe", "Formation de votre secrétariat (1 séance)", "Support prioritaire par téléphone"] },
  { id: "etablissement", name: "Établissement", monthly: 24900, tagline: "Grands établissements et réseaux", students: "Étudiants illimités", users: "Utilisateurs illimités", features: ["Tout Pro, plus un interlocuteur dédié", "Formation de toute l'équipe sur site"] },
];
const INCLUDED = ["Étudiants, inscriptions et documents", "Paiements, soldes et exports", "Présences et planning des groupes", "Certificats prêts à imprimer", "Accès par rôle : directeur, secrétaire, formateur", "Données séparées de chaque école"];
const price = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} DA`;
const planTotal = (plan: Plan, billing: Billing) => (billing === "yearly" ? plan.monthly * 10 : plan.monthly);

const AUDIENCES = ["Écoles privées", "Centres de formation", "Écoles de soutien", "Écoles de langues", "Préscolaire"];

const FAQ = [
  { q: "Combien de temps pour démarrer ?", a: "Le jour même. Vous ajoutez vos formations, vos groupes et vos étudiants, puis vous invitez votre équipe. Avec la formule Pro, notre équipe importe vos listes Excel pour vous." },
  { q: "Faut-il former l'équipe ?", a: "Une courte prise en main suffit : les écrans reprennent les gestes du quotidien — inscrire, encaisser, faire l'appel. La formule Pro inclut une séance de formation pour votre secrétariat." },
  { q: "Que deviennent nos données si nous partons ?", a: "Elles restent les vôtres. Les listes d'étudiants, les paiements, les présences et le catalogue s'exportent à tout moment en fichiers lisibles dans Excel." },
  { q: "Comment payer ?", a: "Par carte Edahabia ou CIB en ligne, ou par virement / versement CCP. L'accès est ouvert dès la confirmation du paiement." },
  { q: "Que se passe-t-il après le paiement ?", a: "Votre espace école est créé et le directeur reçoit un email pour choisir son mot de passe. Il invite ensuite son équipe depuis Paramètres." },
  { q: "Mes données sont-elles séparées des autres écoles ?", a: "Oui. Chaque école a son propre espace ; les règles d'accès sont appliquées par la base de données elle-même, pas seulement par l'écran." },
  { q: "Puis-je changer de formule ?", a: "Oui, à tout moment. Le changement s'applique à la période suivante." },
  { q: "Faut-il installer quelque chose ?", a: "Non. FormaPlus fonctionne dans le navigateur, sur ordinateur comme sur téléphone." },
];

const PROBLEMS: { icon: IconName; title: string; text: string }[] = [
  { icon: "clock", title: "Des heures perdues chaque semaine", text: "Recopier les listes d'appel, recompter les absences, refaire les totaux : du temps qui ne va pas aux étudiants." },
  { icon: "wallet", title: "Des impayés découverts trop tard", text: "Un carnet de versements, un reçu introuvable : on ne sait plus qui a payé quoi, ni combien il reste." },
  { icon: "warning", title: "Des données fragiles", text: "Un fichier Excel sur une clé USB, un cahier dans un tiroir. Une perte, et c'est une année de dossiers qui disparaît." },
];

const ROLES: { icon: IconName; role: string; text: string; can: string[] }[] = [
  { icon: "building", role: "Directeur", text: "Voit toute l'école et la pilote.", can: ["Finances et soldes de chaque étudiant", "Équipe, accès et paramètres", "Modification et suppression des paiements"] },
  { icon: "file", role: "Secrétaire", text: "Fait tourner le quotidien.", can: ["Inscriptions et dossiers étudiants", "Encaissements, sans pouvoir les modifier", "Groupes, planning et présences"] },
  { icon: "teacher", role: "Formateur", text: "Se concentre sur ses groupes.", can: ["Son planning uniquement", "L'appel de ses propres groupes", "Les noms de ses étudiants, rien de plus"] },
];

export function Footer() {
  return <footer className="lp-footer">
    <Brand />
    <nav aria-label="Informations légales"><a href="/mentions-legales">Mentions légales</a><a href="/cgv">CGV</a><a href="/confidentialite">Confidentialité</a></nav>
    <a href="/connexion">Espace client</a>
  </footer>;
}

// Public read-only demo school. Unset in .env = no demo button.
const DEMO = { email: import.meta.env.VITE_DEMO_EMAIL as string | undefined, password: import.meta.env.VITE_DEMO_PASSWORD as string | undefined };
function DemoButton({ className = "lp-btn" }: { className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  if (!DEMO.email || !DEMO.password) return null;
  const start = async () => {
    setState("busy");
    const { error } = await supabase.auth.signInWithPassword({ email: DEMO.email!, password: DEMO.password! });
    if (error) return setState("error");
    window.history.replaceState(null, "", "/"); // the app opens on its dashboard
    window.scrollTo({ top: 0 });
  };
  return <span className="lp-demo">
    <button className={className} type="button" onClick={start} disabled={state === "busy"}>{state === "busy" ? "Ouverture de la démo…" : "Essayer la démo"}</button>
    {state === "error" && <small role="alert">La démo est indisponible pour le moment.</small>}
  </span>;
}

export function Brand({ light = false }: { light?: boolean }) {
  return <a className={`lp-brand ${light ? "light" : ""}`} href="/"><span className="brand-mark">F</span><strong>FORMA<span>PLUS</span></strong></a>;
}

// A still of the real app, drawn in HTML so it stays sharp and matches the product.
function AppPreview() {
  return <div className="lp-app" aria-hidden="true">
    <div className="lp-app-side">
      <span className="brand-mark">F</span>
      {(["grid", "graduation", "file", "users", "calendar", "check", "wallet"] as IconName[]).map((icon, index) => <i key={icon} className={index === 5 ? "on" : ""}><Icon name={icon} size={15} /></i>)}
    </div>
    <div className="lp-app-main">
      <div className="lp-app-head"><div><small>Présences · Mardi 14 octobre</small><strong>Excel avancé — Matin</strong></div><em>14 / 18 présents</em></div>
      <div className="lp-app-table">
        {[["Lina Haddad", "P", "96%"], ["Yacine Merabet", "P", "88%"], ["Sara Belkacem", "L", "81%"], ["Karim Ouali", "A", "68%"], ["Nour Saad", "P", "92%"]].map(([name, mark, rate]) =>
          <div className="lp-app-row" key={name}>
            <span className="lp-app-avatar">{name.split(" ").map((part) => part[0]).join("")}</span>
            <strong>{name}</strong>
            <span className="lp-app-marks">{["P", "L", "A"].map((option) => <b key={option} className={`${option}${option === mark ? " on" : ""}`}>{option === "P" ? "✓" : option === "L" ? "~" : "×"}</b>)}</span>
            <span className={`lp-app-rate ${parseInt(rate) < 75 ? "low" : ""}`}>{rate}</span>
          </div>)}
      </div>
    </div>
    <div className="lp-app-card">
      <small>Encaissé ce mois</small>
      <strong>742 000 DA</strong>
      <span>Reste à recouvrer · 186 500 DA</span>
    </div>
  </div>;
}

// Small stills of the other screens, looped right-to-left under the hero.
const avatar = (name: string) => <i className="ms-avatar">{name.split(" ").map((part) => part[0]).join("")}</i>;
const SCREENS: { title: string; icon: IconName; body: ReactNode }[] = [
  { title: "Tableau de bord", icon: "grid", body: <>
    <div className="ms-metrics"><div><small>Étudiants actifs</small><b>186</b></div><div><small>Présence</small><b>91%</b></div><div><small>Encaissé</small><b>742k</b></div></div>
    <div className="ms-bars">{[42, 58, 50, 71, 64, 88, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
  </> },
  { title: "Étudiants", icon: "graduation", body: <>
    {[["Lina Haddad", "Excel avancé", "Actif"], ["Yacine Merabet", "Anglais B1", "Actif"], ["Sara Belkacem", "Comptabilité", "En attente"], ["Nour Saad", "Python", "Actif"]].map(([name, course, status]) =>
      <div className="ms-row" key={name}>{avatar(name)}<span><b>{name}</b><small>{course}</small></span><em className={status === "Actif" ? "ok" : "wait"}>{status}</em></div>)}
  </> },
  { title: "Paiements", icon: "wallet", body: <>
    {[["Karim Ouali", "15 000 DA", "CCP"], ["Lina Haddad", "22 000 DA", "Espèces"], ["Amel Rahmani", "18 500 DA", "Edahabia"]].map(([name, amount, method]) =>
      <div className="ms-row" key={name}>{avatar(name)}<span><b>{name}</b><small>{method}</small></span><strong>{amount}</strong></div>)}
    <div className="ms-due"><span>Reste à recouvrer</span><b>186 500 DA</b></div>
  </> },
  { title: "Planning", icon: "calendar", body:
    <div className="ms-week">{["Dim", "Lun", "Mar", "Mer", "Jeu"].map((day, index) => <div key={day}><small>{day}</small>
      {[["Excel", "t"], ["Anglais", "c"], ["Python", "n"]].filter((_, slot) => (index + slot) % 3 !== 2).map(([label, tone]) => <i key={label} className={tone}>{label}</i>)}
    </div>)}</div> },
  { title: "Groupes", icon: "users", body: <>
    {[["Excel avancé — Matin", 16, 18], ["Anglais B1 — Soir", 11, 20], ["Python débutant", 19, 20]].map(([name, taken, seats]) =>
      <div className="ms-group" key={name}><span><b>{name}</b><small>{taken} / {seats} places</small></span><div><i style={{ width: `${(Number(taken) / Number(seats)) * 100}%` }} /></div></div>)}
  </> },
  { title: "Certificats", icon: "print", body:
    <div className="ms-cert"><small>Certificat de formation</small><b>Lina Haddad</b><span>a suivi avec succès « Excel avancé »</span><div><i /><i /></div></div> },
];

function ScreenStrip() {
  return <div className="lp-marquee">
    <div className="lp-marquee-track">
      {[0, 1].map((copy) => SCREENS.map((screen) => <div className="lp-shot" key={`${copy}-${screen.title}`} aria-hidden={copy === 1 || undefined}>
        <div className="lp-shot-bar"><Icon name={screen.icon} size={13} />{screen.title}</div>
        <div className="lp-shot-body" aria-hidden="true">{screen.body}</div>
      </div>))}
    </div>
  </div>;
}

// Scroll reveal, marketing surface only: each block fades up once when it enters the viewport.
const REVEAL = ".lp-section-head, .lp-marquee, .lp-problem article, .lp-role, .lp-tile, .lp-band h2, .lp-steps li, .lp-pricing-intro, .lp-plan, .lp-faq > div, .lp-cta";
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const targets = [...(root.current?.querySelectorAll<HTMLElement>(REVEAL) ?? [])];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.setAttribute("data-visible", ""); observer.unobserve(entry.target); }
    }, { rootMargin: "0px 0px -80px 0px" });
    for (const target of targets) { target.setAttribute("data-reveal", ""); observer.observe(target); }
    return () => observer.disconnect();
  }, []);
  return root;
}

// Nav underline follows the section in the middle of the screen.
const NAV = [["fonctionnalites", "Fonctionnalités"], ["roles", "Pour qui"], ["tarifs", "Tarifs"], ["faq", "Questions"]];
function useActiveSection() {
  const [active, setActive] = useState("");
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) { const id = entry.target.id; setActive((current) => entry.isIntersecting ? id : current === id ? "" : current); }
    }, { rootMargin: "-45% 0px -50% 0px" });
    for (const [id] of NAV) { const section = document.getElementById(id); if (section) observer.observe(section); }
    return () => observer.disconnect();
  }, []);
  return active;
}

export function Landing() {
  const root = useReveal();
  const active = useActiveSection();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const [billing, setBilling] = useState<Billing>("monthly");
  const featured = PLANS.find((plan) => plan.featured)!;
  return <div className="lp" ref={root}>
    <header className="lp-header">
      <Brand />
      <nav className="lp-nav" aria-label="Sections">{NAV.map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>{label}</a>)}</nav>
      <a className="lp-login" href="/connexion">Se connecter</a>
      <button className="lp-burger" type="button" aria-label="Menu" aria-expanded={menuOpen} aria-controls="lp-menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={20} /></button>
      {menuOpen && <nav id="lp-menu" className="lp-menu" aria-label="Menu">{NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>}
    </header>

    <main>
      <section className="lp-hero">
        <p className="lp-eyebrow">Logiciel de gestion scolaire · Algérie</p>
        <h1>L'école tourne.<br /><span>Les papiers, non.</span></h1>
        <p className="lp-lead">Inscriptions, présences, paiements et certificats au même endroit — pour le directeur, le secrétariat et les formateurs.</p>
        <div className="lp-actions"><a className="lp-btn primary" href="#tarifs">Voir les formules</a>{DEMO.email ? <DemoButton className="lp-btn outline" /> : <a className="lp-link" href="#fonctionnalites">Comment ça marche <Icon name="arrow" size={15} /></a>}</div>
        {DEMO.email && <p className="lp-demo-hint">Démo en lecture seule, sans inscription, avec une école fictive.</p>}
        <AppPreview />
      </section>

      <section className="lp-audience" aria-label="Pour qui">
        <span>Conçu pour</span>
        <ul>{AUDIENCES.map((audience) => <li key={audience}>{audience}</li>)}</ul>
      </section>

      <section className="lp-section lp-problem">
        <div className="lp-section-head">
          <p className="lp-eyebrow">Le problème</p>
          <h2>La gestion de l'école se perd dans les cahiers.</h2>
          <p>Un tableur pour les inscriptions, un cahier pour l'appel, un carnet pour les versements. Chaque information existe en trois versions, dont deux sont fausses.</p>
        </div>
        <div className="lp-problem-grid">{PROBLEMS.map((item) => <article key={item.title}><span className="lp-icon"><Icon name={item.icon} size={20} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="lp-shots" aria-label="Les écrans de FormaPlus">
        <div className="lp-section-head">
          <p className="lp-eyebrow">L&apos;application</p>
          <h2>Tous les écrans de l&apos;école, au même endroit.</h2>
        </div>
        <ScreenStrip />
      </section>

      <section id="fonctionnalites" className="lp-section">
        <div className="lp-section-head">
          <p className="lp-eyebrow">Au quotidien</p>
          <h2>Une journée d'école, sans double saisie.</h2>
        </div>
        <div className="lp-bento">
          <article className="lp-tile dark big">
            <span className="lp-icon"><Icon name="check" size={20} /></span>
            <h3>La présence en un geste</h3>
            <p>Le formateur marque présent, retard ou absent depuis son téléphone. Le taux de chaque étudiant se met à jour pour tout le monde.</p>
            <div className="lp-tile-marks" aria-hidden="true"><b className="P on">✓</b><b className="L">~</b><b className="A">×</b></div>
          </article>
          <article className="lp-tile">
            <span className="lp-icon"><Icon name="wallet" size={20} /></span>
            <h3>Qui doit quoi, en temps réel</h3>
            <p>Chaque versement est enregistré. Le reste à payer se calcule par inscription, sans tableur.</p>
          </article>
          <article className="lp-tile">
            <span className="lp-icon"><Icon name="graduation" size={20} /></span>
            <h3>Le dossier complet</h3>
            <p>Coordonnées, inscriptions, CNI et diplômes scannés, notes de suivi.</p>
          </article>
          <article className="lp-tile wide">
            <span className="lp-icon"><Icon name="calendar" size={20} /></span>
            <div><h3>Groupes, salles et horaires</h3><p>Une grille hebdomadaire lisible, filtrée pour chaque formateur.</p></div>
          </article>
          <article className="lp-tile sand">
            <span className="lp-icon"><Icon name="print" size={20} /></span>
            <h3>Certificats</h3>
            <p>Prêts à imprimer dès qu'une formation est terminée et réglée.</p>
          </article>
        </div>
      </section>

      <section id="roles" className="lp-section lp-roles">
        <div className="lp-section-head">
          <p className="lp-eyebrow">Pour qui</p>
          <h2>Chaque rôle a son espace.</h2>
          <p>Chacun voit ce dont il a besoin, et rien d'autre. Les règles sont appliquées par la base de données, pas seulement par l'écran.</p>
        </div>
        <div className="lp-role-grid">{ROLES.map((item) => <article className="lp-role" key={item.role}>
          <span className="lp-icon"><Icon name={item.icon} size={20} /></span>
          <h3>{item.role}</h3>
          <p>{item.text}</p>
          <ul>{item.can.map((line) => <li key={line}><Icon name="check" size={14} />{line}</li>)}</ul>
        </article>)}</div>
      </section>

      <section className="lp-band">
        <div className="lp-band-inner">
          <h2>En ligne dès aujourd'hui.</h2>
          <ol className="lp-steps">
            <li><em>01</em><strong>Choisissez votre formule</strong><span>Selon le nombre d'étudiants.</span></li>
            <li><em>02</em><strong>Payez en ligne</strong><span>Edahabia, CIB, ou virement / CCP.</span></li>
            <li><em>03</em><strong>Recevez votre accès</strong><span>Le directeur invite son équipe.</span></li>
          </ol>
        </div>
      </section>

      <section id="tarifs" className="lp-section lp-pricing">
        <div className="lp-pricing-intro">
          <p className="lp-eyebrow">Tarifs</p>
          <h2>Un prix par taille d'école. Rien de caché.</h2>
          <p>Toutes les fonctionnalités sont dans chaque formule. Seules la taille et l'accompagnement changent.</p>
          <div className="lp-billing" role="group" aria-label="Période de facturation">
            <button className={billing === "monthly" ? "active" : ""} aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")}>Mensuel</button>
            <button className={billing === "yearly" ? "active" : ""} aria-pressed={billing === "yearly"} onClick={() => setBilling("yearly")}>Annuel · 2 mois offerts</button>
          </div>
          <div className="lp-included">
            <strong>Inclus partout</strong>
            <ul>{INCLUDED.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
          </div>
        </div>

        <div className="lp-ledger">
          {PLANS.map((plan) => <article className={`lp-plan ${plan.featured ? "featured" : ""}`} key={plan.id}>
            <div className="lp-plan-name">
              <h3>{plan.name}{plan.featured && <span className="lp-badge">Recommandé</span>}</h3>
              <p>{plan.tagline}</p>
            </div>
            <div className="lp-plan-size"><span>{plan.students}</span><span>{plan.users}</span></div>
            <div className="lp-plan-price">
              <strong key={billing} className="lp-swap">{price(planTotal(plan, billing))}</strong>
              <span>{billing === "yearly" ? `par an · soit ${price(Math.round(plan.monthly * 10 / 12))}/mois` : "par mois"}</span>
            </div>
            <a className={`lp-plan-cta ${plan.featured ? "primary" : ""}`} href={`/commander?plan=${plan.id}&periode=${billing}`} aria-label={`Choisir ${plan.name}`}>
              Choisir <Icon name="arrow" size={16} />
            </a>
            {plan.featured && <ul className="lp-plan-extras">{plan.features.map((feature) => <li key={feature}><Icon name="spark" size={14} />{feature}</li>)}</ul>}
          </article>)}
          <p className="lp-ledger-note">{featured.name} : {featured.features.length} services d'accompagnement en plus. Paiement Edahabia, CIB ou virement CCP. Sans engagement en mensuel.</p>
        </div>
      </section>

      <section id="faq" className="lp-section lp-faq">
        <div>
          <p className="lp-eyebrow">Questions</p>
          <h2>Ce que les directeurs nous demandent.</h2>
        </div>
        <div>{FAQ.map((item) => <details key={item.q}><summary>{item.q}<Icon name="plus" size={18} /></summary><p>{item.a}</p></details>)}</div>
      </section>

      <section className="lp-cta">
        <h2>Prêt pour la rentrée ?</h2>
        <div className="lp-actions"><a className="lp-btn primary" href="#tarifs">Choisir ma formule</a><DemoButton className="lp-btn outline" /></div>
      </section>
    </main>

    <Footer />
  </div>;
}

// ---------------------------------------------------------------- Demo checkout

const SCHOOL_TYPES = ["École privée", "Centre de formation", "École de soutien scolaire", "École de langues", "Crèche / préscolaire"];

export function Checkout() {
  const params = new URLSearchParams(window.location.search);
  const [planId, setPlanId] = useState(PLANS.some((plan) => plan.id === params.get("plan")) ? params.get("plan")! : "pro");
  const [billing, setBilling] = useState<Billing>(params.get("periode") === "yearly" ? "yearly" : "monthly");
  const [values, setValues] = useState({ school: "", type: SCHOOL_TYPES[0], wilaya: "", director: "", email: "", phone: "", method: "card" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "paying" | "done">("form");
  const [reference] = useState(() => `FP-${Date.now().toString(36).toUpperCase()}`);
  const plan = PLANS.find((item) => item.id === planId)!;
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => { setValues({ ...values, [key]: event.target.value }); setErrors({ ...errors, [key]: "" }); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.school.trim()) next.school = "Indiquez le nom de l'établissement.";
    if (!values.wilaya.trim()) next.wilaya = "Indiquez la wilaya.";
    if (!values.director.trim()) next.director = "Indiquez le nom du directeur.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Email invalide.";
    if (!/^0[5-7]\d{8}$/.test(values.phone.replace(/[\s.-]/g, ""))) next.phone = "Numéro mobile algérien : 05, 06 ou 07 suivi de 8 chiffres.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setStep("paying");
    window.setTimeout(() => { setStep("done"); window.scrollTo({ top: 0 }); }, 1400); // simulated payment
  };

  const field = (key: keyof typeof values, label: string, props: Record<string, string> = {}) => <label>
    {label}
    <input className="field" value={values[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} {...props} />
    {errors[key] && <span className="field-error">{errors[key]}</span>}
  </label>;

  return <div className="lp lp-checkout-page">
    <header className="lp-header"><Brand /><a className="lp-login" href="/#tarifs">← Retour aux tarifs</a></header>
    <p className="lp-demo-banner" role="note"><Icon name="warning" size={15} /> Démonstration : aucun paiement n'est effectué et aucun compte n'est créé.</p>

    {step === "done" ? <section className="lp-done">
      <span className="lp-done-icon"><Icon name="checkCircle" size={34} /></span>
      <h1>Paiement confirmé</h1>
      <p>Merci, {values.director.trim()}. Commande <strong>{reference}</strong> · {plan.name} · {price(planTotal(plan, billing))}{billing === "yearly" ? "/an" : "/mois"}</p>
      <ol className="lp-next">
        <li><strong>Espace créé</strong><span>« {values.school.trim()} » est prêt, vide et séparé des autres écoles.</span></li>
        <li><strong>Email d'accès</strong><span>{values.email.trim()} reçoit un lien pour choisir son mot de passe.</span></li>
        <li><strong>Votre équipe</strong><span>Dans Paramètres → Utilisateurs, invitez secrétaires et formateurs.</span></li>
      </ol>
      <p className="lp-price-note">En production, ces trois étapes sont automatiques après la confirmation du paiement.</p>
      <a className="lp-btn primary" href="/connexion">Aller à la connexion</a>
    </section> : <div className="lp-checkout">
      <form className="lp-checkout-form" onSubmit={submit} noValidate>
        <h1>Commander FormaPlus</h1>
        <fieldset disabled={step === "paying"}>
          <legend>Votre établissement</legend>
          {field("school", "Nom de l'établissement *", { placeholder: "Ex. École Ibn Sina", autoComplete: "organization" })}
          <label>Type d'établissement<select className="field" value={values.type} onChange={set("type")}>{SCHOOL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          {field("wilaya", "Wilaya *", { placeholder: "Ex. Alger" })}
        </fieldset>
        <fieldset disabled={step === "paying"}>
          <legend>Le directeur (compte principal)</legend>
          {field("director", "Nom complet *", { autoComplete: "name" })}
          {field("email", "Email *", { type: "email", autoComplete: "email", placeholder: "directeur@ecole.dz" })}
          {field("phone", "Téléphone mobile *", { type: "tel", autoComplete: "tel", placeholder: "0555 00 00 00" })}
        </fieldset>
        <fieldset disabled={step === "paying"}>
          <legend>Paiement</legend>
          <div className="lp-methods">
            {[["card", "Carte Edahabia ou CIB", "Paiement en ligne, accès immédiat"], ["transfer", "Virement ou versement CCP", "Accès dès réception du paiement"]].map(([id, title, text]) =>
              <label key={id} className={`lp-method ${values.method === id ? "active" : ""}`}><input type="radio" name="method" value={id} checked={values.method === id} onChange={set("method")} /><div><strong>{title}</strong><span>{text}</span></div></label>)}
          </div>
        </fieldset>
        <p className="lp-terms">En commandant, vous acceptez les <a href="/cgv" target="_blank">conditions générales de vente</a> et la <a href="/confidentialite" target="_blank">politique de confidentialité</a>.</p>
        <button className="lp-btn primary lp-pay" type="submit" disabled={step === "paying"}>{step === "paying" ? "Paiement en cours…" : `Payer ${price(planTotal(plan, billing))} (démo)`}</button>
      </form>

      <aside className="lp-summary">
        <h2>Récapitulatif</h2>
        <label>Formule<select className="field" value={planId} onChange={(event) => setPlanId(event.target.value)} disabled={step === "paying"}>{PLANS.map((item) => <option key={item.id} value={item.id}>{item.name} · {price(item.monthly)}/mois</option>)}</select></label>
        <div className="lp-billing small" role="group" aria-label="Période de facturation">
          <button type="button" className={billing === "monthly" ? "active" : ""} aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")}>Mensuel</button>
          <button type="button" className={billing === "yearly" ? "active" : ""} aria-pressed={billing === "yearly"} onClick={() => setBilling("yearly")}>Annuel</button>
        </div>
        <ul>{[plan.students, plan.users, ...plan.features].map((feature) => <li key={feature}><Icon name="check" size={14} />{feature}</li>)}</ul>
        <div className="lp-total"><span>Total {billing === "yearly" ? "annuel" : "mensuel"}</span><strong key={billing + planId} className="lp-swap">{price(planTotal(plan, billing))}</strong></div>
        {billing === "yearly" && <p className="lp-price-note">Vous économisez {price(plan.monthly * 2)} par an.</p>}
      </aside>
    </div>}
  </div>;
}
