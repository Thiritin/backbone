// GDD, Software choices (Consoles): what the web console of each piece of software offers. Pure; the browser draws it.
import { isService, softwareById } from "../10-catalog/platforms";
import type { Product } from "../30-customers/customers";
import { fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { clustersOf, hostsOfVm, isOwnVm, vmById, type Cluster } from "../60-infra/cluster";
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

const GAME_NAMES: Record<string, string> = { tcadmen: "TCAdmen", multikraft: "MultiKraft", pterodaktyl: "Pterodaktyl" };
// The product name on a console: the catalog's console name, or the game panel's own.
export function consoleTitle(softwareId: string): string {
  const sw = softwareById(softwareId);
  return sw.id === softwareId ? sw.console : GAME_NAMES[softwareId] ?? softwareId;
}

export function consoleLook(softwareId: string): ConsoleLook {
  if (GAME_PANELS.includes(softwareId)) return "game";
  const sw = softwareById(softwareId);
  return LOOK[sw.id] ?? (isService(sw.kind) ? "game" : sw.kind === "cloud" ? "proxmocks" : sw.kind === "mail" ? "mail" : "freepanel");
}

// docs/design/gdd.md, Software choices: the matrix. Panels migrate from the year their tool imports from the same or another panel;
// a hypervisor migrates live or cold by its trait from the year it can; clusters follow the software's cluster year.
export function consoleFeatures(softwareId: string, year: number): ConsoleFeatures {
  const look = consoleLook(softwareId), sw = softwareById(softwareId), game = look === "game", mail = look === "mail";
  const cloud = !game && sw.kind === "cloud", panel = !game && sw.kind === "panel";
  const migrate: MigrateMode | null = panel ? (year >= Math.min(sw.migration.same ?? Infinity, sw.migration.other ?? Infinity) ? "hand" : null)
    : cloud ? (year >= (sw.migration.same ?? sw.from) ? (sw.live ? "live" : "cold") : null) : null;
  return {
    look,
    create: !mail, delete: !mail, stop: !mail, start: !mail,
    migrate,
    resize: (panel && softwareId !== "freepanel") || cloud,
    // Every console with a backup server that reads it schedules its jobs there.
    backups: !mail && sw.kind !== "backup",
    update: true,
    sitesOffline: panel || game,
    cleanUp: panel || game,
    cluster: !game && !mail && sw.cluster !== null && year >= sw.cluster,
  };
}

// Every cluster whose software answers at a hostname, the hypervisor first and then the panel: a server's, or those in
// the player's own VM.
export function consoleClusters(s: GameState, hostname: string): Cluster[] {
  const d = s.devices.find((x) => x.hostname === hostname);
  const vm = d ? undefined : s.workloads.find((w) => w.hostname === hostname && isOwnVm(w));
  return (d ? clustersOf(s, d.id) : vm ? hostsOfVm(s, vm.id) : []).filter((c) => familyOf(c));
}

// docs/design/software.md, 8.2: the port each console also answers on, next to the host's own address; Mailpig answers
// on a path.
const CONSOLE_AT: Record<string, string> = {
  proxmocks: ":8006", cpanic: ":2087", pleskit: ":8443", directadmen: ":2222", freepanel: ":10000", tcadmen: ":8880", multikraft: ":8080",
  pterodaktyl: ":8080", powerdnz: ":8081", openveepeen: ":943", minnio: ":9001", anyconnekt: ":443", mailpig: "/admin",
};
const atOf = (c: Cluster): string => CONSOLE_AT[familyOf(c) ?? ""] ?? "";

// The console at a host's address: the one on the port when one is given, Mailpig on /admin, otherwise the first.
export function consoleAt(s: GameState, hostname: string, port = "", path = "/"): Cluster | null {
  const all = consoleClusters(s, hostname);
  if (port) return all.find((c) => atOf(c) === port) ?? null;
  return (/^\/admin(\/|$)/.test(path) ? all.find((c) => atOf(c) === "/admin") : undefined) ?? all[0] ?? null;
}

// What follows the host in a console's address (its port, its path, or nothing), or null when another console holds it.
export function consoleSuffix(s: GameState, c: Cluster): string | null {
  const host = consoleHost(s, c), at = atOf(c);
  if (!host) return null;
  return consoleAt(s, host, at.startsWith(":") ? at : "", at.startsWith("/") ? at : "/")?.id === c.id ? at : null;
}

export const isDefaced = (s: GameState, c: Cluster): boolean => s.security.hacked.includes(c.id);

// The hostname a cluster's console is bookmarked at: its VM, or the node that runs its control plane.
export function consoleHost(s: GameState, c: Cluster): string | null {
  if (c.vm) return vmById(s, c.vm)?.hostname ?? null;
  const id = c.controlPlane ?? c.nodes[0]?.deviceId;
  return s.devices.find((d) => d.id === id)?.hostname ?? null;
}

// One bookmark per console the company runs, at its port.
export function consoleBookmarks(s: GameState): { title: string; url: string }[] {
  if (!s.company.domain) return [];
  return s.clusters.flatMap((c) => {
    const family = familyOf(c), host = family && consoleHost(s, c), at = consoleSuffix(s, c);
    return family && host && at !== null ? [{ title: `${consoleTitle(family)} ${c.name}${at}`, url: fqdn(s, host) + at }] : [];
  });
}

// The real-looking address of each console's create-account form, imitating the product it is named after.
export const CREATE_PATH: Record<string, string> = {
  cpanic: "/scripts/wwwacct", directadmen: "/CMD_ACCOUNT_USER", pleskit: "/admin/subscription/create", freepanel: "/virtual-server/domain_form.cgi",
  tcadmen: "/Services/Create", multikraft: "/servers/create", pterodaktyl: "/admin/servers/new", proxmocks: "/?create=vm", vmwhere: "/ui/app/vm/new",
  hypervee: "/vm/new", openveezee: "/virtual-servers/create", openstash: "/project/instances/launch",
};
export const PACKAGES_PATH: Record<string, string> = {
  cpanic: "/scripts/addpkg", tcadmen: "/Services/Defaults", proxmocks: "/?plans=1", directadmen: "/CMD_PACKAGES_USER", pleskit: "/admin/service-plan/list",
  freepanel: "/virtual-server/edit_plan.cgi", multikraft: "/plans", pterodaktyl: "/admin/nests",
};

// The products each console has a create form for; a console gains its entry in the milestone that draws its form.
const CREATE_FORMS: Record<string, Product[]> = {
  cpanic: ["webHosting"], proxmocks: ["vps", "gameServer", "cloud"], tcadmen: ["gameServer"],
  directadmen: ["webHosting"], pleskit: ["webHosting"], freepanel: ["webHosting"], multikraft: ["gameServer"], pterodaktyl: ["gameServer"],
};
export const createFormFor = (family: string | null, product: Product): boolean => !!family && !!CREATE_FORMS[family]?.includes(product);

export type CreateScreen = { screen: "create"; order?: string } | { screen: "packages" } | null;

const same = (spec: string | undefined, u: URL): boolean => {
  if (!spec) return false;
  const w = new URL(spec, "http://x");
  return w.pathname === u.pathname && [...w.searchParams].every(([k, v]) => u.searchParams.get(k) === v);
};

// Which of a console's own screens an address inside it names.
export function parseCreate(family: string | null, path: string | undefined): CreateScreen {
  if (!family || !path) return null;
  const u = new URL(path, "http://x");
  if (same(CREATE_PATH[family], u)) return { screen: "create", ...(u.searchParams.get("order") && { order: u.searchParams.get("order")! }) };
  return same(PACKAGES_PATH[family], u) ? { screen: "packages" } : null;
}

// The address of a console's create form with an order picked, or null when the console has no form.
export function createLink(s: GameState, clusterId: string, ticketId: string): string | null {
  const c = s.clusters.find((x) => x.id === clusterId), family = c && familyOf(c), spec = family && CREATE_PATH[family];
  const host = c && consoleHost(s, c), at = c && consoleSuffix(s, c);
  if (!spec || host === null || host === undefined || at === null || at === undefined) return null;
  return `${fqdn(s, host)}${at}${spec}${spec.includes("?") ? "&" : "?"}order=${ticketId}`;
}
