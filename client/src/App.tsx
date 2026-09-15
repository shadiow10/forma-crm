import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";

// FormaCRM — single-file product experience with rich local mock data.
// The interaction layer is intentionally local-first so every workflow is demonstrable
// before wiring the same objects to Supabase tables and realtime subscriptions.

type Stage = "inscrit" | "encours" | "diplome" | "abandonne";
type IconName = keyof typeof ICONS;

type Person = {
  id: number;
  name: string;
  phone: string;
  email: string;
  course: string;
  stage: Stage;
  staff: string;
  lastContact: string;
  source: string;
  address: string;
  dob: string;
  attendance: number;
  payment: "Payé" | "Partiel" | "En retard";
  balance: number;
  enrolled: string;
  teacher: string;
  progress: number;
};

type Course = { id: number; name: string; short: string; duration: string; price: number; students: number; color: string };
type Teacher = { id: number; name: string; initials: string; subject: string; phone: string; email: string; classes: string[]; rate: number; contract: string; color: string };
type SchoolClass = { id: number; name: string; teacher: string; room: string; schedule: string; days: string[]; time: string; enrolled: number; capacity: number; status: "Ouvert" | "Complet" | "Annulé"; subject: string; color: string; roster: number[] };
type Payment = { id: number; student: string; course: string; total: number; paid: number; balance: number; date: string; method: string; status: "Payé" | "Partiel" | "En retard" };

type PageKey = "dashboard" | "students" | "enrollments" | "formations" | "teachers" | "groups" | "planning" | "attendance" | "payments" | "certificates" | "settings";

const COLORS = {
  ink: "#17202A",
  navy: "#182B49",
  navy2: "#233B61",
  teal: "#2A9D8F",
  tealLight: "#E3F3F0",
  coral: "#F28F6B",
  coralLight: "#FDEBE4",
  sand: "#F7F5F0",
  paper: "#FFFEFB",
  border: "#E5E7EA",
  muted: "#6F7B89",
  green: "#3F9D71",
  yellow: "#D5A13A",
  red: "#D96C6C",
};

const ICONS = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  funnel: "M3 5h18l-7 8v5l-4 2v-7z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  graduation: "M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5M19 11v6",
  calendar: "M6 2v4M18 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z",
  check: "M20 6 9 17l-5-5",
  wallet: "M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm12 6h3",
  checklist: "M9 11l3 3L22 4M4 4h2M4 11h2M4 18h2M9 5h10M9 18h10",
  teacher: "M4 21v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM18 8h4M20 6v4",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.41 1.41-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.41-1.41.06-.06A1.7 1.7 0 0 0 9.4 15a1.7 1.7 0 0 0-1.56-1.03H7v-2h.84A1.7 1.7 0 0 0 9.4 11a1.7 1.7 0 0 0-.34-1.88L9 9.06l1.41-1.41.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.38 6.5V6h2v.5a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.41 1.41-.06.06A1.7 1.7 0 0 0 19.4 11a1.7 1.7 0 0 0 1.56 1.03H21v2h-.04A1.7 1.7 0 0 0 19.4 15z",
  plus: "M12 5v14M5 12h14",
  search: "m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chevron: "m9 18 6-6-6-6",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-16v6l4 2",
  filter: "M4 4h16M7 10h10M10 16h4",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16",
  print: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z",
  warning: "M10.3 3.3 1.8 18a2 2 0 0 0 1.73 3h16.94A2 2 0 0 0 22.2 18L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  spark: "m12 3-1.2 5.8L5 10l5.8 1.2L12 17l1.2-5.8L19 10l-5.8-1.2z",
  checkCircle: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  building: "M3 21h18M6 21V4h8v17M14 8h4v13M8 8h2M8 12h2M8 16h2M16 12h2M16 16h2",
  lock: "M6 10V8a6 6 0 0 1 12 0v2M5 10h14v11H5z",
} as const;

const Icon = ({ name, size = 18, stroke = "currentColor" }: { name: IconName; size?: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);

const stageLabels: Record<Stage, string> = { inscrit: "Inscrit", encours: "En cours", diplome: "Terminé", abandonne: "Abandonné" };
const stageColors: Record<Stage, string> = { inscrit: COLORS.teal, encours: "#597BC4", diplome: "#6A63B8", abandonne: COLORS.red };

const courses: Course[] = [
  { id: 1, name: "Bureautique & Excel", short: "Bureautique", duration: "3 mois", price: 45000, students: 18, color: "#5B8DEF" },
  { id: 2, name: "Comptabilité pratique", short: "Comptabilité", duration: "4 mois", price: 62000, students: 14, color: "#E4A853" },
  { id: 3, name: "Design graphique", short: "Design", duration: "6 mois", price: 85000, students: 12, color: "#B56FCE" },
  { id: 4, name: "Marketing digital", short: "Marketing", duration: "4 mois", price: 70000, students: 9, color: "#2A9D8F" },
  { id: 5, name: "Développement web", short: "Web", duration: "6 mois", price: 95000, students: 16, color: "#E57865" },
];

const staff = ["Nadia Benali", "Mehdi Saidi", "Sarah Kaci", "Amine Touati"];
const avatarColors = ["#D9E9E6", "#FBE0D6", "#E2E4F2", "#F5E8C9", "#DCE8F8"];
const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const formatMoney = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} DA`;

const people: Person[] = [
  { id: 1, name: "Lina Haddad", phone: "0554 21 38 70", email: "lina.haddad@gmail.com", course: "Design graphique", stage: "encours", staff: "Nadia Benali", lastContact: "12 sept. 2026", source: "Instagram", address: "Bab Ezzouar, Alger", dob: "14/06/2002", attendance: 92, payment: "Payé", balance: 0, enrolled: "10/03/2026", teacher: "Yanis Boudiaf", progress: 72 },
  { id: 2, name: "Yacine Merabet", phone: "0661 88 44 19", email: "yacine.merabet@outlook.com", course: "Développement web", stage: "encours", staff: "Mehdi Saidi", lastContact: "11 sept. 2026", source: "Parrainage", address: "Hydra, Alger", dob: "02/11/2000", attendance: 84, payment: "Partiel", balance: 25000, enrolled: "02/02/2026", teacher: "Omar Cherif", progress: 66 },
  { id: 3, name: "Sara Belkacem", phone: "0770 13 52 94", email: "sara.belkacem@gmail.com", course: "Comptabilité pratique", stage: "inscrit", staff: "Sarah Kaci", lastContact: "10 sept. 2026", source: "Facebook", address: "El Biar, Alger", dob: "22/08/1998", attendance: 76, payment: "En retard", balance: 31000, enrolled: "01/09/2026", teacher: "Samira Ait Ali", progress: 12 },
  { id: 4, name: "Karim Ouali", phone: "0550 72 18 06", email: "karim.ouali@proton.me", course: "Bureautique & Excel", stage: "encours", staff: "Nadia Benali", lastContact: "09 sept. 2026", source: "Walk-in", address: "Kouba, Alger", dob: "18/02/2001", attendance: 68, payment: "Partiel", balance: 12000, enrolled: "15/04/2026", teacher: "Nadia Benali", progress: 58 },
  { id: 5, name: "Imen Rahmani", phone: "0560 44 98 12", email: "imen.rahmani@gmail.com", course: "Marketing digital", stage: "diplome", staff: "Mehdi Saidi", lastContact: "08 sept. 2026", source: "Site web", address: "Draria, Alger", dob: "09/12/1997", attendance: 96, payment: "Payé", balance: 0, enrolled: "11/02/2026", teacher: "Riad Mansouri", progress: 100 },
  { id: 6, name: "Nour El Houda Saad", phone: "0698 67 22 51", email: "nour.saad@gmail.com", course: "Bureautique & Excel", stage: "inscrit", staff: "Sarah Kaci", lastContact: "07 sept. 2026", source: "Facebook", address: "Birkhadem, Alger", dob: "30/04/2003", attendance: 88, payment: "Payé", balance: 0, enrolled: "03/09/2026", teacher: "Nadia Benali", progress: 8 },
  { id: 7, name: "Amine Khelifi", phone: "0555 10 62 44", email: "amine.khelifi@gmail.com", course: "Développement web", stage: "inscrit", staff: "Amine Touati", lastContact: "06 sept. 2026", source: "LinkedIn", address: "Chéraga, Alger", dob: "10/10/1996", attendance: 0, payment: "Partiel", balance: 45000, enrolled: "", teacher: "", progress: 0 },
  { id: 8, name: "Meriem Chibani", phone: "0790 21 45 88", email: "meriem.chibani@yahoo.com", course: "Design graphique", stage: "inscrit", staff: "Sarah Kaci", lastContact: "05 sept. 2026", source: "Instagram", address: "Aïn Benian, Alger", dob: "05/05/2004", attendance: 0, payment: "Partiel", balance: 85000, enrolled: "", teacher: "", progress: 0 },
  { id: 9, name: "Sofiane Bensaïd", phone: "0666 31 09 62", email: "sofiane.bensaid@gmail.com", course: "Comptabilité pratique", stage: "inscrit", staff: "Mehdi Saidi", lastContact: "04 sept. 2026", source: "Référencement", address: "Bordj El Kiffan, Alger", dob: "", attendance: 0, payment: "Partiel", balance: 62000, enrolled: "", teacher: "", progress: 0 },
  { id: 10, name: "Aya Mokhtari", phone: "0551 07 34 91", email: "aya.mokhtari@gmail.com", course: "Marketing digital", stage: "encours", staff: "Nadia Benali", lastContact: "03 sept. 2026", source: "Parrainage", address: "Dely Brahim, Alger", dob: "19/01/1999", attendance: 73, payment: "Payé", balance: 0, enrolled: "12/03/2026", teacher: "Riad Mansouri", progress: 70 },
  { id: 11, name: "Walid Hamza", phone: "0778 36 55 01", email: "walid.hamza@gmail.com", course: "Développement web", stage: "diplome", staff: "Mehdi Saidi", lastContact: "02 sept. 2026", source: "Walk-in", address: "Alger Centre", dob: "11/09/1995", attendance: 91, payment: "Payé", balance: 0, enrolled: "10/01/2026", teacher: "Omar Cherif", progress: 100 },
  { id: 12, name: "Hiba Saïdi", phone: "0562 91 25 14", email: "hiba.saidi@gmail.com", course: "Bureautique & Excel", stage: "abandonne", staff: "Sarah Kaci", lastContact: "29 août 2026", source: "Facebook", address: "Hussein Dey, Alger", dob: "23/03/2000", attendance: 41, payment: "En retard", balance: 18000, enrolled: "15/02/2026", teacher: "Nadia Benali", progress: 29 },
  { id: 13, name: "Mohamed Tarek", phone: "0699 02 72 13", email: "tarek.mohamed@gmail.com", course: "Design graphique", stage: "encours", staff: "Amine Touati", lastContact: "28 août 2026", source: "Instagram", address: "Ouled Fayet, Alger", dob: "01/07/2001", attendance: 79, payment: "Partiel", balance: 22000, enrolled: "20/05/2026", teacher: "Yanis Boudiaf", progress: 44 },
  { id: 14, name: "Rania Zerrouki", phone: "0557 13 88 21", email: "rania.zerrouki@gmail.com", course: "Comptabilité pratique", stage: "inscrit", staff: "Nadia Benali", lastContact: "27 août 2026", source: "Site web", address: "Sidi Yahia, Alger", dob: "16/12/2002", attendance: 94, payment: "Payé", balance: 0, enrolled: "07/09/2026", teacher: "Samira Ait Ali", progress: 4 },
  { id: 15, name: "Amina Djouadi", phone: "0771 20 44 83", email: "amina.djouadi@gmail.com", course: "Marketing digital", stage: "inscrit", staff: "Sarah Kaci", lastContact: "26 août 2026", source: "Parrainage", address: "Ben Aknoun, Alger", dob: "12/10/1998", attendance: 86, payment: "Partiel", balance: 17500, enrolled: "09/09/2026", teacher: "Riad Mansouri", progress: 4 },
  { id: 16, name: "Ilyes Saouli", phone: "0664 41 05 18", email: "ilyes.saouli@outlook.com", course: "Développement web", stage: "inscrit", staff: "Mehdi Saidi", lastContact: "25 août 2026", source: "TikTok", address: "Blida", dob: "07/06/2003", attendance: 0, payment: "Partiel", balance: 95000, enrolled: "", teacher: "", progress: 0 },
  { id: 17, name: "Lamia Fares", phone: "0553 80 12 07", email: "lamia.fares@gmail.com", course: "Bureautique & Excel", stage: "inscrit", staff: "Amine Touati", lastContact: "24 août 2026", source: "Facebook", address: "El Harrach, Alger", dob: "28/02/1996", attendance: 0, payment: "Partiel", balance: 45000, enrolled: "", teacher: "", progress: 0 },
  { id: 18, name: "Nassim Azzouz", phone: "0796 11 20 18", email: "nassim.azzouz@gmail.com", course: "Comptabilité pratique", stage: "diplome", staff: "Nadia Benali", lastContact: "22 août 2026", source: "Référencement", address: "Béjaïa", dob: "05/03/1994", attendance: 98, payment: "Payé", balance: 0, enrolled: "10/01/2026", teacher: "Samira Ait Ali", progress: 100 },
];

const teachers: Teacher[] = [
  { id: 1, name: "Nadia Benali", initials: "NB", subject: "Bureautique & Excel", phone: "0555 44 10 21", email: "nadia.benali@formacrm.dz", classes: ["Excel avancé — Matin", "Bureautique — Soir"], rate: 1800, contract: "Temps plein", color: "#5B8DEF" },
  { id: 2, name: "Omar Cherif", initials: "OC", subject: "Développement web", phone: "0661 20 38 11", email: "omar.cherif@formacrm.dz", classes: ["Web Frontend — Soir"], rate: 2400, contract: "Temps partiel", color: "#E57865" },
  { id: 3, name: "Samira Ait Ali", initials: "SA", subject: "Comptabilité", phone: "0770 14 62 20", email: "samira.aitali@formacrm.dz", classes: ["Comptabilité pratique — Matin", "Comptabilité — Week-end"], rate: 2100, contract: "Temps plein", color: "#E4A853" },
  { id: 4, name: "Yanis Boudiaf", initials: "YB", subject: "Design graphique", phone: "0550 17 83 04", email: "yanis.boudiaf@formacrm.dz", classes: ["Design graphique — Après-midi"], rate: 2300, contract: "Temps partiel", color: "#B56FCE" },
  { id: 5, name: "Riad Mansouri", initials: "RM", subject: "Marketing digital", phone: "0698 04 72 10", email: "riad.mansouri@formacrm.dz", classes: ["Marketing digital — Après-midi"], rate: 2200, contract: "Temps partiel", color: "#2A9D8F" },
];

const classes: SchoolClass[] = [
  { id: 1, name: "Excel avancé — Matin", teacher: "Nadia Benali", room: "Salle A1", schedule: "Dim · Mar · Jeu, 09:00–11:00", days: ["Dim", "Mar", "Jeu"], time: "09:00", enrolled: 14, capacity: 18, status: "Ouvert", subject: "Bureautique", color: "#5B8DEF", roster: [1, 4, 6, 12, 17] },
  { id: 2, name: "Comptabilité pratique — Matin", teacher: "Samira Ait Ali", room: "Salle B2", schedule: "Dim · Mar · Jeu, 09:00–11:30", days: ["Dim", "Mar", "Jeu"], time: "09:00", enrolled: 15, capacity: 15, status: "Complet", subject: "Comptabilité", color: "#E4A853", roster: [3, 14, 18] },
  { id: 3, name: "Design graphique — Après-midi", teacher: "Yanis Boudiaf", room: "Studio C1", schedule: "Lun · Mer, 14:00–17:00", days: ["Lun", "Mer"], time: "14:00", enrolled: 9, capacity: 12, status: "Ouvert", subject: "Design", color: "#B56FCE", roster: [1, 8, 13] },
  { id: 4, name: "Marketing digital — Après-midi", teacher: "Riad Mansouri", room: "Salle A2", schedule: "Lun · Mer · Ven, 14:00–16:00", days: ["Lun", "Mer", "Ven"], time: "14:00", enrolled: 8, capacity: 12, status: "Ouvert", subject: "Marketing", color: "#2A9D8F", roster: [5, 10, 15] },
  { id: 5, name: "Web Frontend — Soir", teacher: "Omar Cherif", room: "Lab D1", schedule: "Lun · Mer, 18:00–20:30", days: ["Lun", "Mer"], time: "18:00", enrolled: 16, capacity: 16, status: "Complet", subject: "Développement", color: "#E57865", roster: [2, 7, 11, 16] },
  { id: 6, name: "Comptabilité — Week-end", teacher: "Samira Ait Ali", room: "Salle B2", schedule: "Sam · 09:00–13:00", days: ["Sam"], time: "09:00", enrolled: 10, capacity: 15, status: "Ouvert", subject: "Comptabilité", color: "#E4A853", roster: [3, 9, 14, 18] },
];

const payments: Payment[] = [
  { id: 1, student: "Lina Haddad", course: "Design graphique", total: 85000, paid: 85000, balance: 0, date: "12 sept. 2026", method: "Virement", status: "Payé" },
  { id: 2, student: "Yacine Merabet", course: "Développement web", total: 95000, paid: 70000, balance: 25000, date: "11 sept. 2026", method: "Virement", status: "Partiel" },
  { id: 3, student: "Sara Belkacem", course: "Comptabilité pratique", total: 62000, paid: 31000, balance: 31000, date: "10 sept. 2026", method: "Espèces", status: "En retard" },
  { id: 4, student: "Karim Ouali", course: "Bureautique & Excel", total: 45000, paid: 33000, balance: 12000, date: "09 sept. 2026", method: "Chèque", status: "Partiel" },
  { id: 5, student: "Imen Rahmani", course: "Marketing digital", total: 70000, paid: 70000, balance: 0, date: "08 sept. 2026", method: "Virement", status: "Payé" },
  { id: 6, student: "Nour El Houda Saad", course: "Bureautique & Excel", total: 45000, paid: 45000, balance: 0, date: "07 sept. 2026", method: "Espèces", status: "Payé" },
  { id: 7, student: "Aya Mokhtari", course: "Marketing digital", total: 70000, paid: 70000, balance: 0, date: "05 sept. 2026", method: "Virement", status: "Payé" },
  { id: 8, student: "Walid Hamza", course: "Développement web", total: 95000, paid: 95000, balance: 0, date: "04 sept. 2026", method: "Virement", status: "Payé" },
  { id: 9, student: "Mohamed Tarek", course: "Design graphique", total: 85000, paid: 63000, balance: 22000, date: "03 sept. 2026", method: "Espèces", status: "Partiel" },
  { id: 10, student: "Rania Zerrouki", course: "Comptabilité pratique", total: 62000, paid: 62000, balance: 0, date: "02 sept. 2026", method: "Chèque", status: "Payé" },
  { id: 11, student: "Amina Djouadi", course: "Marketing digital", total: 70000, paid: 52500, balance: 17500, date: "01 sept. 2026", method: "Virement", status: "Partiel" },
  { id: 12, student: "Hiba Saïdi", course: "Bureautique & Excel", total: 45000, paid: 27000, balance: 18000, date: "29 août 2026", method: "Espèces", status: "En retard" },
  { id: 13, student: "Nassim Azzouz", course: "Comptabilité pratique", total: 62000, paid: 62000, balance: 0, date: "28 août 2026", method: "Virement", status: "Payé" },
  { id: 14, student: "Meriem Chibani", course: "Design graphique", total: 85000, paid: 0, balance: 85000, date: "27 août 2026", method: "—", status: "En retard" },
  { id: 15, student: "Ilyes Saouli", course: "Développement web", total: 95000, paid: 50000, balance: 45000, date: "26 août 2026", method: "Chèque", status: "Partiel" },
  { id: 16, student: "Lamia Fares", course: "Bureautique & Excel", total: 45000, paid: 0, balance: 45000, date: "24 août 2026", method: "—", status: "En retard" },
  { id: 17, student: "Adel Kaci", course: "Marketing digital", total: 70000, paid: 20000, balance: 50000, date: "22 août 2026", method: "Espèces", status: "Partiel" },
  { id: 18, student: "Rachid Khellaf", course: "Marketing digital", total: 70000, paid: 0, balance: 70000, date: "20 août 2026", method: "—", status: "En retard" },
  { id: 19, student: "Nadia Ferhat", course: "Design graphique", total: 85000, paid: 15000, balance: 70000, date: "18 août 2026", method: "Virement", status: "Partiel" },
  { id: 20, student: "Bilal Daoud", course: "Développement web", total: 95000, paid: 45000, balance: 50000, date: "15 août 2026", method: "Chèque", status: "Partiel" },
  { id: 21, student: "Sofiane Bensaïd", course: "Comptabilité pratique", total: 62000, paid: 0, balance: 62000, date: "13 août 2026", method: "—", status: "En retard" },
  { id: 22, student: "Amine Khelifi", course: "Développement web", total: 95000, paid: 30000, balance: 65000, date: "11 août 2026", method: "Espèces", status: "Partiel" },
];

const attendanceDates = ["08 sept.", "09 sept.", "10 sept.", "11 sept.", "12 sept."];
const attendanceSeed: Record<number, string[]> = {};
people.filter((p) => p.enrolled).forEach((person, index) => {
  attendanceSeed[person.id] = attendanceDates.map((_, dateIndex) => (dateIndex + index) % 9 === 0 ? "A" : (dateIndex + index) % 6 === 0 ? "L" : "P");
});

const initialsBadge = (name: string, color?: string) => (
  <span className="avatar" style={{ background: color || avatarColors[name.length % avatarColors.length] }}>{initials(name)}</span>
);

const Badge = ({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "purple"; dot?: boolean }) => {
  const tones: Record<string, CSSProperties> = {
    neutral: { background: "#F2F4F6", color: COLORS.muted },
    success: { background: "#E6F5EE", color: "#2D805D" },
    warning: { background: "#FFF4D9", color: "#9A711A" },
    danger: { background: "#FDE8E8", color: "#B65353" },
    info: { background: "#E8F0FC", color: "#4B6EAF" },
    purple: { background: "#F0ECFB", color: "#6B5AA7" },
  };
  return <span className="badge" style={tones[tone]}>{dot && <span className="badge-dot" />} {children}</span>;
};

const statusTone = (status: string): "success" | "warning" | "danger" | "info" | "neutral" => status === "Payé" || status === "Terminé" || status === "Ouvert" ? "success" : status === "En retard" || status === "Annulé" ? "danger" : status === "Partiel" || status === "Complet" ? "warning" : "info";

const Button = ({ children, variant = "primary", icon, onClick, type = "button", disabled = false }: { children: ReactNode; variant?: "primary" | "ghost" | "outline" | "soft" | "danger"; icon?: IconName; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) => {
  const styleMap: Record<string, CSSProperties> = {
    primary: { background: COLORS.navy, color: "white", borderColor: COLORS.navy },
    ghost: { background: "transparent", color: COLORS.muted, borderColor: "transparent" },
    outline: { background: "white", color: COLORS.navy, borderColor: COLORS.border },
    soft: { background: COLORS.tealLight, color: COLORS.teal, borderColor: "transparent" },
    danger: { background: COLORS.coralLight, color: "#C96549", borderColor: "transparent" },
  };
  return <button type={type} disabled={disabled} onClick={onClick} className="button" style={styleMap[variant]}>{icon && <Icon name={icon} size={15} />}{children}</button>;
};

const MetricCard = ({ label, value, note, icon, accent, trend }: { label: string; value: string; note: string; icon: IconName; accent: string; trend?: string }) => (
  <div className="metric-card">
    <div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon" style={{ color: accent, background: `${accent}16` }}><Icon name={icon} size={17} /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-note">{trend && <span style={{ color: COLORS.green, fontWeight: 700 }}>{trend}</span>} {note}</div>
  </div>
);

const PageHeader = ({ eyebrow, title, description, action, actionLabel, actionIcon = "plus", onAction }: { eyebrow: string; title: string; description: string; action?: boolean; actionLabel?: string; actionIcon?: IconName; onAction?: () => void }) => (
  <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <Button icon={actionIcon} onClick={onAction}>{actionLabel}</Button>}</div>
);

const Panel = ({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) => (
  <section className={`panel ${className}`}><>{title && <div className="panel-header"><h3>{title}</h3>{action}</div>}{children}</></section>
);

function Dashboard({ goTo, setNotice }: { goTo: (key: PageKey) => void; setNotice: (message: string) => void }) {
  const activeStudents = people.filter((person) => person.stage === "inscrit" || person.stage === "encours").length;
  const activeGroups = classes.filter((item) => item.status !== "Annulé").length;
  const todayClasses = classes.slice(0, 3);
  const todayAttendance = people.filter((person) => person.attendance > 0).length;
  const recentEnrollments = people.filter((person) => Boolean(person.enrolled)).slice(0, 5);
  return <>
    <PageHeader eyebrow="Lundi 14 septembre 2026" title="Bonjour Nadia," description="Voici ce qui se passe dans votre centre aujourd'hui." action actionLabel="Nouvelle inscription" onAction={() => goTo("enrollments")} />
    <div className="metrics-grid">
      <MetricCard label="Étudiants actifs" value={String(activeStudents)} note="inscrits dans le centre" icon="graduation" accent={COLORS.teal} />
      <MetricCard label="Inscriptions en cours" value={String(people.filter((person) => person.stage === "encours").length)} note="parmi les dossiers actifs" icon="file" accent="#5B8DEF" />
      <MetricCard label="Groupes actifs" value={String(activeGroups)} note="sur le planning actuel" icon="users" accent={COLORS.coral} />
      <MetricCard label="Cours aujourd'hui" value={String(todayClasses.length)} note="sessions programmées" icon="calendar" accent="#6A63B8" />
      <MetricCard label="Présences aujourd'hui" value={String(todayAttendance)} note="étudiants suivis" icon="checkCircle" accent={COLORS.green} />
      <MetricCard label="Paiements en attente" value={String(payments.filter((payment) => payment.status !== "Payé").length)} note="dossiers à vérifier" icon="wallet" accent={COLORS.yellow} />
    </div>
    <div className="dashboard-grid top-grid">
      <Panel title="Cours aujourd'hui" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("planning")}>Voir le planning</Button>}>
        <div className="activity-list">{todayClasses.map((item) => <div className="activity-row" key={item.id}><span className="activity-icon" style={{ background: `${item.color}18`, color: item.color }}><Icon name="calendar" size={15} /></span><div><strong>{item.name}</strong><span>{item.schedule} · {item.room}</span></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>)}</div>
      </Panel>
      <Panel title="Présences du jour" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("attendance")}>Ouvrir les présences</Button>}>
        <div className="risk-list">{people.filter((person) => person.attendance > 0).slice(0, 4).map((person) => <div className="risk-row" key={person.id} onClick={() => goTo("attendance")}><div>{initialsBadge(person.name)}</div><div className="task-copy"><strong>{person.name}</strong><span>{person.course}</span></div><div className="risk-score">{person.attendance}%<span>présence</span></div><Icon name="chevron" size={16} stroke={COLORS.muted} /></div>)}</div>
      </Panel>
    </div>
    <div className="dashboard-grid lower-grid">
      <Panel title="Inscriptions récentes" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("enrollments")}>Toutes les inscriptions</Button>}>
        <div className="activity-list">{recentEnrollments.map((person) => <div className="activity-row" key={person.id}><span className="activity-icon" style={{ background: COLORS.tealLight, color: COLORS.teal }}><Icon name="check" size={15} /></span><div><strong>{person.name}</strong><span>{person.course} · {person.enrolled}</span></div><Badge tone={statusTone(stageLabels[person.stage])}>{stageLabels[person.stage]}</Badge></div>)}</div>
      </Panel>
      <Panel title="Paiements récents" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("payments")}>Voir les paiements</Button>}>
        <div className="activity-list">{payments.slice(0, 4).map((payment) => <div className="activity-row" key={payment.id}><span className="activity-icon" style={{ background: `${COLORS.yellow}18`, color: COLORS.yellow }}><Icon name="wallet" size={15} /></span><div><strong>{payment.student}</strong><span>{formatMoney(payment.paid)} · {payment.date}</span></div><Badge tone={statusTone(payment.status)}>{payment.status}</Badge></div>)}</div>
      </Panel>
      <Panel title="Groupes actifs" action={<Button variant="ghost" icon="arrow" onClick={() => goTo("groups")}>Voir les groupes</Button>}>
        <div className="activity-list">{classes.filter((item) => item.status !== "Annulé").slice(0, 4).map((item) => <div className="activity-row" key={item.id}><span className="activity-icon" style={{ background: `${item.color}18`, color: item.color }}><Icon name="users" size={15} /></span><div><strong>{item.name}</strong><span>{item.enrolled}/{item.capacity} étudiants · {item.teacher}</span></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>)}</div>
      </Panel>
    </div>
  </>;
}

function Inscriptions({ contacts, setSelected, setNotice }: { contacts: Person[]; setSelected: (person: Person) => void; setNotice: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const enrolled = contacts.filter((person) => person.enrolled || person.stage === "inscrit" || person.stage === "encours" || person.stage === "diplome");
  const filtered = enrolled.filter((person) => `${person.name} ${person.course}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader eyebrow="Gestion des dossiers" title="Inscriptions" description="Suivez les inscriptions des étudiants dans chaque formation." action actionLabel="Nouvelle inscription" onAction={() => setNotice("Le formulaire d'inscription sera connecté à la base de données.")} />
    <div className="metrics-grid metrics-grid-4"><MetricCard label="Inscriptions actives" value={String(enrolled.length)} note="dossiers en cours" icon="file" accent={COLORS.teal} /><MetricCard label="En cours" value={String(enrolled.filter((person) => person.stage === "encours").length)} note="formations commencées" icon="graduation" accent="#5B8DEF" /><MetricCard label="Terminées" value={String(enrolled.filter((person) => person.stage === "diplome").length)} note="certificats à suivre" icon="checkCircle" accent={COLORS.green} /><MetricCard label="Solde restant" value={formatMoney(enrolled.reduce((sum, person) => sum + person.balance, 0))} note="sur les inscriptions" icon="wallet" accent={COLORS.yellow} /></div>
    <Panel className="table-panel" title="Dossiers d'inscription" action={<div className="search-box compact"><Icon name="search" size={16} /><input placeholder="Rechercher un étudiant…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>}><div className="table-scroll"><table><thead><tr><th>Étudiant</th><th>Formation</th><th>Statut</th><th>Date d'inscription</th><th>Paiement</th><th>Solde</th></tr></thead><tbody>{filtered.map((person) => <tr key={person.id} onClick={() => setSelected(person)}><td><div className="person-cell">{initialsBadge(person.name)}<div><strong>{person.name}</strong><span>{person.email}</span></div></div></td><td>{person.course}</td><td><Badge tone={person.stage === "diplome" ? "success" : person.stage === "encours" ? "info" : "neutral"} dot>{person.stage === "diplome" ? "Terminé" : stageLabels[person.stage] === "Inscrit" ? "Inscrit" : "En cours"}</Badge></td><td>{person.enrolled || "À compléter"}</td><td><Badge tone={statusTone(person.payment)}>{person.payment}</Badge></td><td>{formatMoney(person.balance)}</td></tr>)}</tbody></table></div><div className="table-footer"><span>{filtered.length} inscriptions affichées</span><span>Une inscription associe un étudiant à une formation.</span></div></Panel>
  </>;
}

function Students({ contacts, setSelected, setNotice, goTo }: { contacts: Person[]; setSelected: (person: Person) => void; setNotice: (message: string) => void; goTo: (key: PageKey) => void }) {
  const [courseFilter, setCourseFilter] = useState("Toutes");
  const [paymentFilter, setPaymentFilter] = useState("Tous");
  const [attendanceFilter, setAttendanceFilter] = useState("Tous");
  const active = contacts.filter((person) => ["inscrit", "encours"].includes(person.stage));
  const filtered = active.filter((person) => (courseFilter === "Toutes" || person.course === courseFilter) && (paymentFilter === "Tous" || person.payment === paymentFilter) && (attendanceFilter === "Tous" || person.attendance < 75));
  return <>
    <PageHeader eyebrow="Suivi pédagogique" title="Étudiants actifs" description="Suivez la progression, la présence et les paiements de vos apprenants." action actionLabel="Inscrire un étudiant" onAction={() => setNotice("Parcours d'inscription lancé depuis la liste des étudiants.")} />
    <Panel className="table-panel"><div className="filter-bar"><div><span className="filter-caption">Filtres rapides</span><div className="filter-pills"><select className="select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}><option>Toutes</option>{courses.map((course) => <option key={course.id}>{course.name}</option>)}</select><select className="select" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}><option>Tous</option><option>Payé</option><option>Partiel</option><option>En retard</option></select><select className="select" value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)}><option>Tous</option><option value="low">Présence &lt; 75%</option></select></div></div><div className="active-count"><strong>{filtered.length}</strong><span>étudiants affichés</span></div></div><div className="table-scroll"><table><thead><tr><th>Étudiant</th><th>Formation</th><th>Inscription</th><th>Présence</th><th>Paiement</th><th>Solde</th><th>Formateur</th><th>Progression</th><th /></tr></thead><tbody>{filtered.map((person) => <tr key={person.id} onClick={() => setSelected(person)}><td><div className="person-cell">{initialsBadge(person.name)}<div><strong>{person.name}</strong><span>{person.email}</span></div></div></td><td>{person.course}</td><td>{person.enrolled}</td><td><div className="inline-progress"><span className={person.attendance < 75 ? "low" : ""}>{person.attendance}%</span><div><i style={{ width: `${person.attendance}%`, background: person.attendance < 75 ? COLORS.red : COLORS.teal }} /></div></div></td><td><Badge tone={statusTone(person.payment)}>{person.payment}</Badge></td><td className={person.balance > 0 ? "money-danger" : "money-ok"}>{formatMoney(person.balance)}</td><td>{person.teacher}</td><td><div className="inline-progress"><span>{person.progress}%</span><div><i style={{ width: `${person.progress}%`, background: COLORS.navy2 }} /></div></div></td><td><button className="row-menu" onClick={(e) => { e.stopPropagation(); setNotice(`Actions pour ${person.name}`); }}><Icon name="dots" size={16} /></button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Actions rapides disponibles dans le profil d'un étudiant</span><button className="text-button" onClick={() => goTo("certificates")}>Voir les certificats éligibles <Icon name="arrow" size={13} /></button></div></Panel>
  </>;
}

function Classes({ setSelectedClass, setNotice }: { setSelectedClass: (item: SchoolClass) => void; setNotice: (message: string) => void }) {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return <>
    <PageHeader eyebrow="Organisation pédagogique" title="Groupes" description="Une vue claire des groupes, des salles, des formateurs et des capacités." action actionLabel="Créer un groupe" onAction={() => setNotice("Création de groupe : formulaire prêt à être connecté.")} />
    <div className="class-cards">{classes.map((item) => <div className="class-card" key={item.id} onClick={() => setSelectedClass(item)}><div className="class-color" style={{ background: item.color }} /><div className="class-card-main"><div className="class-card-top"><Badge tone={statusTone(item.status)} dot>{item.status}</Badge><button className="row-menu" onClick={(e) => { e.stopPropagation(); setNotice(`Options pour ${item.name}`); }}><Icon name="dots" size={16} /></button></div><h3>{item.name}</h3><p><Icon name="teacher" size={14} /> {item.teacher} · {item.room}</p><p><Icon name="calendar" size={14} /> {item.schedule}</p><div className="capacity"><div><span>Capacité</span><strong>{item.enrolled}/{item.capacity}</strong></div><div className="capacity-track"><i style={{ width: `${(item.enrolled / item.capacity) * 100}%`, background: item.enrolled === item.capacity ? COLORS.coral : item.color }} /></div></div></div></div>)}</div>
    <Panel title="Planning hebdomadaire" action={<div className="week-switch"><button>‹</button><strong>14 — 20 septembre 2026</strong><button>›</button></div>}><div className="calendar-grid"><div className="time-col"><span /><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span><span>20:00</span></div>{days.map((day) => <div className="day-col" key={day}><div className="day-head">{day}<small>{day === "Lun" ? "14" : day === "Mar" ? "15" : day === "Mer" ? "16" : day === "Jeu" ? "17" : day === "Ven" ? "18" : day === "Sam" ? "19" : "13"}</small></div><div className="day-slots">{[0, 1, 2, 3, 4, 5].map((slot) => <div className="calendar-slot" key={slot} />)}{classes.filter((item) => item.days.includes(day)).map((item, index) => <div className="calendar-event" key={item.id} style={{ top: `${item.time === "09:00" ? 11 : item.time === "14:00" ? 47 : 83}%`, background: `${item.color}18`, borderLeftColor: item.color }} onClick={() => setSelectedClass(item)}><strong>{item.name.split(" — ")[0]}</strong><span>{item.time} · {item.room}</span></div>)}</div></div>)}</div></Panel>
  </>;
}

function Formations({ setNotice }: { setNotice: (message: string) => void }) {
  return <>
    <PageHeader eyebrow="Catalogue pédagogique" title="Formations" description="Pilotez votre catalogue, les tarifs et les places disponibles par parcours." action actionLabel="Nouvelle formation" onAction={() => setNotice("Nouvelle formation : formulaire prêt à être connecté.")} />
    <div className="class-cards">{courses.map((course) => <div className="class-card" key={course.id} onClick={() => setNotice(`Formation « ${course.name} » sélectionnée.`)}><div className="class-color" style={{ background: course.color }} /><div className="class-card-main"><div className="class-card-top"><Badge tone="success" dot>Active</Badge><button className="row-menu" onClick={(event) => { event.stopPropagation(); setNotice(`Options pour ${course.name}`); }}><Icon name="dots" size={16} /></button></div><h3>{course.name}</h3><p><Icon name="clock" size={14} /> {course.duration} · {formatMoney(course.price)}</p><p><Icon name="graduation" size={14} /> {course.students} étudiants actifs</p><div className="capacity"><div><span>Remplissage estimé</span><strong>{Math.round(course.students / 20 * 100)}%</strong></div><div className="capacity-track"><i style={{ width: `${Math.round(course.students / 20 * 100)}%`, background: course.color }} /></div></div></div></div>)}</div>
    <Panel title="Synthèse du catalogue" action={<Button variant="outline" icon="download" onClick={() => setNotice("Catalogue exporté en version démo.")}>Exporter</Button>}><div className="hours-grid">{courses.map((course) => <div className="hours-row" key={course.id}><span className="hours-name"><span className="tiny-avatar" style={{ background: `${course.color}22`, color: course.color }}>F{course.id}</span>{course.name}</span><div className="hours-track"><i style={{ width: `${Math.round(course.students / 20 * 100)}%`, background: course.color }} /></div><strong>{course.students} inscrits</strong></div>)}</div></Panel>
  </>;
}

function Planning({ setSelectedClass, setNotice }: { setSelectedClass: (item: SchoolClass) => void; setNotice: (message: string) => void }) {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return <>
    <PageHeader eyebrow="Organisation pédagogique" title="Planning" description="Visualisez les séances de la semaine et repérez les créneaux encore disponibles." action actionLabel="Ajouter une séance" onAction={() => setNotice("Nouvelle séance : formulaire prêt à être connecté.")} />
    <Panel title="Planning hebdomadaire" action={<div className="week-switch"><button onClick={() => setNotice("Semaine précédente")}>‹</button><strong>14 — 20 septembre 2026</strong><button onClick={() => setNotice("Semaine suivante")}>›</button></div>}><div className="calendar-grid"><div className="time-col"><span /><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span><span>20:00</span></div>{days.map((day) => <div className="day-col" key={day}><div className="day-head">{day}<small>{day === "Lun" ? "14" : day === "Mar" ? "15" : day === "Mer" ? "16" : day === "Jeu" ? "17" : day === "Ven" ? "18" : day === "Sam" ? "19" : "13"}</small></div><div className="day-slots">{[0, 1, 2, 3, 4, 5].map((slot) => <div className="calendar-slot" key={slot} />)}{classes.filter((item) => item.days.includes(day)).map((item) => <div className="calendar-event" key={item.id} style={{ top: `${item.time === "09:00" ? 11 : item.time === "14:00" ? 47 : 83}%`, background: `${item.color}18`, borderLeftColor: item.color }} onClick={() => setSelectedClass(item)}><strong>{item.name.split(" — ")[0]}</strong><span>{item.time} · {item.room}</span></div>)}</div></div>)}</div></Panel>
    <div className="class-cards">{classes.slice(0, 3).map((item) => <div className="class-card" key={item.id} onClick={() => setSelectedClass(item)}><div className="class-color" style={{ background: item.color }} /><div className="class-card-main"><div className="class-card-top"><Badge tone={statusTone(item.status)} dot>{item.status}</Badge></div><h3>{item.name}</h3><p><Icon name="teacher" size={14} /> {item.teacher}</p><p><Icon name="calendar" size={14} /> {item.schedule}</p></div></div>)}</div>
  </>;
}

function Attendance({ attendance, setAttendance, setNotice }: { attendance: Record<number, string[]>; setAttendance: (next: Record<number, string[]>) => void; setNotice: (message: string) => void }) {
  const [selectedClass, setSelectedClass] = useState("Excel avancé — Matin");
  const selected = classes.find((item) => item.name === selectedClass) || classes[0];
  const roster = people.filter((person) => selected.roster.includes(person.id));
  const toggle = (personId: number, index: number) => {
    const values = [...(attendance[personId] || attendanceSeed[personId] || attendanceDates.map(() => "P"))];
    values[index] = values[index] === "P" ? "A" : values[index] === "A" ? "L" : "P";
    setAttendance({ ...attendance, [personId]: values });
    setNotice("Présence mise à jour.");
  };
  const attendanceRate = (values: string[]) => Math.round(values.filter((value) => value === "P").length / values.length * 100);
  return <>
    <PageHeader eyebrow="Suivi des séances" title="Présences" description="Enregistrez la présence en quelques secondes et détectez les risques tôt." action actionLabel="Exporter la feuille" actionIcon="download" onAction={() => setNotice("Export de la feuille de présence simulé.")} />
    <div className="attendance-controls"><div><label>Classe</label><select className="select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>{classes.map((item) => <option key={item.id}>{item.name}</option>)}</select></div><div><label>Période</label><div className="date-range"><Icon name="calendar" size={15} /> 02 sept. — 28 sept. 2026</div></div><div className="attendance-legend"><span><i className="presence present">✓</i> Présent</span><span><i className="presence late">~</i> En retard</span><span><i className="presence absent">×</i> Absent</span></div></div>
    <Panel className="table-panel attendance-panel"><div className="attendance-head"><div><h3>{selected.name}</h3><p>{selected.teacher} · {roster.length} étudiants · {attendanceDates.length} séances</p></div><Badge tone="success" dot>Feuille ouverte</Badge></div><div className="table-scroll"><table className="attendance-table"><thead><tr><th>Étudiant</th>{attendanceDates.map((date) => <th key={date}>{date}</th>)}<th>Taux</th></tr></thead><tbody>{roster.map((person) => { const values = attendance[person.id] || attendanceSeed[person.id] || attendanceDates.map(() => "P"); return <tr key={person.id}><td><div className="person-cell">{initialsBadge(person.name)}<div><strong>{person.name}</strong><span>{person.course}</span></div></div></td>{values.map((value, index) => <td key={index}><button className={`presence ${value === "P" ? "present" : value === "L" ? "late" : "absent"}`} onClick={() => toggle(person.id, index)}>{value === "P" ? "✓" : value === "L" ? "~" : "×"}</button></td>)}<td><strong className={attendanceRate(values) < 75 ? "text-danger" : "text-teal"}>{attendanceRate(values)}%</strong></td></tr>})}</tbody><tfoot><tr><td><strong>Moyenne de la classe</strong></td>{attendanceDates.map((_, index) => <td key={index}><strong className="text-teal">{Math.round(roster.reduce((sum, person) => { const values = attendance[person.id] || attendanceSeed[person.id] || attendanceDates.map(() => "P"); return sum + (values[index] === "P" ? 1 : 0); }, 0) / roster.length * 100)}%</strong></td>)}<td><strong className="text-teal">86%</strong></td></tr></tfoot></table></div></Panel>
  </>;
}

function Payments({ setNotice }: { setNotice: (message: string) => void }) {
  const [rows, setRows] = useState(payments);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [form, setForm] = useState({ student: "Lina Haddad", amount: "", method: "Virement", date: "14/09/2026" });
  const filtered = rows.filter((payment) => statusFilter === "Tous" || payment.status === statusFilter);
  const totalPaid = rows.reduce((sum, item) => sum + item.paid, 0);
  const outstanding = rows.reduce((sum, item) => sum + item.balance, 0);
  const submit = (event: FormEvent) => { event.preventDefault(); const amount = Number(form.amount); if (!amount) { setNotice("Renseignez un montant pour enregistrer le paiement."); return; } const person = people.find((item) => item.name === form.student); const total = person ? courses.find((course) => course.name === person.course)?.price || 50000 : 50000; const newPayment: Payment = { id: Date.now(), student: form.student, course: person?.course || "Formation", total, paid: amount, balance: Math.max(total - amount, 0), date: "14 sept. 2026", method: form.method, status: amount >= total ? "Payé" : "Partiel" }; setRows([newPayment, ...rows]); setForm({ ...form, amount: "" }); setNotice(`Paiement de ${formatMoney(amount)} enregistré pour ${form.student}.`); };
  return <>
    <PageHeader eyebrow="Suivi financier" title="Paiements & finances" description="Gardez une vision précise des encaissements et des soldes à recouvrer." action actionLabel="Télécharger le rapport" actionIcon="download" onAction={() => setNotice("Rapport financier simulé.")} />
    <div className="metrics-grid finance-metrics"><MetricCard label="Encaissé ce mois" value="1,84 M DA" note="sur 2,26 M DA facturés" icon="wallet" accent={COLORS.teal} /><MetricCard label="Solde à recouvrer" value={formatMoney(outstanding)} note="18 comptes ouverts" icon="clock" accent={COLORS.yellow} /><MetricCard label="Comptes en retard" value="7" note="3 à relancer aujourd'hui" icon="warning" accent={COLORS.red} /></div>
    <div className="two-column-layout"><Panel className="table-panel"><div className="toolbar"><div><h3 className="inline-title">Historique des paiements <span className="count-chip">{filtered.length}</span></h3><p className="muted-copy">Total encaissé sur la période : {formatMoney(totalPaid)}</p></div><select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Tous</option><option>Payé</option><option>Partiel</option><option>En retard</option></select></div><div className="table-scroll"><table><thead><tr><th>Étudiant</th><th>Formation</th><th>Total</th><th>Payé</th><th>Solde</th><th>Date</th><th>Méthode</th><th>Statut</th></tr></thead><tbody>{filtered.map((payment) => <tr key={payment.id} className={payment.status === "En retard" ? "row-danger" : ""}><td><strong>{payment.student}</strong></td><td>{payment.course}</td><td>{formatMoney(payment.total)}</td><td className="money-ok">{formatMoney(payment.paid)}</td><td className={payment.balance ? "money-danger" : "money-ok"}>{formatMoney(payment.balance)}</td><td>{payment.date}</td><td>{payment.method}</td><td><Badge tone={statusTone(payment.status)} dot>{payment.status}</Badge></td></tr>)}</tbody></table></div></Panel><Panel title="Enregistrer un paiement"><form className="stack-form" onSubmit={submit}><label>Étudiant<select className="field" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>{people.filter((person) => person.enrolled).map((person) => <option key={person.id}>{person.name}</option>)}</select></label><label>Montant reçu<div className="input-with-suffix"><input className="field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9]/g, "") })} placeholder="Ex. 25 000" /><span>DA</span></div></label><label>Date<input className="field" type="text" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>Mode de paiement<select className="field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Virement</option><option>Espèces</option><option>Chèque</option></select></label><Button type="submit" icon="check">Enregistrer le paiement</Button><p className="form-hint"><Icon name="lock" size={13} /> Les paiements sont journalisés et visibles par les utilisateurs autorisés.</p></form></Panel></div>
  </>;
}

function Teachers({ setSelectedTeacher, setNotice }: { setSelectedTeacher: (teacher: Teacher) => void; setNotice: (message: string) => void }) {
  return <>
    <PageHeader eyebrow="Équipe pédagogique" title="Enseignants" description="Un annuaire clair pour piloter l'équipe et les heures enseignées." action actionLabel="Ajouter un enseignant" onAction={() => setNotice("Formulaire d'ajout d'enseignant ouvert.")} />
    <div className="teacher-grid">{teachers.map((teacher) => <div className="teacher-card" key={teacher.id} onClick={() => setSelectedTeacher(teacher)}><div className="teacher-top"><span className="teacher-avatar" style={{ background: `${teacher.color}22`, color: teacher.color }}>{teacher.initials}</span><button className="row-menu" onClick={(e) => { e.stopPropagation(); setNotice(`Options pour ${teacher.name}`); }}><Icon name="dots" size={16} /></button></div><h3>{teacher.name}</h3><p className="teacher-subject">{teacher.subject}</p><div className="teacher-details"><span><Icon name="phone" size={14} />{teacher.phone}</span><span><Icon name="mail" size={14} />{teacher.email}</span></div><div className="teacher-footer"><span>{teacher.classes.length} classe{teacher.classes.length > 1 ? "s" : ""}</span><strong>{formatMoney(teacher.rate)}/h</strong></div></div>)}</div>
    <Panel title="Charge horaire cette semaine"><div className="hours-grid">{teachers.map((teacher, index) => <div className="hours-row" key={teacher.id}><span className="hours-name"><span className="tiny-avatar" style={{ background: `${teacher.color}22`, color: teacher.color }}>{teacher.initials}</span>{teacher.name}</span><div className="hours-track"><i style={{ width: `${[88, 56, 76, 44, 63][index]}%`, background: teacher.color }} /></div><strong>{[32, 20, 28, 16, 23][index]} h</strong></div>)}</div></Panel>
  </>;
}

function Certificates({ contacts, setNotice }: { contacts: Person[]; setNotice: (message: string) => void }) {
  const [selected, setSelected] = useState<Person | null>(people.find((person) => person.name === "Imen Rahmani") || null);
  const eligible = contacts.filter((person) => person.stage === "diplome" && person.attendance >= 75 && person.balance === 0);
  return <>
    <PageHeader eyebrow="Documents officiels" title="Certificats & documents" description="Générez des documents prêts à imprimer pour chaque étape du parcours étudiant." action actionLabel="Nouveau document" onAction={() => setNotice("Choisissez un type de document à générer.")} />
    <div className="document-layout"><Panel><div className="doc-tabs"><button className="active">Certificats</button><button>Attestations d'inscription</button><button>Reçus de paiement</button></div><div className="eligibility-banner"><span className="metric-icon" style={{ color: COLORS.teal, background: COLORS.tealLight }}><Icon name="checkCircle" size={17} /></span><div><strong>{eligible.length} étudiants éligibles</strong><span>Présence ≥ 75% et formation entièrement réglée</span></div></div><div className="certificate-list">{eligible.map((person) => <div className={`certificate-row ${selected?.id === person.id ? "selected" : ""}`} key={person.id} onClick={() => setSelected(person)}>{initialsBadge(person.name)}<div><strong>{person.name}</strong><span>{person.course} · Diplômé le 30 août 2026</span></div><Badge tone="success">Éligible</Badge><Icon name="chevron" size={16} stroke={COLORS.muted} /></div>)}</div></Panel><div className="certificate-preview"><div className="preview-toolbar"><div><span>APERÇU DU DOCUMENT</span><strong>Certificat de formation</strong></div><Button variant="outline" icon="print" onClick={() => setNotice("Fenêtre d'impression simulée.")}>Imprimer</Button></div><div className="formal-document"><div className="document-corner" /><div className="document-logo"><span>F</span><div><strong>FORMA<span>PLUS</span></strong><small>Centre de formation professionnelle</small></div></div><div className="document-rule" /><p className="formal-kicker">CERTIFICAT DE RÉUSSITE</p><p className="formal-intro">Le présent certificat est délivré à</p><h2>{selected?.name || "Nom de l'étudiant"}</h2><p className="formal-copy">pour avoir suivi avec assiduité et satisfait aux exigences de la formation</p><h3>{selected?.course || "Intitulé de la formation"}</h3><div className="document-stats"><div><span>Durée</span><strong>{selected?.course.includes("Design") ? "6 mois" : "4 mois"}</strong></div><div><span>Assiduité</span><strong>{selected?.attendance || 0}%</strong></div><div><span>N° certificat</span><strong>FC-2026-00{selected?.id || "0"}</strong></div></div><div className="document-bottom"><div><span>Alger, le 30 août 2026</span><strong>La Direction</strong></div><div className="signature">Nadia Benali</div></div><div className="document-seal">F<br /><small>2026</small></div></div></div></div>
  </>;
}

function Settings({ setNotice }: { setNotice: (message: string) => void }) {
  const [tab, setTab] = useState("Établissement");
  const [notifications, setNotifications] = useState({ payments: true, attendance: true, followup: true });
  return <>
    <PageHeader eyebrow="Administration" title="Paramètres" description="Configurez l'identité de votre établissement et les règles de votre équipe." action actionLabel="Enregistrer les changements" actionIcon="check" onAction={() => setNotice("Paramètres enregistrés dans la version de démonstration.")} />
    <div className="settings-layout"><aside className="settings-nav">{["Établissement", "Utilisateurs", "Catalogue des formations", "Notifications"].map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}><Icon name={item === "Établissement" ? "building" : item === "Utilisateurs" ? "users" : item === "Catalogue des formations" ? "graduation" : "bell"} size={16} />{item}<Icon name="chevron" size={15} stroke={COLORS.muted} /></button>)}</aside><div className="settings-content">{tab === "Établissement" && <><Panel title="Profil de l'établissement"><div className="settings-form"><label>Nom de l'établissement<input className="field" defaultValue="FormaPlus Alger" /></label><label>Téléphone<input className="field" defaultValue="021 55 42 18" /></label><label>Email professionnel<input className="field" defaultValue="contact@formaplus.dz" /></label><label>Adresse<input className="field" defaultValue="12, rue des Frères Benali, Hydra, Alger" /></label></div><div className="logo-upload"><span className="school-logo">F</span><div><strong>Logo de l'établissement</strong><span>PNG ou JPG · 1 Mo maximum</span></div><Button variant="outline" onClick={() => setNotice("Sélecteur de fichier simulé.")}>Changer le logo</Button></div></Panel><Panel title="Préférences régionales"><div className="settings-form"><label>Devise<select className="field" defaultValue="Dinar algérien (DA)"><option>Dinar algérien (DA)</option><option>Euro (€)</option></select></label><label>Fuseau horaire<select className="field" defaultValue="Africa/Algiers"><option>Africa/Algiers (UTC+1)</option></select></label><label>Premier jour de la semaine<select className="field" defaultValue="Dimanche"><option>Dimanche</option><option>Lundi</option></select></label></div></Panel></>}{tab === "Utilisateurs" && <Panel title="Utilisateurs & rôles"><div className="user-list">{[{ name: "Nadia Benali", email: "nadia@formaplus.dz", role: "Directrice", status: "Actif" }, { name: "Mehdi Saidi", email: "mehdi@formaplus.dz", role: "Administrateur", status: "Actif" }, { name: "Sarah Kaci", email: "sarah@formaplus.dz", role: "Administratrice", status: "Actif" }, { name: "Omar Cherif", email: "omar@formaplus.dz", role: "Enseignant", status: "Actif" }].map((user) => <div className="user-row" key={user.email}>{initialsBadge(user.name)}<div><strong>{user.name}</strong><span>{user.email}</span></div><Badge tone="info">{user.role}</Badge><span className="user-status"><i />{user.status}</span><button className="row-menu" onClick={() => setNotice(`Modifier ${user.name}`)}><Icon name="dots" size={16} /></button></div>)}</div><Button icon="plus" onClick={() => setNotice("Ajout d'un utilisateur : formulaire prêt.")}>Ajouter un utilisateur</Button></Panel>}{tab === "Catalogue des formations" && <Panel title="Catalogue des formations"><div className="course-settings">{courses.map((course) => <div className="course-setting-row" key={course.id}><span className="course-color" style={{ background: course.color }} /><input className="inline-edit" defaultValue={course.name} /><input className="inline-edit small" defaultValue={course.duration} /><div className="price-edit"><input className="inline-edit small" defaultValue={course.price.toString()} /><span>DA</span></div><button className="row-menu" onClick={() => setNotice(`Formation « ${course.name} » enregistrée.`)}><Icon name="check" size={15} /></button></div>)}</div><Button variant="outline" icon="plus" onClick={() => setNotice("Nouvelle formation : ligne ajoutée.")}>Ajouter une formation</Button></Panel>}{tab === "Notifications" && <Panel title="Préférences de notification"><div className="toggle-list">{[{ key: "payments" as const, title: "Rappels de paiements en retard", desc: "Recevoir une alerte lorsque le solde d'un étudiant dépasse son échéance." }, { key: "attendance" as const, title: "Alertes de présence faible", desc: "Être averti lorsque la présence d'un étudiant passe sous 75%." }, { key: "followup" as const, title: "Rappels de séances à venir", desc: "Rappeler les séances et échéances prévues dans les prochaines 24 heures." }].map((item) => <div className="toggle-row" key={item.key}><div><strong>{item.title}</strong><span>{item.desc}</span></div><button className={`switch ${notifications[item.key] ? "on" : ""}`} onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}><i /></button></div>)}</div></Panel>}</div></div>
  </>;
}

function Drawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="drawer-layer" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">FICHE DÉTAILLÉE</span><h2>{title}</h2></div><button className="close-button" onClick={onClose}><Icon name="close" size={20} /></button></div>{children}</aside></div>;
}

function PersonDrawer({ person, onClose, setNotice, onAddNote }: { person: Person; onClose: () => void; setNotice: (message: string) => void; onAddNote: (note: string) => void }) {
  const [note, setNote] = useState("");
  const operationalStatus = person.stage === "diplome" ? "Terminé" : person.stage === "encours" ? "En cours" : person.stage === "abandonne" ? "Abandonné" : "Inscrit";
  return <Drawer title={person.name} onClose={onClose}><div className="drawer-profile"><span className="profile-avatar">{initials(person.name)}</span><div><strong>{person.course}</strong><span><Badge tone={statusTone(operationalStatus)} dot>{operationalStatus}</Badge></span></div></div><div className="drawer-actions"><Button variant="soft" icon="phone" onClick={() => setNotice(`Appel lancé vers ${person.phone}`)}>Appeler</Button><Button variant="outline" icon="mail" onClick={() => setNotice(`Email préparé pour ${person.email}`)}>Email</Button><Button variant="outline" icon="calendar" onClick={() => setNotice("Événement ajouté au planning.")}>Planning</Button></div><div className="drawer-section"><h4>Informations de l'étudiant</h4><div className="info-grid"><div><span>Téléphone</span><strong>{person.phone}</strong></div><div><span>Email</span><strong>{person.email}</strong></div><div><span>Adresse</span><strong>{person.address}</strong></div><div><span>Date de naissance</span><strong>{person.dob || "Non renseignée"}</strong></div><div><span>Formation</span><strong>{person.course}</strong></div><div><span>Groupe / formateur</span><strong>{person.teacher || "À affecter"}</strong></div></div></div><div className="drawer-section"><div className="drawer-section-head"><h4>Suivi de formation</h4><span>{person.progress}% complété</span></div><div className="timeline"><div><i style={{ background: COLORS.teal }} /><p><strong>Statut actuel : {operationalStatus}</strong><span>Inscription {person.enrolled ? `du ${person.enrolled}` : "à compléter"}</span></p></div><div><i style={{ background: COLORS.green }} /><p><strong>Présence suivie</strong><span>{person.attendance > 0 ? `${person.attendance}% de présence` : "Aucune séance enregistrée"}</span></p></div><div><i style={{ background: COLORS.yellow }} /><p><strong>Situation de paiement</strong><span>{person.payment} · {person.balance ? `solde de ${formatMoney(person.balance)}` : "solde réglé"}</span></p></div></div></div><div className="drawer-section"><h4>Ajouter une note</h4><textarea className="field textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Écrivez une note sur cet étudiant…" /><div className="drawer-note-footer"><span>Visible par l'équipe</span><Button icon="check" onClick={() => { if (note.trim()) { onAddNote(note); setNote(""); } }}>Ajouter la note</Button></div></div><div className="drawer-footer-actions"><Button variant="outline" onClick={() => setNotice("Le changement de statut sera disponible avec la base de données.")}>Modifier le statut</Button></div></Drawer>;
}

function ClassDrawer({ item, onClose, setNotice }: { item: SchoolClass; onClose: () => void; setNotice: (message: string) => void }) {
  const roster = people.filter((person) => item.roster.includes(person.id));
  return <Drawer title={item.name} onClose={onClose}><div className="class-drawer-head"><span className="class-color-large" style={{ background: item.color }} /><div><Badge tone={statusTone(item.status)} dot>{item.status}</Badge><p>{item.teacher} · {item.room}</p><span>{item.schedule}</span></div></div><div className="drawer-section"><div className="drawer-section-head"><h4>Liste des étudiants</h4><span>{item.enrolled}/{item.capacity} places</span></div><div className="roster-list">{roster.map((person) => <div className="roster-row" key={person.id}>{initialsBadge(person.name)}<div><strong>{person.name}</strong><span>Présence {person.attendance}%</span></div><Badge tone={person.attendance < 75 ? "danger" : "success"}>{person.attendance < 75 ? "À surveiller" : "Régulier"}</Badge></div>)}</div></div><div className="drawer-section"><h4>Actions de classe</h4><div className="drawer-actions vertical"><Button variant="soft" icon="check" onClick={() => setNotice("Feuille de présence ouverte.")}>Ouvrir les présences</Button><Button variant="outline" icon="mail" onClick={() => setNotice("Message envoyé aux étudiants de la classe.")}>Envoyer un message</Button></div></div></Drawer>;
}

function TeacherDrawer({ teacher, onClose, setNotice }: { teacher: Teacher; onClose: () => void; setNotice: (message: string) => void }) {
  return <Drawer title={teacher.name} onClose={onClose}><div className="drawer-profile"><span className="profile-avatar" style={{ background: `${teacher.color}22`, color: teacher.color }}>{teacher.initials}</span><div><strong>{teacher.subject}</strong><span><Badge tone="success" dot>{teacher.contract}</Badge></span></div></div><div className="drawer-section"><h4>Coordonnées</h4><div className="info-grid"><div><span>Téléphone</span><strong>{teacher.phone}</strong></div><div><span>Email</span><strong>{teacher.email}</strong></div><div><span>Tarif horaire</span><strong>{formatMoney(teacher.rate)}/h</strong></div></div></div><div className="drawer-section"><h4>Planning de la semaine</h4><div className="teacher-schedule">{teacher.classes.map((name, index) => <div key={name}><span className="schedule-day">{index === 0 ? "LUN" : "MER"}</span><div><strong>{name}</strong><span>{index === 0 ? "14:00 — 17:00" : "09:00 — 11:00"} · {index === 0 ? "Salle A1" : "Studio C1"}</span></div></div>)}</div></div><Button variant="outline" icon="calendar" onClick={() => setNotice("Planning enseignant exporté.")}>Exporter le planning</Button></Drawer>;
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
    const [contacts, setContacts] = useState(people);
    const [attendance, setAttendance] = useState(attendanceSeed);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [notice, setNotice] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  const goTo = (page: PageKey) => { setActivePage(page); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const pageTitles: Record<PageKey, string> = { dashboard: "Tableau de bord", students: "Étudiants", enrollments: "Inscriptions", formations: "Formations", teachers: "Formateurs", groups: "Groupes", planning: "Planning", attendance: "Présences", payments: "Paiements", certificates: "Certificats", settings: "Paramètres" };
  const activeLabel = pageTitles[activePage];

  const renderPage = () => {
    switch (activePage) {
      case "dashboard": return <Dashboard goTo={goTo} setNotice={setNotice} />;
      case "enrollments": return <Inscriptions contacts={contacts} setSelected={setSelectedPerson} setNotice={setNotice} />;
      case "students": return <Students contacts={contacts} setSelected={setSelectedPerson} setNotice={setNotice} goTo={goTo} />;
      case "formations": return <Formations setNotice={setNotice} />;
      case "teachers": return <Teachers setSelectedTeacher={setSelectedTeacher} setNotice={setNotice} />;
      case "groups": return <Classes setSelectedClass={setSelectedClass} setNotice={setNotice} />;
      case "planning": return <Planning setSelectedClass={setSelectedClass} setNotice={setNotice} />;
      case "attendance": return <Attendance attendance={attendance} setAttendance={setAttendance} setNotice={setNotice} />;
      case "payments": return <Payments setNotice={setNotice} />;
      case "certificates": return <Certificates contacts={contacts} setNotice={setNotice} />;
      case "settings": return <Settings setNotice={setNotice} />;
    }
  };

  const groups: { label: string; items: { key: PageKey; label: string; icon: IconName; badge?: string }[] }[] = [
    { label: "GESTION DU CENTRE", items: [{ key: "dashboard", label: "Tableau de bord", icon: "grid" }, { key: "students", label: "Étudiants", icon: "graduation" }, { key: "enrollments", label: "Inscriptions", icon: "file" }, { key: "formations", label: "Formations", icon: "file" }, { key: "teachers", label: "Formateurs", icon: "teacher" }, { key: "groups", label: "Groupes", icon: "users" }, { key: "planning", label: "Planning", icon: "calendar" }, { key: "attendance", label: "Présences", icon: "check" }, { key: "payments", label: "Paiements", icon: "wallet" }, { key: "certificates", label: "Certificats", icon: "file" }, { key: "settings", label: "Paramètres", icon: "settings" }] },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><span className="brand-mark">F</span><div><strong>FORMA<span>PLUS</span></strong><small>Gestion d'école</small></div><button className="mobile-close" onClick={() => setSidebarOpen(false)}><Icon name="close" size={18} /></button></div>
      <div className="school-switcher"><span className="school-avatar">FP</span><div><strong>FormaPlus Alger</strong><span>Plan Pro · actif</span></div><Icon name="chevron" size={15} stroke="#95A7C4" /></div>
      <nav className="nav-groups">{groups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map((item) => <button key={item.key} className={`nav-item ${activePage === item.key ? "active" : ""}`} onClick={() => goTo(item.key)}><Icon name={item.icon} size={17} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</button>)}</div>)}</nav>
      <div className="sidebar-help"><span className="help-icon"><Icon name="spark" size={16} /></span><div><strong>Besoin d'aide ?</strong><span>Parlez à notre équipe</span></div><Icon name="arrow" size={14} /></div>
      <div className="sidebar-user"><span className="user-avatar">NB</span><div><strong>Nadia Benali</strong><span>Directrice</span></div><button className="icon-button" onClick={() => setNotice("Menu du compte")}> <Icon name="dots" size={17} /></button></div>
    </aside>
    {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Icon name="menu" size={20} /></button><span className="breadcrumb">FormaPlus Alger <Icon name="chevron" size={13} /> {activeLabel}</span></div><div className="topbar-right"><div className="global-search"><Icon name="search" size={16} /><input placeholder="Rechercher…" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} /></div><button className="top-icon" onClick={() => setNotice("Vous avez 3 notifications non lues.")}><Icon name="bell" size={18} /><span className="notification-dot" /></button><span className="top-divider" /><button className="top-profile" onClick={() => goTo("settings")}><span className="user-avatar small">NB</span><span>Nadia Benali</span><Icon name="chevron" size={13} /></button></div></header>
      <div className="content-wrap">{renderPage()}</div>
      <footer className="app-footer"><span>FormaPlus · Centre de formation FormaPlus Alger</span><span><span className="status-live" /> Système opérationnel · Version 1.4.0</span></footer>
    </main>
    {selectedPerson && <PersonDrawer person={selectedPerson} onClose={() => setSelectedPerson(null)} setNotice={setNotice} onAddNote={(note) => { setNotice(`Note ajoutée : « ${note.slice(0, 38)}${note.length > 38 ? "…" : ""} »`); }} />}
    {selectedClass && <ClassDrawer item={selectedClass} onClose={() => setSelectedClass(null)} setNotice={setNotice} />}
    {selectedTeacher && <TeacherDrawer teacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} setNotice={setNotice} />}
    {notice && <div className="toast"><span className="toast-check"><Icon name="check" size={14} /></span><span>{notice}</span><button onClick={() => setNotice("")}><Icon name="close" size={14} /></button></div>}
  </div>;
}
