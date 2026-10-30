// GDD, Domain registration: the registrar partner also resells SSL certificates, billed with the domains. A web hosting
// customer takes one with a new order or when they ask for the padlock, while the website lists them and certificates still
// cost money. Numbers in economy.md, Sales and quotes (SSL certificates).
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { marketPrice, sizeSpec } from "../10-catalog/products";
import { offerPrice } from "../30-market/spec";
import type { GameState } from "../50-state";
import { listed } from "../80-business/website";
import { provisionService } from "../90-actions/clusters";
import type { Service } from "./customers";

// Share of customers who take a certificate at the market price: with a new web hosting order, and after asking for one.
export const CERT_SHARE = { order: 0.25, asked: 0.8 };

export const certificateOf = (s: GameState, domain: string): Service | undefined =>
  s.services.find((v) => v.product === "ssl" && v.endedAt === null && v.label === domain);

// Offers the web hosting customer a certificate for their domain at the player's yearly rate; a higher rate lowers the share.
// Returns the new service's id when they took it.
export function offerCertificate(s: GameState, hosting: Service, share: number): string | null {
  const year = yearOf(s.hour), spec = sizeSpec("ssl", 0, year), market = marketPrice("ssl", spec, year, "basic");
  const domain = hosting.domain ?? hosting.label;
  if (!s.registrar || !listed(s, "ssl") || market <= 0 || certificateOf(s, domain)) return null;
  const price = offerPrice(s, "ssl", spec);
  if (rand(hashRng(s.seed, s.nextId, 307)) >= share * Math.min(1, market / Math.max(price, 0.01))) return null;
  const done = provisionService(s, hosting.customerId, "ssl", { label: domain, price });
  return done.ok ? done.id! : null;
}
