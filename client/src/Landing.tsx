import { useEffect, useState } from "react";
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

type Billing = "monthly" | "yearly";
type PlanId = keyof Copy["plans"];

// Monthly prices in DA; the names and what each plan adds live in i18n.tsx. Yearly = 10 months.
export const PLANS: { id: PlanId; monthly: number; featured?: boolean }[] = [
  { id: "essentiel", monthly: 7900 },
  { id: "pro", monthly: 14900, featured: true },
  { id: "etablissement", monthly: 24900 },
];
const planTotal = (monthly: number, billing: Billing) => (billing === "yearly" ? monthly * 10 : monthly);

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
  const [billing, setBilling] = useState<Billing>("monthly");
  const navLabels = [t.nav.features, t.nav.roles, t.nav.pricing, t.nav.faq];
  const featured = PLANS.find((plan) => plan.featured)!;
  return <div className="lp" {...page}>
    <header className="lp-header">
      <Brand />
      <nav className="lp-nav" aria-label={t.sections}>{NAV.map((id, index) => <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>{navLabels[index]}</a>)}</nav>
      <Prefs />
      <a className="lp-login" href="/connexion">{t.signIn}</a>
      <button className="lp-burger" type="button" aria-label={t.menu} aria-expanded={menuOpen} aria-controls="lp-menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={20} /></button>
      {menuOpen && <nav id="lp-menu" className="lp-menu" aria-label={t.menu}>
        {NAV.map((id, index) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{navLabels[index]}</a>)}
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
          <div className="lp-billing" role="group" aria-label={t.pricing.period}>
            <button className={billing === "monthly" ? "active" : ""} aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")}>{t.pricing.monthly}</button>
            <button className={billing === "yearly" ? "active" : ""} aria-pressed={billing === "yearly"} onClick={() => setBilling("yearly")}>{t.pricing.yearly}</button>
          </div>
          <div className="lp-included">
            <strong>{t.pricing.includedTitle}</strong>
            <ul>{t.pricing.included.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>
          </div>
        </div>

        <div className="lp-ledger">
          {PLANS.map((plan) => {
            const copy = t.plans[plan.id];
            return <article className={`lp-plan ${plan.featured ? "featured" : ""}`} key={plan.id}>
              <div className="lp-plan-name">
                <h3>{copy.name}{plan.featured && <span className="lp-badge">{t.pricing.recommended}</span>}</h3>
                <p>{copy.tagline}</p>
              </div>
              <div className="lp-plan-size"><span>{copy.students}</span><span>{copy.users}</span></div>
              <div className="lp-plan-price">
                <strong key={billing} className="lp-swap">{money(planTotal(plan.monthly, billing), t)}</strong>
                <span>{billing === "yearly" ? t.pricing.perYear(money(Math.round(plan.monthly * 10 / 12), t)) : t.pricing.perMonth}</span>
              </div>
              <a className={`lp-plan-cta ${plan.featured ? "primary" : ""}`} href={`/commander?plan=${plan.id}&periode=${billing}`} aria-label={t.pricing.chooseAria(copy.name)}>
                {t.pricing.choose} <Icon name="arrow" size={16} />
              </a>
              {plan.featured && <ul className="lp-plan-extras">{copy.features.map((feature) => <li key={feature}><Icon name="spark" size={14} />{feature}</li>)}</ul>}
            </article>;
          })}
          <p className="lp-ledger-note">{t.pricing.note(t.plans[featured.id].name, t.plans[featured.id].features.length)}</p>
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

// ---------------------------------------------------------------- Demo checkout

// Supabase refuses anything weaker, so the form asks for the same thing.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,}$/;
// What lands in the orders table, whatever language the visitor reads the site in.
const TYPES_FR = ["École privée", "Centre de formation", "École de soutien scolaire", "École de langues", "Crèche / préscolaire"];
const METHODS_FR = ["en main propre", "virement ou CCP"];

export function Checkout() {
  const t = useT();
  const page = usePage();
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("plan");
  const [planId, setPlanId] = useState<PlanId>(PLANS.some((plan) => plan.id === requested) ? requested as PlanId : "pro");
  const [billing, setBilling] = useState<Billing>(params.get("periode") === "yearly" ? "yearly" : "monthly");
  const [type, setType] = useState(0);
  const [method, setMethod] = useState(0);
  const [values, setValues] = useState({ school: "", wilaya: "", director: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "sending" | "done">("form");
  const [reference, setReference] = useState("");
  const [account, setAccount] = useState<string | null>(null); // email of the session, when already signed in
  useEffect(() => { supabase.auth.getSession().then(({ data }) => {
    const email = data.session?.user.email;
    if (email) { setAccount(email); setValues((current) => ({ ...current, email })); }
  }); }, []);
  const plan = PLANS.find((item) => item.id === planId)!;
  const planCopy = t.plans[planId];
  const total = money(planTotal(plan.monthly, billing), t);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => { setValues({ ...values, [key]: event.target.value }); setErrors({ ...errors, [key]: "" }); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.school.trim()) next.school = t.checkout.errors.school;
    if (!values.wilaya.trim()) next.wilaya = t.checkout.errors.wilaya;
    if (!values.director.trim()) next.director = t.checkout.errors.director;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = t.checkout.errors.email;
    if (!/^0[5-7]\d{8}$/.test(values.phone.replace(/[\s.-]/g, ""))) next.phone = t.checkout.errors.phone;
    if (!account && !STRONG_PASSWORD.test(values.password)) next.password = t.checkout.errors.password;
    setErrors(next);
    if (Object.keys(next).length) return;
    setStep("sending");
    // A director's password opens their whole school: same leak check as the invitation screen.
    if (!account && (await isLeaked(values.password))) {
      setStep("form");
      setErrors({ password: t.checkout.errors.leaked });
      return;
    }
    // Already signed in (an account created earlier, order never sent): keep that login, skip signup.
    const signUp = account ? { error: null } : await supabase.auth.signUp({ email: values.email.trim().toLowerCase(), password: values.password });
    if (signUp.error) {
      if (import.meta.env.DEV) console.error(signUp.error); // the exact reason, dev only; the visitor gets the message below
      setStep("form");
      const already = /already|registered|exists/i.test(signUp.error.message);
      const weak = signUp.error.code === "weak_password";
      setErrors({ [already ? "email" : weak ? "password" : "form"]: already ? t.checkout.errors.exists : weak ? t.checkout.errors.weak : t.checkout.errors.signup });
      return;
    }
    // place_order runs as owner: it can write the order and hand back its number without opening the table.
    const { data, error } = await supabase.rpc("place_order", {
      p_school_name: values.school, p_school_type: TYPES_FR[type], p_wilaya: values.wilaya,
      p_director_name: values.director, p_email: values.email, p_phone: values.phone,
      p_plan: planId, p_billing: billing,
      p_notes: `Paiement souhaité : ${METHODS_FR[method]}`,
    });
    if (error || !data) { setStep("form"); setErrors({ form: t.checkout.errors.send }); return; }
    setReference(`CMD-${String(data).padStart(5, "0")}`);
    setStep("done");
    window.scrollTo({ top: 0 });
  };

  const field = (key: keyof typeof values, label: string, props: Record<string, string> = {}) => <label>
    {label}
    <input className="field" value={values[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} {...props} />
    {errors[key] && <span className="field-error">{errors[key]}</span>}
  </label>;

  const doneValues = [values.email.trim(), values.phone.trim(), values.school.trim()];

  return <div className="lp lp-checkout-page" {...page}>
    <header className="lp-header"><Brand /><a className="lp-login" href="/#tarifs">{t.checkout.back}</a></header>
    <p className="lp-demo-banner" role="note"><Icon name="phone" size={15} /> {t.checkout.banner}</p>

    {step === "done" ? <section className="lp-done">
      <span className="lp-done-icon"><Icon name="checkCircle" size={34} /></span>
      <h1>{t.checkout.done.title}</h1>
      <p>{t.checkout.done.thanks(values.director.trim())} <strong>{reference}</strong>.</p>
      <p className="lp-price-note">{planCopy.name} · {total} {billing === "yearly" ? t.pricing.perYear(money(Math.round(plan.monthly * 10 / 12), t)) : t.pricing.perMonth}</p>
      <ol className="lp-next">
        {t.checkout.done.steps.map((item, index) => <li key={item.title}><strong>{item.title}</strong><span>{item.text(doneValues[index])}</span></li>)}
      </ol>
      <p className="lp-price-note">{t.checkout.done.nothingCharged}</p>
      <a className="lp-btn primary" href="/connexion">{t.checkout.done.goToLogin}</a>
    </section> : <div className="lp-checkout">
      <form className="lp-checkout-form" onSubmit={submit} noValidate>
        <h1>{t.checkout.title}</h1>
        <fieldset disabled={step === "sending"}>
          <legend>{t.checkout.schoolLegend}</legend>
          {field("school", t.checkout.schoolName, { placeholder: t.checkout.schoolPlaceholder, autoComplete: "organization" })}
          <label>{t.checkout.schoolType}<select className="field" value={type} onChange={(event) => setType(Number(event.target.value))}>{t.checkout.types.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
          {field("wilaya", t.checkout.wilaya, { placeholder: t.checkout.wilayaPlaceholder })}
        </fieldset>
        <fieldset disabled={step === "sending"}>
          <legend>{t.checkout.accountLegend}</legend>
          {field("director", t.checkout.director, { autoComplete: "name" })}
          {field("email", t.checkout.email, { type: "email", autoComplete: "email", placeholder: "directeur@ecole.dz", ...(account ? { readOnly: "true" } : {}) })}
          {field("phone", t.checkout.phone, { type: "tel", autoComplete: "tel", placeholder: "0555 00 00 00" })}
          {!account && field("password", t.checkout.password, { type: "password", autoComplete: "new-password", placeholder: t.checkout.passwordPlaceholder })}
          <p className="lp-terms">{account ? t.checkout.signedIn(account) : t.checkout.ownCredentials}</p>
        </fieldset>
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
        <label>{t.checkout.plan}<select className="field" value={planId} onChange={(event) => setPlanId(event.target.value as PlanId)} disabled={step === "sending"}>{PLANS.map((item) => <option key={item.id} value={item.id}>{t.plans[item.id].name} · {money(item.monthly, t)}</option>)}</select></label>
        <div className="lp-billing small" role="group" aria-label={t.pricing.period}>
          <button type="button" className={billing === "monthly" ? "active" : ""} aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")}>{t.pricing.monthly}</button>
          <button type="button" className={billing === "yearly" ? "active" : ""} aria-pressed={billing === "yearly"} onClick={() => setBilling("yearly")}>{t.pricing.yearlyShort}</button>
        </div>
        <ul>{[planCopy.students, planCopy.users, ...planCopy.features].map((feature) => <li key={feature}><Icon name="check" size={14} />{feature}</li>)}</ul>
        <div className="lp-total"><span>{t.checkout.total(billing === "yearly" ? t.checkout.totalYearly : t.checkout.totalMonthly)}</span><strong key={billing + planId} className="lp-swap">{total}</strong></div>
        {billing === "yearly" && <p className="lp-price-note">{t.checkout.saving(money(plan.monthly * 2, t))}</p>}
      </aside>
    </div>}
  </div>;
}
