import type { SchoolData } from "./queries";

// A refresh shows the school at once from what this tab already had, then the server's copy
// replaces it a moment later (data.tsx). sessionStorage: kept only for this tab, gone when it closes,
// and cleared on sign-out (auth.ts). Anything that goes wrong with it (private mode, storage full)
// just means waiting for the server, as before.
const CACHE = "classtra-school-";

export const readSchoolCache = (schoolId: number): SchoolData | undefined => {
  try { const raw = sessionStorage.getItem(CACHE + schoolId); return raw ? JSON.parse(raw) as SchoolData : undefined; } catch { return undefined; }
};
export const writeSchoolCache = (schoolId: number, data: SchoolData) => {
  try { sessionStorage.setItem(CACHE + schoolId, JSON.stringify(data)); } catch { /* full or blocked: the next refresh waits */ }
};
export const clearSchoolCache = () => {
  try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(CACHE)) sessionStorage.removeItem(key); } catch { /* blocked */ }
};
