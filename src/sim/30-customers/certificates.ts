// GDD, Domain registration: the registrar partner also resells SSL certificates, billed with the domains. A web hosting
// customer takes one with a new order or when they ask for the padlock. Numbers in economy.md, Sales and quotes (SSL certificates).
import { hashRng, rand } from "../00-core/rng";
import { dateOf, yearOf } from "../00-core/time";
import { marketPrice, sizeSpec } from "../10-catalog/products";
import { offerPrice } from "../30-market/spec";
import type { GameState } from "../50-state";
import { listed } from "../80-business/website";
import { provisionService } from "../90-actions/clusters";
import { profileStats } from "../40-support/tickets";
import type { SimEvent } from "../88-tick/tick";
import type { Profile, Service } from "./customers";

// Share of customers who take a certificate at the market price: with a new web hosting order, and after asking for one.
export const CERT_SHARE = { order: 0.25, asked: 0.8 };
// The year certificates turn free (the Let's Encrypt stand-in), and the years a medium budget's paid DV share takes to reach none.
export const FREE_SSL_YEAR = 2016;
const DV_FADE_YEARS = 8;

// The size of the SSL line a profile buys: offices OV, shops EV until browsers drop the EV bar in 2020, enterprises EV, everyone else DV.
export function certSize(p: Profile, year: number): number {
  if (p === "enterprise" || (p === "onlineShop" && year < 2020)) return 2;
  return p === "office" || p === "onlineShop" ? 1 : 0;
}
// Share of a profile's buyers who still pay for a certificate in a year: once certificates are free a low budget never
// does and a medium budget's DV share falls to none; OV and EV buyers keep paying.
export function paidShare(p: Profile, year: number): number {
  if (year < FREE_SSL_YEAR || certSize(p, year) > 0) return 1;
  return profileStats(p).budget === "low" ? 0 : Math.max(0, 1 - (year - FREE_SSL_YEAR + 1) / DV_FADE_YEARS);
}

export const certificateOf = (s: GameState, domain: string): Service | undefined =>
  s.services.find((v) => v.product === "ssl" && v.endedAt === null && v.label === domain);

// Offers the web hosting customer a certificate for their domain at the player's yearly rate; a higher rate lowers the share.
// Returns the new service's id when they took it.
export function offerCertificate(s: GameState, hosting: Service, share: number): string | null {
  const c = s.customers.find((x) => x.id === hosting.customerId), domain = hosting.domain ?? hosting.label;
  if (!c || !s.registrar || !listed(s, "ssl") || certificateOf(s, domain)) return null;
  const year = yearOf(s.hour), spec = sizeSpec("ssl", certSize(c.profile, year), year), market = marketPrice("ssl", spec, year, "basic");
  const price = offerPrice(s, "ssl", spec);
  if (rand(hashRng(s.seed, s.nextId, 307)) >= share * paidShare(c.profile, year) * Math.min(1, market / Math.max(price, 0.01))) return null;
  const done = provisionService(s, hosting.customerId, "ssl", { label: domain, price, spec });
  return done.ok ? done.id! : null;
}

// On 1 January from the free year, each paid DV certificate stays with the share of this year's paid buyers among last
// year's; the others end, as their customers move to the free certificate.
export function certificatesTick(s: GameState): SimEvent[] {
  const d = dateOf(s.hour), year = d.getUTCFullYear();
  if (year < FREE_SSL_YEAR || d.getUTCMonth() !== 0 || d.getUTCDate() !== 1 || d.getUTCHours() !== 0) return [];
  let n = 0;
  s.services = s.services.map((v) => {
    const c = v.product === "ssl" && v.endedAt === null && !v.spec.cert && s.customers.find((x) => x.id === v.customerId);
    if (!c) return v;
    const was = paidShare(c.profile, year - 1), keep = was > 0 ? paidShare(c.profile, year) / was : 0;
    if (rand(hashRng(s.seed, year, Number(v.id.replace(/\D/g, "")) || 0, 311)) < keep) return v;
    n++;
    return { ...v, endedAt: s.hour };
  });
  return n ? [{ app: "Books", key: "event.certificatesFree", params: { n } }] : [];
}
