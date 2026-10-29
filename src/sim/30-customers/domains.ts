// GDD, Domains: every web hosting service carries a domain made once from the customer's name, type and city.
import { hashRng, rand, type Rng } from "../00-core/rng";
import type { GameState } from "../50-state";
import type { Profile } from "./customers";

type Lang = "de" | "en" | "fr" | "nl" | "it";
export const CITY_TLD: Record<string, { tld: string; lang: Lang }> = {
  Frankfurt: { tld: "de", lang: "de" }, Berlin: { tld: "de", lang: "de" }, Vienna: { tld: "at", lang: "de" }, Zurich: { tld: "ch", lang: "de" },
  London: { tld: "co.uk", lang: "en" }, Paris: { tld: "fr", lang: "fr" }, Amsterdam: { tld: "nl", lang: "nl" }, Milan: { tld: "it", lang: "it" },
  Düsseldorf: { tld: "de", lang: "de" }, Nuremberg: { tld: "de", lang: "de" }, Falkenstein: { tld: "de", lang: "de" }, Munich: { tld: "de", lang: "de" },
  Kerkrade: { tld: "nl", lang: "nl" },
  Ashburn: { tld: "com", lang: "en" }, "New York": { tld: "com", lang: "en" }, Chicago: { tld: "com", lang: "en" }, Dallas: { tld: "com", lang: "en" },
  "Los Angeles": { tld: "com", lang: "en" },
};
const countryOf = (city: string) => CITY_TLD[city] ?? CITY_TLD.Frankfurt;

// The trade in a company name, in the customer's language. Keys are the trades of senderFor in market.ts.
const TRADE: Record<string, Record<Lang, string[]>> = {
  "Florist": { de: ["blumen", "floristik"], en: ["florist", "flowers"], fr: ["fleurs", "fleuriste"], nl: ["bloemen"], it: ["fiori", "fioreria"] },
  "Bakery": { de: ["bäckerei", "backstube"], en: ["bakery", "bakes"], fr: ["boulangerie"], nl: ["bakkerij"], it: ["panificio", "forno"] },
  "Bike Repair": { de: ["fahrrad", "radwerkstatt"], en: ["bikes", "cycles"], fr: ["vélo", "cycles"], nl: ["fietsen", "fietsmaker"], it: ["bici", "cicli"] },
  "Tailoring": { de: ["schneiderei", "maßatelier"], en: ["tailoring", "tailors"], fr: ["couture", "tailleur"], nl: ["kleermaker"], it: ["sartoria"] },
  "Bookshop": { de: ["buchhandlung", "bücher"], en: ["books", "bookshop"], fr: ["librairie"], nl: ["boekhandel", "boeken"], it: ["libreria"] },
  "Plumbing": { de: ["sanitär", "installateur"], en: ["plumbing", "plumbers"], fr: ["plomberie"], nl: ["loodgieter"], it: ["idraulica", "idraulico"] },
  "Driving School": { de: ["fahrschule"], en: ["drivingschool", "driving"], fr: ["auto-école"], nl: ["rijschool"], it: ["autoscuola"] },
  "Tattoo Studio": { de: ["tattoo", "tattoostudio"], en: ["tattoo", "ink"], fr: ["tatouage", "tattoo"], nl: ["tattoo"], it: ["tatuaggi", "tattoo"] },
  "Logistics": { de: ["logistik", "spedition"], en: ["logistics", "freight"], fr: ["logistique", "transports"], nl: ["logistiek", "transport"], it: ["logistica", "trasporti"] },
  "Consulting": { de: ["beratung", "consulting"], en: ["consulting", "advisory"], fr: ["conseil"], nl: ["advies"], it: ["consulenza"] },
  "Print & Copy": { de: ["druck", "copyshop"], en: ["print", "printshop"], fr: ["imprimerie"], nl: ["drukkerij"], it: ["tipografia", "stampa"] },
  "Steuerberatung": { de: ["steuerberatung", "steuerbüro"], en: ["tax", "accountants"], fr: ["expert-comptable"], nl: ["belastingadvies"], it: ["commercialista"] },
  "Elektro": { de: ["elektro", "elektrotechnik"], en: ["electrical", "electrics"], fr: ["électricité"], nl: ["elektro", "installatie"], it: ["impianti", "elettrica"] },
  "Immobilien": { de: ["immobilien", "makler"], en: ["property", "estates"], fr: ["immobilier"], nl: ["makelaardij", "makelaar"], it: ["immobiliare"] },
  "Dental Practice": { de: ["zahnarzt", "praxis", "zahnarztpraxis"], en: ["dental", "dentist", "smile"], fr: ["dentiste", "cabinet-dentaire"], nl: ["tandarts", "tandartspraktijk"], it: ["dentista", "studio-dentistico"] },
  "Law Office": { de: ["kanzlei", "anwalt", "rechtsanwalt"], en: ["law", "solicitors", "legal"], fr: ["avocat", "cabinet"], nl: ["advocaten", "advocaat"], it: ["avvocato", "studio-legale"] },
  "Physiotherapy": { de: ["physio", "physiotherapie"], en: ["physio", "physiotherapy"], fr: ["kiné", "kinésithérapie"], nl: ["fysio", "fysiotherapie"], it: ["fisioterapia", "fisio"] },
  "Notary": { de: ["notar", "notariat"], en: ["notary", "notaries"], fr: ["notaire"], nl: ["notaris"], it: ["notaio"] },
  "Veterinary Clinic": { de: ["tierarzt", "tierklinik"], en: ["vets", "vet"], fr: ["vétérinaire", "clinique-véto"], nl: ["dierenarts", "dierenkliniek"], it: ["veterinario", "clinica-veterinaria"] },
};
// American trade words where they differ from British ones.
const US_TRADE: Record<string, string[]> = { "Law Office": ["law", "attorneys", "legal"], "Physiotherapy": ["physicaltherapy", "pt"], "Tailoring": ["tailor", "alterations"] };
const AGENCY: Record<Lang, string> = { de: "agentur", en: "agency", fr: "agence", nl: "bureau", it: "agenzia" };
const CORP: Record<Lang, string[]> = { de: ["industries", "ag", "gruppe"], en: ["industries", "group"], fr: ["industries", "groupe"], nl: ["industries", "groep"], it: ["industries", "gruppo"] };
const HANDLE_PRE = ["dark", "frost", "pixel", "shadow", "turbo", "neon", "captain", "xx", "lord", "sir"];
const HANDLE_POST = ["", "-gaming", "plays", "-clan", "hq", "tv", "42", "1337", "-lan"];

// Lowercase ASCII with umlauts written out: "Bäckerei Groß" is "baeckerei-gross".
export const ascii = (x: string): string =>
  x.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(rand(r) * xs.length)];
const shuffle = <T>(r: Rng, xs: T[]): T[] => xs.map((x) => [rand(r), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

// Candidate names without the TLD, best first.
function candidates(name: string, profile: Profile, lang: Lang, r: Rng, us = false): string[] {
  const trade = Object.keys(TRADE).find((k) => name.includes(k));
  const words = name.replace(trade ?? "", " ").replace(/\bIndustries (AG|Inc)\b/, " ").trim().split(/\s+/).map(ascii).filter(Boolean);
  const first = words[0] ?? "web", last = words.at(-1) ?? first;
  if (trade) {
    const local = shuffle(r, ((us && US_TRADE[trade]) || TRADE[trade][lang]).map(ascii));
    // A small business puts the family name first: weber-logistik, not logistik-weber.
    return profile === "smallBiz" ? local.flatMap((w) => [`${last}-${w}`, `${last}${w}`]) : local.flatMap((w) => [`${w}-${last}`, `${w}${last}`]);
  }
  switch (profile) {
    case "private": return shuffle(r, [`${first}${last}`, `${first}-${last}`, `${first[0]}${last}`]);
    case "hobbyDev": return shuffle(r, [`${first}-${last}`, `${first}codes`, `${last}-dev`, `${first}${last}`]);
    case "gamer": return Array.from({ length: 4 }, () => `${pick(r, HANDLE_PRE)}${pick(r, [first, last])}${pick(r, HANDLE_POST)}`);
    case "agency": return [ascii(name), `${ascii(name)}-${AGENCY[lang]}`, `${ascii(name)}-studio`];
    case "onlineShop": return [ascii(name.replace(/\.[a-z.]+$/, "")), ascii(`${name.replace(/\.[a-z.]+$/, "")} online`)];
    case "enterprise": return shuffle(r, CORP[lang]).map((w) => `${last}-${w}`);
    default: return [ascii(name)];
  }
}

export const taken = (s: GameState): Set<string> =>
  new Set([...s.services.map((v) => v.domain ?? v.label), ...s.sales.requests.flatMap((x) => (x.domain ? [x.domain] : []))]);

// A free domain for a customer; key makes it stable for a seed. The first free candidate wins, then numbered ones.
export function domainFor(s: GameState, name: string, profile: Profile, city: string, key: number): string {
  const { tld, lang } = countryOf(city), used = taken(s);
  const names = candidates(name, profile, lang, hashRng(s.seed, key, 73), tld === "com").filter(Boolean);
  const free = names.find((n) => !used.has(`${n}.${tld}`));
  if (free) return `${free}.${tld}`;
  for (let i = 2; ; i++) if (!used.has(`${names[0]}-${i}.${tld}`)) return `${names[0]}-${i}.${tld}`;
}

const cityOf = (s: GameState, zone: string | null): string => s.locations.find((l) => l.az === zone)?.city ?? s.locations[0]?.city ?? "Frankfurt";

// A web hosting service's domain: its label when that is one already (an order's or a friend's), otherwise made from the customer.
export function webDomain(s: GameState, customerId: string, label: string, zone: string | null, id: string): string {
  if (/^[a-z0-9-]+(\.[a-z]+)+$/.test(label)) return label;
  const c = s.customers.find((x) => x.id === customerId);
  return domainFor(s, c?.name ?? label, c?.profile ?? "private", cityOf(s, zone), Number(id.slice(3)) || 0);
}

// Saves from before domains: each web hosting service gets one, its label becomes it, and open web hosting requests get theirs.
export function fillDomains(s: GameState): GameState {
  for (const v of s.services) {
    if (v.product !== "webHosting" || v.domain) continue;
    const c = s.customers.find((x) => x.id === v.customerId);
    v.domain = v.label = domainFor(s, c?.name ?? v.label, c?.profile ?? "private", cityOf(s, v.zone), Number(v.id.slice(3)) || 0);
  }
  for (const r of s.sales.requests) {
    if (r.product !== "webHosting" || r.domain) continue;
    r.domain = s.services.find((v) => v.id === r.serviceId)?.domain ?? domainFor(s, r.company ?? r.contact, r.profile, r.city, Number(r.id.slice(3)) || 0);
  }
  return s;
}

// The domain the company's name suggests: its name with the TLD of its first city.
export const derivedDomain = (s: GameState): string => `${ascii(s.company.name) || "hosting"}.${countryOf(s.locations[0]?.city ?? "Frankfurt").tld}`;

// The company's own domain, for mail servers, panel addresses and signatures; the suggested name until one is registered.
export const companyDomain = (s: GameState): string => s.company.domain ?? derivedDomain(s);
