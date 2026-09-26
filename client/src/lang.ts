import { useSyncExternalStore } from "react";

// Which language the reader chose. A module of its own so both the copy files and the shared
// UI helpers can read it without importing each other.
export type Lang = "fr" | "en" | "ar";

const stored = (): Lang | null => {
  try {
    const value = localStorage.getItem("classtra-lang");
    return value === "fr" || value === "en" || value === "ar" ? value : null;
  } catch { return null; }
};
let current: Lang = stored() ?? (navigator.language?.startsWith("ar") ? "ar" : navigator.language?.startsWith("en") ? "en" : "fr");
const listeners = new Set<() => void>();

export function setLang(next: Lang) {
  current = next;
  try { localStorage.setItem("classtra-lang", next); } catch { /* private window: the choice just doesn't stick */ }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => current;

export const useLang = () => useSyncExternalStore(subscribe, snapshot, snapshot);

// For Intl: Arabic dates are written with Latin digits in Algeria.
export const locale = () => (current === "ar" ? "ar-DZ" : current);
