import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { clusterDefaults } from "../src/sim/60-infra/cluster";
import { productsTick } from "../src/sim/85-products/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setLicenceTier } from "../src/sim/90-actions/licence";
import { updateSoftware } from "../src/sim/90-actions/software";
import { panelVm, readyGame } from "./fixtures";

const MONTH = hourOf(new Date(Date.UTC(2006, 0, 1)));

function setup(tier: string, extra: object = {}) {
  const s = readyGame(1);
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic");
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, licence: { tier, trialUntil: null, lapsedAt: null, ...extra } } : c));
  s.hour = MONTH;
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const host = () => s.clusters.find((c) => c.id === id)!;
  const add = (label: string) => provisionService(s, cus, "webHosting", { label, clusterId: id });
  const fees = () => s.ledger.filter((l) => l.key === "ledger.license" && l.params.cluster === host().name);
  return { s, id, host, add, fees };
}

describe("licence tiers", () => {
  it("bills the tier fee on the ledger", () => {
    const { s, fees } = setup("pro");
    productsTick(s);
    expect(fees().map((l) => l.amount)).toEqual([-10]);
  });

  it("blocks accounts above the cap", () => {
    const { add } = setup("solo");
    expect(add("a.com").ok).toBe(true);
    expect(add("b.com")).toEqual({ ok: false, error: "error.licenceCap" });
  });

  it("refuses a tier below the account count", () => {
    const { s, id, add } = setup("pro");
    add("a.com"); add("b.com");
    expect(setLicenceTier(s, id, "solo")).toEqual({ ok: false, error: "error.licenceCap" });
    expect(setLicenceTier(s, id, "admin").ok).toBe(true);
  });

  it("blocks new accounts and updates once the trial ends, until a tier is bought", () => {
    const { s, id, host, add } = setup("premier", { trialUntil: MONTH + 10 });
    expect(add("a.com").ok).toBe(true);
    s.hour += 11;
    expect(add("b.com")).toEqual({ ok: false, error: "error.licenceExpired" });
    host().version = 2000;
    expect(updateSoftware(s, id)).toEqual({ ok: false, error: "error.licenceExpired" });
    expect(setLicenceTier(s, id, "pro").ok).toBe(true);
    expect(add("b.com").ok).toBe(true);
  });

  it("lapses on empty cash and recovers within seven days", () => {
    const { s, host, add } = setup("pro");
    s.cash = 0;
    productsTick(s);
    expect(host().licence!.lapsedAt).toBe(MONTH);
    expect(add("a.com")).toEqual({ ok: false, error: "error.licenceExpired" });
    s.cash = 100; s.hour += 1;
    productsTick(s);
    expect(host().licence!.lapsedAt).toBeNull();
    expect(add("a.com").ok).toBe(true);
  });

  it("stays lapsed after seven days", () => {
    const { s, id, host } = setup("pro");
    s.cash = 0;
    productsTick(s);
    s.cash = 100; s.hour += 8 * 24;
    productsTick(s);
    expect(host().licence!.lapsedAt).toBe(MONTH);
    expect(setLicenceTier(s, id, "pro").ok).toBe(true);
    expect(host().licence!.lapsedAt).toBeNull();
    expect(s.cash).toBe(90);
  });

  it("starts a new install on a 30 day trial", () => {
    const { s, id, host } = setup("pro");
    s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, panel: null, licence: undefined, switching: { kind: "panel", to: "cpanic", doneAt: MONTH } } : c));
    productsTick(s);
    expect(host().licence).toEqual({ tier: "premier", trialUntil: MONTH + 30 * 24, lapsedAt: null });
  });

  it("gives an old save the top tier with no expiry", () => {
    const c = clusterDefaults({ nodes: [], panel: "cpanic" });
    expect(c.licence).toEqual({ tier: "premier", trialUntil: null, lapsedAt: null });
    expect(clusterDefaults({ nodes: [], panel: "freepanel" }).licence).toBeUndefined();
  });
});
