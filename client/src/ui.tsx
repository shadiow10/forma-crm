import { useState, useSyncExternalStore } from "react";
import { locale } from "./lang";
import { Mark } from "./Logo";
import { Icon, type IconName } from "./icons";
import type { CSSProperties, ReactNode } from "react";

// Shared building blocks for every page: colors, icons, badges, buttons, panels, forms and drawers.

// Tokens, not fixed colours: an inline style written with var() follows the light/dark theme
// exactly like a stylesheet rule does. The key names are kept, they are used across the pages.
export const COLORS = {
  ink: "var(--ink-2)",
  navy: "var(--navy)",
  navy2: "var(--umber)",
  teal: "var(--accent)",
  tealLight: "var(--accent-soft)",
  coral: "var(--sun)",          // charte: saffron = alert (full group, low attendance)
  coralLight: "var(--warn-bg)",
  sand: "var(--sand)",
  paper: "var(--paper)",
  border: "var(--border)",
  muted: "var(--muted)",
  green: "var(--ok-fg)",
  yellow: "var(--warn-fg)",
  red: "var(--sun)",            // charte: alerts are saffron fills; text stays umber (--bad-fg)
};

// Icons live in ./icons (one family, drawn to the charte). Re-exported here so existing imports keep working.
export { Icon, ICONS, ICON_SIZES } from "./icons";
export type { IconName, IconSize } from "./icons";

export const PALETTE = ["#5B8DEF", "#E4A853", "#B56FCE", "#2A9D8F", "#E57865", "#6A63B8"];
// Charte Classtra: four colours only. The colour a group, course or teacher was given (stored as
// one of PALETTE above) is shown as one of the charte's three accents; the stored value is untouched.
const TINTS = ["#1F6B4F", "#F2A104", "#2A1B12"];
export const tint = (stored?: string | null) => {
  const index = PALETTE.findIndex((colour) => colour.toLowerCase() === (stored ?? "").toLowerCase());
  return TINTS[(index < 0 ? 0 : index) % TINTS.length];
};
export const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]; // stored values, never displayed raw
const avatarColors = ["#D9E9E6", "#FBE0D6", "#E2E4F2", "#F5E8C9", "#DCE8F8"];

export const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
export const initialsBadge = (name: string) => <span className="avatar" style={{ background: avatarColors[name.length % avatarColors.length] }}>{initials(name)}</span>;

// sv-SE formats as YYYY-MM-DD in local time — the same string the offset arithmetic this replaces
// produced, checked against Algiers, UTC and both sides of the date line.
export const todayISO = () => new Date().toLocaleDateString("sv-SE");
export const formatDate = (iso: string | null | undefined, style: "short" | "long" = "short") =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(locale(), style === "long" ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "short", year: "numeric" }) : "—";
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
// Charte status pills: paid = palm + sand, partial = saffron + umber, late/unpaid = umber + saffron,
// anything else outlined. The label is always written: a state is never told by colour alone.
const tones: Record<Tone, CSSProperties> = {
  // Neutral labels (payment method, plain states) wear a light palm tint, not a grey outline.
  neutral: { background: "rgba(31,107,79,.12)", color: "var(--palm)", boxShadow: "inset 0 0 0 1.5px rgba(31,107,79,.3)" },
  success: { background: "var(--palm)", color: "#F3EBDD" },
  warning: { background: "var(--sun)", color: "var(--umber)" },
  // Exception to the charte (validated): alerts such as "Non payé" are brick red.
  danger: { background: "var(--alert)", color: "#fff8ea" },
  info: { background: "rgba(242,161,4,.2)", color: "var(--umber)", boxShadow: "inset 0 0 0 1.5px rgba(242,161,4,.65)" },
  purple: { background: "transparent", color: "var(--ink-2)", boxShadow: "inset 0 0 0 1.5px var(--ink-2)" },
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
export const variants: Record<Variant, CSSProperties> = {
  // Charte: one saffron primary per screen; the other actions are outlined or plain text.
  primary: { background: "var(--sun)", color: "var(--umber)", borderColor: "var(--umber)" },
  ghost: { background: "transparent", color: "var(--ink-2)", borderColor: "transparent" },
  outline: { background: "transparent", color: "var(--ink-2)", borderColor: "var(--ink-2)" },
  soft: { background: "transparent", color: "var(--ink-2)", borderColor: "var(--border)" },
  danger: { background: "transparent", color: "var(--ink-2)", borderColor: "var(--ink-2)" },
};
// The logo (charte): the umber tile on light backgrounds, the saffron tile on dark ones.
// It follows the theme unless the caller knows its background (onDark).
export const BrandMark = ({ size = 32, onDark }: { size?: number; onDark?: boolean }) => {
  const dark = useTheme() === "dark";
  return <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true"><Mark size={size} onDark={onDark ?? dark} /></span>;
};

export const Button = ({ children, variant = "primary", icon, onClick, type = "button", disabled = false, small = false }: { children: ReactNode; variant?: Variant; icon?: IconName; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; small?: boolean }) => (
  <button type={type} disabled={disabled} onClick={onClick} className={`button button-${variant}${small ? " small" : ""}`} style={variants[variant]}>{icon && <Icon name={icon} size={small ? 13 : 15} />}{children}</button>
);

// Charte KPI card: umber 1.5px border, figure in Fraunces. The key figure of a screen is
// highlighted (umber fill, sand text). `accent` is kept for the callers but no longer paints.
export const MetricCard = ({ label, value, note, icon, highlight = false }: { label: string; value: string; note: string; icon: IconName; accent?: string; highlight?: boolean }) => (
  <div className={`metric-card${highlight ? " hi" : ""}`}>
    <div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon"><Icon name={icon} size={17} /></span></div>
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

// "Simple and guided" dashboard: one card per record instead of a wide table row. The name comes
// first and big, then two short lines, the status pill, and one clear button to open it.
export const RecordCard = ({ title, lines = [], status, avatar, extra, actions, onOpen, openLabel }: {
  title: ReactNode; lines?: ReactNode[]; status?: ReactNode; avatar?: ReactNode; extra?: ReactNode; actions?: ReactNode; onOpen?: () => void; openLabel?: string;
}) => (
  <article className={`record-card${onOpen ? " clickable" : ""}`} onClick={onOpen}>
    {avatar && <div className="record-avatar">{avatar}</div>}
    <div className="record-main">
      <h3 className="record-title">{title}</h3>
      {lines.filter((line) => line !== null && line !== undefined && line !== false && line !== "").map((line, index) => <p className="record-line" key={index}>{line}</p>)}
    </div>
    {(status || extra) && <div className="record-side">{status}{extra}</div>}
    {(actions || (onOpen && openLabel)) && <div className="record-actions" onClick={(event) => event.stopPropagation()}>
      {actions}
      {onOpen && openLabel && <button type="button" className="record-open" onClick={onOpen}>{openLabel}<Icon name="chevron" size={16} /></button>}
    </div>}
  </article>
);
export const RecordList = ({ children, label }: { children: ReactNode; label?: string }) => <div className="record-list" role="list" aria-label={label}>{children}</div>;

export const EmptyState = ({ title, text, action }: { title: string; text: string; action?: ReactNode }) => (
  <div className="empty-state"><span className="activity-icon"><Icon name="tray" size={16} /></span><div><strong>{title}</strong><span>{text}</span></div>{action}</div>
);

export type Option = string | { value: string; label: string };
export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "time" | "select" | "textarea" | "days" | "checks"; // checks: several options, stored "a,b,c"
  options?: Option[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
  min?: number;
};

// Light or dark, remembered per browser. The dark rules only cover the public site and the
// login screen; the signed-in app stays light, so the attribute is harmless there.
// ponytail: no "follow the system" third state — the OS preference is only the first default.
type Theme = "light" | "dark";
const storedTheme = (): Theme | null => {
  try {
    const value = localStorage.getItem("classtra-theme");
    return value === "light" || value === "dark" ? value : null;
  } catch { return null; }
};
// The dark theme was removed (redesign): the site and the app are always light. storedTheme is
// kept so an old saved "dark" is simply ignored.
void storedTheme;
let theme: Theme = "light";
const themeListeners = new Set<() => void>();
const applyTheme = () => document.documentElement.setAttribute("data-theme", theme);
applyTheme();

export function setTheme(next: Theme) {
  void next;
  theme = "light";
  try { localStorage.setItem("classtra-theme", next); } catch { /* private window: the choice just doesn't stick */ }
  applyTheme();
  for (const listener of themeListeners) listener();
}
const themeSnapshot = () => theme;
export const useTheme = () => useSyncExternalStore((listener: () => void) => { themeListeners.add(listener); return () => { themeListeners.delete(listener); }; }, themeSnapshot, themeSnapshot);

export function ThemeToggle({ labels }: { labels: { dark: string; light: string } }) {
  const current = useTheme();
  const next = current === "dark" ? "light" : "dark";
  return <button className="pref-button" type="button" title={labels[next]} aria-label={labels[next]} onClick={() => setTheme(next)}>
    <Icon name={current === "dark" ? "sun" : "moon"} size={17} />
  </button>;
}

export const Spinner = () => <span className="spinner" aria-hidden="true" />;
