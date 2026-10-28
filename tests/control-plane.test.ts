import { describe, expect, it } from "vitest";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { serviceOnline } from "../src/sim/40-support/status";
import { offers } from "../src/sim/30-market/market";
import type { GameState } from "../src/sim/50-state";
import { controlPlaneUp, lineOffered, workloadsOf } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService, setSoftware } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { startGame } from "../src/sim/90-actions/start";
import { setLine } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";

const ok = (r: { ok: boolean; error?: string }) => { expect(r.error).toBeUndefined(); return r; };
const err = (r: { ok: boolean; error?: string }) => r.error;
const basement = (s: GameState) => s.clusters[0];
const run = (s: GameState, hours: number) => Array.from({ length: hours }, () => tick(s)).flat();
const install = (s: GameState, id: string) => { ok(setSoftware(s, basement(s).id, id)); return run(s, softwareById(id).installHours); };

describe("control planes", () => {
  it("starts with the basement server running nothing, no customers and no product line on sale", () => {
    const s = startGame(1);
    expect([basement(s).panel, basement(s).platform, s.customers.length]).toEqual([null, null, 0]);
    expect(controlPlaneUp(s, basement(s))).toBe(false);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    expect(err(provisionService(s, cus, "webHosting", { label: "Blog" }))).toBe("error.needsPanel");
    expect(err(provisionService(s, cus, "vps", { label: "Box", clusterId: basement(s).id }))).toBe("error.needsPlatform");
    expect(s.services).toHaveLength(0);
    expect((["webHosting", "vps", "gameServer"] as const).some((p) => lineOffered(s, p) || offers(s, p, "Frankfurt"))).toBe(false);
  });

  it("keeps the control plane busy for the install hours, then moves the friends onto the first hosting panel", () => {
    const s = startGame(1), hours = softwareById("directadmen").installHours;
    ok(setSoftware(s, basement(s).id, "directadmen"));
    const early = run(s, hours - 1);
    expect(basement(s).panel).toBeNull();
    expect(controlPlaneUp(s, basement(s))).toBe(false);
    expect(early.some((e) => e.key === "event.installed")).toBe(false);
    const events = run(s, 1);
    expect(events).toContainEqual({ app: "Products", key: "event.installed", params: { cluster: "Basement 1", name: "DirectAdmen" } });
    expect(events).toContainEqual({ app: "Customers", key: "event.friendsJoined", params: { cluster: "Basement 1" } });
    expect(basement(s).panel).toBe("directadmen");
    const friends = s.services.filter((v) => v.product === "webHosting");
    expect(friends.map((v) => v.label)).toEqual(["jonasweber.de", "mira-schulz.de", "tobikraus.de"]);
    expect(friends.every((v) => serviceOnline(s, v.id) && workloadsOf(s, v.id)[0].clusterId === basement(s).id)).toBe(true);
  });

  it("waits with the friends while only a platform is installed and sells only its product lines", () => {
    const s = startGame(2);
    install(s, "proxmocks");
    expect(s.customers).toHaveLength(0);
    expect([lineOffered(s, "vps"), lineOffered(s, "gameServer"), lineOffered(s, "webHosting")]).toEqual([true, true, false]);
    for (const p of ["vps", "gameServer"] as const) setLine(s, p, true);
    run(s, 30 * 24);
    expect(s.sales.requests.length).toBeGreaterThan(0);
    expect(s.sales.requests.every((r) => r.product !== "webHosting")).toBe(true);
    install(s, "freepanel");
    expect(s.customers.filter((c) => c.habit === "friend")).toHaveLength(3);
  });

  it("takes no orders before anything is installed", () => {
    const s = startGame(3);
    run(s, 30 * 24);
    expect(s.sales.requests.filter((r) => !r.shady)).toHaveLength(0);
    expect(s.customers).toHaveLength(0);
  });

  it("changes a control plane only once the cluster is empty of what it serves", () => {
    const s = startGame(1);
    install(s, "freepanel");
    expect(err(setSoftware(s, basement(s).id, "cpanic"))).toBe("error.softwareInUse");
    for (const v of s.services) s.services = s.services.map((x) => (x.id === v.id ? { ...x, endedAt: s.hour } : x));
    run(s, 1);
    ok(setSoftware(s, basement(s).id, "cpanic"));
  });

  it("loads an old save with its panel and platform installed, and keeps a new save's empty server empty", () => {
    const old = JSON.parse(serialize(startGame(1)));
    for (const c of old.clusters) { delete c.panel; delete c.platform; }
    const s = deserialize(JSON.stringify(old));
    expect([basement(s).panel, basement(s).platform]).toEqual(["freepanel", "proxmocks"]);
    expect(controlPlaneUp(s, basement(s))).toBe(true);
    expect(lineOffered(s, "webHosting") && lineOffered(s, "vps")).toBe(true);
    expect(basement(deserialize(serialize(startGame(1)))).panel).toBeNull();
  });
});
