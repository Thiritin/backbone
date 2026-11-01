// Shop systems: the order form and provisioning software a hoster runs next to the website (docs/design/shop.md).
import { type Cycle } from "./cycles";
import { SOFTWARE, type SoftwareKind } from "./platforms";

export type ShopId = "modemBill" | "clientExit" | "whmCache" | "blessta" | "hostBull" | "ubersmyth" | "orderBocks" | "boxBillin";

// Module ids are software ids plus these four for products that run on no software.
export const HARDWARE_MODULES = ["registrar", "ssl", "dedicated", "colo"] as const;

export interface ShopVariant {
  id: ShopId;
  name: string;
  maker: string;
  // First year the shop exists; its licensing is in shop-licences.ts.
  from: number;
  // Included modules: a software kind, a software id or a hardware module, each from a year.
  includes: [string, number][];
  // Price of a module that is not included; null when none are sold.
  extra: number | null;
  // Hours until a bought module works.
  extraHours?: number;
  // Whether stock can follow free capacity.
  autoStock: boolean;
  // Billing cycles the system sells.
  cycles: Cycle[];
}

export const SHOPS: ShopVariant[] = [
  { id: "modemBill", name: "ModemBill", maker: "ModemBill Inc.", from: 2005, includes: [["cpanic", 2005], ["pleskit", 2005], ["registrar", 2005]], extra: null, autoStock: false, cycles: ["monthly", "quarterly", "annual"] },
  { id: "clientExit", name: "ClientExit", maker: "Newedge", from: 2005, includes: [["cpanic", 2005], ["directadmen", 2005], ["registrar", 2005]], extra: 150, autoStock: true, cycles: ["monthly", "quarterly", "annual", "biennial"] },
  { id: "whmCache", name: "WHMCache", maker: "WHMCache Ltd", from: 2005, includes: [["panel", 2005], ["registrar", 2005], ["ssl", 2005], ["game", 2008]], extra: 200, autoStock: true, cycles: ["monthly", "quarterly", "semiannual", "annual", "biennial", "triennial"] },
  { id: "blessta", name: "Blessta", maker: "Philips Data", from: 2007, includes: [["cpanic", 2007], ["pleskit", 2007], ["directadmen", 2007], ["registrar", 2007], ["proxmocks", 2010]], extra: 100, autoStock: true, cycles: ["monthly", "quarterly", "semiannual", "annual", "biennial", "triennial"] },
  { id: "hostBull", name: "HostBull", maker: "HostBull", from: 2009, includes: [["panel", 2009], ["cloud", 2009], ["game", 2009], ["dns", 2009], ["vpn", 2009], ["storage", 2009], ["registrar", 2009], ["ssl", 2009]], extra: null, autoStock: true, cycles: ["monthly", "quarterly", "semiannual", "annual", "biennial", "triennial"] },
  { id: "ubersmyth", name: "Ubersmyth", maker: "Ubersmyth", from: 2006, includes: [["dedicated", 2006], ["colo", 2006], ["dns", 2006]], extra: 300, autoStock: true, cycles: ["monthly", "quarterly", "annual", "biennial"] },
  { id: "orderBocks", name: "OrderBocks", maker: "ResellerKlub", from: 2006, includes: [["registrar", 2006], ["ssl", 2006], ["cpanic", 2006]], extra: null, autoStock: false, cycles: ["monthly", "annual", "biennial"] },
  { id: "boxBillin", name: "BoxBillin'", maker: "BoxBillin' community", from: 2011, includes: [["registrar", 2011]], extra: 0, extraHours: 12, autoStock: true, cycles: ["monthly", "quarterly", "semiannual", "annual", "biennial", "triennial"] },
];

export const shopById = (id: ShopId): ShopVariant => SHOPS.find((x) => x.id === id)!;

// Days a new shop needs before it takes orders.
export const SHOP_SETUP_HOURS = 72;
const kindOf = (id: string): SoftwareKind | undefined => SOFTWARE.find((x) => x.id === id)?.kind;
export const MODULE_IDS: string[] = [...SOFTWARE.filter((x) => x.kind !== "mail" && x.kind !== "backup").map((x) => x.id), ...HARDWARE_MODULES];
export const moduleName = (id: string): string => SOFTWARE.find((x) => x.id === id)?.name ?? id;

export const includes = (v: ShopVariant, module: string, year: number): boolean =>
  v.includes.some(([what, from]) => year >= from && (what === module || what === kindOf(module)));
