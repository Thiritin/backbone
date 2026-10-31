import { bump, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { CERT_FEE, certsOf, enroll, isAnyconnekt, putVpn, vpnOf, vpnServices } from "../60-infra/netsvc-vpn";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const happier = (s: GameState, customerId: string, d: number) => { s.customers = s.customers.map((c) => { if (c.id !== customerId) return c; const n = { ...c }; bump(n, d); return n; }); };

// Revokes a user certificate. Revoking the lost one in time resolves the customer's ticket.
export function revokeCert(s: GameState, serviceId: string, index: number): ActionResult {
  const v = vpnServices(s).find((x) => x.id === serviceId);
  if (!v) return fail("error.unknownService");
  const cert = certsOf(s, v)[index];
  if (!cert || cert.revoked) return fail("error.badCert");
  const x = vpnOf(s, v), wasLost = x.lost === index;
  putVpn(s, v, { ...x, revoked: [...x.revoked, index], lost: wasLost ? null : x.lost, lostAt: wasLost ? null : x.lostAt });
  if (wasLost) {
    s.tickets = s.tickets.map((t) => (t.serviceId === v.id && t.topic === "certLost" && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
    happier(s, v.customerId, 1);
  }
  return { ok: true };
}

// Issues a revoked user a new certificate; the hassle costs the customer a little happiness.
export function reissueCert(s: GameState, serviceId: string, index: number): ActionResult {
  const v = vpnServices(s).find((x) => x.id === serviceId);
  if (!v) return fail("error.unknownService");
  const x = vpnOf(s, v);
  if (!x.revoked.includes(index)) return fail("error.badCert");
  putVpn(s, v, { ...x, revoked: x.revoked.filter((i) => i !== index) });
  happier(s, v.customerId, -1);
  return { ok: true };
}

// Replaces the gateway certificate. OpenVeePeeN regenerates it for free; AnyConnekt enrolls with a CA for a fee.
export function renewCert(s: GameState, serviceId: string): ActionResult {
  const v = vpnServices(s).find((x) => x.id === serviceId);
  if (!v) return fail("error.unknownService");
  if (isAnyconnekt(s, v) && s.cash < CERT_FEE) return fail("error.noCash");
  enroll(s, v);
  return { ok: true };
}

// Switches automatic renewal, a feature of AnyConnekt only.
export function setAutoEnroll(s: GameState, serviceId: string, on: boolean): ActionResult {
  const v = vpnServices(s).find((x) => x.id === serviceId);
  if (!v) return fail("error.unknownService");
  if (!isAnyconnekt(s, v)) return fail("error.noAutoEnroll");
  putVpn(s, v, { ...vpnOf(s, v), autoEnroll: on });
  return { ok: true };
}
