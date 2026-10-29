// What the ranking needs of a result: the strings it can be found by and how recent it is.
export interface Rankable { keys: string[]; recent?: number }

// 0 for a prefix of the whole string, 1 for a prefix of one of its words, 2 for any other substring, 3 for no match.
const tier = (key: string, q: string): number =>
  key.startsWith(q) ? 0 : key.split(/[\s.\-_/@:]+/).some((w) => w.startsWith(q)) ? 1 : key.includes(q) ? 2 : 3;

// Matches ordered by the best tier of any key, ties by the more recent first; an empty query matches nothing.
export function rank<T extends Rankable>(query: string, items: T[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items
    .map((item) => ({ item, tier: Math.min(...item.keys.map((k) => tier(k.toLowerCase(), q))) }))
    .filter((x) => x.tier < 3)
    .sort((a, b) => a.tier - b.tier || (b.item.recent ?? 0) - (a.item.recent ?? 0))
    .map((x) => x.item);
}
