// Subscribing to a hosted desk and installing a self-hosted one (docs/design/plans/support-desk.md, The desk site).
import { deskById, deskReady, tenantHost, type DeskId } from "../10-catalog/desks";
import { versionAt } from "../10-catalog/software-versions";
import { deskItem, monthlyCharge, subscriptionEntry } from "../10-catalog/store";
import { deskPath } from "../80-business/deskroutes";
import { dropDesk, openDesk } from "../40-support/desk";
import { deliverMail } from "../40-support/tickets";
import { licenceBlock } from "../60-infra/licence";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const TENANT = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// Signs up on the vendor's site: the first month for every seat is paid at once and the tick bills each later one.
// Another desk in use is replaced, with its configuration; tickets stay.
export function subscribeDesk(s: GameState, tenant: string, id: DeskId): ActionResult {
  const d = deskById(id);
  if (d?.hosting !== "hosted") return fail("error.unknownDesk");
  if (!deskReady(s, id)) return fail("error.deskNotYet");
  const name = tenant.trim().toLowerCase();
  if (!TENANT.test(name)) return fail("error.deskTenant");
  if (s.desk?.id === id) return fail("error.deskInUse");
  const item = deskItem(d), price = monthlyCharge(s, item);
  if (s.cash < price) return fail("error.noCash");
  s.cash = Math.round((s.cash - price) * 100) / 100;
  s.ledger = [...s.ledger, subscriptionEntry(s, item)];
  dropDesk(s);
  openDesk(s, id, { kind: "hosted" }, name);
  const host = tenantHost(d, name);
  deliverMail(s, d.name, "deskWelcome", { desk: d.name, url: `${host}${id === "zendusk" ? deskPath("zendusk", "agent") : deskPath("freshdusk", "dashboard")}`, address: `support@${host}` });
  return { ok: true };
}

// Installs the newest release into a web space of a panel host, which counts against the panel's licence. The same desk on
// another host moves with its configuration; another desk replaces the one in use.
export function installDesk(s: GameState, clusterId: string, id: DeskId): ActionResult {
  const d = deskById(id);
  if (d?.hosting !== "self") return fail("error.unknownDesk");
  if (!deskReady(s, id)) return fail("error.deskNotYet");
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "panel" || !c.panel) return fail("error.deskHostPanel");
  const h = s.desk?.id === id ? s.desk.hosting : null;
  if (h?.kind === "self" && h.clusterId === clusterId) return fail("error.deskInUse");
  const full = licenceBlock(s, c);
  if (full) return fail(full);
  const hosting = { kind: "self" as const, clusterId, version: versionAt(id, s.hour).version };
  if (h) s.desk = { ...s.desk!, hosting };
  else { dropDesk(s); openDesk(s, id, hosting); }
  return { ok: true, id: hosting.version };
}

// Cancels the subscription or uninstalls the desk; tickets keep their numbers and stay in the mailbox.
export function removeDesk(s: GameState): ActionResult {
  if (!s.desk) return fail("error.noDesk");
  dropDesk(s);
  return { ok: true };
}
