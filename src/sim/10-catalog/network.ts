// Values come from docs/design/economy.md (Traffic and bandwidth) and docs/design/gdd.md (Network and DDoS).
import { priceAt } from "./economy";
import type { Datacenter } from "../20-world/datacenters";

export interface Carrier { id: string; name: string; factor: number }
// factor scales the year's transit price per Mbit/s.
export const CARRIERS: Carrier[] = [
  { id: "cogentle", name: "Cogentle", factor: 0.7 },
  { id: "drizzle", name: "Drizzle Electric", factor: 0.8 },
  { id: "tellya", name: "Tell-Ya Carrier", factor: 1 },
  { id: "leveltree", name: "Level Tree", factor: 1.3 },
  { id: "nttea", name: "NTTea", factor: 1.15 },
  { id: "zayno", name: "Zayno", factor: 0.95 },
];
export const carrierById = (id: string) => CARRIERS.find((c) => c.id === id);
// One carrier on sale per four on site; the cheap ones are everywhere.
export const carriersAt = (dc: Datacenter): Carrier[] => CARRIERS.slice(0, Math.min(CARRIERS.length, Math.max(1, Math.ceil(dc.carriers / 4))));

export interface Exchange { id: string; name: string; city: string }
export const EXCHANGES: Exchange[] = [
  { id: "dekicks", name: "DE-KICKS", city: "Frankfurt" },
  { id: "hamsix", name: "HAMS-IX", city: "Amsterdam" },
  { id: "lynx", name: "LYNX", city: "London" },
  { id: "franzix", name: "Franz-IX", city: "Paris" },
  { id: "becix", name: "BeCIX", city: "Berlin" },
  { id: "mixup", name: "MIXup", city: "Milan" },
  { id: "viex", name: "VieX", city: "Vienna" },
  { id: "swizzix", name: "SwizzIX", city: "Zurich" },
  { id: "ecksix", name: "ECKS-IX", city: "Düsseldorf" },
  { id: "nicks", name: "N-ICKS", city: "Nuremberg" },
  { id: "inexcess", name: "IN-EXCESS", city: "Munich" },
  { id: "equinoxix", name: "Equinox IX", city: "Ashburn" },
  { id: "nyikes", name: "NYIKES", city: "New York" },
  { id: "chikicks", name: "CHI-KICKS", city: "Chicago" },
  { id: "yallix", name: "Y'ALL-IX", city: "Dallas" },
  { id: "any3", name: "Any3", city: "Los Angeles" },
];
export const exchangeById = (id: string) => EXCHANGES.find((x) => x.id === id);
export const exchangeAt = (dc: Datacenter): Exchange | undefined => EXCHANGES.find((x) => x.name === dc.exchange?.name);
// What a cross-connect can reach from a space at dc: the carriers on sale there, and the exchange when it is on site.
export const crossConnectTargets = (dc: Datacenter): { id: string; name: string }[] => {
  const x = dc.exchange?.onSite ? exchangeAt(dc) : undefined;
  return [...carriersAt(dc), ...(x ? [x] : [])].map(({ id, name }) => ({ id, name }));
};
export const targetName = (id: string): string => (carrierById(id) ?? exchangeById(id))?.name ?? id;

// Port speeds in Gbit/s and the year carriers and exchanges start selling them.
export const PORT_SPEEDS: { gbit: number; from: number }[] = [{ gbit: 1, from: 2005 }, { gbit: 10, from: 2008 }, { gbit: 100, from: 2014 }, { gbit: 400, from: 2021 }];
export const speedsIn = (year: number): number[] => PORT_SPEEDS.filter((p) => p.from <= year).map((p) => p.gbit);

export const TRANSIT = { perMbps2026: 0.19, m: 108 } as const;
// The commit as a share of the contract's capacity, and the discount it earns on the price per Mbit/s.
export const COMMITS: { share: number; discount: number }[] = [{ share: 0.2, discount: 0 }, { share: 0.5, discount: 0.1 }, { share: 1, discount: 0.2 }];
export const transitPerMbps = (c: Carrier, year: number): number => priceAt(TRANSIT.perMbps2026, TRANSIT.m, year) * c.factor;

export const EXCHANGE_FEES = { setup: 1000, yearly: 1500 } as const;
const EXCHANGE_PORT_2026: Record<number, number> = { 1: 250, 10: 650, 100: 2500, 400: 6000 };
export const exchangePortPrice = (gbit: number, year: number): number => Math.round(priceAt(EXCHANGE_PORT_2026[gbit], 5, year));

// The datacenter's own transit through its 1G handoff, per TB carried.
export const DC_BANDWIDTH = { perTb2026: 4, m: 46, mbps: 1000 } as const;
export const dcPerTb = (year: number): number => priceAt(DC_BANDWIDTH.perTb2026, DC_BANDWIDTH.m, year);
// TB carried by one Mbit/s over one hour.
export const TB_PER_MBPS_HOUR = 3600 / 8 / 1e6;

export const LEAD_HOURS = 14 * 24;
export const ZONE_LINK_LEAD_HOURS = 30 * 24;
export const ASN_FEE = 500;

// Links between zones: leased wavelengths by speed, or dark fiber within a region, which carries 100G.
export type ZoneLinkKind = "wave" | "fiber";
const WAVE_2026: Record<number, number> = { 1: 400, 10: 900, 100: 2500, 400: 6000 };
// A transatlantic wave costs ten times a metro one.
export function zoneLinkPrice(kind: ZoneLinkKind, gbit: number, sameRegion: boolean, year: number, overseas = false): number {
  if (kind === "fiber") return 2000;
  return Math.round(priceAt(WAVE_2026[gbit], 5, year) * (sameRegion ? 1 : overseas ? 10 : 3));
}
export const FIBER_GBIT = 100;

// PeeringDB-style facts. share is the part of your traffic headed to that network; minMbps is the traffic they want from a peer.
// routeServer networks peer with every member through the route servers; open ones accept anyone, selective ones want minMbps,
// restrictive ones want minMbps and still rarely say yes.
export type PeerPolicy = "routeServer" | "open" | "selective" | "restrictive";
export type PeerKind = "eyeball" | "content" | "cdn" | "carrier" | "hoster" | "hobby";
export interface Peer { id: string; name: string; kind: PeerKind; share: number; prefixes: number; policy: PeerPolicy; minMbps: number; exchanges: string[] }
const ALL = EXCHANGES.map((x) => x.id);
export const PEERS: Peer[] = [
  { id: "crowdflare", name: "Crowdflare", kind: "cdn", share: 0.05, prefixes: 1800, policy: "routeServer", minMbps: 0, exchanges: ALL },
  { id: "akamaybe", name: "Akamaybe", kind: "cdn", share: 0.03, prefixes: 950, policy: "routeServer", minMbps: 0, exchanges: ALL },
  { id: "drizzle", name: "Drizzle Electric", kind: "carrier", share: 0.04, prefixes: 180000, policy: "routeServer", minMbps: 0, exchanges: ALL },
  { id: "ohv", name: "OHV Cloud", kind: "hoster", share: 0.01, prefixes: 420, policy: "open", minMbps: 0, exchanges: ["dekicks", "franzix", "lynx", "hamsix"] },
  { id: "stratosphere", name: "Strato-sphere", kind: "hoster", share: 0.005, prefixes: 60, policy: "open", minMbps: 0, exchanges: ["dekicks", "becix"] },
  { id: "chaos", name: "Chaos Computing Club", kind: "hobby", share: 0.002, prefixes: 12, policy: "open", minMbps: 0, exchanges: ["dekicks", "becix"] },
  { id: "freefunk", name: "Freefunk", kind: "hobby", share: 0.001, prefixes: 30, policy: "open", minMbps: 0, exchanges: ["dekicks", "becix", "viex"] },
  { id: "bastelkeller", name: "AS-Bastelkeller", kind: "hobby", share: 0.0005, prefixes: 2, policy: "open", minMbps: 0, exchanges: ["dekicks"] },
  { id: "volve", name: "Volve", kind: "content", share: 0.03, prefixes: 140, policy: "selective", minMbps: 200, exchanges: ["dekicks", "hamsix", "lynx"] },
  { id: "goggle", name: "Goggle", kind: "content", share: 0.06, prefixes: 1100, policy: "selective", minMbps: 1000, exchanges: ALL },
  { id: "vodaphony", name: "Voda-Phony", kind: "eyeball", share: 0.08, prefixes: 2100, policy: "selective", minMbps: 2000, exchanges: ["dekicks", "hamsix", "lynx", "mixup"] },
  { id: "kapeen", name: "KaPeeN", kind: "eyeball", share: 0.04, prefixes: 900, policy: "selective", minMbps: 500, exchanges: ["hamsix"] },
  { id: "orangina", name: "Orangina Telecom", kind: "eyeball", share: 0.05, prefixes: 1600, policy: "selective", minMbps: 1500, exchanges: ["franzix"] },
  { id: "swisscone", name: "Swisscone", kind: "eyeball", share: 0.03, prefixes: 700, policy: "selective", minMbps: 500, exchanges: ["swizzix"] },
  { id: "a0", name: "A0 Telekom", kind: "eyeball", share: 0.03, prefixes: 650, policy: "selective", minMbps: 500, exchanges: ["viex"] },
  { id: "timid", name: "TIMid", kind: "eyeball", share: 0.04, prefixes: 1200, policy: "restrictive", minMbps: 5000, exchanges: ["mixup"] },
  { id: "beetee", name: "BeeTee", kind: "eyeball", share: 0.06, prefixes: 2400, policy: "restrictive", minMbps: 5000, exchanges: ["lynx"] },
  { id: "doitsche", name: "Doitsche Telekomm", kind: "eyeball", share: 0.15, prefixes: 4500, policy: "restrictive", minMbps: 20000, exchanges: ["dekicks"] },
];
export const peerById = (id: string) => PEERS.find((p) => p.id === id);
// Chance per day that a network on your exchange asks you to peer, before your size counts.
export const REQUEST_DAILY: Record<Exclude<PeerPolicy, "routeServer">, number> = { open: 0.03, selective: 0.01, restrictive: 0.001 };
export const REQUEST_DAYS = 30;
export const DECLINE_COOLDOWN_HOURS = 90 * 24;

// economy.md, DDoS attacks.
export const DDOS = { gamerMonthly: 0.02, otherMonthly: 0.002, mbps2005: 500, growth: 1.25, minHours: 1, maxHours: 6, detectShare: 10 / 60, burst: 0.5 } as const;
export type Protection = "none" | "onDemand" | "alwaysOn";
export const PROTECTIONS: Record<Exclude<Protection, "none">, { name: string; monthly: number; perIncident: number }> = {
  onDemand: { name: "Scrubba Dub On Demand", monthly: 50, perIncident: 250 },
  alwaysOn: { name: "Akamaybe Prolexit", monthly: 800, perIncident: 0 },
};
// Each hour of saturation costs a customer this share of their outage penalty.
export const SATURATION_PENALTY = 0.25;
// The dropped share of a zone's traffic from which its customers notice.
export const SATURATION_FLOOR = 0.02;

// economy.md, Traffic and bandwidth (Latency): milliseconds a hop adds to a round trip. The home line gets its fast figure from 2015.
export const LATENCY_MS = { switch: 0.2, firewall: 1, gateway: 1, host: 0, line: 18, uplink: 3, domestic: 8, european: 25, overseas: 90 } as const;
export const FAST_LINE = { from: 2015, ms: 8 } as const;
// Above this share of capacity a link queues: each point adds delayMs per unit and lossPerUnit of the packets are lost.
export const QUEUEING = { knee: 0.8, delayMs: 200, lossPerUnit: 0.2 } as const;
export const JITTER = 0.1;
