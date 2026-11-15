// Student packs, sold on top of a plan (migration 0027): the public site sells them with an order,
// a director asks for one from Settings. More than 1 000 extra students is on quote.
export const EXTRA_PACKS = [{ students: 500, price: 5000 }, { students: 1000, price: 10000 }] as const;

// One offer sold by duration; the id is what orders.billing stores (0027). Prices in DA; the names
// live in i18n.tsx (site) and appCopy.tsx (Settings). Every plan covers 500 students, unlimited users.
export type PlanId = "monthly" | "semester" | "yearly";
export const PLANS: { id: PlanId; price: number; months: number; featured?: boolean }[] = [
  { id: "monthly", price: 10000, months: 1 },
  { id: "semester", price: 60000, months: 6 },
  { id: "yearly", price: 89900, months: 12, featured: true },
];
// The free trial (0033): 15 days, then 3 days of grace before the school turns read-only.
export const TRIAL_DAYS = 15;
