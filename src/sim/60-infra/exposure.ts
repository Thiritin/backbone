// economy.md, Per-VM firewall: which ports a host's software listens on, which of them it must serve, and what a firewall on its VM changes.
import { softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { vmById, type Cluster } from "./cluster";

export const MACROS = ["web", "ssh", "mail", "db", "rdp"] as const;
export type Macro = (typeof MACROS)[number];
// The Proxmox "macro" tick list of a VM's firewall; with the firewall on, every port outside the list is dropped.
export interface Firewall { on: boolean; allow: Macro[] }

// Chance multiplier of a compromise when the firewall closes a port the software listens on but does not need.
export const FIREWALL_RISK = 0.5;
const PORT_MACRO: Record<number, Macro> = { 80: "web", 443: "web", 22: "ssh", 25: "mail", 465: "mail", 587: "mail", 3306: "db", 5432: "db", 3389: "rdp" };

// The ports the host's software serves: a panel its web sites, a mail host its mail.
export const needs = (c: Cluster): Macro[] => (c.kind === "panel" ? ["web"] : c.kind === "mail" ? ["mail"] : []);
// Everything it answers on: what it serves, the ports its software opens and SSH.
export function listens(c: Cluster): Macro[] {
  const id = c.panel ?? c.platform, ports = id ? softwareById(id).ports : [];
  return [...new Set<Macro>([...needs(c), "ssh", ...ports.flatMap((p) => PORT_MACRO[p] ?? [])])];
}

// The firewall of the VM a cluster runs in, when it is on.
export const firewallOf = (s: GameState, c: Cluster): Firewall | null => {
  const f = c.vm ? vmById(s, c.vm)?.firewall : null;
  return f?.on ? f : null;
};
// A closed port the software serves takes it offline.
export const firewallBlocks = (s: GameState, c: Cluster): boolean => {
  const f = firewallOf(s, c);
  return !!f && needs(c).some((m) => !f.allow.includes(m));
};
export function exposureFactor(s: GameState, c: Cluster): number {
  const f = firewallOf(s, c);
  return f && listens(c).some((m) => !f.allow.includes(m) && !needs(c).includes(m)) ? FIREWALL_RISK : 1;
}
