// Student packs, sold on top of a plan (migration 0027): the public site sells them with an order,
// a director asks for one from Settings. More than 1 000 extra students is on quote.
export const EXTRA_PACKS = [{ students: 500, price: 5000 }, { students: 1000, price: 10000 }] as const;
