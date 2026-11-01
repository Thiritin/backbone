import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { LAPSE_GRACE_DAYS } from "../src/sim/10-catalog/licence-tiers";
import { assignKey, issueKey, monthAfter, panelKey, panelMachine, updateKey } from "../src/sim/60-infra/licence";
import { productsTick } from "../src/sim/85-products/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setLicenceTier } from "../src/sim/90-actions/licence";
import { updateSoftware } from "../src/sim/90-actions/software";
import { panelVm, readyGame } from "./fixtures";

const MONTH = hourOf(new Date(Date.UTC(2020, 0, 1)));

// A cPanic VM on the given tier's key, or on a trial until trialUntil without one.
function setup(tier: string, trialUntil?: number) {
  const s = readyGame(1);
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic");
  const vm = panelMachine(s.clusters.find((c) => c.id === id)!)!;
  s.licenses = s.licenses.filter((k) => k.machineId !== vm);
  s.hour = MONTH;
  if (trialUntil === undefined) assignKey(s, issueKey(s, "cpanic", tier).id, vm);
  else s.trials = [{ machineId: vm, product: "cpanic", until: trialUntil }];
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const host = () => s.clusters.find((c) => c.id === id)!;
  const add = (label: string) => provisionService(s, cus, "webHosting", { label, clusterId: id });
  const fees = () => s.ledger.filter((l) => l.key === "ledger.licenceRenewal").map((l) => l.amount);
  const mails = (topic: string) => s.tickets.filter((x) => x.kind === "mail" && x.topic === topic);
  return { s, id, vm, host, add, fees, mails, key: () => panelKey(s, host()) };
}

describe("licence tiers", () => {
  it("renews a key on the day it was bought, a line per key and a receipt per product", () => {
    const { s, fees, mails, key } = setup("pro");
    const renews = monthAfter(MONTH);
    expect(key()!.renewsAt).toBe(renews);
    s.hour = renews - 1;
    productsTick(s);
    expect(fees()).toEqual([]);
    s.hour = renews;
    productsTick(s);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.licenceRenewal", params: { name: "cPanic", key: key()!.key }, amount: -10 });
    expect(key()).toMatchObject({ renewsAt: monthAfter(renews), covers: { kind: "term", until: monthAfter(renews) }, lapsedAt: null });
    expect(mails("licenceRenewed").map((m) => m.mail!.params)).toEqual([{ name: "cPanic", count: 1, amount: 10 }]);
    s.hour++;
    productsTick(s);
    expect(fees()).toEqual([-10]);
  });

  it("bills Premier per account and an unassigned key for one", () => {
    const { s, add, fees, mails, key } = setup("premier");
    add("a.com"); add("b.com"); add("c.com");
    const spare = issueKey(s, "cpanic", "premier");
    s.hour = key()!.renewsAt!;
    productsTick(s);
    expect(fees()).toEqual([-1.2, -0.4]);
    expect(mails("licenceRenewed").map((m) => m.mail!.params)).toEqual([{ name: "cPanic", count: 2, amount: 1.6 }]);
    expect(s.licenses.find((k) => k.id === spare.id)!.renewsAt).toBe(monthAfter(s.hour));
  });

  it("runs a cancelled key to the end of its term without billing it", () => {
    const { s, fees, key } = setup("pro");
    updateKey(s, key()!.id, { renewsAt: null });
    s.hour = monthAfter(MONTH);
    productsTick(s);
    expect(fees()).toEqual([]);
    expect(key()!.lapsedAt).toBe(s.hour);
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

  it("keeps running through the grace days and pays late on the original day", () => {
    const { s, key, add, fees } = setup("pro");
    const renews = monthAfter(MONTH);
    s.cash = 0; s.hour = renews;
    productsTick(s);
    expect(key()).toMatchObject({ renewsAt: renews, lapsedAt: null });
    expect(add("a.com").ok).toBe(true);
    s.cash = 100; s.hour += 2 * 24;
    productsTick(s);
    expect(fees()).toEqual([-10]);
    expect(key()!.renewsAt).toBe(monthAfter(renews));
  });

  it("lapses after the grace days and renews from the day it is paid", () => {
    const { s, key, add, mails } = setup("pro");
    s.cash = 0; s.hour = monthAfter(MONTH) + LAPSE_GRACE_DAYS * 24;
    productsTick(s);
    expect(key()!.lapsedAt).toBe(s.hour);
    expect(mails("licenceLapsed").map((m) => m.mail!.params)).toEqual([{ name: "cPanic", key: key()!.key }]);
    expect(add("a.com")).toEqual({ ok: false, error: "error.licenceExpired" });
    s.cash = 100; s.hour += 30 * 24;
    productsTick(s);
    expect(key()).toMatchObject({ lapsedAt: null, renewsAt: monthAfter(s.hour) });
    expect(s.cash).toBe(90);
    expect(add("a.com").ok).toBe(true);
  });

  it("buying a tier after a lapse pays a month from that day", () => {
    const { s, id, key } = setup("pro");
    s.cash = 0; s.hour = monthAfter(MONTH) + LAPSE_GRACE_DAYS * 24;
    productsTick(s);
    s.cash = 100; s.hour++;
    expect(setLicenceTier(s, id, "pro").ok).toBe(true);
    expect(key()).toMatchObject({ lapsedAt: null, renewsAt: monthAfter(s.hour) });
    productsTick(s);
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
