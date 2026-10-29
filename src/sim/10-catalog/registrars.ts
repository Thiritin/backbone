// GDD, Domain registration: the registrar partners a company resells domains through. Numbers in economy.md, Sales and quotes (Domains).
export type RegistrarId = "nameCheep" | "goDuddy" | "interNetY" | "openSrsly";

// Domains under management at which each tier starts.
export const TIERS = [0, 100, 500, 5000] as const;
export type Factors = [number, number, number, number];

export interface Registrar {
  id: RegistrarId;
  name: string;
  from: number;
  // Charged once, at the first month start under the contract.
  signup: number;
  // Charged every month on top of the domains.
  fee: number;
  // Charged every month in total; what the domains do not use is lost.
  minimum: number;
  // Multiplies the registry cost of a domain, by tier.
  factors: Factors;
  // Factors that replace the tier's for a TLD.
  tlds?: Record<string, number>;
}

export const REGISTRARS: Registrar[] = [
  { id: "nameCheep", name: "NameCheep", from: 2005, signup: 0, fee: 0, minimum: 0, factors: [1.5, 1.5, 1.5, 1.5] },
  { id: "goDuddy", name: "GoDuddy Reseller", from: 2005, signup: 0, fee: 9, minimum: 0, factors: [1.3, 1.2, 1.15, 1.1] },
  { id: "interNetY", name: "InterNetY", from: 2005, signup: 200, fee: 0, minimum: 50, factors: [1.15, 1.08, 1.05, 1.03], tlds: { de: 1 } },
  { id: "openSrsly", name: "OpenSRSly", from: 2005, signup: 100, fee: 0, minimum: 0, factors: [1.25, 1.15, 1.08, 1.04] },
];

export const registrarById = (id: string): Registrar | undefined => REGISTRARS.find((r) => r.id === id);

// The tier a number of domains under management falls into.
export const tierFor = (domains: number): number => TIERS.reduce<number>((t, at, i) => (domains >= at ? i : t), 0);

// The ICANN fee on a .com a year: EUR 0.18, EUR 0.20 from July 2025.
export const icannFee = (year: number, month: number): number => (year + month / 12 >= 2025.5 ? 0.2 : 0.18);

// The factor a partner applies to a TLD's registry cost at a tier.
export const factorFor = (r: Registrar, tld: string, tier: number): number => r.tlds?.[tld] ?? r.factors[tier];
