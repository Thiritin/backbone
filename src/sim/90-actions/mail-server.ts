// docs/design/plans/webmail-server.md: setting up the webmail front ends of the own mail server.
import type { GameState } from "../50-state";
import type { Cluster } from "../60-infra/cluster";
import { frontOf, mailClusterAt, webmailClusters, webmailDefaults, webmailOf, WEBMAIL_PLUGINS, type WebmailInstall } from "../80-business/webmail";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const port = (p: number) => Number.isInteger(p) && p > 0 && p < 65536;

function save(s: GameState, c: Cluster, cfg: WebmailInstall, setupPending: boolean): void {
  s.webmail = { ...s.webmail, installs: { ...s.webmail.installs, [c.id]: cfg } };
  const backend = mailClusterAt(s, c, cfg.imapHost)?.id ?? null;
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, backend, setupPending } : x));
}

// A fresh front end takes the mail server on its machine; SquirrelMeal opens its setup menu first.
export function startWebmail(s: GameState, clusterId: string): void {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (c) save(s, c, webmailDefaults(s, c), frontOf(c) === "squirrelmeal");
}

// Saves the setup menu of a front end; the IMAP server it names becomes its backend.
export function configureWebmail(s: GameState, clusterId: string, cfg: Partial<WebmailInstall>): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c || c.kind !== "mailweb") return fail("error.unknownCluster");
  const next = { ...webmailOf(s, c), ...cfg };
  if (!next.imapHost.trim() || !next.smtpHost.trim() || !port(next.imapPort) || !port(next.smtpPort)) return fail("error.webmailConfig");
  if (next.plugins.some((p) => !(WEBMAIL_PLUGINS as readonly string[]).includes(p))) return fail("error.webmailConfig");
  save(s, c, { ...next, imapHost: next.imapHost.trim(), smtpHost: next.smtpHost.trim() }, false);
  return { ok: true, id: c.id };
}

// Picks the front end that answers at webmail.<domain>.
export function setWebmailDefault(s: GameState, clusterId: string): ActionResult {
  if (!webmailClusters(s).some((c) => c.id === clusterId)) return fail("error.unknownCluster");
  s.webmail = { ...s.webmail, default: clusterId };
  return { ok: true, id: clusterId };
}

// Removing a front end drops what it kept; the mail stays on the server.
export function dropWebmail(s: GameState, clusterId: string): void {
  const { [clusterId]: _, ...installs } = s.webmail.installs;
  s.webmail = { installs, default: s.webmail.default === clusterId ? null : s.webmail.default };
}
