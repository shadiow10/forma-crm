import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "./ui";
import type { IconName } from "./ui";

// Public site: landing page and a DEMO checkout. Nothing here charges money or creates accounts.
// Real version: checkout → payment gateway (Chargily: Edahabia/CIB) → webhook creates the school
// and invites the director with the existing invite-user flow.

type Billing = "monthly" | "yearly";
type Plan = { id: string; name: string; monthly: number; tagline: string; features: string[]; featured?: boolean };

// Monthly prices in DA. Yearly = 10 months (2 months free).
export const PLANS: Plan[] = [
  { id: "essentiel", name: "Essentiel", monthly: 2900, tagline: "Petits centres et écoles de soutien", features: ["Jusqu'à 100 étudiants", "3 utilisateurs", "Inscriptions, paiements, présences", "Planning et groupes", "Certificats imprimables"] },
  { id: "pro", name: "Pro", monthly: 5900, tagline: "Écoles et centres en croissance", featured: true, features: ["Jusqu'à 400 étudiants", "10 utilisateurs", "Tout Essentiel, plus :", "Documents des étudiants (CNI, diplômes…)", "Aide à l'import de vos listes Excel"] },
  { id: "etablissement", name: "Établissement", monthly: 9900, tagline: "Grandes écoles privées", features: ["Étudiants illimités", "Utilisateurs illimités", "Tout Pro, plus :", "Formation de votre équipe", "Accompagnement prioritaire"] },
];
const price = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} DA`;
const planTotal = (plan: Plan, billing: Billing) => (billing === "yearly" ? plan.monthly * 10 : plan.monthly);

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "graduation", title: "Étudiants & inscriptions", text: "Une fiche par étudiant : coordonnées, inscriptions, documents et notes de suivi." },
  { icon: "wallet", title: "Paiements & soldes", text: "Chaque versement est enregistré. Le reste à payer se calcule tout seul, par inscription." },
  { icon: "check", title: "Présences en un clic", text: "Le formateur marque présent, retard ou absent depuis son téléphone. Le taux se met à jour." },
  { icon: "calendar", title: "Groupes & planning", text: "Salles, horaires et formateurs sur une grille hebdomadaire claire." },
  { icon: "print", title: "Certificats", text: "Certificat prêt à imprimer dès qu'une formation est terminée, réglée et suivie." },
  { icon: "lock", title: "Accès par rôle", text: "Directeur, secrétaire, formateur : chacun ne voit que ce qui le concerne." },
];

const FAQ = [
  { q: "Comment payer ?", a: "Par carte Edahabia ou CIB en ligne, ou par virement / versement CCP. L'accès est ouvert dès la confirmation du paiement." },
  { q: "Que se passe-t-il après le paiement ?", a: "Votre espace école est créé et le directeur reçoit un email pour choisir son mot de passe. Il invite ensuite son équipe depuis Paramètres." },
  { q: "Mes données sont-elles séparées des autres écoles ?", a: "Oui. Chaque école a son propre espace ; les règles d'accès sont appliquées par la base de données elle-même, pas seulement par l'écran." },
  { q: "Puis-je changer de formule ?", a: "Oui, à tout moment. Le changement s'applique à la période suivante." },
  { q: "Faut-il installer quelque chose ?", a: "Non. FormaPlus fonctionne dans le navigateur, sur ordinateur comme sur téléphone." },
];

function Brand() {
  return <a className="lp-brand" href="/"><span className="brand-mark">F</span><strong>FORMA<span>PLUS</span></strong></a>;
}

export function Landing() {
  const [billing, setBilling] = useState<Billing>("monthly");
  return <div className="lp">
    <header className="lp-header">
      <Brand />
      <nav aria-label="Sections"><a href="#fonctionnalites">Fonctionnalités</a><a href="#tarifs">Tarifs</a><a href="#faq">Questions</a></nav>
      <a className="lp-login" href="/connexion">Se connecter</a>
    </header>

    <main>
      <section className="lp-hero">
        <div>
          <p className="lp-eyebrow">Logiciel de gestion scolaire · fait pour l'Algérie</p>
          <h1>Gérez votre école, pas des tableaux Excel.</h1>
          <p className="lp-lead">Inscriptions, groupes, présences, paiements et certificats au même endroit. Pour les écoles privées, centres de formation et écoles de soutien.</p>
          <div className="lp-actions"><a className="lp-btn primary" href="#tarifs">Voir les tarifs</a><a className="lp-btn ghost" href="#fonctionnalites">Découvrir</a></div>
          <ul className="lp-proof"><li><Icon name="check" size={15} /> Paiement Edahabia, CIB ou CCP</li><li><Icon name="check" size={15} /> Prix affichés, sans devis</li><li><Icon name="check" size={15} /> Sur ordinateur et téléphone</li></ul>
        </div>
        <div className="lp-preview" aria-hidden="true">
          <div className="lp-preview-bar"><i /><i /><i /></div>
          <div className="lp-preview-body">
            <div className="lp-preview-metrics">
              <div><span>Étudiants actifs</span><strong>184</strong></div>
              <div><span>Présence moyenne</span><strong>91%</strong></div>
              <div><span>Encaissé ce mois</span><strong>742 000 DA</strong></div>
            </div>
            {[["Excel avancé — Matin", "09:00–11:00", "14/18"], ["Anglais B1 — Soir", "18:00–20:00", "16/16"], ["Comptabilité — Samedi", "09:00–13:00", "9/15"]].map(([name, time, seats]) =>
              <div className="lp-preview-row" key={name}><span className="lp-dot" /><div><strong>{name}</strong><small>{time}</small></div><em>{seats}</em></div>)}
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="lp-section">
        <h2>Tout le quotidien de votre école</h2>
        <p className="lp-sub">De l'inscription au certificat, sans double saisie.</p>
        <div className="lp-features">{FEATURES.map((feature) => <article key={feature.title}><span className="lp-icon"><Icon name={feature.icon} size={20} /></span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
      </section>

      <section className="lp-section lp-steps-section">
        <h2>Prêt en trois étapes</h2>
        <ol className="lp-steps">
          <li><strong>Choisissez votre formule</strong><span>Selon le nombre d'étudiants de votre école.</span></li>
          <li><strong>Payez en ligne</strong><span>Edahabia, CIB, ou virement / versement CCP.</span></li>
          <li><strong>Recevez votre accès</strong><span>Un email au directeur, puis il invite son équipe.</span></li>
        </ol>
      </section>

      <section id="tarifs" className="lp-section">
        <h2>Des prix clairs, en dinars</h2>
        <p className="lp-sub">Toutes les fonctionnalités dans chaque formule. Vous payez selon la taille de votre école.</p>
        <div className="lp-billing" role="group" aria-label="Période de facturation">
          <button className={billing === "monthly" ? "active" : ""} aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")}>Mensuel</button>
          <button className={billing === "yearly" ? "active" : ""} aria-pressed={billing === "yearly"} onClick={() => setBilling("yearly")}>Annuel <em>2 mois offerts</em></button>
        </div>
        <div className="lp-plans">{PLANS.map((plan) => <article className={`lp-plan ${plan.featured ? "featured" : ""}`} key={plan.id}>
          {plan.featured && <span className="lp-badge">Recommandé</span>}
          <h3>{plan.name}</h3>
          <p className="lp-tagline">{plan.tagline}</p>
          <p className="lp-price"><strong>{price(planTotal(plan, billing))}</strong><span>/{billing === "yearly" ? "an" : "mois"}</span></p>
          <p className="lp-price-note">{billing === "yearly" ? `soit ${price(Math.round(plan.monthly * 10 / 12))}/mois` : `ou ${price(plan.monthly * 10)}/an`}</p>
          <ul>{plan.features.map((feature) => <li key={feature}><Icon name="check" size={15} />{feature}</li>)}</ul>
          <a className={`lp-btn ${plan.featured ? "primary" : "outline"}`} href={`/commander?plan=${plan.id}&periode=${billing}`}>Choisir {plan.name}</a>
        </article>)}</div>
      </section>

      <section id="faq" className="lp-section lp-faq">
        <h2>Questions fréquentes</h2>
        {FAQ.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
      </section>

      <section className="lp-cta">
        <h2>Votre prochaine rentrée, sans papiers perdus.</h2>
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
        <ul>{plan.features.map((feature) => <li key={feature}><Icon name="check" size={14} />{feature}</li>)}</ul>
        <div className="lp-total"><span>Total {billing === "yearly" ? "annuel" : "mensuel"}</span><strong>{price(planTotal(plan, billing))}</strong></div>
        {billing === "yearly" && <p className="lp-price-note">Vous économisez {price(plan.monthly * 2)} par an.</p>}
      </aside>
    </div>}
  </div>;
}
