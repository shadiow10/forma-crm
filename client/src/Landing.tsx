import { useState } from "react";
import type { FormEvent } from "react";
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
  { q: "Comment payer ?", a: "Par carte Edahabia ou CIB en ligne, ou par virement / versement CCP. L'accès est ouvert dès la confirmation du paiement." },
  { q: "Que se passe-t-il après le paiement ?", a: "Votre espace école est créé et le directeur reçoit un email pour choisir son mot de passe. Il invite ensuite son équipe depuis Paramètres." },
  { q: "Mes données sont-elles séparées des autres écoles ?", a: "Oui. Chaque école a son propre espace ; les règles d'accès sont appliquées par la base de données elle-même, pas seulement par l'écran." },
  { q: "Puis-je changer de formule ?", a: "Oui, à tout moment. Le changement s'applique à la période suivante." },
  { q: "Faut-il installer quelque chose ?", a: "Non. FormaPlus fonctionne dans le navigateur, sur ordinateur comme sur téléphone." },
];

function Brand({ light = false }: { light?: boolean }) {
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

export function Landing() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const featured = PLANS.find((plan) => plan.featured)!;
  return <div className="lp">
    <header className="lp-header">
      <Brand />
      <nav aria-label="Sections"><a href="#fonctionnalites">Fonctionnalités</a><a href="#tarifs">Tarifs</a><a href="#faq">Questions</a></nav>
      <a className="lp-login" href="/connexion">Se connecter</a>
    </header>

    <main>
      <section className="lp-hero">
        <p className="lp-eyebrow">Logiciel de gestion scolaire · Algérie</p>
        <h1>L'école tourne.<br /><span>Les papiers, non.</span></h1>
        <p className="lp-lead">Inscriptions, présences, paiements et certificats au même endroit — pour le directeur, le secrétariat et les formateurs.</p>
        <div className="lp-actions"><a className="lp-btn primary" href="#tarifs">Voir les formules</a><a className="lp-link" href="#fonctionnalites">Comment ça marche <Icon name="arrow" size={15} /></a></div>
        <AppPreview />
      </section>

      <section className="lp-audience" aria-label="Pour qui">
        <span>Conçu pour</span>
        <ul>{AUDIENCES.map((audience) => <li key={audience}>{audience}</li>)}</ul>
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
              <strong>{price(planTotal(plan, billing))}</strong>
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
        <a className="lp-btn primary" href="#tarifs">Choisir ma formule</a>
      </section>
    </main>

    <footer className="lp-footer"><Brand /><span>Logiciel de gestion scolaire · Algérie</span><a href="/connexion">Espace client</a></footer>
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
        <div className="lp-total"><span>Total {billing === "yearly" ? "annuel" : "mensuel"}</span><strong>{price(planTotal(plan, billing))}</strong></div>
        {billing === "yearly" && <p className="lp-price-note">Vous économisez {price(plan.monthly * 2)} par an.</p>}
      </aside>
    </div>}
  </div>;
}
