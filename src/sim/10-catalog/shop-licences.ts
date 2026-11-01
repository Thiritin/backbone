// docs/design/plans/shop-software.md, lane shop-catalog: how each shop system is licensed, from its real history in
// docs/design/software-versions.md. Editions live in TIERS under the shop id.
import { tiersOf, type LicenceTier } from "./licence-tiers";
import { eraAt, type LicenseEra } from "./server-os";
import { yearOf } from "../00-core/time";
import { shopById, SHOPS, type ShopId } from "./shops";
import { site, type Site } from "./sites";

export interface ShopLicence {
  id: ShopId;
  name: string;
  licensing: LicenseEra[];
  // Days a fresh install runs without a key; null when a key is needed at install; missing when no key exists.
  trialDays?: number | null;
  // What an edition's cap counts.
  caps?: "clients" | "servers";
  // The vendor site that sells keys, once it exists.
  site?: Site;
}

const TERMS: Record<ShopId, Omit<ShopLicence, "id" | "name">> = {
  modemBill: {
    licensing: [
      { from: 2005, kind: "once", fee: 250, updates: 12, updatesFee: 100, upgrade: 125, editions: ["lite", "unlimited"] },
      { from: 2008, month: 3, kind: "server", fee: 22, editions: ["unlimited"] },
      { from: 2011, kind: "server", fee: 0, editions: [], closed: true },
    ],
    trialDays: 14, caps: "clients",
  },
  clientExit: {
    licensing: [
      { from: 2005, kind: "once", fee: 250, updates: 12, updatesFee: 50, editions: ["branded", "unbranded"] },
      { from: 2025, month: 12, kind: "server", fee: 13, editions: ["branded", "unbranded"] },
    ],
    trialDays: 14,
  },
  whmCache: {
    licensing: [
      { from: 2005, kind: "once", fee: 250, updates: 12, updatesFee: 45, editions: ["leased"] },
      { from: 2007, month: 7, kind: "once", fee: 325, updates: 12, updatesFee: 45, editions: ["leased"] },
      { from: 2020, month: 8, kind: "server", fee: 18, editions: ["plus", "professional", "business", "business5000", "unlimited"] },
    ],
    trialDays: null, caps: "clients", site: { host: "whmcache.com", tagline: "", blurb: "", features: [], eras: [] },
  },
  blessta: {
    licensing: [
      { from: 2007, kind: "server", fee: 13, editions: [] },
      { from: 2010, month: 6, kind: "once", fee: 100, updates: 12, updatesFee: 0, editions: [] },
      { from: 2013, month: 8, kind: "once", fee: 250, updates: 12, updatesFee: 39, editions: ["branded", "unbranded"] },
      { from: 2025, month: 11, kind: "once", fee: 350, updates: 12, updatesFee: 62, editions: ["branded", "unbranded"] },
    ],
    trialDays: 30,
    site: { host: "blessta.com", tagline: "", blurb: "", features: [], eras: [{ from: 2007, look: "early" }] },
  },
  hostBull: {
    licensing: [
      { from: 2009, month: 9, kind: "server", fee: 16, editions: [] },
      { from: 2013, month: 6, kind: "once", fee: 600, updates: 12, updatesFee: 125, editions: [] },
    ],
    trialDays: 14,
  },
  ubersmyth: {
    licensing: [
      { from: 2006, kind: "server", fee: 100, setup: 1000, editions: ["starter", "standard", "pro", "enterprise"] },
      { from: 2016, month: 4, kind: "server", fee: 400, setup: 2500, editions: ["standard", "pro", "enterprise"] },
    ],
    trialDays: null, caps: "servers",
  },
  orderBocks: { licensing: [{ from: 2006, kind: "free", fee: 0, cut: 0.06 }] },
  boxBillin: { licensing: [{ from: 2011, kind: "free", fee: 0 }], site: site("boxBillin", "boxbillin.com", 0, 2011) },
};

export const SHOP_LICENCES: ShopLicence[] = SHOPS.map((v) => ({ id: v.id, name: v.name, ...TERMS[v.id] }));
export const shopLicence = (id: ShopId): ShopLicence => SHOP_LICENCES.find((x) => x.id === id)!;
export const shopEra = (id: ShopId, hour: number): LicenseEra => eraAt(shopLicence(id), hour);
// The editions an era sells; an era with editions unset sells none, unlike a panel's.
export const shopEditions = (id: ShopId, hour: number): LicenceTier[] => {
  const on = shopEra(id, hour).editions ?? [];
  return tiersOf(id).filter((x) => on.includes(x.id));
};
// The cheapest edition on sale whose cap fits the count, else the largest.
export const shopEditionFor = (id: ShopId, hour: number, count: number): LicenceTier | undefined => {
  const on = shopEditions(id, hour);
  return on.find((x) => x.cap === null || count <= x.cap) ?? on.at(-1);
};
// The monthly lease at the hour for a count of what the editions cap; null when no lease is sold.
export const shopLease = (id: ShopId, hour: number, count = 0): number | null => {
  const era = shopEra(id, hour), ed = shopEditionFor(id, hour, count);
  if (era.closed) return null;
  return ed ? ed.fee : era.kind !== "once" && era.kind !== "free" ? era.fee : null;
};
// The price of a perpetual key at the hour; null when none is sold.
export const shopKeyPrice = (id: ShopId, hour: number): number | null => {
  const era = shopEra(id, hour);
  return era.kind === "once" && !era.closed ? era.fee : null;
};
// Whether a new shop of the variant can be taken at the hour.
export const shopOnSale = (id: ShopId, hour: number): boolean => yearOf(hour) >= shopById(id).from && !shopEra(id, hour).closed;
// What choosing the shop costs at the hour: the lease's setup fee, or the key when no lease is sold.
export const shopUpfront = (id: ShopId, hour: number): number =>
  shopLease(id, hour) !== null ? shopEra(id, hour).setup ?? 0 : shopKeyPrice(id, hour) ?? 0;
