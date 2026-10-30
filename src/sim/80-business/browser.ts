// GDD, The desktop (Browser): what an address in the in-game browser leads to. Pure; the UI draws the page.
import { yearOf } from "../00-core/time";
import { SOFTWARE } from "../10-catalog/platforms";
import { registrarById, registrarHost, REGISTRARS, type RegistrarId } from "../10-catalog/registrars";
import { SERVER_OS, type ServerOsId } from "../10-catalog/server-os";
import { companyDomain } from "../30-customers/domains";
import { serviceOnline } from "../40-support/status";
import type { GameState } from "../50-state";
import { isOwnVm, workloadOnline, workloadsOf, type Workload } from "../60-infra/cluster";
import { ipmiIp, oobIp, privateIp } from "../60-infra/addresses";
import { oobUp } from "../60-infra/oob";
import { linkStatus, powered, working } from "../60-infra/status";
import { nodeUsage } from "../60-infra/usage";
import { BOARD_HOST } from "./sponsorboard";
import { consoleCluster, isDefaced } from "./consoles";
import { customerSite, siteStatus, slowHost } from "./website";
import { vendorHost, VENDORS } from "./vendors";

// fast loads at once, slow shows a progress bar first, down cannot be reached.
export type Load = "fast" | "slow" | "down";

export type Page =
  | { kind: "company" }
  | { kind: "customer"; serviceId: string }
  | { kind: "vendor"; maker: string }
  | { kind: "registrar"; id: RegistrarId }
  | { kind: "host"; hostname: string }
  | { kind: "console"; hostname: string; clusterId: string; defaced: boolean }
  | { kind: "ipmi"; deviceId: string }
  | { kind: "kvm"; deviceId: string }
  | { kind: "video" }
  | { kind: "phishing"; sender: string }
  | { kind: "sponsorboard" }
  | { kind: "index" }
  | { kind: "software"; id: string }
  | { kind: "os"; id: ServerOsId }
  | { kind: "notfound" };

export interface Resolved { url: string; host: string; path: string; page: Page; load: Load }

export const BOARD_TITLE = "Sponsor-Bored";
export const VIDEO_HOST = "youtub.com";
export const VIDEO_URL = `${VIDEO_HOST}/watch?v=uptime`;
export const VIDEO_TITLE = "Never Gonna Give You Uptime";
export const VIDEO_ARTIST = "Rick Astley-Packet";
export const VIDEO_REAL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export { vendorHost, VENDORS } from "./vendors";

export const BOARD_URL = `${BOARD_HOST}/`;
// docs/design/software.md, 8.1: the home icon and a new browser session open the site index.
export const INDEX_HOST = "yahoy.com";
export const HOME_URL = `www.${INDEX_HOST}/dir/`;
export const companyUrl = (s: GameState): string => `www.${companyDomain(s)}/`;

// The registrar under contract, or the first one before any contract.
export function registrarUrl(s: GameState): string {
  const r = (s.registrar && registrarById(s.registrar.id)) ?? REGISTRARS[0];
  return `www.${registrarHost(r)}/`;
}

// Bookmarks every game has: the company site once launched and the registrar. The index lists the rest.
export const defaultBookmarks = (s: GameState): { title: string; url: string }[] => [
  ...(s.marketing.launched ? [{ title: s.company.name, url: companyUrl(s) }] : []),
  { title: ((s.registrar && registrarById(s.registrar.id)) ?? REGISTRARS[0]).name, url: registrarUrl(s) },
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
  // A phishing page a notice reports stays up until the player takes it down.
  const phish = s.tickets.filter((t) => t.topic === "phishing" && t.notice && split(t.notice.url).host === host && split(t.notice.url).path === path);
  if (phish.length && !phish.some((t) => t.outcome === "takenDown" || t.outcome === "seized")) return out({ kind: "phishing", sender: phish[0].notice!.sender });
  if (host === domain || host === `www.${domain}`) {
    if (!s.marketing.launched) return out({ kind: "notfound" });
    const st = siteStatus(s);
    return out({ kind: "company" }, st === "up" ? "fast" : st === "slow" ? "slow" : "down");
  }
  const site = s.services.find((v) => !!v.domain && (v.domain === host || `www.${v.domain}` === host));
  if (site) {
    const c = customerSite(s, site.id);
    if (c) return out({ kind: "customer", serviceId: site.id }, c.status === "down" ? "down" : c.status === "slow" ? "slow" : "fast");
  }
  const named = (bare: string) => host === bare || host === `www.${bare}`;
  if (named(INDEX_HOST)) return out({ kind: "index" });
  // A software's site exists from the year the software does; an operating system's always.
  const year = yearOf(s.hour), sw = SOFTWARE.find((x) => named(x.site.host) && x.from <= year);
  if (sw) return out({ kind: "software", id: sw.id });
  const os = SERVER_OS.find((x) => named(x.site.host));
  if (os) return out({ kind: "os", id: os.id });
  const vendor = VENDORS.find((m) => named(vendorHost(m.id)));
  if (vendor) return out({ kind: "vendor", maker: vendor.id });
  if (named(BOARD_HOST)) return out({ kind: "sponsorboard" });
  const registrar = REGISTRARS.find((r) => named(registrarHost(r)));
  if (registrar) return out({ kind: "registrar", id: registrar.id });
  if (named(VIDEO_HOST)) {
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
