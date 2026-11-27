// Classtra icon family — "trait de sable".
//
// Each glyph started from a Lucide reference found with the Icon MCP server, then was redrawn
// to the charte (section 7, annexe D) so the whole set reads as one hand:
//   · 24 × 24 grid, drawing kept inside 3 → 21 (optical squares may touch 3.5 / 20.5);
//   · one stroke weight (1.8 at 20 px and up, slightly heavier when drawn smaller — see Icon.tsx);
//   · round caps and joins, no fills except the "perle";
//   · every container uses the same 2.5 corner radius (1.5 for small parts);
//   · heads are r 3.5 circles, arrow heads are 5.5 legs at 45°;
//   · the "perle" — the green pearl of the logo, "tout est en ordre" — is the family's signature:
//     a single solid dot (r 1.35) that marks the meaningful point of an icon (clasp, keyhole,
//     today, tassel, exclamation point…). At most one or two per glyph, never decorative.
//
// Add a glyph: draw it on the same grid, reuse rr()/ring(), keep it to the fewest strokes that read
// at 15 px, and give it a perle only if it has a natural "point".

export type Glyph = { d: string; dots?: readonly (readonly [number, number])[] };

/** Rounded rectangle as path data. */
const rr = (x: number, y: number, w: number, h: number, r = 2.5) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}z`;

/** Circle as path data. */
const ring = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0z`;

/** Person: r 3.5 head + shoulders, the one silhouette every people icon shares. */
const person = (cx: number, top = 4.5, bottom = 20.5, half = 6) =>
  `${ring(cx, top + 3.5, 3.5)}M${cx - half} ${bottom}c0-3.6 2.7-6 ${half} -6s${half} 2.4 ${half} 6`;

export const GLYPHS = {
  // ── Navigation ────────────────────────────────────────────────────────────
  /** Tableau de bord: three tiles and one round "perle" tile. */
  grid: { d: `${rr(3.5, 3.5, 7, 7)}${rr(13.5, 3.5, 7, 7)}${rr(3.5, 13.5, 7, 7)}${ring(17, 17, 3.5)}` },
  /** Étudiants: the logo's cap, tassel ending in the perle. */
  graduation: { d: "M12 4.5 21 9l-9 4.5L3 9zM6.5 11.5V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.5M21 9v5", dots: [[21, 16.4]] },
  /** Présences: clipboard with a tick. */
  roll: { d: `${rr(4.5, 4.5, 15, 16.5)}M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M8.5 13.2l2.3 2.3 4.7-5` },
  /** Paiements: wallet, clasp is the perle. */
  wallet: { d: `${rr(3, 7, 18, 13.5)}M5.5 7l9.6-3.2a1.5 1.5 0 0 1 2 1.4V7M21 11.5h-3.5a2.25 2.25 0 0 0 0 4.5H21`, dots: [[17.6, 13.75]] },
  /** Inscriptions: page being signed. */
  enrol: { d: "M18 10V5.5A2.5 2.5 0 0 0 15.5 3h-8A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21H11M8.5 7.5h6M8.5 11.5h4M14 21l.6-2.6 4.6-4.6a1.5 1.5 0 0 1 2.1 2.1l-4.6 4.6z" },
  /** Formations: the logo's open book. */
  book: { d: "M12 6.5C10.4 5 8 4.5 3.5 4.5v13c4.5 0 6.9.5 8.5 2 1.6-1.5 4-2 8.5-2v-13C16 4.5 13.6 5 12 6.5zM12 6.5v13" },
  /** Formateurs: person beside a small board. */
  teacher: { d: `${person(8, 4.5, 20.5, 5.5)}${rr(13.5, 3.5, 7.5, 7, 1.5)}M16 7h3M13.5 14.5h4.5` },
  /** Groupes: two people, the second behind. */
  users: { d: `${person(9)}M15.5 4.9a3.5 3.5 0 0 1 0 6.2M17.8 14.9c1.9.8 3.2 2.8 3.2 5.6` },
  /** Planning: calendar, today is the perle. */
  calendar: { d: `${rr(3.5, 5, 17, 15.5)}M3.5 10h17M8 3v4M16 3v4`, dots: [[15.75, 15.25]] },
  /** Salles: door, handle is the perle. */
  door: { d: "M4 21h16M6.5 21V5.5A2.5 2.5 0 0 1 9 3h6a2.5 2.5 0 0 1 2.5 2.5V21", dots: [[14.5, 12.5]] },
  /** École / centre: pediment building, round window is the perle. */
  building: { d: "M3.5 21h17M5.5 21V9.5L12 4l6.5 5.5V21M10 21v-3.5a2 2 0 0 1 4 0V21", dots: [[12, 11.25]] },
  /** Statistiques: rounded axis + three bars. */
  chart: { d: "M4 4v13.5A2.5 2.5 0 0 0 6.5 20H20M9 16v-4M13 16V7.5M17 16v-6.5" },
  /** Certificats: rosette, the perle at its heart. */
  award: { d: `${ring(12, 9, 5.5)}M8.7 13.4 7.5 21l4.5-2.6 4.5 2.6-1.2-7.6`, dots: [[12, 9]] },
  /** Paramètres: two sliders — calmer than a cog at small sizes. */
  settings: { d: `M4 7h8.5M18.5 7H20M4 17h1.5M11.5 17H20${ring(15.5, 7, 2.5)}${ring(8.5, 17, 2.5)}` },

  // ── Actions ───────────────────────────────────────────────────────────────
  plus: { d: "M12 5v14M5 12h14" },
  close: { d: "M6.5 6.5l11 11M17.5 6.5l-11 11" },
  check: { d: "M5 12.5l4.5 4.5L19 7" },
  edit: { d: "M4 20l.9-4.1L15.6 5.2a2.1 2.1 0 0 1 3 3L7.9 19.1zM13.6 7.2l3 3M13 20h7" },
  trash: { d: "M4 6.5h16M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5M6 6.5l.9 12.2A2.5 2.5 0 0 0 9.4 21h5.2a2.5 2.5 0 0 0 2.5-2.3L18 6.5M10 10.5v6M14 10.5v6" },
  download: { d: "M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 20h15" },
  upload: { d: "M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 20h15" },
  print: { d: `M7 9V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V9M7 17.5H5.5A2.5 2.5 0 0 1 3 15v-3.5A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5V15a2.5 2.5 0 0 1-2.5 2.5H17${rr(7, 14, 10, 7, 1.5)}`, dots: [[17.25, 12]] },
  scan: { d: "M4 8.5v-2A2.5 2.5 0 0 1 6.5 4h2M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2M7.5 12h9" },
  search: { d: `${ring(10.5, 10.5, 6.5)}M15.4 15.4 20 20` },
  filter: { d: "M4 6.5h16M7 12h10M10 17.5h4" },
  funnel: { d: "M4 5h16l-6 7.2v5.3l-4 2V12.2z" },
  logout: { d: "M10 20.5H6.5A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5H10M15.5 16.5 20 12l-4.5-4.5M20 12H9.5" },
  userplus: { d: `${person(9)}M18 8v6M15 11h6` },
  menu: { d: "M4 7h16M4 12h16M4 17h10" },

  // ── Direction ─────────────────────────────────────────────────────────────
  arrow: { d: "M5 12h14M13.5 6.5 19 12l-5.5 5.5" },
  chevron: { d: "m9.5 6 6 6-6 6" },
  chevronDown: { d: "m6 9.5 6 6 6-6" },
  dots: { d: "", dots: [[5.5, 12], [12, 12], [18.5, 12]] },

  // ── Contact & information ─────────────────────────────────────────────────
  phone: { d: "M5.5 4h3.3l1.8 4.6-2.3 1.4a11 11 0 0 0 5.7 5.7l1.4-2.3 4.6 1.8v3.3a2 2 0 0 1-2 2A16 16 0 0 1 3.5 6a2 2 0 0 1 2-2z" },
  mail: { d: `${rr(3, 5, 18, 14)}M3.8 7.5 12 13l8.2-5.5` },
  pin: { d: `M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z${ring(12, 10, 2.5)}` },
  globe: { d: `${ring(12, 12, 9)}M3 12h18M12 3c2.4 2.6 3.7 5.6 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.6-3.7-9S9.6 5.6 12 3z` },
  clock: { d: `${ring(12, 12, 9)}M12 7.5V12l3 2` },
  bell: { d: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 21h4" },
  file: { d: "M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8zM14 3v5h5M8.5 13h7M8.5 17h4.5" },
  checklist: { d: "M4 7l1.6 1.6L8.8 5.4M4 16.5l1.6 1.6 3.2-3.2M12 7h8M12 16.5h8" },
  /** Empty states: an open tray. */
  tray: { d: "M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5M5.8 6.2 3.5 13.5V18a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-4.5l-2.3-7.3A2.5 2.5 0 0 0 15.8 4.5H8.2a2.5 2.5 0 0 0-2.4 1.7z" },

  // ── States ────────────────────────────────────────────────────────────────
  checkCircle: { d: `${ring(12, 12, 9)}M8 12.5l3 3 5-6` },
  info: { d: `${ring(12, 12, 9)}M12 11v5.5`, dots: [[12, 7.9]] },
  warning: { d: "M10.3 4.4 3.2 17.3A2.4 2.4 0 0 0 5.3 21h13.4a2.4 2.4 0 0 0 2.1-3.7L13.7 4.4a2 2 0 0 0-3.4 0zM12 9.5v4.5", dots: [[12, 17.2]] },
  error: { d: `${ring(12, 12, 9)}M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6` },
  lock: { d: `${rr(5, 10.5, 14, 10.5)}M8 10.5V8a4 4 0 0 1 8 0v2.5`, dots: [[12, 15.75]] },
  shield: { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5" },
  spark: { d: "M11 4c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5C8.7 9.9 10.4 8.2 11 4z", dots: [[18.5, 18.5]] },
  sun: { d: `${ring(12, 12, 4)}M12 3v1.5M12 19.5V21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M3 12h1.5M19.5 12H21M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1` },
  moon: { d: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof GLYPHS;
