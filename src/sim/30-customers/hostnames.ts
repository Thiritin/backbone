// GDD, Hostnames: servers are nodeNNN, the player's VMs vmNNN, customer services a product prefix plus an eight-digit number.
import { hashRng, rand } from "../00-core/rng";
import { modelById } from "../10-catalog/hardware";
import type { GameState } from "../50-state";
import type { Product, Service } from "./customers";
import { fqdn } from "./domains";

// Domain and SSL services have no machine behind them and no hostname.
export const HOST_PREFIX: Partial<Record<Product, string>> = {
  webHosting: "web", vps: "vps", gameServer: "game", dns: "dns", vpn: "vpn", dedicated: "dedi", storage: "store", cloud: "cloud", colocation: "colo",
};

const pad = (n: number) => String(n).padStart(3, "0");

// The first service number lies in 10,000,000 to 19,999,999 for a seed.
export const firstHostNo = (seed: number): number => 10_000_000 + Math.floor(rand(hashRng(seed, 31)) * 10_000_000);

export const nodeName = (s: GameState): string => `node${pad(s.nextNode++)}`;
export const vmName = (s: GameState): string => `vm${pad(s.nextVm++)}`;

// The next service hostname; the counter grows by 1 to 97 from a draw that leaves the game's rng alone.
export function serviceHostname(s: GameState, product: Product): string | undefined {
  const prefix = HOST_PREFIX[product];
  if (!prefix) return undefined;
  const n = s.nextHostNo;
  s.nextHostNo += 1 + Math.floor(rand(hashRng(s.seed, n, 97)) * 97);
  return `${prefix}${n}`;
}

// The full name of a service for ticket texts; empty when it has none.
export const serviceFqdn = (s: GameState, v: Service | undefined): string => (v?.hostname ? fqdn(s, v.hostname) : "");

// Saves from before hostnames: servers number in purchase order, services in start order, then workloads follow.
export function fillHostnames(s: GameState): GameState {
  const byTime = <T>(xs: T[], at: (x: T) => number) => [...xs].sort((a, b) => at(a) - at(b));
  for (const d of byTime(s.devices.filter((x) => !x.hostname && modelById(x.model).kind === "server"), (x) => x.boughtAt)) d.hostname = nodeName(s);
  for (const v of byTime(s.services.filter((x) => !x.hostname), (x) => x.startedAt)) {
    const h = serviceHostname(s, v.product);
    if (h) v.hostname = h;
  }
  s.workloads = s.workloads.map((w) => {
    if (w.hostname) return w;
    const h = w.serviceId ? s.services.find((v) => v.id === w.serviceId)?.hostname : vmName(s);
    return h ? { ...w, hostname: h } : w;
  });
  return s;
}
