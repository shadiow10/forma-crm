import type { ReactNode } from "react";
import { Brand, Footer } from "./Landing";

// Legal pages of the public site. Text between <Todo> marks must be filled in with the
// company's real details, and the whole text reviewed by a lawyer, before selling.
const Todo = ({ children }: { children: ReactNode }) => <mark className="lp-todo">{children}</mark>;
const UPDATED = "19 septembre 2026";

const PAGES: Record<string, { title: string; body: ReactNode }> = {
  "/mentions-legales": {
    title: "Mentions légales",
    body: <>
      <h2>Éditeur du site</h2>
      <p>FormaPlus est édité par <Todo>raison sociale et forme juridique</Todo>, dont le siège est situé <Todo>adresse complète, wilaya</Todo>.</p>
      <p>Registre du commerce : <Todo>n° RC</Todo> · NIF : <Todo>n°</Todo> · NIS : <Todo>n°</Todo> · Article d'imposition : <Todo>n°</Todo></p>
      <p>Directeur de la publication : <Todo>nom du responsable</Todo>. Contact : <Todo>email</Todo> · <Todo>téléphone</Todo>.</p>
      <h2>Hébergement</h2>
      <p>Site : Vercel Inc., États-Unis — <Todo>adresse et téléphone, à reprendre de vercel.com/legal</Todo>.</p>
      <p>Base de données et fichiers : Supabase Inc. — <Todo>adresse, à reprendre de supabase.com/legal</Todo>, région d'hébergement <Todo>région choisie dans Supabase</Todo>.</p>
      <h2>Propriété intellectuelle</h2>
      <p>Le logiciel FormaPlus, son nom, son logo et le contenu de ce site sont protégés. Toute reproduction sans autorisation écrite est interdite. Les données saisies par chaque établissement restent sa propriété.</p>
    </>,
  },
  "/cgv": {
    title: "Conditions générales de vente",
    body: <>
      <h2>1. Objet</h2>
      <p>Les présentes conditions régissent l'abonnement au logiciel en ligne FormaPlus, service de gestion d'établissements d'enseignement et de formation (étudiants, inscriptions, paiements, présences, planning, certificats), conformément à la loi n° 18-05 du 10 mai 2018 relative au commerce électronique.</p>
      <h2>2. Formules et prix</h2>
      <p>Les formules et leurs prix sont affichés sur la page Tarifs, en dinars algériens, <Todo>HT ou TTC, taux de TVA</Todo>. Le prix applicable est celui affiché le jour de la commande. Une modification de prix ne s'applique qu'à la période suivante et est annoncée au moins 30 jours à l'avance.</p>
      <h2>3. Commande et paiement</h2>
      <p>La commande est passée en ligne. Le paiement se fait par carte Edahabia ou CIB via <Todo>prestataire de paiement agréé</Todo>, ou par virement ou versement CCP. L'abonnement mensuel est payable chaque mois, l'abonnement annuel en une fois, d'avance.</p>
      <h2>4. Accès au service</h2>
      <p>L'espace de l'établissement est ouvert dès la confirmation du paiement ; le directeur reçoit par email un lien pour choisir son mot de passe. Pour un virement ou un versement CCP, l'accès est ouvert à réception des fonds.</p>
      <h2>5. Durée et résiliation</h2>
      <p>L'abonnement mensuel est sans engagement et se résilie à tout moment, avec effet à la fin du mois payé. L'abonnement annuel court jusqu'à son terme ; <Todo>conditions de remboursement éventuel</Todo>. En cas d'impayé, l'accès peut être suspendu après une relance restée sans effet pendant 15 jours.</p>
      <h2>6. Données de l'établissement</h2>
      <p>L'établissement reste propriétaire de ses données et peut les exporter à tout moment depuis le logiciel. Après la fin de l'abonnement, les données restent disponibles à l'export pendant <Todo>durée, ex. 30 jours</Todo>, puis sont supprimées définitivement. Le traitement des données est décrit dans la politique de confidentialité.</p>
      <h2>7. Disponibilité et responsabilité</h2>
      <p>FormaPlus met en œuvre les moyens raisonnables pour assurer l'accès au service 24 h/24, sauf maintenance ou panne d'un fournisseur. Sa responsabilité est limitée au montant payé au titre des 12 derniers mois. L'établissement est responsable des informations qu'il saisit et des accès qu'il donne à son équipe.</p>
      <h2>8. Droit applicable</h2>
      <p>Les présentes conditions sont soumises au droit algérien. À défaut d'accord amiable, tout litige relève des juridictions de <Todo>ville</Todo>.</p>
    </>,
  },
  "/confidentialite": {
    title: "Politique de confidentialité",
    body: <>
      <p>Cette politique explique quelles données personnelles FormaPlus traite et pourquoi, conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.</p>
      <h2>Deux situations différentes</h2>
      <p><strong>Nos clients</strong> (directeurs et équipes des établissements) : FormaPlus est responsable du traitement de leurs données de compte et de facturation.</p>
      <p><strong>Les étudiants des établissements</strong> : chaque établissement est responsable des données de ses étudiants. FormaPlus les héberge et les traite uniquement pour faire fonctionner le logiciel, sur instruction de l'établissement, sans jamais les utiliser à d'autres fins.</p>
      <h2>Données traitées</h2>
      <p>Comptes : nom, email, rôle, journal des actions dans le logiciel. Commandes : nom de l'établissement, wilaya, nom, email et téléphone du directeur, formule choisie. Étudiants (saisis par l'établissement) : identité, coordonnées, inscriptions, paiements, présences, documents déposés et notes de suivi.</p>
      <h2>Finalités</h2>
      <p>Fournir le service, gérer les abonnements et la facturation, assurer la sécurité (connexions, journal d'activité) et répondre aux demandes d'assistance. Aucune donnée n'est vendue, louée ni utilisée à des fins publicitaires.</p>
      <h2>Hébergement et sécurité</h2>
      <p>Les données sont hébergées par Supabase (région <Todo>région</Todo>) et le site par Vercel. Chaque établissement ne voit que ses propres données : les règles d'accès sont appliquées par la base de données. Les connexions sont chiffrées (HTTPS). <Todo>Autorisation de l'ANPDP pour l'hébergement hors d'Algérie, ou hébergement en Algérie</Todo>.</p>
      <h2>Durée de conservation</h2>
      <p>Pendant l'abonnement, puis <Todo>durée</Todo> après sa fin pour permettre l'export, sauf obligation légale de conservation (factures).</p>
      <h2>Vos droits</h2>
      <p>Vous disposez d'un droit d'accès, de rectification et d'opposition. Les étudiants s'adressent d'abord à leur établissement. Pour toute demande : <Todo>email</Todo>. Vous pouvez aussi saisir l'Autorité nationale de protection des données à caractère personnel (ANPDP).</p>
      <p>Déclaration auprès de l'ANPDP : <Todo>numéro de récépissé</Todo>.</p>
    </>,
  },
};

export const isLegalPage = (path: string) => path in PAGES;

export function Legal({ path }: { path: string }) {
  const page = PAGES[path];
  return <div className="lp">
    <header className="lp-header"><Brand /><a className="lp-login" href="/">← Retour au site</a></header>
    <main className="lp-legal">
      <p className="lp-eyebrow">Informations légales</p>
      <h1>{page.title}</h1>
      <p className="lp-legal-date">Dernière mise à jour : {UPDATED}</p>
      {page.body}
    </main>
    <Footer />
  </div>;
}
