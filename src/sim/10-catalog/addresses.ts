// economy.md, Addresses and internet: the numbers behind addresses, home line reconnects and mail reputation.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { Product, Profile } from "../30-customers/customers";
import type { Spec } from "./products";

// economy.md, Addresses and internet.
export const RECONNECT_HOUR = 3;
export const RECONNECT_MINUTES = 3;
// Customers who run a business notice the nightly reconnect at once and lose patience with it.
export const NOTICES_RECONNECT: Profile[] = ["smallBiz", "agency", "office", "onlineShop", "enterprise"];
// A static (business) home line comes with a /29: the router's address and four more. More cost this much a month each.
export const STATIC_LINE_ADDRESSES = 5;
export const LINE_EXTRA_V4 = 3;
export const IPV6_FROM = { dc: 2010, home: 2013 };
export const IPV6_MONTHLY = 0.1;
export const REP = { fresh: 80, staticLine: 70, dynamic: 20, listAt: 30, clearAt: 50, perThousand: 5, recover: 1, delist: 20 };
export const DELIST_HOURS = 24;
// Daily chance a mail customer behind a listed address writes in about bounced mail.
export const BOUNCE_CHANCE = 0.01;
// Mails a day from a compromised panel host and from a spamming customer's service, in thousands.
export const SPAM = { hacked: 12, shady: 2 };
export const LIR_FEES = { signup: 2000, yearly: 1400 };
// One-off fee a datacenter provider charges to announce an own block under the company's AS from its routers.
export const PROVIDER_ROUTING_SETUP = 250;
// Lines whose services need an address of their own. Only web hosting sits behind a shared address, so a dynamic line sells
// nothing else; DNS and storage share their host's address but need it static.
export const OWN_ADDRESS: Product[] = ["vps", "gameServer", "cloud", "vpn", "colocation", "dedicated", "gpu"];
// Reputation points an address loses for each abuse report about content on it.
export const ABUSE_HIT: Record<string, number> = { "abuse.spam": 10, "abuse.attack": 5, "notice.phishing": 15, "notice.spam": 10, "notice.movie": 3, "notice.music": 3, "notice.youtuber": 3 };

// economy.md: a provider's IPv4 per month, flat until RIPE's last /8 (2012), rising to run-out (2019) and the 2020s market.
const V4_CURVE: [number, number][] = [[2011, 1], [2019, 2], [2021, 3], [2024, 3.5]];
const curve = (points: [number, number][], year: number): number => {
  if (year <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [y1, p1] = points[i - 1], [y2, p2] = points[i];
    if (year <= y2) return p1 + ((p2 - p1) * (year - y1)) / (y2 - y1);
  }
  return points[points.length - 1][1];
};
// Volume discounts on a provider's addresses: the share of the price paid once the company rents this many.
export const V4_TIERS: [number, number][] = [[1, 1], [17, 0.8], [65, 0.6], [257, 0.45]];
export const providerV4 = (year: number, count = 1): number =>
  Math.round(curve(V4_CURVE, year) * V4_TIERS.filter(([from]) => Math.max(1, count) >= from).at(-1)![1] * 100) / 100;
// What customers pay for a dedicated IPv4 a month: half again the provider's price, at least €2.
export const retailV4 = (year: number): number => Math.max(2, Math.round(providerV4(year) * 1.5 * 2) / 2);
// One-time price per address on the transfer market once the free pool ran out.
const MARKET_CURVE: [number, number][] = [[2014, 7], [2016, 10], [2018, 17], [2020, 22], [2021, 40], [2022, 50], [2024, 35], [2026, 30]];
export const transferPrice = (year: number): number => Math.round(curve(MARKET_CURVE, year));
// RIPE's allocation to a new LIR: a /21 until the last /8 (September 2012), one /22 until run-out (November 2019), a /24
// from the waiting list after.
const LAST_8 = 2012.7, RUN_OUT = 2019.9;
export const freeBlock = (hour: number): { size: number; prefix: number } | null => {
  const y = yearOf(hour) + (hour % 8760) / 8760;
  return y < LAST_8 ? { size: 2048, prefix: 21 } : y < RUN_OUT ? { size: 1024, prefix: 22 } : { size: 256, prefix: 24 };
};

// Customers who need their own IPv4 or IPv6, from the order's key: SSL before SNI and mail senders on web hosting, every
// game server, and a share needing IPv6 that grows from 2012.
const DEDICATED_WEB: Partial<Record<Profile, number>> = { smallBiz: 0.15, agency: 0.15, office: 0.2, onlineShop: 0.6, enterprise: 0.3 };
const sniFactor = (year: number) => (year <= 2010 ? 1 : Math.max(0, 1 - (year - 2010) / 6));
export const ipv6Share = (year: number): number => Math.min(0.4, Math.max(0, 0.03 * (year - 2011)));
const V6_LINES: Product[] = ["webHosting", "vps", "gameServer", "cloud", "dedicated", "colocation", "gpu"];
export function withAddressNeeds(seed: number, key: number, profile: Profile, product: Product, spec: Spec, year: number): Spec {
  const r = hashRng(seed, key, 241);
  const v4 = product === "gameServer" || (product === "webHosting" && rand(r) < (DEDICATED_WEB[profile] ?? 0) * sniFactor(year));
  const v6 = V6_LINES.includes(product) && rand(r) < ipv6Share(year);
  return { ...spec, ...(v4 && { ipv4: 1 }), ...(v6 && { ipv6: true }) };
}

