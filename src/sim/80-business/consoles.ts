// GDD, Software choices (Consoles): what the web console of each piece of software offers. Pure; the browser draws it.
import { softwareById } from "../10-catalog/platforms";
import { fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { clusterOf, hostOfVm, isOwnVm, vmById, type Cluster } from "../60-infra/cluster";
import { familyOf } from "../60-infra/vulns";

// One look per product; both mail servers share a plain mail admin and the game panels share a dark one.
export type ConsoleLook =
  | "cpanic" | "pleskit" | "directadmen" | "freepanel" | "horizont" | "vsphear" | "proxmocks" | "hypervee" | "openveezee" | "mail" | "game";

// How a console moves objects to another host: a panel by hand, a hypervisor live or cold.
export type MigrateMode = "hand" | "live" | "cold";

export interface ConsoleFeatures {
  look: ConsoleLook;
  create: boolean; delete: boolean; stop: boolean; start: boolean;
  migrate: MigrateMode | null;
  resize: boolean; backups: boolean; update: boolean; sitesOffline: boolean; cleanUp: boolean; cluster: boolean;
}

// Game panels may be missing from the catalog; their rows come from here either way.
const GAME_PANELS = ["tcadmen", "multikraft", "pterodaktyl"];

const LOOK: Record<string, ConsoleLook> = {
  cpanic: "cpanic", pleskit: "pleskit", directadmen: "directadmen", freepanel: "freepanel", openstash: "horizont", vmwhere: "vsphear",
  proxmocks: "proxmocks", hypervee: "hypervee", openveezee: "openveezee", postfixit: "mail", mailpig: "mail",
};

export function consoleLook(softwareId: string): ConsoleLook {
  if (GAME_PANELS.includes(softwareId)) return "game";
  const sw = softwareById(softwareId);
  return LOOK[sw.id] ?? ((sw.kind as string) === "game" ? "game" : sw.kind === "cloud" ? "proxmocks" : sw.kind === "mail" ? "mail" : "freepanel");
}

// docs/design/gdd.md, Software choices: the matrix. Panels migrate from the year their tool imports from another panel;
// a hypervisor migrates live or cold by its trait from the year it can; clusters follow the software's cluster year.
export function consoleFeatures(softwareId: string, year: number): ConsoleFeatures {
  const look = consoleLook(softwareId), sw = softwareById(softwareId), game = look === "game", mail = look === "mail";
  const cloud = !game && sw.kind === "cloud", panel = !game && sw.kind === "panel";
  const migrate: MigrateMode | null = panel ? (sw.migration.other !== null && year >= sw.migration.other ? "hand" : null)
    : cloud ? (year >= (sw.migration.same ?? sw.from) ? (sw.live ? "live" : "cold") : null) : null;
  return {
    look,
    create: !mail, delete: !mail, stop: !mail, start: !mail,
    migrate,
    resize: (panel && softwareId !== "freepanel") || cloud,
    backups: ["cpanic", "pleskit", "directadmen", "vmwhere", "proxmocks", "pterodaktyl"].includes(softwareId),
    update: true,
    sitesOffline: panel || game,
    cleanUp: panel || game,
    cluster: !game && !mail && sw.cluster !== null && year >= sw.cluster,
  };
}

// The cluster whose software answers at a hostname: a server's, or the player's own VM the panel runs in.
export function consoleCluster(s: GameState, hostname: string): Cluster | null {
  const d = s.devices.find((x) => x.hostname === hostname);
  const vm = d ? undefined : s.workloads.find((w) => w.hostname === hostname && isOwnVm(w));
  const c = d ? clusterOf(s, d.id) : vm ? hostOfVm(s, vm.id) : undefined;
  return c && familyOf(c) ? c : null;
}

export const isDefaced = (s: GameState, c: Cluster): boolean => s.security.hacked.includes(c.id);

// The hostname a cluster's console is bookmarked at: its VM, or the node that runs its control plane.
export function consoleHost(s: GameState, c: Cluster): string | null {
  if (c.vm) return vmById(s, c.vm)?.hostname ?? null;
  const id = c.controlPlane ?? c.nodes[0]?.deviceId;
  return s.devices.find((d) => d.id === id)?.hostname ?? null;
}

// One bookmark per console the company runs.
export function consoleBookmarks(s: GameState): { title: string; url: string }[] {
  if (!s.company.domain) return [];
  return s.clusters.flatMap((c) => {
    const family = familyOf(c), host = family && consoleHost(s, c);
    return family && host ? [{ title: `${softwareById(family).console} ${c.name}`, url: fqdn(s, host) }] : [];
  });
}
