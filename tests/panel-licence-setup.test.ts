import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { isFinal } from "../src/sim/40-support/tickets";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import { assignedKey, issueKey, panelLocked, panelMachine, releaseKey } from "../src/sim/60-infra/licence";
import { webpanelTick } from "../src/sim/60-infra/webpanel";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { activateLicence, finishPanelSetup } from "../src/sim/90-actions/licence";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;

// A Pleskit host with sites, its fixture key taken back and its trial over.
function expired(seed = 3, sites = 6) {
  const s = withServer(newGame(seed));
  s.hour = hourOf(new Date(Date.UTC(2012, 0, 1)));
  const host = panelServer(s, "dev3", "pleskit"), m = panelMachine(cluster(s, host))!;
  const ids = Array.from({ length: sites }, (_, i) => ok(provisionService(s, addCustomer(s, `Customer ${i}`, "hobbyDev"), "webHosting", { label: `site${i}.de`, spec: sizeSpec("webHosting", 0, 2005), clusterId: host })));
  releaseKey(s, assignedKey(s, m, "pleskit")!.id);
  s.trials = [...s.trials, { machineId: m, product: "pleskit", until: s.hour - 1 }];
  return { s, host, m, ids };
}
const open = (s: GameState) => s.tickets.filter((t) => t.topic === "licence" && !isFinal(t));
const days = (s: GameState, n: number) => { for (let i = 0; i < n; i++) { s.hour += 24; webpanelTick(s); } };

describe("panel licence setup", () => {
  it("asks a freshly installed licensed panel for setup and closes it once licensed", () => {
    const s = withServer(newGame(1));
    const host = panelServer(s, "dev3", "pleskit");
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, panel: null, switching: { kind: "panel", to: "pleskit", doneAt: s.hour } } : c));
    tick(s);
    expect(cluster(s, host).setupPending).toBe(true);
    ok(finishPanelSetup(s, host));
    expect(cluster(s, host).setupPending).toBe(false);
  });

  it("refuses to finish setup without a licence and finishes after a key is entered", () => {
    const { s, host, m } = expired(5, 0);
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, setupPending: true } : c));
    expect((finishPanelSetup(s, host) as { error?: string }).error).toBe("error.licenceExpired");
    ok(activateLicence(s, m, "pleskit", issueKey(s, "pleskit", null).key));
    ok(finishPanelSetup(s, host));
  });

  it("locks an expired panel, keeps its sites up and draws tickets until a key is entered", () => {
    const { s, host, m, ids } = expired();
    s.hour -= s.hour % 24;
    expect(panelLocked(s, cluster(s, host))).toBe(true);
    expect(ids.every((id) => serviceOnline(s, id))).toBe(true);
    days(s, 10);
    expect(open(s).length).toBeGreaterThan(0);
    expect(new Set(open(s).map((t) => t.serviceId)).size).toBe(open(s).length);
    ok(activateLicence(s, m, "pleskit", issueKey(s, "pleskit", null).key));
    expect(panelLocked(s, cluster(s, host))).toBe(false);
    const before = s.tickets.length;
    days(s, 10);
    expect(open(s)).toHaveLength(0);
    expect(s.tickets.length).toBe(before);
  });

  it("leaves panels from older saves set up", () => {
    const s = withServer(newGame(2));
    const host = panelServer(s, "dev3", "pleskit");
    const raw = JSON.parse(serialize(s));
    delete raw.clusters.find((c: { id: string }) => c.id === host).setupPending;
    expect(deserialize(JSON.stringify(raw)).clusters.find((c) => c.id === host)!.setupPending).toBeFalsy();
  });
});
