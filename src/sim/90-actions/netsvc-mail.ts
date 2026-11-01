import { bump } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { workloadsUp } from "../60-infra/cluster";
import { mailServices, mailStateOf } from "../60-infra/netsvc-mail";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const setDeferred = (s: GameState, id: string, deferred: number, p: object = {}) => {
  s.netsvc = { ...s.netsvc, mail: { ...s.netsvc.mail, [id]: { ...mailStateOf(s, id), deferred, ...p } } };
};

// Retries the whole deferred queue; it only goes out while the address is clean and the mail host is up.
export function flushQueue(s: GameState, addressId: string): ActionResult {
  const a = s.ips.addresses.find((x) => x.id === addressId);
  if (!a) return fail("error.unknownAddress");
  if (a.listed || mailServices(s, addressId).some((v) => !workloadsUp(s, v.id))) return fail("error.mailStillListed");
  setDeferred(s, addressId, 0);
  return { ok: true };
}

// Throws the deferred queue away; every mail customer on the address loses 2 happiness and it works once a day per address.
export function deleteQueue(s: GameState, addressId: string): ActionResult {
  if (!s.ips.addresses.some((x) => x.id === addressId)) return fail("error.unknownAddress");
  const cur = mailStateOf(s, addressId);
  if (cur.deletedAt !== undefined && s.hour - cur.deletedAt < 24) return fail("error.queueDeleted");
  const hit = new Set(mailServices(s, addressId).map((v) => v.customerId));
  s.customers = s.customers.map((c) => {
    if (!hit.has(c.id)) return c;
    const n = { ...c };
    bump(n, -2);
    return n;
  });
  setDeferred(s, addressId, 0, { deletedAt: s.hour });
  return { ok: true };
}

// Sends a panel host's customers' mail through a mail server's address, or back through its own with null.
export function setMailRelay(s: GameState, panelId: string, mailId: string | null): ActionResult {
  if (s.clusters.find((c) => c.id === panelId)?.kind !== "panel") return fail("error.unknownCluster");
  if (mailId !== null && s.clusters.find((c) => c.id === mailId)?.kind !== "mail") return fail("error.unknownCluster");
  const relay = { ...s.netsvc.relay };
  if (mailId === null) delete relay[panelId]; else relay[panelId] = mailId;
  s.netsvc = { ...s.netsvc, relay };
  return { ok: true };
}
