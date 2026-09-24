import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// Shared building blocks for every page: colors, icons, badges, buttons, panels, forms and drawers.

export const COLORS = {
  ink: "#17202A",
  navy: "#15163a",
  navy2: "#233B61",
  teal: "#4338ca", // accent (kept under this key: used across the pages)
  tealLight: "#ecebfb",
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

export const ICONS = {
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
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  upload: "M12 21V9m0 0-4 4m4-4 4 4M4 3h16",
} as const;

export type IconName = keyof typeof ICONS;

export const Icon = ({ name, size = 18, stroke = "currentColor" }: { name: IconName; size?: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);

export const PALETTE = ["#5B8DEF", "#E4A853", "#B56FCE", "#2A9D8F", "#E57865", "#6A63B8"];
export const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const avatarColors = ["#D9E9E6", "#FBE0D6", "#E2E4F2", "#F5E8C9", "#DCE8F8"];

export const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
export const initialsBadge = (name: string) => <span className="avatar" style={{ background: avatarColors[name.length % avatarColors.length] }}>{initials(name)}</span>;

// sv-SE formats as YYYY-MM-DD in local time — the same string the offset arithmetic this replaces
// produced, checked against Algiers, UTC and both sides of the date line.
export const todayISO = () => new Date().toLocaleDateString("sv-SE");
export const formatDate = (iso: string | null | undefined, style: "short" | "long" = "short") =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", style === "long" ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const formatTime = (time: string | null) => (time ? time.slice(0, 5) : "");
export const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
export const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export const downloadCSV = (filename: string, rows: (string | number | null)[][]) => {
  const content = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "purple";
const tones: Record<Tone, CSSProperties> = {
  neutral: { background: "#F2F4F6", color: COLORS.muted },
  success: { background: "#E6F5EE", color: "#2D805D" },
  warning: { background: "#FFF4D9", color: "#9A711A" },
  danger: { background: "#FDE8E8", color: "#B65353" },
  info: { background: "#E8F0FC", color: "#4B6EAF" },
  purple: { background: "#F0ECFB", color: "#6B5AA7" },
};
export const Badge = ({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: Tone; dot?: boolean }) => (
  <span className="badge" style={tones[tone]}>{dot && <span className="badge-dot" />} {children}</span>
);

export const statusTone = (status: string): Tone =>
  ["Payé", "Terminé", "Ouvert"].includes(status) ? "success"
    : ["Non payé", "Annulé", "Abandonné"].includes(status) ? "danger"
    : ["Partiel", "Complet"].includes(status) ? "warning"
    : status === "En cours" ? "info" : "neutral";

type Variant = "primary" | "ghost" | "outline" | "soft" | "danger";
const variants: Record<Variant, CSSProperties> = {
  primary: { background: COLORS.navy, color: "white", borderColor: COLORS.navy },
  ghost: { background: "transparent", color: COLORS.muted, borderColor: "transparent" },
  outline: { background: "white", color: COLORS.navy, borderColor: COLORS.border },
  soft: { background: COLORS.tealLight, color: COLORS.teal, borderColor: "transparent" },
  danger: { background: COLORS.coralLight, color: "#C96549", borderColor: "transparent" },
};
// The logo: a graduation cap on a screen, drawn once and reused everywhere.
export const BrandMark = ({ size = 32 }: { size?: number }) => (
  <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1.7" y="2.6" width="20.6" height="14.6" rx="2.4" fill="var(--brand-screen)" stroke="var(--brand-ink)" strokeWidth="1.9" />
      <path d="M12 18.4v2.1M8.6 21.4h6.8" stroke="var(--brand-ink)" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 6.2 18.4 8.7 12 11.2 5.6 8.7z" fill="var(--brand-ink)" />
      <path d="M8.6 9.9v2.2c0 .9 1.5 1.6 3.4 1.6s3.4-.7 3.4-1.6V9.9" stroke="var(--brand-ink)" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M18.4 8.7v3.6" stroke="var(--brand-ink)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  </span>
);

export const Button = ({ children, variant = "primary", icon, onClick, type = "button", disabled = false }: { children: ReactNode; variant?: Variant; icon?: IconName; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) => (
  <button type={type} disabled={disabled} onClick={onClick} className="button" style={variants[variant]}>{icon && <Icon name={icon} size={15} />}{children}</button>
);

export const MetricCard = ({ label, value, note, icon, accent }: { label: string; value: string; note: string; icon: IconName; accent: string }) => (
  <div className="metric-card">
    <div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon" style={{ color: accent, background: `${accent}16` }}><Icon name={icon} size={17} /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-note">{note}</div>
  </div>
);

export const PageHeader = ({ eyebrow, title, description, actionLabel, actionIcon = "plus", onAction, extra }: { eyebrow: string; title: string; description: string; actionLabel?: string; actionIcon?: IconName; onAction?: () => void; extra?: ReactNode }) => (
  <div className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    <div className="page-actions">{extra}{actionLabel && onAction && <Button icon={actionIcon} onClick={onAction}>{actionLabel}</Button>}</div>
  </div>
);

export const Panel = ({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) => (
  <section className={`panel ${className}`}>{title && <div className="panel-header"><h3>{title}</h3>{action}</div>}{children}</section>
);

export const EmptyState = ({ title, text, action }: { title: string; text: string; action?: ReactNode }) => (
  <div className="empty-state"><span className="activity-icon"><Icon name="file" size={16} /></span><div><strong>{title}</strong><span>{text}</span></div>{action}</div>
);

export type Option = string | { value: string; label: string };
export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "time" | "select" | "textarea" | "days";
  options?: Option[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
  min?: number;
};
const optionValue = (option: Option) => (typeof option === "string" ? option : option.value);
const optionLabel = (option: Option) => (typeof option === "string" ? option : option.label);

// Generic form in a modal. Values are strings; "days" fields hold comma-separated day names.
// onSubmit returns true when saved, so the modal closes only on success.
export type Question = { title: string; text?: string; confirmLabel?: string; danger?: boolean };

export function ConfirmDialog({ question, onAnswer }: { question: Question; onAnswer: (yes: boolean) => void }) {
  return <div className="drawer-layer confirm-layer" onClick={() => onAnswer(false)}>
    <div className="confirm-box" role="alertdialog" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
      <span className="confirm-icon" style={{ background: question.danger ? "#FDE8E8" : COLORS.tealLight, color: question.danger ? COLORS.red : COLORS.teal }}>
        <Icon name={question.danger ? "trash" : "warning"} size={19} />
      </span>
      <h2 id="confirm-title">{question.title}</h2>
      {question.text && <p>{question.text}</p>}
      <div className="confirm-actions">
        <Button variant="outline" onClick={() => onAnswer(false)}>Annuler</Button>
        <Button variant={question.danger ? "danger" : "primary"} onClick={() => onAnswer(true)}>{question.confirmLabel ?? "Confirmer"}</Button>
      </div>
    </div>
  </div>;
}

export function FormModal({ title, subtitle, fields, initial, submitLabel, onClose, onSubmit, validate }: {
  title: string; subtitle?: string; fields: FieldDef[] | ((values: Record<string, string>) => FieldDef[]); initial: Record<string, string>; submitLabel: string;
  onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<boolean> | boolean;
  validate?: (values: Record<string, string>) => Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const visibleFields = typeof fields === "function" ? fields(values) : fields;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string) => { setValues((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: "" })); };
  const submit = async () => {
    const next: Record<string, string> = {};
    for (const field of visibleFields) {
      const value = String(values[field.key] ?? "").trim();
      if (field.required && !value) next[field.key] = "Requis";
      else if (field.type === "number" && value && (!Number.isFinite(Number(value)) || Number(value) < (field.min ?? 0))) next[field.key] = `Nombre ≥ ${field.min ?? 0}`;
      else if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) next[field.key] = "Email invalide";
    }
    Object.assign(next, validate?.(values) ?? {});
    if (Object.values(next).some(Boolean)) { setErrors(next); return; }
    setBusy(true);
    const ok = await onSubmit(values);
    setBusy(false);
    if (ok) onClose();
  };
  const input = (field: FieldDef) => {
    const value = values[field.key] ?? "";
    if (field.type === "select") return <select className="field" value={value} onChange={(event) => set(field.key, event.target.value)}>{(field.options ?? []).map((option) => <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>)}</select>;
    if (field.type === "textarea") return <textarea className="field textarea" value={value} onChange={(event) => set(field.key, event.target.value)} placeholder={field.placeholder} />;
    if (field.type === "days") {
      const selected = value ? value.split(",") : [];
      const toggle = (day: string) => set(field.key, DAYS.filter((d) => (d === day ? !selected.includes(d) : selected.includes(d))).join(","));
      return <div className="days-picker">{DAYS.map((day) => <button type="button" key={day} className={selected.includes(day) ? "active" : ""} aria-pressed={selected.includes(day)} onClick={() => toggle(day)}>{day}</button>)}</div>;
    }
    return <input className="field" type={field.type ?? "text"} min={field.type === "number" ? field.min ?? 0 : undefined} value={value} onChange={(event) => set(field.key, event.target.value)} placeholder={field.placeholder} />;
  };
  return <div className="drawer-layer" onClick={onClose}><div className="form-modal" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
    <div className="form-modal-head"><div><span className="eyebrow">{subtitle || "Formulaire"}</span><h2>{title}</h2></div><button className="close-button" onClick={onClose} aria-label="Fermer"><Icon name="close" size={20} /></button></div>
    <div className="form-modal-body"><div className="form-modal-grid">{visibleFields.map((field) => <div className={`form-field ${field.full ? "full" : ""}`} key={field.key}>
      <label>{field.label}{field.required && " *"}</label>
      {input(field)}
      {errors[field.key] && <span className="field-error">{errors[field.key]}</span>}
    </div>)}</div></div>
    <div className="form-modal-foot"><Button variant="outline" onClick={onClose}>Annuler</Button><Button icon="check" disabled={busy} onClick={submit}>{busy ? "Enregistrement…" : submitLabel}</Button></div>
  </div></div>;
}

export function Drawer({ title, eyebrow = "FICHE DÉTAILLÉE", children, onClose }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void }) {
  return <div className="drawer-layer" onClick={onClose}><aside className="drawer" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="close-button" onClick={onClose} aria-label="Fermer"><Icon name="close" size={20} /></button></div>{children}</aside></div>;
}

