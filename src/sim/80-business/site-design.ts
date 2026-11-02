import { hashRng, rand, type Rng } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { Profile } from "../30-customers/customers";
import type { GameState } from "../50-state";

export type SchemeVariant = "light" | "dark" | "pastel" | "loud";
export interface SiteDesign { layout: string; scheme: { hue: number; variant: SchemeVariant }; blocks: string[]; period: number }

const PERSONAL_LAYOUTS = ["classic", "frames", "centered", "sidebar"];
const BUSINESS_LAYOUTS = ["corporate", "brochure", "hero", "split"];
const VARIANTS: SchemeVariant[] = ["light", "dark", "pastel", "loud"];
const PERSONAL: Profile[] = ["private", "gamer", "hobbyDev"];

const PROFILE_BLOCKS: Record<Profile, string[]> = {
  private: ["photos", "guestbook", "familyNews", "counter"],
  gamer: ["roster", "matches", "serverAddr", "teamspeak"],
  hobbyDev: ["projects", "badges", "blog"],
  soleProp: ["services", "hours", "map", "contactForm", "priceList"],
  smallBiz: ["services", "hours", "map", "contactForm", "priceList"],
  reseller: ["services", "priceList", "contactForm"],
  agency: ["caseStudies", "clientLogos", "letsTalk"],
  office: ["consultHours", "appointment", "privacy"],
  onlineShop: ["productGrid", "cart", "checkout", "sale"],
  enterprise: ["press", "investors", "careers", "handshake"],
};

// The first two blocks of each period are the toggles the uniqueness bits switch; random picks never draw them.
const PERIOD_BLOCKS = [
  ["marquee", "webring", "counter", "guestbook", "construction", "bestViewed", "midi", "links"],
  ["like", "widgets", "tagCloud", "rss", "blogPosts", "flashIntro"],
  ["cookieBanner", "hero", "social", "newsletter", "testimonials", "team"],
  ["chatBubble", "darkToggle", "cookieWall", "pricing", "appBadges"],
];
const TOP = ["marquee", "construction", "flashIntro", "hero"];

export const periodOf = (year: number): number => (year < 2009 ? 0 : year < 2014 ? 1 : year < 2020 ? 2 : 3);

function pick(r: Rng, pool: string[], n: number): string[] {
  const left = [...pool], out: string[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rand(r) * left.length), 1)[0]);
  return out;
}

// A customer's site look, derived so it needs no saved state: stable within a period, redrawn when the period changes.
// Positions 0..63 in s.customers get distinct layout, variant and toggle combinations, so the first sites never repeat.
export function siteDesign(s: GameState, customerId: string): SiteDesign {
  const pos = s.customers.findIndex((c) => c.id === customerId);
  const profile = s.customers[pos]?.profile ?? "private";
  const period = periodOf(yearOf(s.hour));
  const r = hashRng(Number(customerId.replace(/\D/g, "")) || 0, period, 0x5173);
  const layouts = PERSONAL.includes(profile) ? PERSONAL_LAYOUTS : BUSINESS_LAYOUTS;
  const [t1, t2, ...rest] = PERIOD_BLOCKS[period];
  let li: number, vi: number, bits: number;
  if (pos >= 0 && pos < 64) {
    const k = (pos + 5 * period) % 16;
    li = k % 4; vi = k >> 2; bits = pos >> 4;
  } else {
    li = Math.floor(rand(r) * 4); vi = Math.floor(rand(r) * 4); bits = Math.floor(rand(r) * 4);
  }
  const core = pick(r, PROFILE_BLOCKS[profile].filter((b) => b !== t1 && b !== t2), 2);
  const extra = pick(r, rest.filter((b) => !core.includes(b)), 2);
  const blocks = ["about", ...core, ...extra, ...(bits & 1 ? [t1] : []), ...(bits & 2 ? [t2] : [])];
  blocks.sort((a, b) => Number(TOP.includes(b)) - Number(TOP.includes(a)));
  return { layout: layouts[li], scheme: { hue: Math.floor(rand(r) * 360), variant: VARIANTS[vi] }, blocks, period };
}
