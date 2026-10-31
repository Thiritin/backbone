// Postal addresses of customers, printed on invoices and used as domain owner data. Drawn per country of the customer's city.
import { hashRng, rand, type Rng } from "../00-core/rng";
import type { GameState } from "../50-state";
import { personName } from "../30-market/market";
import type { Profile } from "./customers";
import { ascii, CITY_TLD } from "./domains";

export interface Address { contact: string; company?: string; street: string; zip: string; city: string; email: string }

interface Country { streets: string[]; places: [string, string][]; mail: string[]; tld: string; zipFirst: boolean }
const DE: Country = {
  streets: ["Hauptstraße", "Bahnhofstraße", "Gartenweg", "Lindenallee", "Schillerstraße", "Mühlenweg", "Am Markt", "Kirchgasse"],
  places: [["60311", "Frankfurt am Main"], ["10115", "Berlin"], ["80331", "München"], ["50667", "Köln"], ["20095", "Hamburg"], ["40213", "Düsseldorf"], ["90402", "Nürnberg"], ["04109", "Leipzig"]],
  mail: ["gmux.de", "wep.de", "t-onlein.de"], tld: "de", zipFirst: true,
};
const COUNTRIES: Record<string, Country> = {
  de: DE,
  at: { ...DE, places: [["1010", "Wien"], ["8010", "Graz"], ["4020", "Linz"], ["5020", "Salzburg"]], mail: ["gmux.at", "aon-line.at"], tld: "at" },
  ch: { ...DE, places: [["8001", "Zürich"], ["3011", "Bern"], ["4051", "Basel"], ["6003", "Luzern"]], mail: ["bluwin.ch", "gmux.ch"], tld: "ch" },
  "co.uk": {
    streets: ["High Street", "Station Road", "Church Lane", "Park Avenue", "Mill Road", "Victoria Street"],
    places: [["EC1A 1BB", "London"], ["M1 1AE", "Manchester"], ["B1 1AA", "Birmingham"], ["LS1 4AP", "Leeds"], ["BS1 5TR", "Bristol"]],
    mail: ["hotmeal.co.uk", "yahu.co.uk"], tld: "co.uk", zipFirst: false,
  },
  fr: {
    streets: ["rue de la Paix", "avenue Victor Hugo", "rue du Moulin", "boulevard Voltaire", "rue de l'Église"],
    places: [["75002", "Paris"], ["69001", "Lyon"], ["13001", "Marseille"], ["31000", "Toulouse"], ["59000", "Lille"]],
    mail: ["wanadu.fr", "frii.fr"], tld: "fr", zipFirst: true,
  },
  nl: {
    streets: ["Dorpsstraat", "Kerkstraat", "Molenweg", "Stationsplein", "Prinsengracht"],
    places: [["1012 AB", "Amsterdam"], ["3011 AD", "Rotterdam"], ["2511 CV", "Den Haag"], ["3511 LX", "Utrecht"], ["6461 AA", "Kerkrade"]],
    mail: ["plannet.nl", "hoome.nl"], tld: "nl", zipFirst: true,
  },
  it: {
    streets: ["Via Roma", "Corso Italia", "Via Garibaldi", "Piazza del Duomo", "Via Verdi"],
    places: [["20121", "Milano"], ["00184", "Roma"], ["10121", "Torino"], ["40121", "Bologna"], ["50122", "Firenze"]],
    mail: ["libbero.it", "virgillio.it"], tld: "it", zipFirst: true,
  },
  com: {
    streets: ["Main Street", "Oak Avenue", "Maple Drive", "Elm Street", "Washington Boulevard", "Lake Road"],
    places: [["20147", "Ashburn, VA"], ["10001", "New York, NY"], ["60601", "Chicago, IL"], ["75201", "Dallas, TX"], ["90012", "Los Angeles, CA"]],
    mail: ["yahu.com", "hotmeal.com", "aoll.com"], tld: "com", zipFirst: false,
  },
};

const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(rand(r) * xs.length)];
const PERSONAL: Profile[] = ["private", "gamer", "hobbyDev"];

// key makes the address stable for a seed. contact is the person writing; company is null for private customers.
export function addressFor(seed: number, key: number, contact: string, company: string | null, city: string): Address {
  const r = hashRng(seed, key, 241), c = COUNTRIES[CITY_TLD[city]?.tld ?? "de"];
  const n = 1 + Math.floor(rand(r) * 80);
  const street = c.zipFirst ? `${pick(r, c.streets)} ${n}` : `${n} ${pick(r, c.streets)}`;
  const [zip, town] = pick(r, c.places);
  const [first, ...rest] = contact.split(" "), last = rest.join(" ") || first;
  const email = company
    ? `${ascii(last)}@${company.includes(".") ? company : `${ascii(company)}.${c.tld}`}`
    : `${ascii(first)}.${ascii(last)}@${pick(r, c.mail)}`;
  return { contact, ...(company && { company }), street, zip, city: town, email };
}

// Saves from before addresses: the name is the contact of a private customer and the company of any other.
export const legacyAddress = (seed: number, key: number, name: string, profile: Profile, contact: string, city: string): Address =>
  PERSONAL.includes(profile) ? addressFor(seed, key, name, null, city) : addressFor(seed, key, contact, name, city);

// Without an order: the company's home city, and for a business a contact drawn for it.
export const homeAddress = (s: Pick<GameState, "seed" | "locations">, key: number, name: string, profile: Profile) => {
  const city = s.locations[0]?.city ?? "Frankfurt";
  return legacyAddress(s.seed, key, name, profile, personName(hashRng(s.seed, key, 242), city), city);
};
