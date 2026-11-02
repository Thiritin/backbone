// docs/design/web-hosting.md, section 6: what a domain pointing at a web space shows in the Browser.
// The page follows the folder: no files give the panel's placeholder, files without an index give the folder listing,
// an app gives its default theme, or its error when the app is broken.
import type { App } from "../10-catalog/apps";
import { serviceHeld } from "../45-billing/billing";
import { workloadOnline, type Workload } from "../60-infra/cluster";
import { appState, webspaceOf, type Webspace } from "../60-infra/webspace";
import type { GameState } from "../50-state";
import { customerSite, slowHost } from "./website";

export type SiteError = "db" | "fatal" | "http500" | "suspended";
export interface ListEntry { name: string; dir: boolean; at: number; mb: number }
export type SiteBody =
  // A static site: the customer's designed page, or a plain page for the player's own.
  | { kind: "customer"; serviceId: string }
  | { kind: "static"; domain: string }
  | { kind: "app"; app: Exclude<App, "static">; domain: string; title: string; since: number }
  | { kind: "error"; error: SiteError; app: App | null; panel: string; domain: string; home: string; detail: string }
  // listing is null for the panel's placeholder page.
  | { kind: "index"; panel: string; domain: string; listing: ListEntry[] | null };
export interface WebsiteHit { workloadId: string; body: SiteBody; load: "fast" | "slow" | "down" }

const INDEX_FILES = ["index.html", "index.htm", "index.php", "default.htm", "index.shtml"];
// Domains read like the Browser's host: the www form reaches the same folder.
const bare = (host: string): string => (host.startsWith("www.") ? host.slice(4) : host);

const panelWorkload = (s: GameState, w: Workload): boolean => s.clusters.some((c) => c.id === w.clusterId && c.kind === "panel" && !!c.panel);

// The panel workload a name points at: a customer's domain or a domain the player added to a web space.
function spaceAt(s: GameState, name: string): Workload | null {
  const added = Object.entries(s.webspaces).find(([, o]) => !!o.domains?.[name]);
  const aw = added && s.workloads.find((w) => w.id === added[0]);
  if (aw) return aw;
  const v = s.services.find((x) => x.domain === name);
  const w = v && s.workloads.find((x) => x.serviceId === v.id && panelWorkload(s, x));
  return w && s.webspaces[w.id]?.domains?.[name] !== false ? w : null;
}

function listing(ws: Webspace, folder: string): ListEntry[] {
  const out: ListEntry[] = [];
  for (const [path, f] of Object.entries(ws.files)) {
    const name = path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : "";
    if (name && !name.includes("/") && !name.startsWith(".")) out.push({ name, dir: !!f.dir, at: f.at, mb: f.mb });
  }
  return out.sort((a, b) => +b.dir - +a.dir || a.name.localeCompare(b.name));
}

// What the folder of one domain of a web space serves, and how fast.
export function siteBody(s: GameState, w: Workload, name: string): WebsiteHit | null {
  const ws = webspaceOf(s, w.id), d = ws?.domains[name];
  if (!ws || !d) return null;
  const v = s.services.find((x) => x.id === w.serviceId), site = v && customerSite(s, v.id);
  const hit = (body: SiteBody, load: WebsiteHit["load"] = "fast"): WebsiteHit => ({ workloadId: w.id, body, load });
  const home = `/home/${ws.account}/${d.folder}`;
  // detail is the config file of a fatal error and the missing database of a connection error.
  const err = (error: SiteError, app: App | null, detail = ""): SiteBody => ({ kind: "error", error, app, panel: ws.panel, domain: name, home, detail });
  if (v && (v.endedAt !== null || serviceHeld(s, v))) return hit(err("suspended", null));
  const cluster = s.clusters.find((c) => c.id === w.clusterId);
  const load = site ? (site.status === "down" ? "down" : site.status === "slow" ? "slow" : "fast")
    : !workloadOnline(s, w) ? "down" : slowHost(s, w, cluster) ? "slow" : "fast";
  if (site?.status === "defaced") return hit({ kind: "customer", serviceId: v!.id }, load);
  const files = listing(ws, d.folder);
  if (!files.some((f) => !f.dir && INDEX_FILES.includes(f.name))) return hit({ kind: "index", panel: ws.panel, domain: name, listing: files.length ? files : null }, load);
  const app = ws.app?.folder === d.folder ? ws.app : null;
  if (!app) return hit(v && site ? { kind: "customer", serviceId: v.id } : { kind: "static", domain: name }, load);
  if (appState(ws) === "broken") return hit(ws.files[app.config] ? err("db", app.id, app.db) : err("fatal", app.id, `/home/${ws.account}/${app.config}`), load);
  // A site over its disk quota cannot write its sessions and cache.
  if (ws.usage.diskMb > ws.usage.quotaMb) return hit(err("http500", app.id), load);
  return hit({ kind: "app", app: app.id as Exclude<App, "static">, domain: name, title: site?.title ?? name, since: v?.startedAt ?? w.placedAt }, load);
}

// The site at a host, for the domains of web spaces.
export function webspaceSite(s: GameState, host: string): WebsiteHit | null {
  const name = bare(host), w = spaceAt(s, name);
  return w ? siteBody(s, w, name) : null;
}

// The panel's default page of a name that points at a web space nobody has filled yet.
export function placeholderSite(s: GameState, host: string): WebsiteHit | null {
  const c = s.clusters.find((x) => x.kind === "panel" && x.panel);
  return c ? { workloadId: "", body: { kind: "index", panel: c.panel!, domain: bare(host), listing: null }, load: "fast" } : null;
}
