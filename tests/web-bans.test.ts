import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame, type GameState } from "../src/sim/50-state";
import { bansTick, customerIp, jailFactor } from "../src/sim/60-infra/bans";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setJail, trustIp, unbanIp, untrustIp } from "../src/sim/90-actions/webpanel";
import { panelServer, withServer } from "./fixtures";

const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

function world(y: number, n: number, seed = 2) {
  const s = withServer(newGame(seed));
  s.hour = year(y);
  const host = panelServer(s, "dev3", "pleskit");
  const ids = Array.from({ length: n }, (_, i) => ok(provisionService(s, addCustomer(s, `Customer ${i}`, "hobbyDev"), "webHosting", { label: `site${i}.de`, spec: sizeSpec("webHosting", 0, 2005), clusterId: host })));
  return { s, host, ids };
}
const days = (s: GameState, n: number) => { for (let i = 0; i < n; i++) { s.hour += 24; bansTick(s); } };
const lockedOut = (s: GameState) => s.tickets.filter((t) => t.topic === "lockedOut");

describe("Pleskit banned IPs", () => {
  it("has no jail before 2014", () => {
    const { s, host } = world(2012, 3);
    days(s, 10);
    expect(s.webpanel.bans[host]).toBeUndefined();
    expect(jailFactor(s, host)).toBe(1);
  });

  it("bans 3 scanner addresses a day and lets each go after 7 days", () => {
    const { s, host } = world(2016, 0);
    days(s, 1);
    expect(s.webpanel.bans[host].list.filter((b) => b.kind === "scanner")).toHaveLength(3);
    days(s, 6);
    expect(s.webpanel.bans[host].list).toHaveLength(21);
    days(s, 7);
    expect(s.webpanel.bans[host].list).toHaveLength(21);
    expect(s.webpanel.bans[host].list.every((b) => b.until > s.hour)).toBe(true);
  });

  it("is the same for the same seed", () => {
    const a = world(2016, 20, 5), b = world(2016, 20, 5);
    days(a.s, 100); days(b.s, 100);
    expect(a.s.webpanel.bans).toEqual(b.s.webpanel.bans);
  });

  it("only counts failed logins with the jail off", () => {
    const { s, host } = world(2016, 0);
    days(s, 1);
    expect(setJail(s, host, false).ok).toBe(true);
    days(s, 5);
    const b = s.webpanel.bans[host];
    expect(b.failed).toBe(45);
    expect(b.list.every((x) => x.until > s.hour)).toBe(true);
    expect(b.list.filter((x) => x.kind === "scanner").length).toBeLessThanOrEqual(21);
  });

  it("lets 75 percent of the exposure roll through with the jail on", () => {
    const { s, host } = world(2016, 1);
    days(s, 1);
    expect(jailFactor(s, host)).toBe(0.75);
    setJail(s, host, false);
    expect(jailFactor(s, host)).toBe(1);
  });

  it("locks customers out now and then, and trusted addresses never", () => {
    const a = world(2016, 40);
    days(a.s, 300);
    const out = lockedOut(a.s).length;
    expect(out).toBeGreaterThan(3);
    const b = world(2016, 40);
    for (const id of b.ids) ok(trustIp(b.s, b.host, customerIp(b.s, id)));
    days(b.s, 300);
    expect(lockedOut(b.s)).toHaveLength(0);
  });

  it("closes the lockout ticket and cheers the customer on unban", () => {
    const { s, host } = world(2016, 40);
    for (let i = 0; i < 300 && !lockedOut(s).length; i++) days(s, 1);
    const t = lockedOut(s)[0], ban = s.webpanel.bans[host].list.find((b) => b.serviceId === t.serviceId)!;
    const before = s.customers.find((c) => c.id === t.customerId)!.happiness;
    expect(unbanIp(s, host, ban.ip).ok).toBe(true);
    expect(s.tickets.find((x) => x.id === t.id)!.status).toBe("resolved");
    expect(s.customers.find((c) => c.id === t.customerId)!.happiness).toBeGreaterThan(before);
    expect(s.webpanel.bans[host].list.some((b) => b.ip === ban.ip)).toBe(false);
    expect(unbanIp(s, host, ban.ip)).toEqual({ ok: false, error: "error.unknownIp" });
  });

  it("validates trusted addresses and the panel", () => {
    const { s, host } = world(2016, 0);
    expect(trustIp(s, host, "300.1.1.1")).toEqual({ ok: false, error: "error.badIp" });
    expect(trustIp(s, host, "10.0.0.1").ok).toBe(true);
    expect(s.webpanel.bans[host].trusted).toEqual(["10.0.0.1"]);
    expect(untrustIp(s, host, "10.0.0.1").ok).toBe(true);
    expect(s.webpanel.bans[host].trusted).toEqual([]);
    expect(setJail(world(2012, 0).s, "x", true).ok).toBe(false);
  });
});
