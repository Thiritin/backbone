import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { createRng } from "../src/sim/00-core/rng";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import {
  ADVISORY_KEYS, POC_RISK, REBUILD_HOURS, STAGE_HOURS, VULNS, WARNING_RISK, advisoryNodes, securityTick,
} from "../src/sim/60-infra/security";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { provisionService, upgradeNodePhp } from "../src/sim/90-actions/clusters";
import { panelServer, withServer } from "./fixtures";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { mountDevice } from "./plugged";
import { cleanUp, setSitesOffline } from "../src/sim/90-actions/security";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { useStore } from "../src/ui/store";

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const MOPB = VULNS[0];
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};

// The basement's two servers as two bare-metal panel hosts with a web space on each, running PHP 4.4, one hour before the
// 2007 advisory.
function hosting(web = true) {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const a = panelServer(s, "dev3"), b = panelServer(s, second);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  if (web) {
    ok(provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: a }));
    ok(provisionService(s, cus, "webHosting", { label: "lang.de", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: b }));
  }
  s.hour = MOPB.at - 1;
  return { s, second, cus, a, b };
}
const webIds = (s: GameState) => s.services.filter((v) => v.product === "webHosting").map((v) => v.id);

describe("security advisories", () => {
  it("fire only for players running web sites on an affected PHP", () => {
    const none = hosting(false).s;
    expect(run(none, 2).some((e) => ADVISORY_KEYS.includes(e.key))).toBe(false);
    expect(none.security).toMatchObject({ vuln: null, seen: ["mopb"] });

    const newer = hosting().s;
    newer.clusters = newer.clusters.map((c) => ({ ...c, php: "8.5" }));
    expect(run(newer, 2).some((e) => ADVISORY_KEYS.includes(e.key))).toBe(false);

    const { s } = hosting();
    expect(new Set(s.workloads.map((w) => w.deviceId)).size).toBe(2);
    const events = run(s, 2);
    expect(events.filter((e) => e.key === "event.vuln.announced")).toHaveLength(1);
    expect(s.security.vuln).toBe("mopb");
    expect(advisoryNodes(s)).toHaveLength(2);
  });

  it("advance through their stages on schedule and pause the game at each", () => {
    const { s } = hosting();
    s.clusters = s.clusters.map((c) => ({ ...c, php: "8.5" }));
    s.clusters[0].php = "5.2";
    const start = s.hour;
    const at: Record<string, number> = {};
    for (let h = 0; h < 80; h++) for (const e of tick(s)) if (ADVISORY_KEYS.includes(e.key)) at[e.key] = s.hour - 1 - start;
    expect(Object.values(at)).toEqual(STAGE_HOURS);

    useStore.setState({ game: hosting().s, speed: 8, alert: null });
    useStore.getState().advance(5);
    expect(useStore.getState()).toMatchObject({ speed: 0, resume: 8, alert: expect.objectContaining({ key: "event.vuln.announced" }) });
    expect(useStore.getState().game.hour).toBe(MOPB.at);
  });

  it("spare nodes whose sites are offline, and the sites come back online", () => {
    const { s, a, b } = hosting();
    ok(setSitesOffline(s, a, true));
    ok(setSitesOffline(s, b, true));
    expect(err(setSitesOffline(s, b, true))).toBe("error.sitesOffline");
    expect(webIds(s).every((id) => !serviceOnline(s, id))).toBe(true);
    run(s, 24 * 5);
    expect(s.security.hacked).toEqual([]);
    ok(setSitesOffline(s, a, false));
    ok(setSitesOffline(s, b, false));
    expect(webIds(s).every((id) => serviceOnline(s, id))).toBe(true);
  });

  it("compromise exposed nodes at the stated hourly rate", () => {
    const rate = (stage: number, hours: number) => {
      let hacked = 0;
      const { s: base } = hosting();
      base.security = { ...base.security, vuln: "mopb", seen: ["mopb"], stage };
      base.hour = MOPB.at + STAGE_HOURS[stage];
      for (let i = 0; i < 300; i++) {
        const s = structuredClone(base);
        s.rng = createRng(i + 1);
        for (let h = 0; h < hours; h++) { securityTick(s); s.hour++; }
        hacked += s.security.hacked.length;
      }
      return hacked / 600;
    };
    expect(rate(0, 20)).toBe(0);
    expect(rate(1, 20)).toBeCloseTo(1 - (1 - POC_RISK) ** 20, 1);
    expect(rate(2, 10)).toBeCloseTo(1 - (1 - WARNING_RISK) ** 10, 1);
  });

  it("hurt customers on a compromised node until it is cleaned up", () => {
    const { s, cus } = hosting();
    s.security = { ...s.security, vuln: "mopb", seen: ["mopb"], stage: 2 };
    s.hour = MOPB.at + STAGE_HOURS[2];
    const before = s.customers.find((c) => c.id === cus)!.happiness;
    for (let h = 0; h < 500 && !s.security.hacked.length; h++) securityTick(s);
    const node = s.security.hacked[0];
    expect(node).toBeDefined();
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBeLessThan(before);
    expect(s.tickets.some((t) => t.kind === "abuse" && t.topic === "spam")).toBe(true);
    const site = s.workloads.find((w) => w.clusterId === node)!.serviceId;
    expect(serviceOnline(s, site)).toBe(false);
    ok(cleanUp(s, node));
    expect(err(cleanUp(s, node))).toBe("error.notHacked");
    s.hour += REBUILD_HOURS - 1;
    expect(serviceOnline(s, site)).toBe(false);
    s.hour += 1;
    expect(serviceOnline(s, site)).toBe(true);
  });

  it("are patched only once the patch is out", () => {
    const { s, second, a, b } = hosting();
    run(s, 2);
    ok(upgradeNodePhp(s, "dev3"));
    expect(s.clusters[0].php).toBe("5.2");
    expect(err(upgradeNodePhp(s, "dev3"))).toBe("error.patchPending");
    expect(advisoryNodes(s)).toHaveLength(2);
    run(s, STAGE_HOURS[3]);
    expect(s.security.stage).toBe(3);
    ok(upgradeNodePhp(s, "dev3"));
    ok(upgradeNodePhp(s, second));
    expect(s.security.patched).toEqual([a, b]);
    expect(err(upgradeNodePhp(s, "dev3"))).toBe("error.phpCurrent");
    const rng = { ...s.rng };
    securityTick(s);
    expect(s.rng).toEqual(rng);
  });

  it("load into old saves with nothing under way", () => {
    const data = JSON.parse(serialize(withServer(newGame(2))));
    delete data.security;
    expect(deserialize(JSON.stringify(data)).security).toEqual({ vuln: null, stage: 0, seen: [], patched: [], offline: [], hacked: [] });
  });
});
