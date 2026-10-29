// GDD, Domain registration: the registrar partner under contract bills the registry cost of every domain under management
// monthly, at a factor that falls with the number of domains. Numbers in economy.md, Sales and quotes (Domains).
import { dateOf, isMonthStart } from "../00-core/time";
import { factorFor, icannFee, registrarById, tierFor, type Registrar as Partner, type RegistrarId } from "../10-catalog/registrars";
import type { GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { derivedDomain } from "./domains";
import { register, REGISTRIES, registryCost, tldOf, YEAR } from "./registry";

// transfer is the move of every domain to a new partner, a hand task: doneAt is null until someone starts it.
export interface Transfer { from: RegistrarId; domains: number; doneAt: number | null }
// billed is set once the signup fee has been invoiced; tier is checked at every month start.
export interface Registrar { id: RegistrarId; since: number; tier: number; billed: boolean; transfer: Transfer | null }

// The hand task of moving one domain to another partner.
export const TRANSFER_MINUTES = 5;
const MONTH = 730;
const cents = (v: number) => Math.round(v * 100) / 100;

// Starts the move of the domains; it ends at doneAt.
export function beginTransfer(s: GameState, doneAt: number): void {
  if (s.registrar?.transfer) s.registrar = { ...s.registrar, transfer: { ...s.registrar.transfer, doneAt } };
}

// What a partner charges a year for a domain at a tier.
export function yearlyAt(s: GameState, r: Partner, tier: number, name: string): number {
  const tld = tldOf(name), d = dateOf(s.hour);
  return cents(registryCost(name, d.getUTCFullYear()) * factorFor(r, tld, tier) + (tld === "com" ? icannFee(d.getUTCFullYear(), d.getUTCMonth()) : 0));
}

// What the partner under contract charges a year for a domain at this tier; 0 without a contract.
export function wholesale(s: GameState, name: string): number {
  const r = s.registrar && registrarById(s.registrar.id);
  return r ? yearlyAt(s, r, s.registrar!.tier, name) : 0;
}

const PREFIXES = ["get", "my", "the"], SUFFIXES = ["hosting", "host", "web", "online", "net"];

// The registrar search: the typed name under every TLD, then common variations under the TLD typed or .com.
export function spinNames(input: string): string[] {
  const raw = input.trim().toLowerCase().replace(/^www\./, "");
  const tld = Object.keys(REGISTRIES).find((t) => raw.endsWith(`.${t}`));
  const label = (tld ? raw.slice(0, -tld.length - 1) : raw).replace(/[\s_.]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  if (!label) return [];
  const main = tld ?? "com", tlds = [main, ...Object.keys(REGISTRIES).filter((t) => t !== main)];
  const stem = SUFFIXES.reduce((x, w) => (x.endsWith(w) && x.length > w.length + 2 ? x.slice(0, -w.length).replace(/-$/, "") : x), label);
  const variants = [...PREFIXES.map((p) => `${p}${stem}`), ...SUFFIXES.map((w) => `${stem}${w}`)].filter((v) => v !== label);
  return [...new Set([...tlds.map((t) => `${label}.${t}`), ...variants.map((v) => `${v}.${main}`)])];
}

// One twelfth of every domain's wholesale, the monthly domain total.
export const monthlyDomains = (s: GameState): number => cents(s.domains.reduce((n, d) => n + wholesale(s, d.name), 0) / 12);

// The ledger entries of a month start: the signup once, the fee or the unused part of the minimum, and the domains.
export function registrarBill(s: GameState): LedgerEntry[] {
  const r = s.registrar, def = r && registrarById(r.id);
  if (!r || !def) return [];
  const domains = monthlyDomains(s), out: LedgerEntry[] = [];
  const entry = (key: string, params: LedgerEntry["params"], amount: number) => out.push({ hour: s.hour, category: "domains", key, params, amount: -amount });
  if (!r.billed && def.signup > 0) entry("ledger.registrarSignup", { name: def.name }, def.signup);
  const fee = def.minimum > 0 ? Math.max(0, cents(def.minimum - domains)) : def.fee;
  if (fee > 0) entry("ledger.registrar", { name: def.name }, fee);
  if (domains > 0) entry("ledger.domains", { name: def.name, count: s.domains.length }, domains);
  return out;
}

// Hourly: a finished transfer ends. At a month start: the tier follows the count, the company domain renews and the partner invoices.
export function registrarTick(s: GameState): SimEvent[] {
  const r = s.registrar, events: SimEvent[] = [];
  if (!r) return events;
  if (r.transfer?.doneAt != null && s.hour >= r.transfer.doneAt) {
    s.registrar = { ...r, transfer: null };
    events.push({ app: "Browser", key: "event.domainsTransferred", params: { name: registrarById(r.id)!.name, count: r.transfer.domains } });
  }
  if (!isMonthStart(s.hour)) return events;
  const tier = tierFor(s.domains.length), was = s.registrar!.tier;
  s.registrar = { ...s.registrar!, tier };
  if (tier > was) events.push({ app: "Browser", key: "event.registrarTier", params: { name: registrarById(r.id)!.name, domains: s.domains.length } });
  // The company's domain renews with the contract, so only customers' domains need renewing by hand.
  s.domains = s.domains.map((d) => (d.customerId === null && d.expiresAt - s.hour < MONTH ? { ...d, expiresAt: d.expiresAt + YEAR } : d));
  const bill = registrarBill(s), total = cents(bill.reduce((n, e) => n - e.amount, 0));
  s.registrar = { ...s.registrar!, billed: true };
  s.cash = cents(s.cash - total);
  s.ledger = [...s.ledger, ...bill];
  return events;
}

// Saves from before registrars have a NameCheep contract and their derived company domain registered.
export function fillRegistrar(s: GameState, saved: Registrar | null | undefined): GameState {
  if (saved !== undefined) return s;
  const name = derivedDomain(s);
  s.registrar = { id: "nameCheep", since: s.hour, tier: 0, billed: true, transfer: null };
  if (!s.company.domain) {
    s.company = { ...s.company, domain: name };
    if (!s.domains.some((d) => d.name === name)) register(s, name, null, false);
  }
  return s;
}

