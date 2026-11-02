// GDD, Domain registration: SSL certificates are bought from the certificate authority and resold to web hosting customers.
// A customer who wants one books it in the shop once it sells SSL, and before that writes in for a quote (30-market/sales.ts,
// expansions). Numbers in economy.md, Sales and quotes (SSL certificates).
import { hashRng, rand } from "../00-core/rng";
import { dateOf, yearOf } from "../00-core/time";
import { marketPrice, sizeSpec, type Spec } from "../10-catalog/products";
import { offerPrice } from "../30-market/spec";
import type { GameState } from "../50-state";
import { listed } from "../80-business/website";
import { provisionService } from "../90-actions/clusters";
import { createTicket, isFinal, profileStats } from "../40-support/tickets";
import { includes, shopById } from "../10-catalog/shops";
import type { SimEvent } from "../88-tick/tick";
import type { Profile, Service } from "./customers";

// Share of a profile's web hosting customers who want a paid certificate at the market price with a new order; a customer
// who asks how to get the padlock wants one CERT_ASKED times as often. Small sites rarely care; offices, shops and
// enterprises need the OV or EV one.
export const CERT_WANT: Record<Profile, number> = {
  private: 0.01, gamer: 0, hobbyDev: 0.02, soleProp: 0.03, smallBiz: 0.04, agency: 0.08, reseller: 0.03, office: 0.3, onlineShop: 0.6, enterprise: 0.8,
};
export const CERT_ASKED = 3;
// The topic of the upgrade ticket that asks for a certificate.
export const CERT_TOPIC = "cert";
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

// Whether customers can book a certificate themselves: the shop runs, sells SSL and lists it on the website.
// The module check is 80-business/shop.ts hasModule, which this file cannot import without a cycle.
export function shopSellsSsl(s: GameState): boolean {
  const v = s.shop.variant && shopById(s.shop.variant);
  if (!v || s.hour < s.shop.readyAt || s.shop.stock.ssl === "off" || !listed(s, "ssl")) return false;
  return includes(v, "ssl", yearOf(s.hour)) || (s.shop.modules.ssl ?? Infinity) <= s.hour;
}
// The certificate a profile would buy now.
export const certSpec = (p: Profile, year: number): Spec => sizeSpec("ssl", certSize(p, year), year);

// A web hosting customer who may want a certificate: with the shop selling SSL they book it there, otherwise they open an
// upgrade ticket asking for a quote. Returns the new certificate's id when they booked one.
export function wantCertificate(s: GameState, hosting: Service, share: number): string | null {
  if (shopSellsSsl(s)) return offerCertificate(s, hosting, share);
  const c = s.customers.find((x) => x.id === hosting.customerId), domain = hosting.domain ?? hosting.label;
  if (!c || certificateOf(s, domain) || s.tickets.some((t) => t.serviceId === hosting.id && t.topic === CERT_TOPIC && !isFinal(t))) return null;
  if (rand(hashRng(s.seed, s.nextId, 317)) < share * paidShare(c.profile, yearOf(s.hour))) createTicket(s, c, "upgrade", hosting.id, CERT_TOPIC);
  return null;
}

// While the shop sells SSL, offers the web hosting customer a certificate for their domain at the player's yearly rate; a
// higher rate lowers the share.
// Returns the new service's id when they took it.
export function offerCertificate(s: GameState, hosting: Service, share: number): string | null {
  const c = s.customers.find((x) => x.id === hosting.customerId), domain = hosting.domain ?? hosting.label;
  if (!c || !s.registrar || !shopSellsSsl(s) || certificateOf(s, domain)) return null;
  const year = yearOf(s.hour), spec = certSpec(c.profile, year), market = marketPrice("ssl", spec, year, "basic");
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
