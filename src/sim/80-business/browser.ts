// GDD, The desktop (Browser): what an address in the in-game browser leads to. Pure; the UI draws the page.
import { MANUFACTURERS } from "../10-catalog/hardware";
import { companyDomain } from "../30-customers/domains";
import { serviceOnline } from "../40-support/status";
import type { GameState } from "../50-state";
import { isOwnVm, workloadOnline, workloadsOf, type Workload } from "../60-infra/cluster";
import { ipmiIp, oobIp, privateIp } from "../60-infra/addresses";
import { oobUp } from "../60-infra/oob";
import { linkStatus, powered, working } from "../60-infra/status";
import { nodeUsage } from "../60-infra/usage";
import { consoleBookmarks, consoleCluster, isDefaced } from "./consoles";
import { customerSite, siteStatus, slowHost } from "./website";

// fast loads at once, slow shows a progress bar first, down cannot be reached.
export type Load = "fast" | "slow" | "down";

export type Page =
  | { kind: "company" }
  | { kind: "admin" }
  | { kind: "customer"; serviceId: string }
  | { kind: "vendor"; maker: string }
  | { kind: "host"; hostname: string }
  | { kind: "console"; hostname: string; clusterId: string; defaced: boolean }
  | { kind: "ipmi"; deviceId: string }
  | { kind: "kvm"; deviceId: string }
  | { kind: "video" }
  | { kind: "notfound" };

export interface Resolved { url: string; host: string; path: string; page: Page; load: Load }

export const VIDEO_URL = "youtub.example/watch?v=uptime";
export const VIDEO_TITLE = "Never Gonna Give You Uptime";
export const VIDEO_ARTIST = "Rick Astley-Packet";
export const VIDEO_REAL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

// The brands with a site of their own: every manufacturer that sells machines or network gear.
export const VENDORS = MANUFACTURERS.filter((m) => m.id !== "generic");
export const vendorHost = (id: string): string => `${id}.example`;

export const adminUrl = (s: GameState): string => `www.${companyDomain(s)}/admin`;
export const companyUrl = (s: GameState): string => `www.${companyDomain(s)}/`;

// Bookmarks every game has, and a console for each management software the company runs.
export const defaultBookmarks = (s: GameState): { title: string; url: string }[] => [
  { title: s.company.name, url: companyUrl(s) },
  { title: "Admin", url: adminUrl(s) },
  ...consoleBookmarks(s),
];

// Splits what the player typed into a lowercase host and a path with its query; the scheme and a trailing dot fall away.
export function split(raw: string): { host: string; path: string } {
  const bare = raw.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const cut = bare.search(/[/?#]/), host = (cut < 0 ? bare : bare.slice(0, cut)).toLowerCase().replace(/\.$/, "");
  const path = cut < 0 ? "/" : bare.slice(cut).replace(/#.*$/, "");
  return { host, path: path.startsWith("?") ? `/${path}` : path || "/" };
}

const slow = (hostSlow: boolean): Load => (hostSlow ? "slow" : "fast");

// How a machine answers: a server that is off, failed or cut from the internet cannot be reached, a loaded one answers slowly.
function serverLoad(s: GameState, id: string): Load {
  return !working(s, id) || !linkStatus(s, id).online ? "down" : slow(nodeUsage(s, id).perf < 1);
}

// The player's own VM answers like its workload; a customer's workload like its service.
function vmLoad(s: GameState, w: Workload): Load {
  if (!workloadOnline(s, w)) return "down";
  return slow(slowHost(s, w, s.clusters.find((c) => c.id === w.clusterId)));
}

function serviceLoad(s: GameState, serviceId: string): Load {
  if (!serviceOnline(s, serviceId)) return "down";
  return slow(workloadsOf(s, serviceId).some((w) => slowHost(s, w, s.clusters.find((c) => c.id === w.clusterId))));
}

// The machine a hostname or private address names, with the load it answers with.
function machineOf(s: GameState, key: string, byIp: boolean): { hostname: string; load: Load } | null {
  const match = (hostname: string | undefined, id: string) => (byIp ? privateIp(s, id) === key : !!hostname && hostname === key);
  for (const d of s.devices) if (d.hostname !== undefined && match(d.hostname, d.id)) return { hostname: d.hostname, load: serverLoad(s, d.id) };
  for (const w of s.workloads) {
    if (!match(w.hostname, w.id) || !w.hostname) continue;
    return { hostname: w.hostname, load: isOwnVm(w) ? vmLoad(s, w) : serviceLoad(s, w.serviceId) };
  }
  for (const v of s.services) if (v.hostname && !byIp && v.hostname === key) return { hostname: v.hostname, load: serviceLoad(s, v.id) };
  return null;
}

// A machine with management software answers with its console, a defaced one when the host is hacked.
function machinePage(s: GameState, m: { hostname: string; load: Load }): Pick<Resolved, "page" | "load"> {
  const c = consoleCluster(s, m.hostname);
  return { page: c ? { kind: "console", hostname: m.hostname, clusterId: c.id, defaced: isDefaced(s, c) } : { kind: "host", hostname: m.hostname }, load: m.load };
}

export function resolve(s: GameState, raw: string): Resolved {
  const { host, path } = split(raw), url = `${host}${path}`;
  const out = (page: Page, load: Load = "fast"): Resolved => ({ url, host, path, page, load });
  const domain = companyDomain(s);
  if (host === domain || host === `www.${domain}`) {
    if (path.replace(/\/$/, "") === "/admin") return out({ kind: "admin" });
    const st = siteStatus(s);
    return out({ kind: "company" }, st === "up" ? "fast" : st === "slow" ? "slow" : "down");
  }
  const site = s.services.find((v) => !!v.domain && (v.domain === host || `www.${v.domain}` === host));
  if (site) {
    const c = customerSite(s, site.id);
    if (c) return out({ kind: "customer", serviceId: site.id }, c.status === "down" ? "down" : c.status === "slow" ? "slow" : "fast");
  }
  const vendor = VENDORS.find((m) => host === vendorHost(m.id) || host === `www.${vendorHost(m.id)}`);
  if (vendor) return out({ kind: "vendor", maker: vendor.id });
  if (host === "youtub.example" || host === "www.youtub.example") {
    return /[?&]v=uptime(&|$)/.test(path) ? out({ kind: "video" }) : out({ kind: "notfound" });
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    // The management controller answers on standby power, so a switched-off server still has its page; a hung one answers nothing.
    const bmc = s.devices.find((d) => ipmiIp(s, d.id) === host);
    if (bmc) return out({ kind: "ipmi", deviceId: bmc.id }, powered(s, bmc.id) && !bmc.bmcHung ? "fast" : "down");
    const kvm = s.devices.find((d) => oobIp(s, d.id) === host);
    if (kvm) return out({ kind: "kvm", deviceId: kvm.id }, oobUp(s, kvm.id) ? "fast" : "down");
    const m = machineOf(s, host, true);
    return m ? { url, host, path, ...machinePage(s, m) } : out({ kind: "notfound" });
  }
  if (s.company.domain && host.endsWith(`.${domain}`)) {
    const m = machineOf(s, host.slice(0, -domain.length - 1), false);
    if (m) return { url, host, path, ...machinePage(s, m) };
  }
  return out({ kind: "notfound" });
}
