// Subscribing to a hosted desk (docs/design/plans/support-desk.md, The desk site); self-hosted desks install by hand in desk-setup.ts.
import { deskById, deskReady, tenantHost, type DeskId } from "../10-catalog/desks";
import { deskItem, subscriptionEntry } from "../10-catalog/store";
import { deskPath } from "../80-business/deskroutes";
import { dropDesk, openDesk } from "../40-support/desk";
import { deskRecords } from "../40-support/desk-records";
import { deliver } from "../42-mail/deliver";
import { deliverMail } from "../42-mail/sources";
import type { Method } from "../46-finance/payables";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { spend } from "./purchase";

const fail = (error: string): ActionResult => ({ ok: false, error });
const TENANT = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// Signs up on the vendor's site: the first month for every seat is paid at once and the tick bills each later one.
// Another desk in use is replaced, with its configuration; tickets stay.
export function subscribeDesk(s: GameState, tenant: string, id: DeskId, method?: Method): ActionResult {
  const d = deskById(id);
  if (d?.hosting !== "hosted") return fail("error.unknownDesk");
  if (!deskReady(s, id)) return fail("error.deskNotYet");
  const name = tenant.trim().toLowerCase();
  if (!TENANT.test(name)) return fail("error.deskTenant");
  if (s.desk?.id === id) return fail("error.deskInUse");
  const item = deskItem(d);
  const placed = spend(s, { supplier: "services", name: d.name, lines: [subscriptionEntry(s, item)], method });
  if (!placed.ok) return placed;
  dropDesk(s);
  openDesk(s, id, { kind: "hosted" }, name);
  const host = tenantHost(d, name);
  deliverMail(s, d.name, "deskWelcome", { desk: d.name, url: `${host}${id === "zendusk" ? deskPath("zendusk", "agent") : deskPath("freshdusk", "dashboard")}`, address: `support@${host}` });
  return { ok: true };
}

// Cancels the subscription or uninstalls the desk; tickets keep their numbers and stay in the mailbox.
export function removeDesk(s: GameState): ActionResult {
  if (!s.desk) return fail("error.noDesk");
  dropDesk(s);
  return { ok: true };
}

// The Verify button on the desk's domain page: passes once the world sees every record the desk needs.
export function verifyDesk(s: GameState): ActionResult {
  const rows = deskRecords(s);
  if (!s.desk || !rows.length) return fail("error.noDesk");
  return rows.every((r) => r.ok) ? { ok: true } : fail("error.deskRecords");
}

// Verify forwarding on a hosted desk's support address: the vendor mails the address, and the mailbox's forward rule must
// pass the message on to the tenant's own address.
export function verifyForwarding(s: GameState, channelId: string): ActionResult {
  const d = s.desk && deskById(s.desk.id), ch = s.mail.channels.find((c) => c.id === channelId && c.desk === s.desk?.id);
  const a = ch && s.mail.accounts.find((x) => x.id === ch.accountId);
  if (d?.hosting !== "hosted" || !ch || !a) return fail("error.noDesk");
  const target = `support@${tenantHost(d, s.desk!.tenant ?? "")}`, seen = new Set(s.mail.trace);
  deliver(s, { to: `${a.local}@${a.domain}`, from: `n:${d.name}`, kind: "system", topic: "deskForwardTest", p: { desk: d.name, address: target } });
  const passed = s.mail.trace.some((e) => !seen.has(e) && e.to === target && e.result === "accepted");
  s.mail = { ...s.mail, channels: s.mail.channels.map((c) => (c.id === ch.id ? { ...c, verified: passed } : c)) };
  return passed ? { ok: true } : fail("error.deskForwarding");
}
