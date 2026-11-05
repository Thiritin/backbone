// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { listingById } from "../src/sim/20-world/properties";
import { POST_APP, lettersTick } from "../src/sim/40-support/letters";
import { openAccount } from "../src/sim/46-finance/bank";
import { billDirect, UTILITY } from "../src/sim/46-finance/payables";
import type { GameState } from "../src/sim/50-state";
import { addLocation, type ColoOrder } from "../src/sim/90-actions/hardware";
import { freeSections, rentSection } from "../src/sim/90-actions/properties";
import { travelTo, TRAVEL_VENDOR } from "../src/sim/90-actions/travel";
import { SupplierInvoice } from "../src/ui/apps/preview/SupplierInvoice";
import { freeFloor, mailsAbout, newGame } from "./fixtures";

afterEach(cleanup);
const banked = (s: GameState, cash = 20_000): GameState => {
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.cash = cash;
  return s;
};
const order = (kind: "onAccount" | "card" | "transfer"): ColoOrder => ({ company: "A GmbH", name: "Tin Becker", address: { street: "Hauptstr. 1", zip: "60311", city: "Frankfurt" }, payment: { kind } });

describe("colo order", () => {
  it("takes an order on account with no cash and shows the VAT amount on its invoice", () => {
    const s = banked(freeFloor(newGame(2)), 0);
    s.hour += 5 * 24;
    expect(addLocation(s, "hetzler-park", "share", 1, order("onAccount")).ok).toBe(true);
    const inv = s.payables.find((p) => p.doc === "invoice")!;
    expect(inv).toMatchObject({ supplier: "datacenter", method: "onAccount", paidAt: null });
    const { container } = render(<SupplierInvoice game={s} p={inv} />);
    expect(container.querySelector(".inv-sum")?.textContent).toMatch(/VAT 16%\d+\.\d\d/);
  });

  it("refuses the card before one is ready and leaves no location behind", () => {
    const s = banked(freeFloor(newGame(2)));
    s.hour += 5 * 24;
    const n = s.locations.length;
    expect(addLocation(s, "hetzler-park", "share", 1, order("card"))).toEqual({ ok: false, error: "error.noCard" });
    expect(s.locations).toHaveLength(n);
    expect(addLocation(s, "hetzler-park", "share", 1, order("transfer")).ok).toBe(true);
    expect(s.payables.at(-1)).toMatchObject({ method: "transfer", doc: "invoice" });
  });

  it("still needs the month in cash before a bank", () => {
    const s = freeFloor(newGame(2));
    s.cash = 0;
    expect(addLocation(s, "hetzler-park", "share", 1, order("onAccount"))).toEqual({ ok: false, error: "error.noCash" });
  });
});

describe("issuers", () => {
  it("names pre-bank direct bills after the utility, the line provider and the datacenter", () => {
    const s = newGame(4), h = s.hour;
    billDirect(s, [
      { hour: h, category: "power", key: "ledger.power", params: {}, amount: -10 },
      { hour: h, category: "rent", key: "ledger.homeLine", params: { line: "DSL 1000", isp: "Telefonika" }, amount: -20 },
      { hour: h, category: "rent", key: "ledger.space", params: { location: "x", dc: "hetzler-park" }, amount: -30 },
    ]);
    expect(s.payables.map((p) => p.name)).toEqual([UTILITY, "Telefonika", "Hetzler Park"]);
  });

  it("issues travel documents from the travel vendor", () => {
    const s = freeFloor(newGame(2));
    s.cash = 1_000_000;
    const r = addLocation(s, "hetzler-park", "share", 1), id = r.ok ? r.id! : "";
    s.locations.find((l) => l.id === id)!.readyAt = s.hour;
    expect(travelTo(s, id).ok).toBe(true);
    expect(s.payables.at(-1)).toMatchObject({ supplier: "services", name: TRAVEL_VENDOR });
  });
});

describe("landlord post", () => {
  it("sends the deposit on paper with the next morning post", () => {
    const s = newGame(3);
    s.cash = 2_000_000;
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
    expect(rentSection(s, "gallushof", freeSections(s, listingById("gallushof")!)[0]).ok).toBe(true);
    const p = s.payables.at(-1)!, l = s.letters.at(-1)!;
    expect(p).toMatchObject({ supplier: "landlord", doc: "receipt" });
    expect(l).toMatchObject({ from: "Engel & Vogel", topic: "landlordDoc", payable: p.id, arrived: false });
    expect(mailsAbout(s, "receipt")).toHaveLength(0);
    s.hour = l.at;
    lettersTick(s);
    expect(l.arrived).toBe(true);
    expect(s.installed).toContain(POST_APP);
    expect(s.payables.filter((x) => x.supplier === "landlord")).toHaveLength(1);
  });
});
