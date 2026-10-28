// mulberry32; the whole generator is one uint32, so it saves with the game.
export interface Rng {
  s: number;
}

export const createRng = (seed: number): Rng => ({ s: seed >>> 0 });

export function rand(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const chance = (r: Rng, p: number): boolean => rand(r) < p;

// Binomial draw; normal approximation once n is large enough.
export function binomial(r: Rng, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n < 40) {
    let k = 0;
    for (let i = 0; i < n; i++) if (rand(r) < p) k++;
    return k;
  }
  const mean = n * p, sd = Math.sqrt(n * p * (1 - p));
  const z = Math.sqrt(-2 * Math.log(1 - rand(r))) * Math.cos(2 * Math.PI * rand(r));
  return Math.max(0, Math.min(n, Math.round(mean + sd * z)));
}

// A generator hashed from integers, for draws that must not consume the game's rng.
export function hashRng(...xs: number[]): Rng {
  let h = 0x811c9dc5;
  for (const x of xs) h = Math.imul(h ^ (x >>> 0), 0x01000193) ^ (h >>> 15);
  const r = createRng(h);
  rand(r);
  return r;
}
