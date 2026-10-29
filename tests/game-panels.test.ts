import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { SERVES, SOFTWARE, softwareById } from "../src/sim/10-catalog/platforms";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { targetFor } from "../src/sim/30-market/sales";
import { newGame, type GameState } from "../src/sim/50-state";
import { bookable, nodeCapacity, setNodeState, supports, workloadOnline } from "../src/sim/60-infra/cluster";
import { securityTick } from "../src/sim/60-infra/security";
import { openVulns, vulnsFor } from "../src/sim/60-infra/vulns";
import { howToFactor } from "../src/sim/85-products/products";
import { type SimEvent } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { cleanUp } from "../src/sim/90-actions/security";
import { installSoftware, softwareOn, updateSoftware } from "../src/sim/90-actions/software";
import { hypervisor, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: ActionResult) => (r.ok ? "ok" : r.error);
const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));

// The basement server and a second one cabled in, bought while the 2005 shop sells them, then on to the year.
function start(y: number) {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, y);
  return { s, two };
}
const SPEC = sizeSpec("gameServer", 0, 2005);
const order = (s: GameState, cus: string, label: string, clusterId?: string) =>
  provisionService(s, cus, "gameServer", { label, spec: SPEC, clusterId });
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

describe("game server panels", () => {
  it("are game software that sells game servers next to the hypervisors", () => {
    expect(SOFTWARE.filter((x) => x.kind === "game").map((x) => [x.id, x.from, x.pricing, x.fee])).toEqual([
      ["tcadmen", 2005, "server", 25], ["multikraft", 2010, "server", 20], ["pterodaktyl", 2016, "free", 0],
    ]);
    expect(SERVES.game).toEqual(["gameServer"]);
    expect(SERVES.cloud).toContain("gameServer");
  });

  it("install from their year only, one per machine", () => {
    const { s } = start(2010);
    expect(err(installSoftware(s, "dev3", "pterodaktyl"))).toBe("error.softwareNotYet");
    ok(installSoftware(s, "dev3", "multikraft"));
    expect(softwareOn(s, "dev3")[0]).toMatchObject({ id: "multikraft", cluster: { kind: "game" } });
    expect(err(installSoftware(s, "dev3", "tcadmen"))).toBe("error.onePanel");
    const { s: late } = start(2016);
    ok(installSoftware(late, "dev3", "pterodaktyl"));
  });

  it("take a game server order before a cloud cluster when they have room", () => {
    const { s, two } = start(2016), cloud = hypervisor(s, ["dev3"], "Cloud 1"), game = panelServer(s, two, "pterodaktyl");
    const city = s.locations[0].city, want = { city, product: "gameServer" as const, spec: SPEC };
    expect(cluster(s, game).kind).toBe("game");
    expect(targetFor(s, want)?.clusterId).toBe(game);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    ok(order(s, cus, "first"));
    expect(s.workloads.find((w) => w.serviceId)?.clusterId).toBe(game);
    setNodeState(s, cluster(s, game).nodes[0].deviceId, "cordoned");
    expect(targetFor(s, want)?.clusterId).toBe(cloud);
    ok(order(s, cus, "second"));
    expect(s.workloads.filter((w) => w.serviceId).map((w) => w.clusterId)).toEqual([game, cloud]);
  });

  it("sell game servers but no web hosting", () => {
    const { s } = start(2016), game = cluster(s, panelServer(s, "dev3", "pterodaktyl"));
    expect(supports(game, "gameServer")).toBe(true);
    expect(supports(game, "webHosting")).toBe(false);
    expect(supports(game, "vps")).toBe(false);
  });

  it("scale the how-to tickets of their customers by the software factor and book the physical cores less the panel", () => {
    const { s, two } = start(2016), cloud = hypervisor(s, ["dev3"], "Cloud 1"), game = panelServer(s, two, "tcadmen");
    const a = addCustomer(s, "Ada Lang", "hobbyDev"), b = addCustomer(s, "Bo Lang", "hobbyDev");
    ok(order(s, a, "ada", game));
    ok(order(s, b, "bo", cloud));
    expect(howToFactor(s, a)).toBe(softwareById("tcadmen").tickets);
    expect(howToFactor(s, b)).toBe(softwareById("proxmocks").tickets);
    const d = s.devices.find((x) => x.id === cluster(s, game).nodes[0].deviceId)!;
    expect(bookable(s, d).vcpu).toBeCloseTo(nodeCapacity(d).vcpu - 0.25, 6);
  });

  it("have versions and vulnerabilities that compromise the host until it is updated", () => {
    const { s } = start(2005), id = panelServer(s, "dev3", "multikraft"), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    s.hour = year(2030);
    ok(order(s, cus, "ada", id));
    s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, version: 2010, updatedAt: 0 } : c));
    expect(Array.from({ length: 20 }, (_, i) => vulnsFor("multikraft", 2011 + i, 1).length).reduce((a, b) => a + b, 0)).toBeGreaterThan(10);
    expect(openVulns(s, id).length).toBeGreaterThan(10);
    const events: SimEvent[] = [];
    for (let d = 0; d < 200 && !s.security.hacked.length; d++) { s.hour += 24; events.push(...securityTick(s)); }
    expect(s.security.hacked).toEqual([id]);
    const hacked = events.find((e) => e.key === "event.vuln.hacked")!;
    expect(hacked.params).toMatchObject({ kind: "game", customers: 1 });
    expect(t("event.vuln.hacked.text", hacked.params!)).toContain("game servers");
    const w = s.workloads.find((x) => x.serviceId)!;
    expect(workloadOnline(s, w)).toBe(false);
    ok(cleanUp(s, id));
    ok(updateSoftware(s, id));
    expect(openVulns(s, id)).toEqual([]);
  });
});
