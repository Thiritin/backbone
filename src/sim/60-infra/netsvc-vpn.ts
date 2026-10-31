// GDD, Infrastructure consoles: the user certificates of a VPN service and the lost-laptop incident. Numbers in economy.md, Happiness and churn.
import { hashRng, rand } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import type { SimEvent } from "../88-tick/tick";
import { bump, createTicket } from "../40-support/tickets";
import type { GameState } from "../50-state";

export interface VpnState { serverIssuedAt: number; serverExpiresAt: number; revoked: number[]; lost: number | null; lostAt: number | null; autoEnroll: boolean }
export interface Cert { index: number; cn: string; serial: string; revoked: boolean }

export const CERT_DAYS = 365;
export const LOST_REVOKE_HOURS = 72;
export const INTRUSION_LOSS = 20;
const LOST_BASE = 0.015, LOST_CAP = 0.2;

export const vpnServices = (s: GameState): Service[] => s.services.filter((v) => v.product === "vpn" && v.endedAt === null);

// The VPN services running on a gateway cluster.
export const vpnOnCluster = (s: GameState, clusterId: string): Service[] => vpnServices(s).filter((v) => s.workloads.some((w) => w.serviceId === v.id && w.clusterId === clusterId));

// Created on first read from the service start; stored once an action changes it.
export const vpnOf = (s: GameState, v: Service): VpnState =>
  s.netsvc.vpn[v.id] ?? { serverIssuedAt: v.startedAt, serverExpiresAt: v.startedAt + CERT_DAYS * 24, revoked: [], lost: null, lostAt: null, autoEnroll: false };
export const putVpn = (s: GameState, v: Service, x: VpnState): void => { s.netsvc = { ...s.netsvc, vpn: { ...s.netsvc.vpn, [v.id]: x } }; };

// The user certificates are derived from the user count; only the revoked indices are stored.
export function certsOf(s: GameState, v: Service): Cert[] {
  const x = vpnOf(s, v), idNo = Number(v.id.replace(/\D/g, ""));
  return Array.from({ length: v.spec.users ?? 0 }, (_, i) => ({
    index: i, cn: `user${i + 1}`, serial: ((idNo * 7919 + i * 104729 + 0x1000) >>> 0).toString(16).toUpperCase().padStart(8, "0"), revoked: x.revoked.includes(i),
  }));
}

// Monthly: a device of one user goes missing. Hourly: a lost certificate left unrevoked past 72 hours lets the intruder in.
export function vpnTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [], month = isMonthStart(s.hour);
  for (const v of vpnServices(s)) {
    const cust = s.customers.find((c) => c.id === v.customerId), users = v.spec.users ?? 0;
    if (!cust || cust.churnedAt !== null || users === 0) continue;
    const x = vpnOf(s, v);
    if (x.lost !== null && x.lostAt !== null && s.hour - x.lostAt >= LOST_REVOKE_HOURS) {
      s.customers = s.customers.map((c) => { if (c.id !== cust.id) return c; const n = { ...c }; bump(n, -INTRUSION_LOSS); return n; });
      putVpn(s, v, { ...x, lost: null, lostAt: null });
      events.push({ app: "Support", key: "event.vpnIntrusion", params: { customer: cust.name, user: `user${x.lost + 1}` } });
    } else if (month && x.lost === null) {
      const r = hashRng(s.seed, s.hour, Number(v.id.replace(/\D/g, "")), 301), live = certsOf(s, v).filter((c) => !c.revoked);
      if (live.length && rand(r) < Math.min(LOST_CAP, LOST_BASE * Math.ceil(users / 10))) {
        const pick = live[Math.floor(rand(r) * live.length)];
        putVpn(s, v, { ...x, lost: pick.index, lostAt: s.hour });
        createTicket(s, cust, "howTo", v.id, "certLost");
      }
    }
  }
  return events;
}
