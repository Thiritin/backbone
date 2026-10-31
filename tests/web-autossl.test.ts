import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import type { Profile } from "../src/sim/30-customers/customers";
import { newGame, type GameState } from "../src/sim/50-state";
import { sslStatus, webpanelTick } from "../src/sim/60-infra/webpanel";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { renewCertificate, runAutoSslCheck, setAutoSsl } from "../src/sim/90-actions/webpanel";
import { panelServer, withServer } from "./fixtures";

const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

function world(y: number, n: number, profile: Profile = "hobbyDev", panel = "cpanic") {
  const s = withServer(newGame(2));
  s.hour = year(y);
  const host = panelServer(s, "dev3", panel);
  const ids = Array.from({ length: n }, (_, i) => ok(provisionService(s, addCustomer(s, `Customer ${i}`, profile), "webHosting", { label: `site${i}.de`, spec: sizeSpec("webHosting", 0, 2005), clusterId: host })));
  return { s, host, ids };
}
// The daily tick on its own, so customers do not change their apps on the way.
const days = (s: GameState, n: number) => { for (let i = 0; i < n; i++) { s.hour += 24; webpanelTick(s); } };
const expiredCount = (s: GameState) => s.webpanel.ssl.expired.length;

describe("AutoSSL", () => {
  it("does not exist before 2016", () => {
    const { s } = world(2012, 5);
    days(s, 200);
    expect(s.webpanel.ssl.expires).toEqual({});
    expect(expiredCount(s)).toBe(0);
  });

  it("gives every domain an expiry within 90 days of the first tick", () => {
    const { s, ids } = world(2017, 20);
    days(s, 1);
    for (const id of ids) {
      const left = s.webpanel.ssl.expires[id] - s.hour;
      expect(left).toBeGreaterThan(-1);
      expect(left).toBeLessThanOrEqual(90 * 24);
    }
  });

  it("lets no certificate expire over 400 days with AutoSSL on", () => {
    const { s, host } = world(2017, 40, "private");
    expect(setAutoSsl(s, host, true)).toEqual({ ok: true });
    let worst = 0;
    for (let i = 0; i < 400; i++) { days(s, 1); worst = Math.max(worst, expiredCount(s)); }
    expect(worst).toBe(0);
    expect(s.webpanel.ssl.log.length).toBeGreaterThan(40);
  });

  it("lets most certificates of unskilled customers expire without it", () => {
    const { s } = world(2017, 60, "private");
    days(s, 400);
    expect(expiredCount(s)).toBeGreaterThan(40);
    const slowed = s.services.filter((v) => v.slowedAt !== undefined && v.slowedAt >= s.hour - 1).length;
    expect(slowed).toBe(expiredCount(s));
  });

  it("lets fewer expire for skilled customers than for unskilled ones", () => {
    const low = world(2017, 60, "private"), high = world(2017, 60, "smallBiz");
    days(low.s, 400); days(high.s, 400);
    expect(expiredCount(high.s)).toBeLessThan(expiredCount(low.s));
  });

  it("is switched on only on cPanic hosts", () => {
    const { s, host } = world(2017, 1, "private", "freepanel");
    expect(setAutoSsl(s, host, true)).toEqual({ ok: false, error: "error.notCpanic" });
    expect(runAutoSslCheck(s, host)).toEqual({ ok: false, error: "error.notCpanic" });
  });

  it("clears the incident when the player renews, in five minutes, with happiness for an open ticket", () => {
    const { s, ids } = world(2017, 40, "private");
    days(s, 400);
    const id = s.webpanel.ssl.expired[0], v = s.services.find((x) => x.id === id)!;
    const before = s.customers.find((c) => c.id === v.customerId)!.happiness, tk = s.tickets.some((t) => t.serviceId === id && t.topic === "certExpired");
    s.playerBusyUntil = 0;
    expect(ids).toContain(id);
    expect(renewCertificate(s, id)).toEqual({ ok: true });
    expect(s.playerBusyUntil).toBe(s.hour * 60 + 5);
    expect(sslStatus(s, id)).toBe("valid");
    expect(s.customers.find((c) => c.id === v.customerId)!.happiness).toBeGreaterThanOrEqual(before + (tk ? 5 : 0));
    expect(s.tickets.filter((t) => t.serviceId === id && t.topic === "certExpired" && t.status === "open")).toHaveLength(0);
    expect(renewCertificate(s, "none")).toEqual({ ok: false, error: "error.unknownService" });
  });

  it("renews everything due on the Check now button", () => {
    const { s, host } = world(2017, 20, "private");
    days(s, 1);
    setAutoSsl(s, host, true);
    const before = { ...s.webpanel.ssl.expires }, due = Object.keys(before).filter((id) => before[id] - s.hour <= 30 * 24);
    expect(due.length).toBeGreaterThan(0);
    expect(due.length).toBeLessThan(20);
    expect(runAutoSslCheck(s, host)).toEqual({ ok: true });
    for (const [id, e] of Object.entries(s.webpanel.ssl.expires)) expect(e).toBe(due.includes(id) ? s.hour + 90 * 24 : before[id]);
  });

  it("spares a domain with a certificate bought from the registrar", () => {
    const { s, ids } = world(2017, 3, "private");
    const v = s.services.find((x) => x.id === ids[0])!;
    ok(provisionService(s, v.customerId, "ssl", { label: v.domain ?? v.label, price: 1 }));
    days(s, 400);
    expect(s.webpanel.ssl.expires[ids[0]]).toBeUndefined();
    expect(s.webpanel.ssl.expired).not.toContain(ids[0]);
  });
});
