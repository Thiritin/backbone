import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { assignKey, issueKey, panelKey, panelMachine } from "../src/sim/60-infra/licence";
import { productsTick } from "../src/sim/85-products/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setLicenceTier } from "../src/sim/90-actions/licence";
import { updateSoftware } from "../src/sim/90-actions/software";
import { panelVm, readyGame } from "./fixtures";

const MONTH = hourOf(new Date(Date.UTC(2006, 0, 1)));

// A cPanic VM on the given tier's key, or on a trial until trialUntil without one.
function setup(tier: string, trialUntil?: number) {
  const s = readyGame(1);
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic");
  const vm = panelMachine(s.clusters.find((c) => c.id === id)!)!;
  s.licenses = s.licenses.filter((k) => k.machineId !== vm);
  if (trialUntil === undefined) assignKey(s, issueKey(s, "cpanic", tier).id, vm);
  else s.trials = [{ machineId: vm, product: "cpanic", until: trialUntil }];
  s.hour = MONTH;
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const host = () => s.clusters.find((c) => c.id === id)!;
  const add = (label: string) => provisionService(s, cus, "webHosting", { label, clusterId: id });
  const fees = () => s.ledger.filter((l) => l.key === "ledger.license" && l.params.cluster === host().name);
  return { s, id, vm, host, add, fees, key: () => panelKey(s, host()) };
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
    const { s, id, host, add } = setup("premier", MONTH + 10);
    expect(add("a.com").ok).toBe(true);
    s.hour += 11;
    expect(add("b.com")).toEqual({ ok: false, error: "error.licenceExpired" });
    host().version = 2000;
    expect(updateSoftware(s, id)).toEqual({ ok: false, error: "error.licenceExpired" });
    expect(setLicenceTier(s, id, "pro").ok).toBe(true);
    expect(add("b.com").ok).toBe(true);
  });

  it("lapses on empty cash and recovers within seven days", () => {
    const { s, key, add } = setup("pro");
    s.cash = 0;
    productsTick(s);
    expect(key()!.lapsedAt).toBe(MONTH);
    expect(add("a.com")).toEqual({ ok: false, error: "error.licenceExpired" });
    s.cash = 100; s.hour += 1;
    productsTick(s);
    expect(key()!.lapsedAt).toBeNull();
    expect(add("a.com").ok).toBe(true);
  });

  it("stays lapsed after seven days", () => {
    const { s, id, key } = setup("pro");
    s.cash = 0;
    productsTick(s);
    s.cash = 100; s.hour += 8 * 24;
    productsTick(s);
    expect(key()!.lapsedAt).toBe(MONTH);
    expect(setLicenceTier(s, id, "pro").ok).toBe(true);
    expect(key()!.lapsedAt).toBeNull();
    expect(s.cash).toBe(90);
  });

  it("starts a new install on a 15 day trial once per machine", () => {
    const { s, id, vm, host, add } = setup("pro", MONTH);
    s.licenses = [];
    const install = () => { s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, panel: null, switching: { kind: "panel", to: "cpanic", doneAt: s.hour } } : c)); productsTick(s); };
    s.trials = [];
    install();
    expect(s.trials).toEqual([{ machineId: vm, product: "cpanic", until: MONTH + 15 * 24 }]);
    expect(host().panel).toBe("cpanic");
    s.hour += 20 * 24;
    install();
    expect(s.trials).toEqual([{ machineId: vm, product: "cpanic", until: MONTH + 15 * 24 }]);
    expect(add("a.com")).toEqual({ ok: false, error: "error.licenceExpired" });
  });
});
