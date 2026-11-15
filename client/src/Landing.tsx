import { useEffect, useState } from "react";
import { EXTRA_PACKS, PLANS, TRIAL_DAYS } from "./lib/plans";
import type { PlanId } from "./lib/plans";
import { supabase } from "./lib/supabase";
import { isLeaked } from "./Login";
import type { FormEvent, ReactNode } from "react";
import { LangPicker, money, usePage, useT } from "./i18n";
import type { Copy } from "./i18n";
import { BrandMark, Icon, Spinner, ThemeToggle } from "./ui";
import type { IconName } from "./ui";

// Public site: landing page and a DEMO checkout. Nothing here charges money.
// Real version: checkout → payment gateway (Chargily: Edahabia/CIB) → webhook creates the school
// and invites the director with the existing invite-user flow.

// A longer plan shows its price per month when that beats paying month by month.
const monthlyPrice = (plan: (typeof PLANS)[number]) => Math.round(plan.price / plan.months);
const cheaperPerMonth = (plan: (typeof PLANS)[number]) => plan.months > 1 && monthlyPrice(plan) < PLANS[0].price;

const PROBLEM_ICONS: IconName[] = ["clock", "wallet", "warning"];
const ROLE_ICONS: IconName[] = ["building", "file", "teacher"];
const TILE_ICONS: IconName[] = ["check", "wallet", "graduation", "calendar", "print"];

export function Footer() {
  const t = useT();
  return <footer className="lp-footer">
    <Brand />
    <nav aria-label={t.footer.legalNav}><a href="/mentions-legales">{t.footer.legal}</a><a href="/cgv">{t.footer.cgv}</a><a href="/confidentialite">{t.footer.privacy}</a></nav>
    <a href="/connexion">{t.footer.client}</a>
  </footer>;
}

// Public read-only demo school. Unset in .env = no demo button.
const DEMO = { email: import.meta.env.VITE_DEMO_EMAIL as string | undefined, password: import.meta.env.VITE_DEMO_PASSWORD as string | undefined };
function DemoButton({ className = "lp-btn" }: { className?: string }) {
  const t = useT();
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
    <button className={className} type="button" onClick={start} disabled={state === "busy"}>{state === "busy" && <Spinner />}{state === "busy" ? t.demo.busy : t.demo.start}</button>
    {state === "error" && <small role="alert">{t.demo.error}</small>}
  </span>;
}

export function Brand({ light = false }: { light?: boolean }) {
  return <a className={`lp-brand ${light ? "light" : ""}`} href="/"><BrandMark size={34} /><strong dir="ltr">CLASSTRA<span>.</span></strong></a>;
}

// Language and theme, together, wherever the public site shows its header.
function Prefs() {
  const t = useT();
  return <span className="lp-prefs"><LangPicker label={t.language} /><ThemeToggle labels={t.theme} /></span>;
}

// A still of the real app, drawn in HTML so it stays sharp and matches the product.
// Its content is the French product UI on purpose: it is a screenshot, not page copy.
function AppPreview() {
  return <div className="lp-app" aria-hidden="true" dir="ltr">
    <div className="lp-app-side">
      <BrandMark size={30} />
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

// Small stills of the other screens, looped right-to-left under the hero. Same rule as
// AppPreview: the inside is the real French app, only the window title is translated.
const avatar = (name: string) => <i className="ms-avatar">{name.split(" ").map((part) => part[0]).join("")}</i>;
const SCREENS: { icon: IconName; body: ReactNode }[] = [
  { icon: "grid", body: <>
    <div className="ms-metrics"><div><small>Étudiants actifs</small><b>186</b></div><div><small>Présence</small><b>91%</b></div><div><small>Encaissé</small><b>742k</b></div></div>
    <div className="ms-bars">{[42, 58, 50, 71, 64, 88, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
  </> },
  { icon: "graduation", body: <>
    {[["Lina Haddad", "Excel avancé", "Actif"], ["Yacine Merabet", "Anglais B1", "Actif"], ["Sara Belkacem", "Comptabilité", "En attente"], ["Nour Saad", "Python", "Actif"]].map(([name, course, status]) =>
      <div className="ms-row" key={name}>{avatar(name)}<span><b>{name}</b><small>{course}</small></span><em className={status === "Actif" ? "ok" : "wait"}>{status}</em></div>)}
  </> },
  { icon: "wallet", body: <>
    {[["Karim Ouali", "15 000 DA", "CCP"], ["Lina Haddad", "22 000 DA", "Espèces"], ["Amel Rahmani", "18 500 DA", "Edahabia"]].map(([name, amount, method]) =>
      <div className="ms-row" key={name}>{avatar(name)}<span><b>{name}</b><small>{method}</small></span><strong>{amount}</strong></div>)}
    <div className="ms-due"><span>Reste à recouvrer</span><b>186 500 DA</b></div>
  </> },
  { icon: "calendar", body:
    <div className="ms-week">{["Dim", "Lun", "Mar", "Mer", "Jeu"].map((day, index) => <div key={day}><small>{day}</small>
      {[["Excel", "t"], ["Anglais", "c"], ["Python", "n"]].filter((_, slot) => (index + slot) % 3 !== 2).map(([label, tone]) => <i key={label} className={tone}>{label}</i>)}
    </div>)}</div> },
  { icon: "users", body: <>
    {[["Excel avancé — Matin", 16, 18], ["Anglais B1 — Soir", 11, 20], ["Python débutant", 19, 20]].map(([name, taken, seats]) =>
      <div className="ms-group" key={name}><span><b>{name}</b><small>{taken} / {seats} places</small></span><div><i style={{ width: `${(Number(taken) / Number(seats)) * 100}%` }} /></div></div>)}
  </> },
  { icon: "print", body:
    <div className="ms-cert"><small>Certificat de formation</small><b>Lina Haddad</b><span>a suivi avec succès « Excel avancé »</span><div><i /><i /></div></div> },
];

function ScreenStrip() {
  const t = useT();
  return <div className="lp-marquee">
    <div className="lp-marquee-track" dir="ltr">
      {[0, 1].map((copy) => SCREENS.map((screen, index) => <div className="lp-shot" key={`${copy}-${index}`} aria-hidden={copy === 1 || undefined}>
        <div className="lp-shot-bar"><Icon name={screen.icon} size={13} />{t.shots.screens[index]}</div>
        <div className="lp-shot-body" aria-hidden="true">{screen.body}</div>
      </div>))}
    </div>
  </div>;
}

// Nav underline follows the section in the middle of the screen.
const NAV = ["fonctionnalites", "roles", "tarifs", "faq"] as const;
function useActiveSection() {
  const [active, setActive] = useState("");
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) { const id = entry.target.id; setActive((current) => entry.isIntersecting ? id : current === id ? "" : current); }
    }, { rootMargin: "-45% 0px -50% 0px" });
    for (const id of NAV) { const section = document.getElementById(id); if (section) observer.observe(section); }
    return () => observer.disconnect();
  }, []);
  return active;
}

export function Landing() {
  const t = useT();
  const page = usePage();
  const active = useActiveSection();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const navLabels = [t.nav.features, t.nav.roles, t.nav.pricing, t.nav.faq];
  return <div className="lp" {...page}>
    <header className="lp-header">
      <div className="lp-header-start"><Brand /><Prefs /></div>
      <nav className="lp-nav" aria-label={t.sections}>{NAV.map((id, index) => <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>{navLabels[index]}</a>)}</nav>
      <div className="lp-header-end">
        <a className="lp-login" href="/connexion">{t.signIn}</a>
        <a className="lp-login lp-signup-link" href="/creer-un-compte">{t.signup.link}</a>
      </div>
      <button className="lp-burger" type="button" aria-label={t.menu} aria-expanded={menuOpen} aria-controls="lp-menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={20} /></button>
      {menuOpen && <nav id="lp-menu" className="lp-menu" aria-label={t.menu}>
        {NAV.map((id, index) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{navLabels[index]}</a>)}
        <a href="/connexion">{t.signIn}</a>
        <a href="/creer-un-compte">{t.signup.link}</a>
        <Prefs />
      </nav>}
    </header>

    <main>
      <section className="lp-hero">
        <p className="lp-eyebrow">{t.hero.eyebrow}</p>
        <h1>{t.hero.titleA}<br /><span>{t.hero.titleB}</span></h1>
        <p className="lp-lead">{t.hero.lead}</p>
        <div className="lp-actions"><a className="lp-btn primary" href="#tarifs">{t.hero.plans}</a>{DEMO.email ? <DemoButton className="lp-btn outline" /> : <a className="lp-link" href="#fonctionnalites">{t.hero.how} <Icon name="arrow" size={15} /></a>}</div>
        <AppPreview />
      </section>

      <section className="lp-audience" aria-label={t.audience.label}>
        <span>{t.audience.label}</span>
        <ul>{t.audience.items.map((audience) => <li key={audience}>{audience}</li>)}</ul>
      </section>

      <section className="lp-section lp-problem">
        <div className="lp-section-head">
          <h2>{t.problem.title}</h2>
          <p>{t.problem.text}</p>
        </div>
        <div className="lp-problem-grid">{t.problem.items.map((item, index) => <article key={item.title}><span className="lp-icon"><Icon name={PROBLEM_ICONS[index]} size={20} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="lp-shots" aria-label={t.shots.title}>
        <div className="lp-section-head">
          <h2>{t.shots.title}</h2>
        </div>
        <ScreenStrip />
      </section>

      <section id="fonctionnalites" className="lp-section">
        <div className="lp-section-head">
          <h2>{t.features.title}</h2>
        </div>
        <div className="lp-bento">
          {t.features.tiles.map((tile, index) => <article className={`lp-tile ${["dark big", "", "", "wide", "sand"][index]}`} key={tile.title}>
            <span className="lp-icon"><Icon name={TILE_ICONS[index]} size={20} /></span>
            {index === 3
              ? <div><h3>{tile.title}</h3><p>{tile.text}</p></div>
              : <><h3>{tile.title}</h3><p>{tile.text}</p></>}
            {index === 0 && <div className="lp-tile-marks" aria-hidden="true"><b className="P on">✓</b><b className="L">~</b><b className="A">×</b></div>}
          </article>)}
        </div>
      </section>

      <section id="roles" className="lp-section lp-roles">
        <div className="lp-section-head">
          <h2>{t.roles.title}</h2>
          <p>{t.roles.text}</p>
        </div>
        <div className="lp-role-grid">{t.roles.items.map((item, index) => <article className="lp-role" key={item.role}>
          <span className="lp-icon"><Icon name={ROLE_ICONS[index]} size={20} /></span>
          <h3>{item.role}</h3>
          <p>{item.text}</p>
          <ul>{item.can.map((line) => <li key={line}><Icon name="check" size={14} />{line}</li>)}</ul>
        </article>)}</div>
      </section>

      <section className="lp-band">
        <div className="lp-band-inner">
          <h2>{t.steps.title}</h2>
          <ol className="lp-steps">
            {t.steps.items.map((step, index) => <li key={step.title}><em>{String(index + 1).padStart(2, "0")}</em><strong>{step.title}</strong><span>{step.text}</span></li>)}
          </ol>
        </div>
      </section>

      <section id="tarifs" className="lp-section lp-pricing">
        <div className="lp-pricing-intro">
          <p className="lp-eyebrow">{t.pricing.eyebrow}</p>
          <h2>{t.pricing.title}</h2>
          <p>{t.pricing.text}</p>
          <div className="lp-included">
            <strong>{t.pricing.includedTitle}</strong>
            <ul>{t.pricing.included.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
          </div>
          {/* The 15-day free trial (0033): straight to a working school, before any plan. */}
          <div className="lp-trial"><a className="lp-btn primary" href="/essai">{t.trial.cta} <Icon name="arrow" size={16} /></a><span>{t.trial.ctaNote}</span></div>
        </div>

        <div className="lp-ledger">
          {PLANS.map((plan) => {
            const copy = t.plans[plan.id];
            return <article className={`lp-plan ${plan.featured ? "featured" : ""}`} key={plan.id}>
              <div className="lp-plan-name">
                <h3>{copy.name}{plan.featured && <span className="lp-badge">{t.pricing.recommended}</span>}</h3>
                <p>{copy.tagline}</p>
              </div>
              <div className="lp-plan-size" />
              <div className="lp-plan-price">
                <strong>{money(plan.price, t)}</strong>
                {cheaperPerMonth(plan) && <span>{t.pricing.perMonth(money(monthlyPrice(plan), t))}</span>}
              </div>
              <a className={`lp-plan-cta ${plan.featured ? "primary" : ""}`} href={`/commander?plan=${plan.id}`} aria-label={t.pricing.chooseAria(copy.name)}>
                {t.pricing.choose} <Icon name="arrow" size={16} />
              </a>
            </article>;
          })}
          <div className="lp-extras">
            <strong>{t.pricing.extrasTitle}</strong>
            <ul>
              {EXTRA_PACKS.map((pack) => <li key={pack.students}><Icon name="plus" size={14} />{t.pricing.extraLine(pack.students, money(pack.price, t))}</li>)}
              <li><Icon name="plus" size={14} />{t.pricing.extraQuote}</li>
            </ul>
            <span>{t.pricing.extrasNote}</span>
          </div>
          <p className="lp-ledger-note">{t.pricing.note}</p>
        </div>
      </section>

      <section id="faq" className="lp-section lp-faq">
        <div>
          <h2>{t.faq.title}</h2>
        </div>
        <div>{t.faq.items.map((item) => <details key={item.q}><summary>{item.q}<Icon name="plus" size={18} /></summary><p>{item.a}</p></details>)}</div>
      </section>

      <section className="lp-cta">
        <h2>{t.cta.title}</h2>
        <div className="lp-actions"><a className="lp-btn primary" href="#tarifs">{t.hero.plans}</a><DemoButton className="lp-btn outline" /></div>
      </section>
    </main>

    <Footer />
  </div>;
}

// ---------------------------------------------------------------- Checkout and sign-up

// Supabase refuses anything weaker, so the sign-up form asks for the same thing.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,}$/;
// What lands in the orders table, whatever language the visitor reads the site in.
const TYPES_FR = ["Centre de formation", "École de soutien scolaire", "École de langues"]; // "soutien" opens an école de soutien (0019)
const METHODS_FR = ["en main propre", "virement ou CCP"];

// The school and director details, shared by the order form and the sign-up page. The sign-up page
// keeps them on the account (user_metadata), and the order form starts from them.
type Details = { school: string; type: number; wilaya: string; director: string; email: string; phone: string };
const EMPTY: Details = { school: "", type: 0, wilaya: "", director: "", email: "", phone: "" };
const toMetadata = (details: Details) => ({ school_name: details.school.trim(), school_type: details.type, wilaya: details.wilaya.trim(), director_name: details.director.trim(), phone: details.phone.trim() });
const fromMetadata = (data: Record<string, unknown> | undefined): Partial<Details> => !data ? {} : {
  school: String(data.school_name ?? ""), type: Number(data.school_type ?? 0) || 0, wilaya: String(data.wilaya ?? ""),
  director: String(data.director_name ?? ""), phone: String(data.phone ?? ""),
};

// Email confirmation is on, so supabase.auth.signUp() hands back no session: between creating the
// account and opening the link in the email, nothing is signed in and user_metadata is out of reach.
// The details are kept here for that gap, so the order form is filled either way.
// ponytail: one draft per browser, cleared once the order is in — on a shared computer the next
// visitor starts from the last one. Scope it per email if that ever matters.
const DRAFT = "classtra-order-draft";
const saveDraft = (details: Details) => { try { localStorage.setItem(DRAFT, JSON.stringify(details)); } catch { /* private window */ } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT); } catch { /* private window */ } };
const readDraft = (): Partial<Details> => {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT) ?? "{}") as Partial<Details>;
    return { ...saved, type: Number(saved.type ?? 0) || 0 };
  } catch { return {}; }
};

function detailErrors(values: Details, t: Copy) {
  const next: Record<string, string> = {};
  if (!values.school.trim()) next.school = t.checkout.errors.school;
  if (!values.wilaya.trim()) next.wilaya = t.checkout.errors.wilaya;
  if (!values.director.trim()) next.director = t.checkout.errors.director;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = t.checkout.errors.email;
  if (!/^0[5-7]\d{8}$/.test(values.phone.replace(/[\s.-]/g, ""))) next.phone = t.checkout.errors.phone;
  return next;
}

// The two fieldsets both pages show: the school, then the director.
function DetailFields({ values, set, setType, errors, disabled, emailLocked, children }: {
  values: Details; set: (key: keyof Details) => (event: { target: { value: string } }) => void; setType: (type: number) => void;
  errors: Record<string, string>; disabled: boolean; emailLocked: boolean; children?: ReactNode;
}) {
  const t = useT();
  const field = (key: Exclude<keyof Details, "type">, label: string, props: Record<string, string | boolean> = {}) => <label>
    {label}
    <input className="field" value={values[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} {...props} />
    {errors[key] && <span className="field-error">{errors[key]}</span>}
  </label>;
  return <>
    <fieldset disabled={disabled}>
      <legend>{t.checkout.schoolLegend}</legend>
      {field("school", t.checkout.schoolName, { placeholder: t.checkout.schoolPlaceholder, autoComplete: "organization" })}
      <label>{t.checkout.schoolType}<select className="field" value={values.type} onChange={(event) => setType(Number(event.target.value))}>{t.checkout.types.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
      {field("wilaya", t.checkout.wilaya, { placeholder: t.checkout.wilayaPlaceholder })}
    </fieldset>
    <fieldset disabled={disabled}>
      <legend>{t.checkout.accountLegend}</legend>
      {field("director", t.checkout.director, { autoComplete: "name" })}
      {field("email", t.checkout.email, { type: "email", autoComplete: "email", placeholder: "directeur@ecole.dz", readOnly: emailLocked })}
      {field("phone", t.checkout.phone, { type: "tel", autoComplete: "tel", placeholder: "0555 00 00 00" })}
      {children}
    </fieldset>
  </>;
}

function useDetails(initial: Partial<Details> = {}) {
  const [values, setValues] = useState<Details>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof Details) => (event: { target: { value: string } }) => { setValues((current) => ({ ...current, [key]: event.target.value })); setErrors((current) => ({ ...current, [key]: "" })); };
  const setType = (type: number) => setValues((current) => ({ ...current, type }));
  return { values, setValues, errors, setErrors, set, setType };
}

// The order form. It only records the order: no login is created and no email is sent until the
// order is accepted (0026). A visitor signed in already (sign-up page) has the order on that login.
export function Checkout() {
  const t = useT();
  const page = usePage();
  const requested = new URLSearchParams(window.location.search).get("plan");
  const [planId, setPlanId] = useState<PlanId>(PLANS.some((plan) => plan.id === requested) ? requested as PlanId : "yearly");
  const [extra, setExtra] = useState<"0" | "500" | "1000" | "quote">("0");
  const [method, setMethod] = useState(0);
  const { values, setValues, errors, setErrors, set, setType } = useDetails(readDraft());
  const [step, setStep] = useState<"form" | "sending" | "done">("form");
  const [reference, setReference] = useState("");
  const [account, setAccount] = useState<string | null>(null); // email of the session, when already signed in
  // onAuthStateChange, not a single getSession(): arriving from the confirmation link, the session
  // is read out of the URL a moment after this runs, and the form has to fill when it lands.
  useEffect(() => {
    const fill = (user: { email?: string; user_metadata?: Record<string, unknown> } | undefined) => {
      if (!user?.email) return;
      setAccount(user.email);
      setValues((current) => ({ ...current, ...fromMetadata(user.user_metadata), email: user.email! }));
    };
    void supabase.auth.getSession().then(({ data }) => fill(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => fill(session?.user));
    return () => data.subscription.unsubscribe();
  }, [setValues]);
  const plan = PLANS.find((item) => item.id === planId)!;
  const pack = EXTRA_PACKS.find((item) => String(item.students) === extra);
  const total = plan.price + (pack?.price ?? 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = detailErrors(values, t);
    setErrors(next);
    if (Object.keys(next).length) return;
    setStep("sending");
    // place_order runs as owner: it can write the order and hand back its number without opening the table.
    const { data, error } = await supabase.rpc("place_order", {
      p_school_name: values.school, p_school_type: TYPES_FR[values.type], p_wilaya: values.wilaya,
      p_director_name: values.director, p_email: values.email, p_phone: values.phone,
      p_plan: "standard", p_billing: planId,
      p_notes: `Paiement souhaité : ${METHODS_FR[method]}`,
      p_extra_students: pack?.students ?? 0, p_extra_on_quote: extra === "quote",
    });
    if (error || !data) { if (import.meta.env.DEV) console.error(error); setStep("form"); setErrors({ form: t.checkout.errors.send }); return; }
    clearDraft();
    setReference(`CMD-${String(data).padStart(5, "0")}`);
    setStep("done");
    window.scrollTo({ top: 0 });
  };

  const doneValues = [values.phone.trim(), values.email.trim(), values.school.trim()];

  return <div className="lp lp-checkout-page" {...page}>
    <header className="lp-header"><Brand /><a className="lp-login" href="/#tarifs">{t.checkout.back}</a></header>
    <p className="lp-demo-banner" role="note"><Icon name="phone" size={15} /> {t.checkout.banner}</p>

    {step === "done" ? <section className="lp-done">
      <span className="lp-done-icon"><Icon name="checkCircle" size={34} /></span>
      <h1>{t.checkout.done.title}</h1>
      <p>{t.checkout.done.thanks(values.director.trim())} <strong>{reference}</strong>.</p>
      <p className="lp-price-note">{t.plans[planId].name} · {money(total, t)}{extra === "quote" ? ` + ${t.checkout.onQuote}` : ""}</p>
      <ol className="lp-next">
        {t.checkout.done.steps.map((item, index) => <li key={item.title}><strong>{item.title}</strong><span>{item.text(doneValues[index])}</span></li>)}
      </ol>
      <p className="lp-price-note">{t.checkout.done.nothingCharged}</p>
      <a className="lp-btn primary" href="/">{t.checkout.done.goToLogin}</a>
    </section> : <div className="lp-checkout">
      <form className="lp-checkout-form" onSubmit={submit} noValidate>
        <h1>{t.checkout.title}</h1>
        <DetailFields values={values} set={set} setType={setType} errors={errors} disabled={step === "sending"} emailLocked={Boolean(account)}>
          <p className="lp-terms">{account ? t.checkout.signedIn(account) : t.checkout.noPassword}</p>
        </DetailFields>
        <fieldset disabled={step === "sending"}>
          <legend>{t.checkout.payLegend}</legend>
          <div className="lp-methods">
            {t.checkout.methods.map((item, index) =>
              <label key={item.title} className={`lp-method ${method === index ? "active" : ""}`}><input type="radio" name="method" value={index} checked={method === index} onChange={() => setMethod(index)} /><div><strong>{item.title}</strong><span>{item.text}</span></div></label>)}
          </div>
        </fieldset>
        <p className="lp-terms">{t.checkout.terms} <a href="/cgv" target="_blank">{t.checkout.termsCgv}</a> {t.checkout.termsAnd} <a href="/confidentialite" target="_blank">{t.checkout.termsPrivacy}</a>.</p>
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <button className="lp-btn primary lp-pay" type="submit" disabled={step === "sending"}>{step === "sending" && <Spinner />}{step === "sending" ? t.checkout.sending : t.checkout.send}</button>
      </form>

      <aside className="lp-summary">
        <h2>{t.checkout.summary}</h2>
        <label>{t.checkout.plan}<select className="field" value={planId} onChange={(event) => setPlanId(event.target.value as PlanId)} disabled={step === "sending"}>{PLANS.map((item) => <option key={item.id} value={item.id}>{t.plans[item.id].name} · {money(item.price, t)}</option>)}</select></label>
        <label>{t.checkout.extras}<select className="field" value={extra} onChange={(event) => setExtra(event.target.value as typeof extra)} disabled={step === "sending"}>
          <option value="0">{t.checkout.extraNone}</option>
          {EXTRA_PACKS.map((item) => <option key={item.students} value={String(item.students)}>{t.checkout.extraOption(item.students, money(item.price, t))}</option>)}
          <option value="quote">{t.checkout.extraQuote}</option>
        </select></label>
        <ul>{t.pricing.included.slice(0, 4).map((feature) => <li key={feature}><Icon name="check" size={14} />{feature}</li>)}</ul>
        <dl className="lp-lines">
          <div><dt>{t.checkout.linePlan(t.plans[planId].name)}</dt><dd>{money(plan.price, t)}</dd></div>
          {pack && <div><dt>{t.checkout.lineExtra(pack.students)}</dt><dd>{money(pack.price, t)}</dd></div>}
          {extra === "quote" && <div><dt>{t.checkout.lineQuote}</dt><dd>{t.checkout.onQuote}</dd></div>}
        </dl>
        <div className="lp-total"><span>{t.checkout.total}</span><strong key={planId + extra} className="lp-swap">{money(total, t)}</strong></div>
      </aside>
    </div>}
  </div>;
}

// Creating an account before buying, in the sign-in card's second tab: the details are kept on the
// account and fill the order form later. Supabase sends its confirmation email; its link lands on
// the order form, signed in.
// With `trial` (/essai), the confirmation link lands on the trial page instead of the order form.
export function SignupForm({ trial = false }: { trial?: boolean }) {
  const t = useT();
  const { values, errors, setErrors, set, setType } = useDetails();
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"form" | "sending" | "done">("form");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = detailErrors(values, t);
    if (!STRONG_PASSWORD.test(password)) next.password = t.checkout.errors.password;
    setErrors(next);
    if (Object.keys(next).length) return;
    setStep("sending");
    // A director's password opens their whole school: same leak check as the invitation screen.
    if (await isLeaked(password)) { setStep("form"); setErrors({ password: t.checkout.errors.leaked }); return; }
    const { error } = await supabase.auth.signUp({
      email: values.email.trim().toLowerCase(), password,
      options: { data: toMetadata(values), emailRedirectTo: `${window.location.origin}${trial ? "/essai" : "/commander"}` },
    });
    if (error) {
      if (import.meta.env.DEV) console.error(error); // the exact reason, dev only; the visitor gets the message below
      setStep("form");
      const already = /already|registered|exists/i.test(error.message);
      const weak = error.code === "weak_password";
      setErrors({ [already ? "email" : weak ? "password" : "form"]: already ? t.checkout.errors.exists : weak ? t.checkout.errors.weak : t.checkout.errors.signup });
      return;
    }
    saveDraft(values); // the order form reads these until the confirmation link signs them in
    setStep("done");
  };

  if (step === "done") return <>
    <h1>{t.signup.doneTitle}</h1>
    <p className="auth-success" role="status">{trial ? t.trial.doneText(values.email.trim()) : t.signup.doneText(values.email.trim())}</p>
    {!trial && <a className="button auth-submit" href="/#tarifs">{t.signup.choosePlan}</a>}
  </>;

  return <>
    <h1>{trial ? t.trial.title : t.signup.title}</h1>
    <p className="auth-muted">{trial ? t.trial.text : t.signup.text}</p>
    <form className="auth-form auth-signup" onSubmit={submit} noValidate>
      <DetailFields values={values} set={set} setType={setType} errors={errors} disabled={step === "sending"} emailLocked={false}>
        <label>
          {t.checkout.password}
          <input className="field" type="password" autoComplete="new-password" placeholder={t.checkout.passwordPlaceholder} value={password}
            onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: "" })); }} aria-invalid={Boolean(errors.password)} />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>
      </DetailFields>
      <p className="auth-muted">{t.checkout.terms} <a className="text-button" href="/cgv" target="_blank">{t.checkout.termsCgv}</a> {t.checkout.termsAnd} <a className="text-button" href="/confidentialite" target="_blank">{t.checkout.termsPrivacy}</a>.</p>
      {errors.form && <p className="auth-error" role="alert"><Icon name="warning" size={16} />{errors.form}</p>}
      <button className="button auth-submit" type="submit" disabled={step === "sending"}>{step === "sending" && <Spinner />}{step === "sending" ? t.signup.sending : trial ? t.trial.submit : t.signup.submit}</button>
    </form>
  </>;
}

// /essai, signed in and confirmed, no school yet: check the details kept at sign-up, then open the
// school for 15 days (start_trial, 0033). Nothing to pay, nobody to wait for.
export function StartTrial() {
  const t = useT();
  const { values, setValues, errors, setErrors, set, setType } = useDetails(readDraft());
  const [step, setStep] = useState<"form" | "sending">("form");
  const [problem, setProblem] = useState<"used" | "hasSchool" | "">("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => {
    const user = data.user;
    if (user?.email) setValues((current) => ({ ...current, ...fromMetadata(user.user_metadata), email: user.email! }));
  }); }, [setValues]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = detailErrors(values, t);
    setErrors(next);
    if (Object.keys(next).length) return;
    setStep("sending");
    const { error } = await supabase.rpc("start_trial", {
      p_school_name: values.school.trim(), p_school_type: TYPES_FR[values.type], p_wilaya: values.wilaya.trim(),
      p_director_name: values.director.trim(), p_phone: values.phone.replace(/\D/g, ""),
    });
    if (error) {
      setStep("form");
      if (error.code === "CL003") return setProblem("used");
      if (error.code === "CL004") return setProblem("hasSchool");
      if (import.meta.env.DEV) console.error(error);
      return setErrors({ form: error.code === "53400" ? error.message : t.checkout.errors.signup });
    }
    clearDraft();
    window.location.href = "/"; // the account now has a school: the app opens
  };

  if (problem) return <>
    <h1>{t.trial.startTitle}</h1>
    <p className="auth-error" role="alert"><Icon name="warning" size={16} />{problem === "used" ? t.trial.used : t.trial.hasSchool}</p>
    {problem === "used" && <a className="button auth-submit" href="/#tarifs">{t.trial.seePlans}</a>}
  </>;
  return <>
    <h1>{t.trial.startTitle}</h1>
    <p className="auth-muted">{t.trial.startText}</p>
    <form className="auth-form auth-signup" onSubmit={submit} noValidate>
      <DetailFields values={values} set={set} setType={setType} errors={errors} disabled={step === "sending"} emailLocked />
      {errors.form && <p className="auth-error" role="alert"><Icon name="warning" size={16} />{errors.form}</p>}
      <button className="button auth-submit" type="submit" disabled={step === "sending"}>{step === "sending" && <Spinner />}{step === "sending" ? t.trial.starting : t.trial.start}</button>
    </form>
  </>;
}
