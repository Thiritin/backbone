// GDD, The desktop (Browser): what an address in the in-game browser leads to. Pure; the UI draws the page.
import { supplierHost } from "../46-finance/payables";
import { monthIndexOf, yearOf } from "../00-core/time";
import { SOFTWARE } from "../10-catalog/platforms";
import { registrarById, registrarHost, REGISTRARS, type RegistrarId } from "../10-catalog/registrars";
import { SERVER_OS, type ServerOsId } from "../10-catalog/server-os";
import { companyDomain } from "../30-customers/domains";
import { serviceOnline } from "../40-support/status";
import type { GameState } from "../50-state";
import { isOwnVm, workloadOnline, workloadsOf, type Workload } from "../60-infra/cluster";
import { machineAddress } from "../60-infra/addresses";
import { deskReaches, FRITZ_HOST, holderOf } from "../60-infra/lan";
import { isManaged, modelById } from "../10-catalog/hardware";
import { mountedRouter } from "../60-infra/routers";
import { isMgmtDevice, oobUp } from "../60-infra/oob";
import { linkStatus, powered, working } from "../60-infra/status";
import { nodeUsage } from "../60-infra/usage";
import { BOARD_HOST } from "./sponsorboard";
import { consoleAt, isDefaced } from "./consoles";
import { customerSite, siteHost, siteStatus, slowHost } from "./website";
import { vendorHost, vendorLive, VENDORS } from "./vendors";
import { OFFICE_HOST, OFFICE_URL } from "./office";
import { t } from "../../i18n/en";
import { bankById, BANKS, type BankId } from "../10-catalog/banks";
import { LEXWEAR_HOST } from "./lexwear";
import { BOOKS_VENDORS, type BooksVendorId } from "../10-catalog/bookkeeping";
import { booksHost } from "./bookkeeping";
import { SHOPS, type ShopId } from "../10-catalog/shops";
import { shopHost } from "./shoplink";

// fast loads at once, slow shows a progress bar first, down cannot be reached.
export type Load = "fast" | "slow" | "down";

export type Page =
  | { kind: "company" }
  | { kind: "customer"; serviceId: string }
  | { kind: "vendor"; maker: string }
  | { kind: "registrar"; id: RegistrarId }
  | { kind: "bank"; id: BankId }
  | { kind: "supplier"; name: string }
  | { kind: "lexwear" }
  | { kind: "books"; id: BooksVendorId }
  | { kind: "shopVendor"; id: ShopId }
  | { kind: "host"; hostname: string }
  | { kind: "console"; hostname: string; clusterId: string; defaced: boolean; path: string }
  | { kind: "ipmi"; deviceId: string }
  | { kind: "kvm"; deviceId: string }
  | { kind: "router"; deviceId: string }
  | { kind: "switch"; deviceId: string }
  | { kind: "video" }
  | { kind: "phishing"; sender: string }
  | { kind: "sponsorboard" }
  | { kind: "index" }
  | { kind: "office" }
  | { kind: "wiki" }
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

export { vendorHost, vendorLive, VENDORS } from "./vendors";

export const BOARD_URL = `${BOARD_HOST}/`;
// docs/design/software.md, 8.1: the home icon and a new browser session open the site index.
export const INDEX_HOST = "yahoy.com";
export const HOME_URL = `www.${INDEX_HOST}/dir/`;
// The encyclopedia whose articles explain the basics, such as installing a server and the home line.
export const WIKI_HOST = "wikipedio.org";
export const WIKI_TITLE = "Wikipedio";
export const WIKI_URL = `www.${WIKI_HOST}/wiki/Main_Page`;
// A site's host as links show it: a bare domain gets www., a host that already names a subdomain keeps it as it is.
export function displayHost(host: string): string {
  const labels = host.split("."), suffix = /^(co|com|org|net)\.[a-z]{2}$/.test(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.length > suffix ? host : `www.${host}`;
}
export const companyUrl = (s: GameState): string => `${displayHost(companyDomain(s))}/`;

// The registrar under contract, or the first one before any contract.
export const partnerOf = (s: GameState) => (s.registrar && registrarById(s.registrar.id)) ?? REGISTRARS[0];
export const registrarUrl = (s: GameState): string => `${displayHost(registrarHost(partnerOf(s)))}/`;
// A directory category's path segment, as the index links it.
export const dirSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const resellersUrl = (): string => `${HOME_URL}${dirSlug(t("sim.index.cat.resellers"))}`;
// Domains the game's other companies hold in any year, and every name under them.
export function providerDomain(name: string): boolean {
  const hosts = [INDEX_HOST, OFFICE_HOST, WIKI_HOST, LEXWEAR_HOST, BOARD_HOST, VIDEO_HOST, ...SOFTWARE.map((x) => x.site.host), ...SERVER_OS.map((x) => x.site.host),
    ...VENDORS.map((m) => vendorHost(m.id)), ...BANKS.map((b) => b.host), ...REGISTRARS.map(registrarHost)].map((h) => h.replace(/^www\./, ""));
  return hosts.some((h) => h === name || h.endsWith(`.${name}`));
}
// The partner's form that registers or transfers an order's domain.
export const registrarFormUrl = (s: GameState, ticketId: string, transfer: boolean): string => `${registrarUrl(s)}${transfer ? "transfer" : "register"}?order=${ticketId}`;

export const bankUrl = (id: BankId): string => `www.${bankById(id)!.host}/`;

// Bookmarks every game has: the company site once launched, the bank and the registrar. The index lists the rest.
export const defaultBookmarks = (s: GameState): { title: string; url: string }[] => [
  ...(s.registration ? [] : [{ title: t("browser-sites-1.of.title"), url: OFFICE_URL }]),
  ...(s.bank ? [{ title: bankById(s.bank.id)!.name, url: bankUrl(s.bank.id) }] : []),
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
  const match = (hostname: string | undefined, id: string) => (byIp ? machineAddress(s, id) === key : !!hostname && hostname === key);
  for (const d of s.devices) if (d.hostname !== undefined && match(d.hostname, d.id)) return { hostname: d.hostname, load: serverLoad(s, d.id) };
  for (const w of s.workloads) {
    if (!match(w.hostname, w.id) || !w.hostname) continue;
    return { hostname: w.hostname, load: isOwnVm(w) ? vmLoad(s, w) : serviceLoad(s, w.serviceId) };
  }
  for (const v of s.services) if (v.hostname && !byIp && v.hostname === key) return { hostname: v.hostname, load: serviceLoad(s, v.id) };
  return null;
}

// A machine with management software answers with its console (the one on the port, when one is given), a defaced one
// when the host is hacked; a port no console listens on finds nothing.
function machinePage(s: GameState, m: { hostname: string; load: Load }, port: string, path: string): Pick<Resolved, "page" | "load"> {
  const c = consoleAt(s, m.hostname, port, path);
  if (!c && port) return { page: { kind: "notfound" }, load: "fast" };
  return { page: c ? { kind: "console", hostname: m.hostname, clusterId: c.id, defaced: isDefaced(s, c), path } : { kind: "host", hostname: m.hostname }, load: m.load };
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
  const site = s.services.find((v) => !!v.domain && (v.domain === host || `www.${v.domain}` === host))
    ?? s.services.find((v) => !v.domain && v.product === "webHosting" && siteHost(s, v.id) === host);
  if (site) {
    const c = customerSite(s, site.id);
    if (c) return out({ kind: "customer", serviceId: site.id }, c.status === "down" ? "down" : c.status === "slow" ? "slow" : "fast");
  }
  const named = (bare: string) => host === bare || host === `www.${bare}`;
  if (named(INDEX_HOST)) return out({ kind: "index" });
  if (named(OFFICE_HOST)) return out({ kind: "office" });
  if (named(WIKI_HOST)) return out({ kind: "wiki" });
  if (named(LEXWEAR_HOST)) return out({ kind: "lexwear" });
  // Every shop system but the hand-rolled form has its vendor's site, from the year it is sold.
  const shopSite = SHOPS.find((v) => v.id !== "handRolled" && v.from <= yearOf(s.hour) && named(shopHost(v.id)));
  if (shopSite) return out({ kind: "shopVendor", id: shopSite.id });
  // A software's site exists from the year the software does; an operating system's always.
  const year = yearOf(s.hour), sw = SOFTWARE.find((x) => named(x.site.host) && x.from <= year);
  if (sw) return out({ kind: "software", id: sw.id });
  const books = BOOKS_VENDORS.find((v) => v.id !== "lexwear" && named(booksHost(v)) && v.from <= year);
  if (books) return out({ kind: "books", id: books.id });
  const os = SERVER_OS.find((x) => named(x.site.host));
  if (os) return out({ kind: "os", id: os.id });
  const vendor = VENDORS.find((m) => named(vendorHost(m.id)) && vendorLive(m, monthIndexOf(s.hour)));
  if (vendor) return out({ kind: "vendor", maker: vendor.id });
  if (named(BOARD_HOST)) return out({ kind: "sponsorboard" });
  const bank = BANKS.find((b) => named(b.host) && b.from <= year);
  if (bank) return out({ kind: "bank", id: bank.id });
  const registrar = REGISTRARS.find((r) => named(registrarHost(r)));
  // A supplier's portal opens once it has sent an invoice; a registrar's sits under /account of its site.
  const supplier = [...new Set(s.payables.filter((p) => p.supplier !== "card").map((p) => p.name))].find((n) => named(supplierHost(n)));
  if (supplier && (!registrar || path.startsWith("/account"))) return out({ kind: "supplier", name: supplier });
  if (registrar) return out({ kind: "registrar", id: registrar.id });
  if (named(VIDEO_HOST)) {
    return /[?&]v=uptime(&|$)/.test(path) ? out({ kind: "video" }) : out({ kind: "notfound" });
  }
  // A machine's address may name the port of one of its consoles.
  const colon = host.indexOf(":"), name = colon < 0 ? host : host.slice(0, colon), port = colon < 0 ? "" : host.slice(colon);
  // The basement router answers on fritz.bocks and on its own address.
  if (name === FRITZ_HOST) {
    const home = s.locations.find((l) => !l.dc), router = home && mountedRouter(s, home.id);
    return out({ kind: "router", deviceId: router?.id ?? "" }, router && deskReaches(s, router.id, "router") ? "fast" : "down");
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) {
    // A device on a network the desk does not reach times out.
    const at = holderOf(s, name);
    if (at && !deskReaches(s, at.deviceId, at.iface)) return out({ kind: "notfound" }, "down");
    const d = at && s.devices.find((x) => x.id === at.deviceId);
    if (d && at.iface === "router") return out({ kind: "router", deviceId: d.id });
    // The management controller answers on standby power, so a switched-off server still has its page; a hung one answers nothing.
    if (d && at.iface === "bmc") return out({ kind: "ipmi", deviceId: d.id }, powered(s, d.id) && !d.bmcHung ? "fast" : "down");
    if (d && isMgmtDevice(d)) return out({ kind: "kvm", deviceId: d.id }, oobUp(s, d.id) ? "fast" : "down");
    if (d && isManaged(modelById(d.model))) return out({ kind: "switch", deviceId: d.id }, working(s, d.id) ? "fast" : "down");
    const m = machineOf(s, name, true);
    return m ? { url, host, path, ...machinePage(s, m, port, path) } : out({ kind: "notfound" }, "down");
  }
  if (s.company.domain && name.endsWith(`.${domain}`)) {
    const m = machineOf(s, name.slice(0, -domain.length - 1), false);
    if (m) return { url, host, path, ...machinePage(s, m, port, path) };
  }
  return out({ kind: "notfound" });
}
