import { describe, expect, it } from "vitest";
import { hourOf, isMonthStart } from "../src/sim/00-core/time";
import { listingById, rentFor } from "../src/sim/20-world/properties";
import { registrarTick } from "../src/sim/30-customers/registrar";
import { openAccount } from "../src/sim/46-finance/bank";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { announceBlock, buyBlock, joinLir } from "../src/sim/90-actions/addresses";
import { orderProviderCable } from "../src/sim/90-actions/connectivity";
import { addLocation } from "../src/sim/90-actions/hardware";
import { joinExchange, registerAsn } from "../src/sim/90-actions/network";
import { buyBuilding, freeSections, giveNotice, refitSection, rentSection } from "../src/sim/90-actions/properties";
import { signRegistrar } from "../src/sim/90-actions/registrar";
import { planTraining, postJobAd } from "../src/sim/90-actions/staff";
import { freeFloor, hire, newGame } from "./fixtures";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
const bank = (s: GameState) => { s.bank = { ...openAccount(s, "sparklasse"), welcomed: true }; return s; };
const game = (seed = 3) => { const s = newGame(seed); s.cash = 2_000_000; s.hour = at(2005, 3, 10, 10); return s; };
const first = (s: GameState, id = "gallushof") => freeSections(s, listingById(id)!)[0];
const last = (s: GameState) => s.payables.at(-1)!;
const keys = (s: GameState) => last(s).lines.map((l) => l.key);

describe("properties", () => {
  it("rents with a deposit that is one landlord receipt in cash and an open invoice after a bank", () => {
    const s = game(), rent = rentFor(listingById("gallushof")!, 2005), cash = s.cash;
    ok(rentSection(s, "gallushof", first(s)));
    expect(last(s)).toMatchObject({ supplier: "landlord", method: "cash", doc: "receipt", paidAt: s.hour });
    expect(keys(s)).toEqual(["ledger.officeDeposit"]);
    expect(s.cash).toBe(cash - 3 * rent);
    expect(s.ledger.filter((e) => e.key === "ledger.officeDeposit")).toHaveLength(1);

    const b = bank(game());
    ok(rentSection(b, "gallushof", first(b)));
    expect(last(b)).toMatchObject({ method: "transfer", doc: "invoice", paidAt: null });
    expect(b.cash).toBe(2_000_000);
  });

  it("refuses cash once a bank exists and creates nothing", () => {
    const s = bank(game());
    expect(rentSection(s, "gallushof", first(s), "cash")).toEqual({ ok: false, error: "error.noCash" });
    expect(s.payables).toHaveLength(0);
    expect(s.properties.map((p) => p.kind)).toEqual(["basement"]);
  });

  it("buys a building as one invoice and returns the deposit as a credit", () => {
    for (const banked of [false, true]) {
      const s = banked ? bank(game()) : game();
      ok(rentSection(s, "gallushof", first(s)));
      const before = s.payables.length;
      ok(buyBuilding(s, "gallushof"));
      const made = s.payables.slice(before);
      expect(made.map((p) => p.doc)).toContain("credit");
      expect(made.flatMap((p) => p.lines.map((l) => l.key)).sort()).toEqual(["ledger.buildingBought", "ledger.officeDepositBack"]);
      const order = made.find((p) => p.lines[0].key === "ledger.buildingBought")!;
      expect(order).toMatchObject({ supplier: "landlord", method: banked ? "transfer" : "cash", doc: banked ? "invoice" : "receipt" });
    }
  });

  it("books a refit and the lease end deposit as landlord documents", () => {
    const s = game();
    const id = ok(rentSection(s, "gallushof", first(s)));
    const x = s.properties.find((p) => p.id === id)!.sections[0].id;
    ok(refitSection(s, id, x, "closet"));
    expect(last(s)).toMatchObject({ supplier: "landlord", method: "cash", doc: "receipt" });
    expect(keys(s)).toEqual(["ledger.refit"]);

    ok(giveNotice(s, id));
    for (const m of [4, 5, 6, 7, 8]) { s.hour = at(2005, m) - 1; tick(s); }
    const back = s.payables.find((p) => p.lines[0].key === "ledger.officeDepositBack")!;
    expect(back).toMatchObject({ supplier: "landlord", doc: "credit", paidAt: expect.any(Number) });
    expect(back.amount).toBeLessThan(0);
  });
});

describe("network and addresses", () => {
  const net = (seed = 1) => { const s = newGame(seed); s.cash = 1e6; s.unlocks = ["network"]; return s; };

  it("pays the AS number and the exchange join by method", () => {
    const s = net();
    ok(registerAsn(s));
    expect(last(s)).toMatchObject({ supplier: "network", method: "cash", doc: "receipt" });
    ok(joinExchange(s, "dekicks"));
    expect(keys(s)).toEqual(["ledger.exchangeJoin"]);
    expect(s.payables).toHaveLength(2);

    const b = bank(net(2));
    expect(registerAsn(b, "cash")).toEqual({ ok: false, error: "error.noCash" });
    expect(b.network.asn).toBeFalsy();
    ok(registerAsn(b));
    expect(last(b)).toMatchObject({ method: "transfer", doc: "invoice", paidAt: null });
  });

  it("pays the LIR signup, a block and the provider routing", () => {
    const s = net();
    const loc = ok(addLocation(s, "equinox-fr5", "cage", 4));
    ok(joinLir(s));
    expect(keys(s)).toEqual(["ledger.lirSignup"]);
    ok(buyBlock(s));
    expect(keys(s)).toEqual(["ledger.blockBought"]);
    s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 }));
    ok(announceBlock(s, s.ips.blocks[0].id, loc, true));
    expect(keys(s)).toEqual(["ledger.providerRouting"]);
    expect(s.payables).toHaveLength(3);
    expect(s.payables.every((p) => p.method === "cash" && p.doc === "receipt")).toBe(true);
    const poor = net();
    ok(addLocation(poor, "equinox-fr5", "cage", 4));
    poor.cash = 1;
    expect(joinLir(poor)).toEqual({ ok: false, error: "error.noCash" });
  });

  it("bills a provider cable when it is installed", () => {
    const s = freeFloor({ ...newGame(1), cash: 1e7 });
    s.hour = at(2010, 1, 1, 9);
    s.unlocks = ["network"];
    const locs = [ok(addLocation(s, "equinox-fr5", "share", 8)), ok(addLocation(s, "equinox-fr5", "share", 8))];
    s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 }));
    const racks = locs.map((id) => s.racks.find((r) => r.locationId === id)!);
    const cash = s.cash;
    ok(orderProviderCable(s, racks[0].id, 0, racks[1].id, 0));
    expect(s.payables).toHaveLength(0);
    while (!s.payables.length) tick(s);
    expect(last(s)).toMatchObject({ supplier: "network", method: "cash", doc: "receipt" });
    expect(keys(s)).toEqual(["ledger.providerCable"]);
    expect(s.cash).toBeLessThan(cash);
  });
});

describe("staff and registrar", () => {
  it("pays a job ad as one services document and refuses cash after a bank", () => {
    const s = newGame(4);
    s.cash = 5000;
    ok(postJobAd(s, "support", "standard"));
    expect(last(s)).toMatchObject({ supplier: "services", method: "cash", doc: "receipt" });
    expect(keys(s)).toEqual(["ledger.jobAd"]);
    const b = bank(newGame(4));
    expect(postJobAd(b, "support", "standard", "cash")).toEqual({ ok: false, error: "error.noCash" });
    expect(b.candidates).toEqual(newGame(4).candidates);
    ok(postJobAd(b, "support", "standard"));
    expect(last(b)).toMatchObject({ method: "transfer", doc: "invoice" });
  });

  it("pays a course fee as a services document", () => {
    const s = newGame(6);
    s.cash = 2000;
    const c = visibleCandidates(s).find((x) => x.role === "support")!;
    ok(hire(s, c.id));
    ok(planTraining(s, s.staff[0].id, ["howTo"]));
    expect(last(s)).toMatchObject({ supplier: "services", method: "cash", doc: "receipt" });
    expect(keys(s)).toEqual(["ledger.training"]);
  });

  it("pays the registrar's month in cash with one receipt before a bank", () => {
    const s = newGame(7);
    s.cash = 1e5;
    s.hour = at(2005, 3, 10);
    ok(signRegistrar(s, "goDuddy"));
    let h = s.hour;
    while (!isMonthStart(h)) h++;
    s.hour = h;
    const cash = s.cash;
    registrarTick(s);
    expect(s.payables).toHaveLength(1);
    expect(last(s)).toMatchObject({ supplier: "registrar", method: "cash", doc: "receipt" });
    expect(keys(s)).toContain("ledger.registrar");
    expect(s.cash).toBeCloseTo(cash + last(s).lines.reduce((n, e) => n + e.amount, 0), 2);
  });
});
