import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { dateOf } from "../src/sim/00-core/time";
import type { GameState } from "../src/sim/50-state";
import { netsvcTick } from "../src/sim/60-infra/netsvc";
import { certsOf, vpnOf } from "../src/sim/60-infra/netsvc-vpn";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { reissueCert, revokeCert } from "../src/sim/90-actions/netsvc-vpn";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelVm, readyGame } from "./fixtures";

function setup() {
  const s = readyGame(1), cloud = s.clusters.find((c) => c.kind === "cloud")!;
  const vpn = panelVm(s, cloud.id, "openveepeen"), cust = addCustomer(s, "Anna Albers", "private");
  s.customers = s.customers.map((c) => ({ ...c, happiness: 80 }));
  provisionService(s, cust, "vpn", { label: "anna", spec: { ...sizeSpec("vpn", 0, 2005), users: 100 }, clusterId: vpn });
  const v = () => s.services.find((x) => x.product === "vpn")!;
  return { s, v, happy: () => s.customers.find((c) => c.id === cust)!.happiness };
}
const month = (s: GameState) => { do s.hour++; while (dateOf(s.hour).getUTCDate() !== 1 || dateOf(s.hour).getUTCHours() !== 0); return netsvcTick(s); };
// Runs months until a device is lost.
const lose = (s: GameState, v: () => { id: string; spec: { users?: number } }) => { for (let i = 0; i < 120 && vpnOf(s, v() as never).lost === null; i++) month(s); };

describe("vpn certificates", () => {
  it("derives one certificate per user and stores only the revoked ones", () => {
    const { s, v } = setup();
    expect(certsOf(s, v())).toHaveLength(100);
    expect(revokeCert(s, v().id, 3).ok).toBe(true);
    expect(revokeCert(s, v().id, 3).ok).toBe(false);
    expect(certsOf(s, v())[3].revoked).toBe(true);
    expect(deserialize(serialize(s)).netsvc.vpn[v().id].revoked).toEqual([3]);
    expect(reissueCert(s, v().id, 3).ok).toBe(true);
    expect(certsOf(s, v())[3].revoked).toBe(false);
  });

  it("resolves a lost-laptop ticket when the certificate is revoked in time", () => {
    const { s, v, happy } = setup();
    lose(s, v);
    const x = vpnOf(s, v());
    expect(x.lost).not.toBeNull();
    const ticket = s.tickets.find((t) => t.topic === "certLost")!;
    const before = happy();
    expect(revokeCert(s, v().id, x.lost!).ok).toBe(true);
    expect(happy()).toBe(before + 1);
    expect(s.tickets.find((t) => t.id === ticket.id)!.status).toBe("resolved");
    expect(vpnOf(s, v()).lost).toBeNull();
  });

  it("costs 20 happiness once when the lost certificate stays unrevoked past 72 hours", () => {
    const { s, v, happy } = setup();
    lose(s, v);
    const before = happy(), at = vpnOf(s, v()).lostAt!;
    s.hour = at + 71;
    expect(netsvcTick(s).filter((e) => e.key === "event.vpnIntrusion")).toHaveLength(0);
    s.hour = at + 72;
    expect(netsvcTick(s).filter((e) => e.key === "event.vpnIntrusion")).toHaveLength(1);
    expect(happy()).toBe(before - 20);
    s.hour = at + 73;
    netsvcTick(s);
    expect(happy()).toBe(before - 20);
  });

  it("costs the customer 1 happiness to reissue a revoked certificate", () => {
    const { s, v, happy } = setup();
    revokeCert(s, v().id, 0);
    const before = happy();
    reissueCert(s, v().id, 0);
    expect(happy()).toBe(before - 1);
  });
});
