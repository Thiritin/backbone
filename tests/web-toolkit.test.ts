import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame } from "../src/sim/50-state";
import { appVulns } from "../src/sim/60-infra/apps";
import { webpanelTick } from "../src/sim/60-infra/webpanel";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { BREAK_MAX, breakChance, massUpdateSites, rollbackSite } from "../src/sim/90-actions/webpanel";
import { panelServer, withServer } from "./fixtures";

const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

function world(n: number, release = 2014, managed = false, seed = 2) {
  const s = withServer(newGame(seed));
  s.hour = year(2018);
  const host = panelServer(s, "dev3", "pleskit");
  const ids = Array.from({ length: n }, (_, i) => ok(provisionService(s, addCustomer(s, `Customer ${i}`, "hobbyDev"), "webHosting", {
    label: `site${i}.de`, spec: { ...sizeSpec("webHosting", 0, 2005), app: "wordpass", appVersion: release, appUpdatedAt: year(release), managedUpdates: managed }, clusterId: host,
  })));
  return { s, host, ids };
}
const vulnerable = (s: ReturnType<typeof world>["s"], id: string) => appVulns(s, s.services.find((v) => v.id === id)!).length;

describe("Toolkit mass update", () => {
  it("closes every open vulnerability and updates to this year's release", () => {
    const { s, host, ids } = world(6);
    expect(ids.some((id) => vulnerable(s, id) > 0)).toBe(true);
    ok(massUpdateSites(s, host, ids));
    for (const id of ids) {
      expect(s.services.find((v) => v.id === id)!.spec.appVersion).toBe(2018);
      expect(vulnerable(s, id)).toBe(0);
    }
  });

  it("breaks 3 percent plus 2 for each year behind, at most 11, halved when managed", () => {
    expect(breakChance(0, false)).toBeCloseTo(0.03);
    expect(breakChance(1, false)).toBeCloseTo(0.05);
    expect(breakChance(4, false)).toBeCloseTo(0.11);
    expect(breakChance(12, false)).toBe(BREAK_MAX);
    expect(breakChance(4, true)).toBeCloseTo(0.055);
  });

  it("breaks about the table's share of sites, fewer when managed", () => {
    const rate = (managed: boolean) => {
      let broke = 0, total = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const { s, host, ids } = world(40, 2014, managed, seed);
        ok(massUpdateSites(s, host, ids));
        broke += Object.keys(s.webpanel.appBroken).length; total += ids.length;
      }
      return broke / total;
    };
    const plain = rate(false), halved = rate(true);
    expect(plain).toBeGreaterThan(0.06);
    expect(plain).toBeLessThan(0.16);
    expect(halved).toBeLessThan(plain);
  });

  it("takes 10 minutes plus 1 per 5 sites of the player's time", () => {
    const { s, host, ids } = world(10);
    s.playerBusyUntil = 0;
    ok(massUpdateSites(s, host, ids));
    expect(s.playerBusyUntil).toBe(s.hour * 60 + 12);
  });

  it("breaks the same sites for the same seed and slows them for a day", () => {
    const a = world(40, 2014, false, 3), b = world(40, 2014, false, 3);
    ok(massUpdateSites(a.s, a.host, a.ids)); ok(massUpdateSites(b.s, b.host, b.ids));
    expect(a.s.webpanel.appBroken).toEqual(b.s.webpanel.appBroken);
    const id = Object.keys(a.s.webpanel.appBroken)[0];
    expect(id).toBeDefined();
    expect(a.s.services.find((v) => v.id === id)!.slowedAt).toBe(a.s.hour);
    a.s.hour += 48; webpanelTick(a.s);
    expect(a.s.webpanel.appBroken[id]).toBeUndefined();
  });

  it("refuses sites that are up to date and other panels", () => {
    const { s, host, ids } = world(2, 2018);
    expect(massUpdateSites(s, host, ids)).toEqual({ ok: false, error: "error.nothingToUpdate" });
    expect(massUpdateSites(s, "nope", ids)).toEqual({ ok: false, error: "error.notPleskit" });
  });
});

describe("rollback", () => {
  function broken(seed = 3) {
    const w = world(40, 2014, false, seed);
    ok(massUpdateSites(w.s, w.host, w.ids));
    const id = Object.keys(w.s.webpanel.appBroken)[0];
    return { ...w, id, cust: () => w.s.customers.find((c) => c.id === w.s.services.find((v) => v.id === id)!.customerId)! };
  }

  it("restores the old release with a backup and cheers the customer", () => {
    const { s, id, cust } = broken();
    s.workloads.find((w) => w.serviceId === id)!.backupAt = s.hour;
    const before = cust().happiness;
    s.playerBusyUntil = 0;
    ok(rollbackSite(s, id));
    expect(s.services.find((v) => v.id === id)!.spec.appVersion).toBe(2014);
    expect(vulnerable(s, id)).toBeGreaterThan(0);
    expect(cust().happiness).toBeGreaterThanOrEqual(before);
    expect(s.playerBusyUntil).toBe(s.hour * 60 + 30);
    expect(s.webpanel.appBroken[id]).toBeUndefined();
  });

  it("repairs by hand without a backup and costs 10 happiness", () => {
    const { s, id, cust } = broken();
    const before = cust().happiness;
    ok(rollbackSite(s, id));
    expect(s.services.find((v) => v.id === id)!.spec.appVersion).toBe(2018);
    expect(cust().happiness).toBeLessThan(before);
    expect(rollbackSite(s, id)).toEqual({ ok: false, error: "error.notBroken" });
  });

  it("resolves the updateBroke ticket", () => {
    const { s, id } = broken();
    const t = s.tickets.find((x) => x.serviceId === id && x.topic === "updateBroke");
    ok(rollbackSite(s, id));
    if (t) expect(s.tickets.find((x) => x.id === t.id)!.status).toBe("resolved");
  });
});
