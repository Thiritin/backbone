import { describe, expect, it } from "vitest";
import { orderFlyers } from "../src/sim/90-actions/marketing";
import { hourOf, isMonthStart } from "../src/sim/00-core/time";
import { BOOKS_VENDORS } from "../src/sim/10-catalog/bookkeeping";
import { openAccount } from "../src/sim/46-finance/bank";
import { deskOf } from "../src/sim/10-catalog/desks";
import { HOSTTOAST } from "../src/sim/10-catalog/hosttoast";
import { openDesk } from "../src/sim/40-support/desk";
import { billDeskAi } from "../src/sim/40-support/desk-ai";
import type { GameState } from "../src/sim/50-state";
import { AGENCY_TITLE } from "../src/sim/80-business/browser";
import { bill } from "../src/sim/80-business/bookkeeping";
import { hosttoastTick } from "../src/sim/80-business/hosttoast";
import { mailTick } from "../src/sim/80-business/mail";
import { marketingTick } from "../src/sim/80-business/marketing";
import { addLocation } from "../src/sim/90-actions/hardware";
import { fitAtx } from "../src/sim/90-actions/remote";
import { travelTo, TRAVEL_VENDOR } from "../src/sim/90-actions/travel";
import { redesign } from "../src/sim/90-actions/website";
import { mailsAbout, newGame, readyGame, registered } from "./fixtures";

const bank = (s: GameState) => { s.bank = { ...openAccount(s, "sparklasse"), welcomed: true }; return s; };
const toMonthStart = (s: GameState) => { do s.hour++; while (!isMonthStart(s.hour)); };

// Runs one purchase before and after a bank exists and checks the one document, the books and the cash refusal.
function actionPaths(make: () => GameState, run: (s: GameState, method?: "cash" | "transfer") => { ok: boolean; error?: string }, key: string, name: string) {
  const s = make(), cash = s.cash;
  expect(run(s).ok).toBe(true);
  expect(s.payables).toHaveLength(1);
  expect(s.payables[0]).toMatchObject({ method: "cash", doc: "receipt", name, paidAt: s.hour });
  expect(s.ledger.at(-1)).toMatchObject({ key });
  expect(s.cash).toBe(cash + s.ledger.at(-1)!.amount);
  expect(mailsAbout(s, "receipt")).toHaveLength(1);

  const b = bank(make()), before = b.cash;
  expect(run(b, "cash")).toMatchObject({ ok: false, error: "error.noCash" });
  expect(b.payables).toHaveLength(0);
  expect(run(b).ok).toBe(true);
  expect(b.payables).toHaveLength(1);
  expect(b.payables[0]).toMatchObject({ method: "transfer", doc: "invoice", name, paidAt: null });
  expect(b.cash).toBe(before);
  expect(mailsAbout(b, "invoice")).toHaveLength(1);
}

describe("player vendor spends leave one payable", () => {
  it("web design redesign", () => {
    const make = () => { const s = readyGame(1); s.cash = 100000; s.marketing = { ...s.marketing, owned: ["website"] }; return s; };
    actionPaths(make, (s, m) => redesign(s, m), "ledger.redesign", AGENCY_TITLE);
  });

  it("ATX adapter", () => {
    actionPaths(() => readyGame(1), (s, m) => fitAtx(s, "dev3", m), "ledger.atxAdapter", "Alternatte");
  });

  it("trip to a rented location", () => {
    const make = () => {
      const s: GameState = { ...newGame(1), cash: 100_000 };
      const r = addLocation(s, "interaction-fra", "cage", 4);
      if (!r.ok) throw new Error(r.error);
      s.hour = s.locations.find((l) => l.id === r.id)!.readyAt;
      s.payables = [];
      s.mail.msgs = {};
      return s;
    };
    const loc = (s: GameState) => s.locations.at(-1)!.id;
    actionPaths(make, (s, m) => travelTo(s, loc(s), m), "ledger.drive", TRAVEL_VENDOR);
  });

  it("keeps the fee out of the books when the order is refused", () => {
    const s = bank(readyGame(1));
    const lines = s.ledger.length;
    expect(fitAtx(s, "dev3", "cash")).toMatchObject({ ok: false, error: "error.noCash" });
    expect(s.ledger).toHaveLength(lines);
    expect(s.devices.find((d) => d.id === "dev3")!.atx).toBeFalsy();
  });
});

describe("automatic vendor spends leave one payable", () => {
  const same = (s: GameState, key: string, name: string, bankd: boolean) => {
    expect(s.payables).toHaveLength(1);
    expect(s.payables[0]).toMatchObject(bankd ? { method: "transfer", doc: "invoice", paidAt: null, name } : { method: "cash", doc: "receipt", name });
    expect(s.payables[0].lines.map((l) => l.key)).toContain(key);
    expect(s.ledger.some((l) => l.key === key)).toBe(!bankd);
  };

  for (const bankd of [false, true]) {
    const tag = bankd ? "with a bank" : "without a bank";

    it(`bills the marketing month ${tag}`, () => {
      const s = readyGame(2);
      s.marketing = { ...s.marketing, owned: ["website"] };
      if (bankd) bank(s);
      s.payables = [];
      const cash = s.cash;
      toMonthStart(s);
      marketingTick(s);
      same(s, "ledger.marketingUpkeep", AGENCY_TITLE, bankd);
      expect(s.cash).toBeCloseTo(bankd ? cash : cash - s.payables[0].amount);
    });

    it(`bills the company mail ${tag}`, () => {
      const s = readyGame(2);
      if (bankd) bank(s);
      s.payables = [];
      toMonthStart(s);
      mailTick(s);
      same(s, "ledger.companyMail", "Hosted Exchange by Ionose", bankd);
    });

    it(`bills the HostToast fee ${tag}`, () => {
      const s = newGame(5);
      s.hosttoast = { ...s.hosttoast, tier: "premium", uptime: [1, 1, 1] };
      s.hour = hourOf(new Date(Date.UTC(2006, 3, 1)));
      if (bankd) bank(s);
      s.payables = [];
      hosttoastTick(s);
      same(s, "ledger.hosttoast", HOSTTOAST, bankd);
    });

    it(`bills the books program ${tag}`, () => {
      const s = newGame(3), v = BOOKS_VENDORS[0];
      if (bankd) bank(s);
      s.payables = [];
      const cash = s.cash;
      bill(s, v, "ledger.booksMonthly", 20);
      expect(s.payables).toHaveLength(1);
      expect(s.payables[0]).toMatchObject(bankd ? { method: "transfer", paidAt: null } : { method: "cash", doc: "receipt" });
      expect(s.cash).toBe(bankd ? cash : cash - 20);
      expect(s.payables[0].lines[0]).toMatchObject({ category: "licenses", key: "ledger.booksMonthly" });
    });

    it(`bills the desk AI ${tag}`, () => {
      const s = registered({ ...newGame(5), hour: hourOf(new Date(Date.UTC(2019, 0, 3, 10))), cash: 1e6 });
      openDesk(s, "freshdusk", { kind: "hosted" }, "pxl");
      s.desk!.ai.solved = 4;
      if (bankd) bank(s);
      s.payables = [];
      billDeskAi(s);
      same(s, "ledger.answerBot", deskOf(s)!.name, bankd);
    });
  }
});

describe("marketing orders", () => {
  it("leaves one cash receipt for flyers before a bank and refuses cash after one", () => {
    const s = newGame(3);
    s.locations = [{ ...s.locations[0], city: "Berlin" }];
    const cash = s.cash, r = orderFlyers(s, "Berlin", 1000);
    if (!r.ok) throw new Error(r.error);
    expect(s.payables.at(-1)).toMatchObject({ method: "cash", doc: "receipt" });
    expect(s.cash).toBeLessThan(cash);
    s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
    const n = s.payables.length;
    expect(orderFlyers(s, "Berlin", 1000, "cash")).toMatchObject({ ok: false, error: "error.noCash" });
    expect(s.payables).toHaveLength(n);
  });
});
